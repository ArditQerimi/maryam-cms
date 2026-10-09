import { randomUUID } from 'node:crypto';
import { and, eq, inArray } from 'drizzle-orm';
import {
  orderNotes,
  productVariants,
  products,
  sales,
  storefrontOrderDetails,
} from '@/db/schema-tenant';
import { foldSearchText } from '@/lib/search-text';
import type { StorefrontContext } from '@/lib/storefront/context';
import { isStorefrontError } from '@/lib/storefront/errors';
import { addCartItem } from '@/lib/storefront/cart';
import { loadCheckoutRuntimeConfig } from '@/lib/storefront/checkout-config';
import { placeStorefrontCheckout, CheckoutServiceError } from '@/lib/storefront/checkout-service';
import { CheckoutValidationError, parseCheckoutRequest } from '@/lib/storefront/checkout-validation';
import { loadActiveDiscounts, priceProduct } from '@/lib/storefront/pricing';
import { resolveShippingMethods } from '@/lib/storefront/shipping-quote';
import { DEFAULT_SHIPPING_COST } from '@/lib/storefront/shipping-defaults';
import { notifyNewOrder } from '@/lib/storefront/order-notify';
import { sendOrderEmail } from '@/lib/storefront/order-email';
import { orderPhases, type OrderPhase } from '@/lib/storefront/order-status';
import { allowRequest } from '@/lib/in-memory-rate-limit';
import type { LlmTool } from './llm';

export type AgentChannel = 'web' | 'telegram' | 'whatsapp';

/** How a channel is named in order notes and shop notifications. */
export function channelLabel(channel: AgentChannel) {
  return channel === 'telegram' ? 'Telegram' : channel === 'whatsapp' ? 'WhatsApp' : 'chat në faqe';
}

export type ToolEnv = {
  context: StorefrontContext;
  channel: AgentChannel;
  /** Stable id of the conversation (IP / Telegram chat) used for rate limits. */
  sessionKey: string;
  /** Telegram user's name / WhatsApp number, when known. */
  contactHint?: string;
  /** The customer's own phone number (WhatsApp), offered to the model as the order phone. */
  phone?: string;
};

type ToolResult = Record<string, unknown>;

const MAX_ORDER_LINES = 10;
const MAX_LINE_QUANTITY = 10;

export const TOOL_DECLARATIONS: LlmTool[] = [
  {
    name: 'search_products',
    description:
      'Kërko produkte në katalog sipas emrit/fjalëve kyçe (p.sh. "nektar", "libër për fëmijë"). Kthen id, çmim, stok dhe variantet. Përdore GJITHMONË para se të flasësh për një produkt, çmim ose stok.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Fjalët e kërkimit.' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_shop_info',
    description:
      'Informacion i dyqanit: emri, mënyra e pagesës, çmimi i dërgesës për një shtet (kodi 2-shkronjësh, p.sh. XK, AL, MK).',
    parameters: {
      type: 'object',
      properties: {
        country: { type: 'string', description: 'Kodi i shtetit me 2 shkronja, p.sh. XK.' },
      },
    },
  },
  {
    name: 'place_order',
    description:
      'Krijo porosinë. Thirre VETËM pasi klienti ka dhënë të gjitha të dhënat DHE ka konfirmuar shprehimisht përmbledhjen ("po", "konfirmo"). Çmimet i llogarit sistemi, jo ti.',
    parameters: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          description: 'Produktet e porositura.',
          items: {
            type: 'object',
            properties: {
              productId: { type: 'integer' },
              variantId: { type: 'integer', description: 'Id e variantit nga search_products.' },
              quantity: { type: 'integer', description: 'Sasia, 1 deri 10.' },
            },
            required: ['productId', 'variantId', 'quantity'],
          },
        },
        firstName: { type: 'string' },
        lastName: { type: 'string' },
        phone: { type: 'string', description: 'Numri i telefonit, p.sh. +38349123456.' },
        email: { type: 'string', description: 'Email për konfirmimin e porosisë.' },
        address: { type: 'string', description: 'Rruga dhe numri.' },
        city: { type: 'string' },
        country: { type: 'string', description: 'Kodi 2-shkronjësh; XK për Kosovën.' },
        postalCode: { type: 'string', description: 'Kodi postar, nëse e di klienti.' },
        couponCode: { type: 'string', description: 'Kodi i kuponit, nëse e ka.' },
        note: { type: 'string', description: 'Shënim i klientit për dyqanin.' },
      },
      required: ['items', 'firstName', 'lastName', 'phone', 'email', 'address', 'city'],
    },
  },
  {
    name: 'check_order',
    description:
      'Statusi i një porosie. Kërkon numrin e porosisë dhe telefonin me të cilin u bë; pa përputhje nuk jep asgjë.',
    parameters: {
      type: 'object',
      properties: {
        orderNumber: { type: 'string', description: 'Numri i porosisë, p.sh. SF-20260101-...' },
        phone: { type: 'string' },
      },
      required: ['orderNumber', 'phone'],
    },
  },
  {
    name: 'notify_shop',
    description:
      'Çdo gjë që nuk e zgjidh dot ti (ankesë, kthim, kërkesë e veçantë, klient i zemëruar, ose kërkon person): i dërgon dyqanit një mesazh me kontaktin e klientit që t\'i kthejë përgjigje njeriu.',
    parameters: {
      type: 'object',
      properties: {
        summary: { type: 'string', description: 'Përmbledhje e shkurtër e kërkesës.' },
        contact: { type: 'string', description: 'Telefoni ose emaili i klientit.' },
      },
      required: ['summary'],
    },
  },
];

