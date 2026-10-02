import type { ReactElement } from 'react';
import { Heading, Section, Text } from '@react-email/components';
import {
  EmailShell,
  detailBoxStyle,
  detailLabelStyle,
  detailRowStyle,
  headingStyle,
  paraStyle,
  smallStyle,
} from './templates';

/**
 * React Email templates for the storefront contact form:
 *  - `contactNotifyMessage` goes to the store team when a visitor submits a
 *    message, and
 *  - `contactAckMessage` confirms receipt to the visitor.
 * Factory functions so the plain `.ts` route handler can use them without JSX.
 */

export function contactNotifyMessage(input: {
  /** Display name of the store receiving the message. */
  storeName: string;
  /** Visitor's name as typed into the form. */
  name: string;
  /** Visitor's reply address. */
  email: string;
  /** Subject line typed into the form. */
  subject: string;
  /** Full message body. */
  message: string;
}): ReactElement {
  return (
    <EmailShell preview={`New contact message: ${input.subject}`}>
      <Heading style={headingStyle}>New contact message</Heading>
      <Text style={paraStyle}>
        {input.storeName} received a message through the storefront contact form.
      </Text>

      <Section style={detailBoxStyle}>
        <Text style={detailRowStyle}>
          <span style={detailLabelStyle}>From: </span>
          {input.name} ({input.email})
        </Text>
        <Text style={detailRowStyle}>
          <span style={detailLabelStyle}>Subject: </span>
          {input.subject}
        </Text>
        <Text style={{ ...detailRowStyle, marginBottom: 0, whiteSpace: 'pre-wrap' }}>
          {input.message}
        </Text>
      </Section>

      <Text style={smallStyle}>
        The message is also stored in the admin panel, so the store can reply even if this
        email is missed.
      </Text>
    </EmailShell>
  );
}

export function contactAckMessage(input: {
  /** Visitor's first name (or the full name typed into the form). */
  name: string;
  /** Display name of the store contacted. */
  storeName: string;
  /** Subject line the visitor wrote. */
  subject: string;
}): ReactElement {
  return (
    <EmailShell preview="We received your message">
      <Heading style={headingStyle}>We received your message</Heading>
      <Text style={paraStyle}>Hello {input.name},</Text>
      <Text style={paraStyle}>
        Thank you for contacting {input.storeName}. Your message about “{input.subject}” has
        arrived and is stored safely — the store team will get back to you at this email
        address.
      </Text>
      <Text style={smallStyle}>
        This confirmation is automatic; please reply to the store&apos;s own messages instead
        of this address.
      </Text>
    </EmailShell>
  );
}
