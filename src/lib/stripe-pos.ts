'use server';

import Stripe from 'stripe';
import { getSession } from './session';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2026-04-22.dahlia',
});

export async function createStripePaymentIntent(amount: number, currency: string = 'usd') {
  try {
    const session = await getSession();
    if (!session) throw new Error('Unauthorized');

    const companyId = typeof session.companyId === 'number' || typeof session.companyId === 'string'
      ? String(session.companyId)
      : '';
    const userId = typeof session.userId === 'number' || typeof session.userId === 'string'
      ? String(session.userId)
      : '';

    // Create a PaymentIntent with the order amount and currency
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Stripe uses cents
      currency,
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        companyId,
        userId,
      },
    });

    return {
      clientSecret: paymentIntent.client_secret,
    };
  } catch (error) {
    console.error('Error creating PaymentIntent:', error);
    throw error;
  }
}

export async function createStripeCheckoutSession(items: { name: string; price: number; quantity: number }[]) {
  try {
    const session = await getSession();
    if (!session) throw new Error('Unauthorized');

    const checkoutSession = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: items.map(item => ({
        price_data: {
          currency: 'usd',
          product_data: {
            name: item.name,
          },
          unit_amount: Math.round(item.price * 100),
        },
        quantity: item.quantity,
      })),
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/pos?status=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pos?status=cancel`,
    });

    return { url: checkoutSession.url };
  } catch (error) {
    console.error('Error creating Checkout Session:', error);
    throw error;
  }
}
