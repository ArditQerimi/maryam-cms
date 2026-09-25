import Stripe from 'stripe';
import { NextRequest, NextResponse } from 'next/server';
import { masterDb } from '@/db/master';
import * as masterSchema from '@/db/schema-master';
import { eq } from 'drizzle-orm';

export const runtime = 'nodejs';

function normalizeSubdomain(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

function toCurrencyAmount(price: string | number) {
  const numeric = Number(price);
  if (!Number.isFinite(numeric)) {
    throw new Error('Invalid package price.');
  }
  return Math.round(numeric * 100);
}

export async function POST(request: NextRequest) {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const stripePublicDomain = process.env.NEXT_PUBLIC_DOMAIN || 'localhost:3000';

  if (!stripeSecretKey) {
    return NextResponse.json({ error: 'Stripe is not configured.' }, { status: 500 });
  }

  const stripe = new Stripe(stripeSecretKey, { apiVersion: '2026-04-22.dahlia' });
  const body = await request.json().catch(() => null) as {
    name?: string;
    email?: string;
    companyName?: string;
    subdomain?: string;
    packageId?: number;
    companyId?: number;
    tenantDatabaseBaseUrl?: string;
    billingCycle?: 'monthly' | 'yearly';
    successUrl?: string;
    cancelUrl?: string;
  } | null;

  if (!body?.packageId) {
    return NextResponse.json({ error: 'packageId is required.' }, { status: 400 });
  }

  const packageRow = await masterDb.query.packages.findFirst({
    where: eq(masterSchema.packages.id, body.packageId),
  });

  if (!packageRow) {
    return NextResponse.json({ error: 'Package not found.' }, { status: 404 });
  }

  const billingCycle = body.billingCycle === 'yearly' ? 'yearly' : 'monthly';
  const unitAmount = billingCycle === 'yearly'
    ? toCurrencyAmount(Number(packageRow.price) * 10)
    : toCurrencyAmount(packageRow.price);

  // Resolve company context
  let companyId = body.companyId;
  let companyEmail = body.email?.trim().toLowerCase();
  let companyName = body.companyName;
  let subdomain = body.subdomain;

  if (companyId) {
    const row = await masterDb.query.companies.findFirst({
      where: eq(masterSchema.companies.id, companyId),
    });
    if (row) {
      companyEmail = companyEmail || row.email;
      companyName = companyName || row.name;
      subdomain = subdomain || row.subdomain;
    }
  } else if (subdomain) {
    const row = await masterDb.query.companies.findFirst({
      where: eq(masterSchema.companies.subdomain, subdomain),
    });
    if (row) {
      companyId = row.id;
      companyEmail = companyEmail || row.email;
      companyName = companyName || row.name;
    }
  } else if (companyEmail) {
    const row = await masterDb.query.companies.findFirst({
      where: eq(masterSchema.companies.email, companyEmail),
    });
    if (row) {
      companyId = row.id;
      companyName = companyName || row.name;
      subdomain = subdomain || row.subdomain;
    }
  }

  if (!companyEmail || !companyName) {
    return NextResponse.json({ error: 'Company email and name are required.' }, { status: 400 });
  }

  subdomain = subdomain || normalizeSubdomain(companyName);
  const baseConnectionString = body.tenantDatabaseBaseUrl || process.env.TENANT_DATABASE_BASE_URL || process.env.TENANT_DATABASE_SERVER_URL || process.env.MASTER_DATABASE_URL || process.env.DATABASE_URL;

  if (!baseConnectionString) {
    return NextResponse.json({ error: 'Tenant database base connection string is not configured.' }, { status: 500 });
  }

  const company = companyId ? 
    (await masterDb.query.companies.findFirst({ where: eq(masterSchema.companies.id, companyId) })) :
    (await masterDb.query.companies.findFirst({ where: eq(masterSchema.companies.subdomain, subdomain) }));

  let finalCompany = company;

  if (!finalCompany) {
    [finalCompany] = await masterDb.insert(masterSchema.companies).values({
      name: companyName,
      email: companyEmail,
      subdomain,
      dbConnectionString: baseConnectionString,
      dbSchema: 'public',
      status: 'Pending',
    }).returning();
  } else {
    // Sync company details if provided
    await masterDb
      .update(masterSchema.companies)
      .set({
        name: companyName,
        email: companyEmail,
        dbConnectionString: finalCompany.dbConnectionString || baseConnectionString,
      })
      .where(eq(masterSchema.companies.id, finalCompany.id));
  }

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: 'subscription',
    allow_promotion_codes: true,
    billing_address_collection: 'auto',
    client_reference_id: String(finalCompany.id),
    customer_email: companyEmail,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: unitAmount,
          recurring: { interval: billingCycle === 'yearly' ? 'year' : 'month' },
          product_data: {
            name: packageRow.name,
            metadata: {
              packageId: String(packageRow.id),
            },
          },
        },
      },
    ],
    metadata: {
      companyId: String(finalCompany.id),
      companyName: finalCompany.name,
      email: finalCompany.email,
      subdomain: finalCompany.subdomain,
      packageId: String(packageRow.id),
      packageName: packageRow.name,
      billingCycle,
      tenantDatabaseBaseUrl: finalCompany.dbConnectionString || baseConnectionString,
    },
    subscription_data: {
      metadata: {
        companyId: String(finalCompany.id),
        companyName: finalCompany.name,
        email: finalCompany.email,
        subdomain: finalCompany.subdomain,
        packageId: String(packageRow.id),
        packageName: packageRow.name,
        billingCycle,
        tenantDatabaseBaseUrl: finalCompany.dbConnectionString || baseConnectionString,
      },
    },
    success_url: body.successUrl || `https://${finalCompany.subdomain}.${stripePublicDomain}/register/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: body.cancelUrl || `https://${stripePublicDomain}/pricing?error=subscription-cancelled`,
  });

  return NextResponse.json({
    checkoutUrl: checkoutSession.url,
    companyId: finalCompany.id,
    subdomain: finalCompany.subdomain,
    sessionId: checkoutSession.id,
  });
}
