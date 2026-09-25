import Stripe from 'stripe';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-04-22.dahlia',
});

export async function POST(request: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { error: 'Stripe is not configured' },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const { email, amount, billingCycle, packageId, planName, companyId, companyName } = body;

    if (!email || !amount || !packageId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get or create Stripe customer
    const existingCustomers = await stripe.customers.list({
      email,
      limit: 1,
    });

    let customer: Stripe.Customer;
    if (existingCustomers.data.length > 0) {
      customer = existingCustomers.data[0];
      await stripe.customers.update(customer.id, {
        metadata: {
          ...(customer.metadata || {}),
          packageId: String(packageId),
          planName,
          billingCycle,
          companyId: companyId ? String(companyId) : '',
          companyName: companyName || '',
          email,
        },
      });
    } else {
      customer = await stripe.customers.create({
        email,
        metadata: {
          packageId: String(packageId),
          planName,
          billingCycle,
          companyId: companyId ? String(companyId) : '',
          companyName: companyName || '',
          email,
        },
      });
    }

    // Get or create a price for this plan
    const prices = process.env.STRIPE_PRODUCT_ID
      ? await stripe.prices.list({
          product: process.env.STRIPE_PRODUCT_ID,
          limit: 100,
        })
      : await stripe.prices.list({
          limit: 100,
        });

    let price = prices.data.find((p) =>
      p.metadata?.packageId === String(packageId) &&
      (
        (billingCycle === 'monthly' && p.recurring?.interval === 'month') ||
        (billingCycle === 'yearly' && p.recurring?.interval === 'year')
      )
    );

    if (!price) {
      // Create a product and price if they don't exist
      const product = await stripe.products.create({
        name: planName,
        description: `${planName} subscription`,
        metadata: {
          packageId: String(packageId),
        },
      });

      price = await stripe.prices.create({
        product: product.id,
        unit_amount: amount,
        currency: 'usd',
        recurring: {
          interval: billingCycle === 'monthly' ? 'month' : 'year',
        },
        metadata: {
          packageId: String(packageId),
          planName,
          billingCycle,
        },
      });
    }

    // Create a subscription directly
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [
        {
          price: price.id,
        },
      ],
      payment_behavior: 'default_incomplete',
      metadata: {
        email,
        packageId: String(packageId),
        planName,
        billingCycle,
        companyId: companyId ? String(companyId) : '',
        companyName: companyName || '',
      },
      expand: ['latest_invoice.payment_intent'],
    });

    const latestInvoice = subscription.latest_invoice as Stripe.Invoice | string | null;

    // `latest_invoice` may be a string id or an expanded Invoice object.
    // Some Stripe types expose the payment intent differently across versions,
    // so handle both expanded object and id cases safely.
    let paymentIntent: Stripe.PaymentIntent | null = null;

    if (latestInvoice && typeof latestInvoice === 'object') {
      const raw = (latestInvoice as any).payment_intent || (latestInvoice as any).latest_payment_intent;
      if (raw) {
        if (typeof raw === 'string') {
          paymentIntent = await stripe.paymentIntents.retrieve(raw as string);
        } else {
          paymentIntent = raw as Stripe.PaymentIntent;
        }
      }
    } else if (typeof subscription.latest_invoice === 'string') {
      // fallback: retrieve the invoice then its payment intent
      const inv = await stripe.invoices.retrieve(subscription.latest_invoice as string, { expand: ['payment_intent'] });
      const raw = (inv as any).payment_intent || (inv as any).latest_payment_intent;
      if (raw) {
        if (typeof raw === 'string') {
          paymentIntent = await stripe.paymentIntents.retrieve(raw as string);
        } else {
          paymentIntent = raw as Stripe.PaymentIntent;
        }
      }
    }

    if (!paymentIntent || !paymentIntent.client_secret) {
      throw new Error('Failed to get payment intent client secret');
    }

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      subscriptionId: subscription.id,
      paymentIntentId: paymentIntent.id,
    });
  } catch (error) {
    console.error('Payment intent error:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to create payment intent',
      },
      { status: 500 }
    );
  }
}