function text(value: unknown, max: number) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

const STOP_WORDS = new Set([
  'per', 'për', 'keni', 'ka', 'kam', 'dua', 'deshiron', 'desha', 'nje', 'një', 'the', 'and', 'for',
  'çfarë', 'cfare', 'sa', 'si', 'ne', 'në', 'me', 'te', 'të', 'dhe', 'ose', 'jam', 'jeni', 'mund',
]);

function money(value: string | number) {
  return Number(value).toFixed(2);
}

async function searchProducts(env: ToolEnv, args: Record<string, unknown>): Promise<ToolResult> {
  const query = foldSearchText(text(args.query, 80));
  if (query.length < 2) return { products: [], note: 'Kërkimi është shumë i shkurtër.' };
  const { db } = env.context;

  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      sku: products.sku,
      price: products.price,
      stock: products.stockQuantity,
      categoryId: products.categoryId,
      description: products.description,
    })
    .from(products)
    .where(eq(products.status, 'Active'))
    .limit(2000);

  // Albanian words change their ending (teuhid / teuhidin / teuhidit): match on the stem, and rank
  // by how many words match (name counts double, description once).
  const words = query
    .split(' ')
    .filter((word) => word.length >= 3 && !STOP_WORDS.has(word))
    .map((word) => (word.length > 5 ? word.slice(0, word.length - 2) : word));
  if (words.length === 0) return { products: [], note: 'Shkruaj emrin e produktit ose një fjalë kyçe.' };
  const matches = rows
    .map((row) => {
      const name = foldSearchText(row.name);
      const rest = `${foldSearchText(row.sku ?? '')} ${foldSearchText(row.description ?? '')}`;
      let score = 0;
      for (const word of words) {
        if (name.includes(word)) score += 2;
        else if (rest.includes(word)) score += 1;
      }
      return score > 0 ? { row, score } : null;
    })
    .filter((entry): entry is { row: (typeof rows)[number]; score: number } => entry !== null)
    .sort((a, b) => b.score - a.score || a.row.name.length - b.row.name.length)
    .slice(0, 5)
    .map(({ row }) => row);
  if (matches.length === 0) return { products: [], note: 'Nuk u gjet asnjë produkt me këtë kërkim.' };

  const [variants, discounts] = await Promise.all([
    db
      .select({
        id: productVariants.id,
        productId: productVariants.productId,
        name: productVariants.name,
        price: productVariants.price,
      })
      .from(productVariants)
      .where(and(
        inArray(productVariants.productId, matches.map((row) => row.id)),
        eq(productVariants.status, 'Active'),
      )),
    loadActiveDiscounts(db),
  ]);

  return {
    products: matches.map((row) => {
      const own = variants.filter((variant) => variant.productId === row.id);
      const priced = own.map((variant) => {
        const sale = priceProduct(variant.price, row.id, row.categoryId, discounts).salePrice;
        // A zero list price means "no price set" in the catalog: never sell it through chat.
        return sale > 0
          ? { variantId: variant.id, name: variant.name, price: money(sale) }
          : { variantId: variant.id, name: variant.name, price: null, orderable: false };
      });
      const inStock = (row.stock ?? 0) > 0;
      return {
        productId: row.id,
        name: row.name,
        description: text(row.description, 110) || undefined,
        inStock,
        stockLeft: inStock ? Math.min(row.stock ?? 0, 20) : 0,
        variants: priced,
        link: `/home/products/${row.id}`,
      };
    }),
  };
}

async function getShopInfo(env: ToolEnv, args: Record<string, unknown>): Promise<ToolResult> {
  const country = (text(args.country, 2) || 'XK').toUpperCase();
  const { db, company } = env.context;
  let methods: Array<{ title: string; cost: string }> = [];
  try {
    const found = await resolveShippingMethods(db, company.id, { country }, 0);
    methods = (found ?? []).map((method) => ({ title: method.title, cost: money(method.cost) }));
  } catch {
    // Fall through to the default below.
  }
  return {
    shop: company.subdomain,
    payment: 'Pagesa me para në dorë (cash) kur e merr porosinë.',
    delivery: methods.length
      ? methods
      : [{ title: 'Dërgesa standarde', cost: money(DEFAULT_SHIPPING_COST) }],
    note: 'Totali përfundimtar llogaritet nga sistemi kur krijohet porosia.',
  };
}

