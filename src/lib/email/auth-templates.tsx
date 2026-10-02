import type { ReactElement } from 'react';
import { Heading, Link, Section, Text } from '@react-email/components';
import { EmailShell, buttonStyle, headingStyle, paraStyle, smallStyle } from './templates';

/**
 * React Email templates for the customer auth flows: welcome (registration),
 * email confirmation, password reset, and the password-changed security
 * notice. Exposed as factory functions so plain `.ts` server actions can use
 * them without JSX.
 */

export function welcomeEmailMessage(input: {
  /** First name (or display name) of the new customer. */
  name: string;
  email: string;
  /** Absolute URL of the customer account page. */
  accountUrl: string;
}): ReactElement {
  return (
    <EmailShell preview="Your customer account is ready">
      <Heading style={headingStyle}>Welcome aboard!</Heading>
      <Text style={paraStyle}>Hello {input.name},</Text>
      <Text style={paraStyle}>
        Your customer account has been created. You are already signed in on this device, and
        next time you can simply log in with your email address and password.
      </Text>
      <Section style={{ marginBottom: 18 }}>
        <Link href={input.accountUrl} style={buttonStyle}>
          View your account
        </Link>
      </Section>
      <Text style={smallStyle}>Account email: {input.email}</Text>
      <Text style={smallStyle}>
        If you didn&apos;t create this account, you can ignore this email.
      </Text>
    </EmailShell>
  );
}

export function emailVerificationMessage(input: {
  /** First name of the customer, when known. */
  name?: string;
  /** Absolute URL of the verification page with the one-time token. */
  verifyUrl: string;
}): ReactElement {
  return (
    <EmailShell preview="Confirm your email address">
      <Heading style={headingStyle}>Confirm your email address</Heading>
      <Text style={paraStyle}>{input.name ? `Hello ${input.name},` : 'Hello,'}</Text>
      <Text style={paraStyle}>
        One quick step to finish setting up your account: confirm that this email address is
        really yours by tapping the button below.
      </Text>
      <Section style={{ marginBottom: 18 }}>
        <Link href={input.verifyUrl} style={buttonStyle}>
          Confirm my email
        </Link>
      </Section>
      <Text style={smallStyle}>The link works once and expires in 24 hours.</Text>
      <Text style={smallStyle}>
        If you didn&apos;t create an account with this address, you can safely ignore this
        email.
      </Text>
    </EmailShell>
  );
}

export function passwordResetMessage(input: {
  /** First name of the customer, when known. */
  name?: string;
  /** Absolute URL of the reset page with the one-time token. */
  resetUrl: string;
  /** Email address the request was made for. */
  email: string;
}): ReactElement {
  return (
    <EmailShell preview="Reset your password">
      <Heading style={headingStyle}>Reset your password</Heading>
      <Text style={paraStyle}>{input.name ? `Hello ${input.name},` : 'Hello,'}</Text>
      <Text style={paraStyle}>
        We received a request to reset the password for {input.email}. Choose a new password
        through the button below.
      </Text>
      <Section style={{ marginBottom: 18 }}>
        <Link href={input.resetUrl} style={buttonStyle}>
          Reset my password
        </Link>
      </Section>
      <Text style={smallStyle}>The link works once and expires in 1 hour.</Text>
      <Text style={smallStyle}>
        Didn&apos;t request this? You can ignore this email — your password stays exactly as
        it is.
      </Text>
    </EmailShell>
  );
}

export function passwordChangedMessage(input: {
  /** First name of the customer, when known. */
  name?: string;
  /** Email address whose password just changed. */
  email: string;
  /** Absolute URL of the forgot-password page (fallback recovery path). */
  forgotUrl: string;
}): ReactElement {
  return (
    <EmailShell preview="Your password has been changed">
      <Heading style={headingStyle}>Your password has been changed</Heading>
      <Text style={paraStyle}>{input.name ? `Hello ${input.name},` : 'Hello,'}</Text>
      <Text style={paraStyle}>
        The password for {input.email} was just changed. If that was you — for example after a
        reset or an admin-assisted update — no further action is needed.
      </Text>
      <Section style={{ marginBottom: 18 }}>
        <Link href={input.forgotUrl} style={buttonStyle}>
          Reset it now
        </Link>
      </Section>
      <Text style={smallStyle}>
        If you didn&apos;t make this change, use the button above right away to secure the
        account with a new password of your own.
      </Text>
    </EmailShell>
  );
}
