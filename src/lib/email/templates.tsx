import type { ReactElement, ReactNode } from 'react';
import {
  Body,
  Button,
  Container,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';

/**
 * React Email templates for every message the CMS sends.
 *
 * Exposed as factory functions (`testEmailMessage`, `trackingEmailMessage`)
 * instead of JSX call-sites so the server actions that use them can stay in
 * plain `.ts` files.
 */

const ACCENT = '#69521e';
const INK = '#141414';
const MUTED = '#5f5a51';
const LINE = '#e6e2da';
const SURFACE = '#f4f2ee';

const pageStyle = {
  backgroundColor: SURFACE,
  fontFamily: 'Arial, Helvetica, sans-serif',
};

const cardStyle = {
  backgroundColor: '#ffffff',
  border: `1px solid ${LINE}`,
  borderRadius: '10px',
  overflow: 'hidden' as const,
};

const bandTextStyle = {
  margin: 0,
  padding: '13px 32px',
  backgroundColor: ACCENT,
  color: '#ffffff',
  fontSize: '12px',
  fontWeight: 700,
  letterSpacing: '0.18em',
  textAlign: 'center' as const,
};

const contentStyle = { padding: '32px' };

export const headingStyle = {
  margin: '0 0 16px',
  color: INK,
  fontSize: '22px',
  fontWeight: 700,
  lineHeight: '1.3',
};

export const paraStyle = {
  margin: '0 0 14px',
  color: INK,
  fontSize: '15px',
  lineHeight: '1.6',
};

export const smallStyle = {
  margin: '4px 0 0',
  color: MUTED,
  fontSize: '13px',
  lineHeight: '1.6',
};

export const detailBoxStyle = {
  margin: '6px 0 20px',
  padding: '16px 18px',
  backgroundColor: SURFACE,
  border: `1px solid ${LINE}`,
  borderRadius: '8px',
};

export const detailRowStyle = {
  margin: '0 0 8px',
  color: INK,
  fontSize: '14px',
  lineHeight: '1.5',
};

export const detailLabelStyle = { color: MUTED, fontSize: '13px' };

export const buttonStyle = {
  display: 'inline-block',
  padding: '12px 22px',
  backgroundColor: ACCENT,
  borderRadius: '6px',
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: 700,
  textDecoration: 'none',
  textAlign: 'center' as const,
};

export function EmailShell({
  preview,
  children,
}: {
  preview: string;
  children: ReactNode;
}) {
  return (
    <Html lang="en">
      <Preview>{preview}</Preview>
      <Body style={pageStyle}>
        <Container style={cardStyle}>
          <Text style={bandTextStyle}>ONLINE STORE</Text>
          <Section style={contentStyle}>{children}</Section>
        </Container>
      </Body>
    </Html>
  );
}

/** Settings → "Send test email" verification message. */
export function testEmailMessage(to: string): ReactElement {
  return (
    <EmailShell preview="Test email from your store">
      <Heading style={headingStyle}>Test email</Heading>
      <Text style={paraStyle}>Hello,</Text>
      <Text style={paraStyle}>
        This is a test message from your store admin. If you are reading it, your outbound
        email channel (Resend or SMTP) is configured correctly.
      </Text>
      <Text style={smallStyle}>Delivered to {to}</Text>
    </EmailShell>
  );
}

/**
 * Order detail → "Send tracking email" message with the shipment details the
 * admin saved for the order.
 */
export function trackingEmailMessage(input: {
  recipientName?: string;
  orderReference: string;
  amountText: string;
  trackingNumber: string;
  carrier?: string | null;
  trackingUrl?: string | null;
}): ReactElement {
  const greeting = input.recipientName ? `Hello ${input.recipientName},` : 'Hello,';

  return (
    <EmailShell preview={`Tracking details for order ${input.orderReference}`}>
      <Heading style={headingStyle}>Your order is on its way</Heading>
      <Text style={paraStyle}>{greeting}</Text>
      <Text style={paraStyle}>
        Order {input.orderReference} ({input.amountText}) has shipped. Use the details below
        to follow it.
      </Text>

      <Section style={detailBoxStyle}>
        <Text style={detailRowStyle}>
          <span style={detailLabelStyle}>Tracking number: </span>
          {input.trackingNumber}
        </Text>
        {input.carrier ? (
          <Text style={{ ...detailRowStyle, marginBottom: 0 }}>
            <span style={detailLabelStyle}>Carrier: </span>
            {input.carrier}
          </Text>
        ) : null}
      </Section>

      {input.trackingUrl ? (
        <Section style={{ marginBottom: 18 }}>
          <Link href={input.trackingUrl} style={buttonStyle}>
            Track your package
          </Link>
        </Section>
      ) : null}

      <Text style={paraStyle}>Thank you for shopping with us!</Text>
    </EmailShell>
  );
}