function friendlyCheckoutError(error: unknown): string {
  if (error instanceof CheckoutValidationError) {
    const fields = Object.entries(error.fieldErrors).map(([field, message]) => `${field}: ${message}`);
    return `Të dhëna të pavlefshme (${fields.join('; ') || error.message}). Kërkoja klientit t'i korrigjojë.`;
  }
  if (error instanceof CheckoutServiceError) {
    return `${error.message} (${error.code})`;
  }
  if (isStorefrontError(error)) {
    if (error.code === 'insufficient-stock') return 'Stoku nuk mjafton për sasinë e kërkuar.';
    return `${error.message} (${error.code})`;
  }
  return 'Porosia nuk u krijua për shkak të një problemi teknik.';
}

async function placeOrder(env: ToolEnv, args: Record<string, unknown>): Promise<ToolResult> {
  if (!allowRequest(`agent-order:${env.sessionKey}`, 3, 60 * 60 * 1000)) {
    return { ok: false, error: 'Shumë porosi nga kjo bisedë. Ju lutem kontaktoni dyqanin.' };
  }

  const rawItems = Array.isArray(args.items) ? args.items : [];
  const lines: Array<{ productId: number; variantId: number; quantity: number }> = [];
  for (const raw of rawItems.slice(0, MAX_ORDER_LINES)) {
    const item = (raw ?? {}) as Record<string, unknown>;
    const productId = Number(item.productId);
    const variantId = Number(item.variantId);
    const quantity = Number(item.quantity);
    if (
      !Number.isSafeInteger(productId) || productId < 1
      || !Number.isSafeInteger(variantId) || variantId < 1
      || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > MAX_LINE_QUANTITY
    ) {
      return { ok: false, error: `Produkt ose sasi e pavlefshme (sasia lejohet 1-${MAX_LINE_QUANTITY}).` };
    }
    lines.push({ productId, variantId, quantity });
  }
  if (lines.length === 0) return { ok: false, error: 'Porosia nuk ka asnjë produkt.' };

  // Variants without a price are not sold through chat (the model never decides prices).
  const unpriced = await env.context.db
    .select({ id: productVariants.id, price: productVariants.price })
    .from(productVariants)
    .where(inArray(productVariants.id, lines.map((line) => line.variantId)));
  if (unpriced.length !== new Set(lines.map((line) => line.variantId)).size || unpriced.some((row) => Number(row.price) <= 0)) {
    return { ok: false, error: 'Një nga produktet nuk ka çmim të caktuar ose nuk ekziston; kërkoji klientit të kontaktojë dyqanin për të.' };
  }

  const country = (text(args.country, 2) || 'XK').toUpperCase();
  const address = {
    firstName: text(args.firstName, 100),
    lastName: text(args.lastName, 100),
    company: '',
    address1: text(args.address, 200),
    address2: '',
    country,
    city: text(args.city, 100),
    region: '',
    postalCode: text(args.postalCode, 24) || '00000',
  };
  const note = text(args.note, 700);
  const coupon = text(args.couponCode, 64).toUpperCase();

  let request;
  try {
    request = parseCheckoutRequest({
      contact: { email: text(args.email, 254), phone: text(args.phone, 32), marketingOptIn: false },
      shippingAddress: address,
      billing: { sameAsShipping: true, address },
      delivery: { methodId: 'standard' },
      payment: { methodId: 'cash_on_delivery' },
      promotionCode: coupon || null,
      ...(note ? { orderNotes: note } : {}),
      terms: { accepted: true },
    });
  } catch (error) {
    return { ok: false, error: friendlyCheckoutError(error) };
  }

  const { context } = env;
  try {
    // Prices, stock and totals come from the same server code as the website checkout; the model
    // supplies only ids and quantities. Items go into a fresh guest cart that the checkout consumes.
    let cartId: string | null = null;
    for (const line of lines) {
      const added = await addCartItem(context, cartId, line);
      if (added.cookieAction?.type === 'set') cartId = added.cookieAction.cartId;
    }
    const config = loadCheckoutRuntimeConfig(process.env, context.company.subdomain);
    const result = await placeStorefrontCheckout({
      context,
      guestCartId: cartId,
      request,
      idempotencyKey: `agent-${randomUUID()}`,
      config,
    });

    const saleId = Number(result.confirmation.orderId);
    const [sale] = await context.db
      .select({ total: sales.grandTotal, reference: sales.reference })
      .from(sales)
      .where(eq(sales.id, saleId))
      .limit(1);
    await context.db.insert(orderNotes).values({
      orderId: saleId,
      body: `🤖 Porosi e marrë nga agjenti AI (${channelLabel(env.channel)}).${
        address.postalCode === '00000' ? ' Kodi postar nuk u dha.' : ''
      }`,
      isCustomerNote: false,
    });

    const { db } = context;
    const origin = context.requestOrigin;
    // Awaited (not after()): the Telegram route already runs inside after(), which cannot nest.
    await Promise.allSettled([
      notifyNewOrder(db, saleId),
      sendOrderEmail(db, saleId, 'received', origin),
    ]);

    return {
      ok: true,
      orderNumber: result.confirmation.orderNumber,
      total: sale ? `${money(sale.total)} ${result.confirmation.currency}` : undefined,
      next: 'Porosia pret konfirmimin e dyqanit; klienti merr email kur konfirmohet. Pagesa në dorë.',
    };
  } catch (error) {
    return { ok: false, error: friendlyCheckoutError(error) };
  }
}

