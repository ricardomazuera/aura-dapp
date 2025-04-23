import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { cookies } from 'next/headers';
import fs from 'fs/promises';
import path from 'path';

// Function to write logs to a file
async function logToFile(message: string) {
  try {
    const logDir = path.join(process.cwd(), 'logs');
    await fs.mkdir(logDir, { recursive: true });

    const logFilePath = path.join(logDir, 'stripe-debug.log');
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [CHECKOUT] ${message}\n`;

    await fs.appendFile(logFilePath, logEntry);
  } catch (error) {
    console.error('Error writing to log file:', error);
  }
}

// Initialize Stripe with the private key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-03-31.basil',
});

export async function POST(request: Request) {
  try {
    await logToFile('🚀 Starting create-checkout-session request');
    
    const body = await request.json();
    const userEmail = body.email || '';


    await logToFile(`📧 User email: ${userEmail}`);

    // Get the Stripe price ID (defined in the Stripe dashboard)
    const priceId = process.env.STRIPE_PREMIUM_PRICE_ID;
    await logToFile(`💰 Using price ID: ${priceId}`);

    if (!priceId) {
      await logToFile('❌ Error: Price ID is missing in environment variables');
      return NextResponse.json(
        { error: 'Price ID is required' },
        { status: 400 }
      );
    }

    // Validate the price format
    if (!priceId.startsWith('price_')) {
      await logToFile(`❌ Error: Invalid price ID format: ${priceId}`);
      return NextResponse.json(
        { error: 'Invalid price ID format' },
        { status: 400 }
      );
    }

    // Create customer if necessary
    let customerId: string | undefined;

    if (userEmail) {
      await logToFile(`🔍 Looking for existing customer with email: ${userEmail}`);

      // Check if a customer already exists with this email
      const customers = await stripe.customers.list({
        email: userEmail,
        limit: 1,
      });

      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
        await logToFile(`✅ Found existing customer: ${customerId}`);
      } else {
        // Create a new customer
        await logToFile('➕ Creating new customer');
        const newCustomer = await stripe.customers.create({
          email: userEmail,

        });
        customerId = newCustomer.id;
        await logToFile(`✅ Created new customer: ${customerId}`);
      }
    }

    // Create a checkout session
    await logToFile('🔄 Creating checkout session');

    // Get the authentication token if it exists
    const cookieStore = cookies();
    const authToken = cookieStore.get('aura_token')?.value;

    await logToFile(`🔑 Auth token found in cookies: ${authToken ? 'yes' : 'no'}`);

    const checkoutParams: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      // Use the new callback route to process the payment result
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/callback?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/callback?canceled=true`,
      metadata: {
        user_email: userEmail,
        auth_token: authToken || ''
      },
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
    };

    // Associate the customer if it exists
    if (customerId) {
      checkoutParams.customer = customerId;
      await logToFile(`👤 Associated customer ${customerId} with checkout session`);
    }

    const session = await stripe.checkout.sessions.create(checkoutParams);
    await logToFile(`✅ Checkout session created: ${session.id}`);
    await logToFile(`🔗 Checkout URL: ${session.url}`);

    // Return the session ID and checkout URL
    return NextResponse.json({
      id: session.id,
      url: session.url
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await logToFile(`❌ Error creating checkout session: ${errorMessage}`);
    console.error('Error creating checkout session:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}