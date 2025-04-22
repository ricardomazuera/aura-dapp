import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { cookies } from 'next/headers';

// Inicializamos Stripe con la clave privada
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-03-31.basil',
});

export async function POST(request: Request) {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('aura_token')?.value || '';

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    
    // Obtener el ID de precio de Stripe (definido en el panel de Stripe)
    // En producción, esto podría venir del frontend o ser un valor fijo
    const priceId = body.priceId || process.env.STRIPE_PREMIUM_PRICE_ID;

    if (!priceId) {
      return NextResponse.json(
        { error: 'Price ID is required' },
        { status: 400 }
      );
    }

    // Crear una sesión de checkout
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?canceled=true`,
      // Pasamos el token como metadata para identificar al usuario en el webhook
      metadata: {
        auth_token: token,
      },
    });

    return NextResponse.json({ id: session.id });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}