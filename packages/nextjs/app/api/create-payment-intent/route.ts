import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { cookies } from 'next/headers';

// Inicializamos Stripe con la clave privada
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-03-31.basil',
});

export async function POST(request: Request) {
  try {
    // Intentamos obtener el token, pero no bloqueamos si no existe
    const cookieStore = cookies();
    const token = cookieStore.get('aura_token')?.value || '';
    
    // Obtenemos información de la solicitud
    const body = await request.json();
    const userEmail = body.email || request.headers.get('X-User-Email') || 'customer@example.com';

    // Para suscripciones, usaremos SetupIntent en lugar de PaymentIntent
    // SetupIntent nos permite guardar los detalles de pago sin realizar un cargo inmediato
    const setupIntent = await stripe.setupIntents.create({
      payment_method_types: ['card'],
      metadata: {
        auth_token: token,
      },
    });

    // Crear un cliente para usarlo cuando se crea la suscripción
    let customerId: string;
    const customers = await stripe.customers.list({
      email: userEmail,
      limit: 1
    });

    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    } else {
      const customer = await stripe.customers.create({
        email: userEmail,
        metadata: {
          auth_token: token
        }
      });
      customerId = customer.id;
    }

    return NextResponse.json({ 
      clientSecret: setupIntent.client_secret,
      customerId: customerId
    });
  } catch (error) {
    console.error('Error creating payment intent:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    );
  }
}