import Stripe from 'stripe';
import { NextRequest, NextResponse } from 'next/server';
import { processStripeTenantSubscriptionEvent } from '@/lib/stripe-billing';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeSecretKey || !webhookSecret) {
    return NextResponse.json({ error: 'Stripe is not configured.' }, { status: 500 });
  }

  const stripe = new Stripe(stripeSecretKey, { apiVersion: '2026-04-22.dahlia' });
  const signature = request.headers.get('stripe-signature');
  const payload = await request.text();

  if (!signature) {
    return NextResponse.json({ error: 'Missing Stripe signature.' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (error) {
    console.error('Stripe webhook signature verification failed:', error);
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 });
  }

  try {
    console.log(`[Stripe Webhook] Received event type: ${event.type}, ID: ${event.id}`);

    if (event.type === 'checkout.session.completed') {
      console.log('[Stripe Webhook] Processing checkout.session.completed');
      const session = event.data.object as Stripe.Checkout.Session;
      
      if (typeof session.subscription === 'string') {
        console.log(`[Stripe Webhook] Retrieving subscription: ${session.subscription}`);
        const subscription = await stripe.subscriptions.retrieve(session.subscription, {
          expand: ['customer', 'items.data.price'],
        });
        
        console.log(`[Stripe Webhook] Processing subscription for customer: ${subscription.customer}`);
        const result = await processStripeTenantSubscriptionEvent({
          subscription,
          customer: session.customer && typeof session.customer !== 'string'
            ? session.customer
            : null,
        });
        console.log(`[Stripe Webhook] Subscription processed:`, result);
      } else {
        console.warn('[Stripe Webhook] Subscription ID is not a string');
      }
    }

    if (
      event.type === 'customer.subscription.created' ||
      event.type === 'customer.subscription.updated' ||
      event.type === 'customer.subscription.deleted'
    ) {
      console.log(`[Stripe Webhook] Processing ${event.type}`);
      const subscription = event.data.object as Stripe.Subscription;
      const customer = subscription.customer && typeof subscription.customer !== 'string'
        ? (subscription.customer as Stripe.Customer)
        : null;

      console.log(`[Stripe Webhook] Processing subscription:`, {
        subscriptionId: subscription.id,
        status: subscription.status,
        customerId: customer?.id,
        customerEmail: customer?.email,
      });

      const result = await processStripeTenantSubscriptionEvent({ subscription, customer });
      console.log(`[Stripe Webhook] Subscription processed:`, result);
    }

    console.log(`[Stripe Webhook] Event ${event.type} processed successfully`);
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[Stripe Webhook] Processing failed:', error);
    return NextResponse.json({ error: 'Webhook processing failed.' }, { status: 500 });
  }
}
