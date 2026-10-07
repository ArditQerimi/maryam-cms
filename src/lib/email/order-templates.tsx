import type { ReactElement } from 'react';
import {
  Body,
  Column,
  Container,
  Heading,
  Html,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from '@react-email/components';

/*
 * Order emails: "order placed — waiting for confirmation", "order confirmed",
 * "order cancelled". Same palette as the rest of the store's emails (gold on
 * cream); layout = brand header, hero card with a progress stepper, order
 * details box (items, shipping address, totals) and a footer.
 */

const ACCENT = '#69521e';
const INK = '#141414';
const MUTED = '#5f5a51';
const LINE = '#e6e2da';
const SURFACE = '#f4f2ee';
const CARD = '#faf8f3';
const FONT = 'Arial, Helvetica, sans-serif';

export type OrderEmailData = {
  storeName: string;
  recipientName?: string;
  orderReference: string;
  /** Absolute link to the order in the customer's account (omitted when unknown). */
  orderUrl?: string;
  lines: Array<{ name: string; variant?: string | null; quantity: number; total: string }>;
  subtotal: string;
  discount?: string | null;
  shipping?: string | null;
  tax?: string | null;
  total: string;
  shippingAddress: string[];
  paymentLabel: string;
};

type Step = 'placed' | 'confirmed' | 'cancelled';

const STEPS: Record<Step, Array<{ label: string; state: 'done' | 'current' | 'todo' }>> = {
  placed: [
    { label: 'Porosia u bë', state: 'done' },
    { label: 'Konfirmimi', state: 'current' },
    { label: 'Përgatitja', state: 'todo' },
  ],
  confirmed: [
    { label: 'Porosia u bë', state: 'done' },
    { label: 'Konfirmuar', state: 'done' },
    { label: 'Përgatitja', state: 'current' },
  ],
  cancelled: [
    { label: 'Porosia u bë', state: 'done' },
    { label: 'Anuluar', state: 'current' },
  ],
};

function Stepper({ step }: { step: Step }) {
  const items = STEPS[step];
  return (
    <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ margin: '22px 0 24px' }}>
      <tbody>
        <tr>
          {items.map((item, index) => (
            <td key={item.label} align="center" valign="top" style={{ width: `${100 / items.length}%`, position: 'relative' }}>
              <table role="presentation" cellPadding={0} cellSpacing={0} width="100%">
                <tbody>
                  <tr>
                    <td style={{ width: '50%', borderTop: index === 0 ? 'none' : `2px solid ${items[index - 1].state === 'done' ? ACCENT : LINE}`, fontSize: 0, lineHeight: 0, height: 15 }}>
                      &nbsp;
                    </td>
                    <td align="center" style={{ width: 30 }}>
                      <div
                        style={{
                          width: 30,
                          height: 30,
                          lineHeight: '26px',
                          borderRadius: '50%',
                          border: `2px solid ${item.state === 'todo' ? LINE : ACCENT}`,
                          backgroundColor: item.state === 'done' ? ACCENT : '#ffffff',
                          color: item.state === 'done' ? '#ffffff' : ACCENT,
                          fontSize: 14,
                          fontWeight: 700,
                          textAlign: 'center',
                        }}
                      >
                        {item.state === 'done' ? '✓' : item.state === 'current' ? '•' : ''}
                      </div>
                    </td>
                    <td style={{ width: '50%', borderTop: index === items.length - 1 ? 'none' : `2px solid ${item.state === 'done' ? ACCENT : LINE}`, fontSize: 0, lineHeight: 0, height: 15 }}>
                      &nbsp;
                    </td>
                  </tr>
                </tbody>
              </table>
              <Text style={{ margin: '8px 0 0', fontSize: 13, lineHeight: '18px', color: item.state === 'todo' ? MUTED : INK, fontFamily: FONT }}>
                {item.label}
              </Text>
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  );
}

const rowText = { margin: 0, fontSize: 13, lineHeight: '20px', color: INK, fontFamily: FONT } as const;
const smallLabel = { margin: '0 0 6px', fontSize: 13, fontWeight: 700, color: INK, fontFamily: FONT } as const;

function OrderEmail({
  data,
  step,
  heading,
  lead,
  leadEn,
  preview,
}: {
  data: OrderEmailData;
  step: Step;
  heading: string;
  lead: string;
  leadEn: string;
  preview: string;
}) {
  return (
    <Html lang="sq">
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: SURFACE, fontFamily: FONT, margin: 0, padding: '24px 0' }}>
        <Container style={{ maxWidth: 600, backgroundColor: '#ffffff', border: `1px solid ${LINE}`, borderRadius: 10, overflow: 'hidden' }}>
          <Section style={{ padding: '22px 32px 6px' }}>
            <Text style={{ margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: '0.02em', color: ACCENT, fontFamily: 'Georgia, "Times New Roman", serif' }}>
              {data.storeName}
            </Text>
          </Section>

          <Section style={{ padding: '10px 24px 0' }}>
            <Section style={{ backgroundColor: CARD, borderRadius: 12, padding: '30px 24px 26px', textAlign: 'center' }}>
              <Heading style={{ margin: '0 0 12px', fontSize: 28, lineHeight: '34px', color: INK, fontFamily: 'Georgia, "Times New Roman", serif', fontWeight: 700 }}>
                {heading}
              </Heading>
              <Text style={{ margin: '0 auto', maxWidth: 420, fontSize: 14, lineHeight: '21px', color: MUTED, fontFamily: FONT }}>
                {data.recipientName ? `${data.recipientName}, ` : ''}{lead}
              </Text>
              <Text style={{ margin: '6px auto 0', maxWidth: 420, fontSize: 12, lineHeight: '18px', color: MUTED, fontFamily: FONT }}>
                {leadEn}
              </Text>
              <Stepper step={step} />
              {data.orderUrl ? (
                <Link
                  href={data.orderUrl}
                  style={{ display: 'inline-block', backgroundColor: ACCENT, color: '#ffffff', fontFamily: FONT, fontSize: 14, fontWeight: 700, textDecoration: 'none', padding: '12px 28px', borderRadius: 6 }}
                >
                  Shiko porosinë
                </Link>
              ) : null}
            </Section>
          </Section>

          <Section style={{ padding: '28px 24px 8px' }}>
            <Heading as="h2" style={{ margin: '0 0 6px', textAlign: 'center', fontSize: 22, color: INK, fontFamily: 'Georgia, "Times New Roman", serif', fontWeight: 700 }}>
              Detajet e porosisë
            </Heading>
            <Text style={{ margin: '0 0 16px', textAlign: 'center', fontSize: 13, color: INK, fontFamily: FONT }}>
              Numri i porosisë: <span style={{ color: ACCENT, fontWeight: 700 }}>{data.orderReference}</span>
            </Text>

            <Section style={{ border: `1px solid ${LINE}`, borderRadius: 4 }}>
              {data.lines.map((line, index) => (
                <Row key={`${line.name}-${index}`} style={{ borderBottom: `1px solid ${LINE}` }}>
                  <Column style={{ padding: '14px 16px' }}>
                    <Text style={{ ...rowText, fontWeight: 700 }}>{line.name}</Text>
                    {line.variant ? <Text style={{ ...rowText, color: MUTED }}>{line.variant}</Text> : null}
                    <Text style={{ ...rowText, color: MUTED }}>Sasia: {line.quantity}</Text>
                  </Column>
                  <Column align="right" style={{ padding: '14px 16px', verticalAlign: 'bottom' }}>
                    <Text style={{ ...rowText, fontWeight: 700 }}>{line.total}</Text>
                  </Column>
                </Row>
              ))}

              <Row>
                <Column style={{ padding: '16px', width: '50%', verticalAlign: 'top' }}>
                  <Text style={smallLabel}>Adresa e dërgesës</Text>
                  {data.shippingAddress.map((part, index) => (
                    <Text key={`${part}-${index}`} style={{ ...rowText, color: MUTED }}>{part}</Text>
                  ))}
                </Column>
                <Column style={{ padding: '16px', width: '50%', verticalAlign: 'top' }}>
                  <Text style={smallLabel}>{data.paymentLabel}</Text>
                  <Row>
                    <Column><Text style={{ ...rowText, color: MUTED }}>Nëntotali</Text></Column>
                    <Column align="right"><Text style={rowText}>{data.subtotal}</Text></Column>
                  </Row>
                  {data.discount ? (
                    <Row>
                      <Column><Text style={{ ...rowText, color: MUTED }}>Zbritja</Text></Column>
                      <Column align="right"><Text style={rowText}>-{data.discount}</Text></Column>
                    </Row>
                  ) : null}
                  {data.shipping ? (
                    <Row>
                      <Column><Text style={{ ...rowText, color: MUTED }}>Dërgesa</Text></Column>
                      <Column align="right"><Text style={rowText}>{data.shipping}</Text></Column>
                    </Row>
                  ) : null}
                  {data.tax ? (
                    <Row>
                      <Column><Text style={{ ...rowText, color: MUTED }}>Tatimi</Text></Column>
                      <Column align="right"><Text style={rowText}>{data.tax}</Text></Column>
                    </Row>
                  ) : null}
                </Column>
              </Row>

              <Row style={{ borderTop: `1px solid ${LINE}` }}>
                <Column style={{ padding: '14px 16px' }}>
                  <Text style={{ ...rowText, fontWeight: 700 }}>Totali ({data.lines.length} {data.lines.length === 1 ? 'artikull' : 'artikuj'})</Text>
                </Column>
                <Column align="right" style={{ padding: '14px 16px' }}>
                  <Text style={{ margin: 0, fontSize: 20, fontWeight: 700, color: INK, fontFamily: FONT }}>{data.total}</Text>
                </Column>
              </Row>
            </Section>
          </Section>

          {step === 'placed' ? (
            <Section style={{ padding: '14px 24px 4px' }}>
              <Section style={{ backgroundColor: CARD, borderRadius: 10, padding: '16px 20px' }}>
                <Text style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: INK, fontFamily: FONT }}>Çfarë ndodh tani?</Text>
                <Text style={{ margin: 0, fontSize: 13, lineHeight: '20px', color: MUTED, fontFamily: FONT }}>
                  Dyqani po e shqyrton porosinë. Sapo ta konfirmojë, do të merrni një email tjetër dhe statusi te llogaria juaj
                  do të ndryshojë nga &quot;Në pritje të konfirmimit&quot; në &quot;Konfirmuar&quot;.
                </Text>
              </Section>
            </Section>
          ) : null}

          <Section style={{ padding: '22px 32px 26px' }}>
            <Text style={{ margin: 0, fontSize: 12, lineHeight: '18px', textAlign: 'center', color: MUTED, fontFamily: FONT }}>
              Faleminderit që bleni tek {data.storeName}!
            </Text>
          </Section>

          <Section style={{ backgroundColor: ACCENT, padding: '14px 32px' }}>
            <Text style={{ margin: 0, fontSize: 12, textAlign: 'center', color: '#ffffff', letterSpacing: '0.12em', fontFamily: FONT }}>
              {data.storeName.toUpperCase()}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export function orderReceivedEmailMessage(data: OrderEmailData): ReactElement {
  return (
    <OrderEmail
      data={data}
      step="placed"
      preview={`Porosia ${data.orderReference} u pranua — pret konfirmimin`}
      heading="Porosia u bë. Po pritet konfirmimi."
      lead="Porosia juaj u pranua dhe tani pret konfirmimin nga dyqani. Do t'ju dërgojmë një email sapo të konfirmohet."
      leadEn="Your order has been placed and is waiting for the shop's confirmation. We will email you as soon as it is confirmed."
    />
  );
}

export function orderConfirmedEmailMessage(data: OrderEmailData): ReactElement {
  return (
    <OrderEmail
      data={data}
      step="confirmed"
      preview={`Porosia ${data.orderReference} u konfirmua`}
      heading="Porosia juaj u konfirmua!"
      lead="Dyqani e konfirmoi porosinë tuaj dhe po e përgatit menjëherë."
      leadEn="The shop has confirmed your order and is preparing it right away."
    />
  );
}

export function orderCancelledEmailMessage(data: OrderEmailData): ReactElement {
  return (
    <OrderEmail
      data={data}
      step="cancelled"
      preview={`Porosia ${data.orderReference} u anulua`}
      heading="Porosia u anulua"
      lead="Fatkeqësisht dyqani nuk mundi ta përmbushë porosinë tuaj dhe ajo u anulua. Na shkruani nëse keni pyetje."
      leadEn="Unfortunately the shop could not fulfil your order and it was cancelled. Contact us if you have any questions."
    />
  );
}