const PHASE_TEXT: Record<OrderPhase, string> = {
  awaiting: 'Pret konfirmimin e dyqanit.',
  confirmed: 'U konfirmua nga dyqani.',
  preparing: 'Po përgatitet.',
  shipped: 'U dërgua.',
  completed: 'U përfundua.',
  cancelled: 'U anulua.',
  other: 'Statusi nuk është i disponueshëm.',
};

function digitsTail(value: string) {
  return value.replace(/\D/g, '').slice(-8);
}

async function checkOrder(env: ToolEnv, args: Record<string, unknown>): Promise<ToolResult> {
  if (!allowRequest(`agent-check:${env.sessionKey}`, 8, 60 * 60 * 1000)) {
    return { ok: false, error: 'Shumë kërkesa. Provoni më vonë.' };
  }
  const reference = text(args.orderNumber, 100);
  const phone = digitsTail(text(args.phone, 32));
  const miss = { ok: false, error: 'Nuk gjeta porosi me këto të dhëna.' };
  if (!reference || phone.length < 6) return miss;

  const { db } = env.context;
  const [row] = await db
    .select({
      id: sales.id,
      status: sales.status,
      total: sales.grandTotal,
      phone: storefrontOrderDetails.contactPhone,
      currency: storefrontOrderDetails.currency,
    })
    .from(sales)
    .innerJoin(storefrontOrderDetails, eq(storefrontOrderDetails.saleId, sales.id))
    .where(and(eq(sales.reference, reference), eq(sales.isOnline, true)))
    .limit(1);
  if (!row || digitsTail(row.phone ?? '') !== phone) return miss;

  const phase = (await orderPhases(db, [{ id: row.id, status: row.status }])).get(row.id) ?? 'other';
  return { ok: true, status: PHASE_TEXT[phase], total: `${money(row.total)} ${row.currency}` };
}

async function notifyShop(env: ToolEnv, args: Record<string, unknown>): Promise<ToolResult> {
  if (!allowRequest(`agent-notify:${env.sessionKey}`, 3, 60 * 60 * 1000)) {
    return { ok: true, note: 'Dyqani është njoftuar tashmë.' };
  }
  const token = process.env.TELEGRAM_BOT_TOKEN ?? '';
  const chatId = process.env.TELEGRAM_CHAT_ID ?? '';
  const summary = text(args.summary, 600);
  const contact = text(args.contact, 120) || env.contactHint || 'nuk dha kontakt';
  if (!token || !chatId || !summary) {
    return { ok: false, error: 'Dyqani nuk mund të njoftohet tani. Kërkoni që klienti të na shkruajë në faqe.' };
  }
  const via = channelLabel(env.channel);
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: `🙋 Klient kërkon njeri (${via})\n\n${summary}\n\nKontakt: ${contact}` }),
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  return response?.ok
    ? { ok: true, note: 'Dyqani u njoftua dhe do t\'i përgjigjet klientit.' }
    : { ok: false, error: 'Njoftimi nuk u dërgua.' };
}

export async function runTool(env: ToolEnv, name: string, args: Record<string, unknown>): Promise<ToolResult> {
  try {
    switch (name) {
      case 'search_products':
        return await searchProducts(env, args);
      case 'get_shop_info':
        return await getShopInfo(env, args);
      case 'place_order':
        return await placeOrder(env, args);
      case 'check_order':
        return await checkOrder(env, args);
      case 'notify_shop':
        return await notifyShop(env, args);
      default:
        return { ok: false, error: `Vegël e panjohur: ${name}` };
    }
  } catch (error) {
    console.error(`[agent] tool ${name} failed`, error instanceof Error ? error.message : error);
    return { ok: false, error: 'Gabim teknik gjatë kësaj veprimi.' };
  }
}
