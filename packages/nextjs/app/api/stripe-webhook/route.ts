import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { Buffer } from 'buffer';

// Inicializamos Stripe con la clave privada
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-03-31.basil',
});

// Esta función actualiza el rol del usuario en nuestra base de datos
async function updateUserRole(token: string) {
  try {
    const response = await fetch(`${process.env.BACKEND_API_URL}/api/user/upgrade`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to upgrade user: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error upgrading user role:', error);
    throw error;
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature') || '';
    
    let event: Stripe.Event;

    // Verificamos que el webhook proviene de Stripe
    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET || ''
      );
    } catch (error) {
      console.error('Webhook signature verification failed:', error);
      return NextResponse.json(
        { error: 'Webhook signature verification failed' },
        { status: 400 }
      );
    }

    console.log(`Received Stripe webhook event: ${event.type}`);

    // Procesamos el evento según su tipo
    switch (event.type) {
      // Manejar eventos de sesiones de checkout (método antiguo)
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        
        // Verificamos que sea un pago de suscripción y que tenga el token de usuario
        if (session.mode === 'subscription' && session.metadata?.auth_token) {
          const authToken = session.metadata.auth_token;
          await updateUserRole(authToken);
          console.log('User upgraded to premium through checkout session');
        }
        break;
      }

      // Manejar eventos de suscripciones (método nuevo)
      case 'customer.subscription.created': {
        const subscription = event.data.object as Stripe.Subscription;
        if (subscription.status === 'active' && subscription.metadata?.auth_token) {
          const authToken = subscription.metadata.auth_token;
          await updateUserRole(authToken);
          console.log('User upgraded to premium through subscription creation');
        }
        break;
      }

      // Manejar eventos de facturas pagadas (otro punto donde podemos actualizar el usuario)
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        
        // Si es una factura de suscripción y tiene ID de suscripción
        if (invoice.subscription) {
          try {
            // Obtener la suscripción para verificar el token en sus metadatos
            const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
            
            if (subscription.metadata?.auth_token) {
              const authToken = subscription.metadata.auth_token;
              await updateUserRole(authToken);
              console.log('User upgraded to premium through invoice payment');
            }
          } catch (error) {
            console.error('Failed to retrieve subscription from invoice:', error);
          }
        }
        break;
      }

      // Para el evento setup_intent.succeeded (cuando se confirma un método de pago)
      case 'setup_intent.succeeded': {
        const setupIntent = event.data.object as Stripe.SetupIntent;
        
        if (setupIntent.metadata?.auth_token) {
          const authToken = setupIntent.metadata.auth_token;
          
          // Intentamos actualizar el rol del usuario
          try {
            await updateUserRole(authToken);
            console.log('User upgraded to premium through setup intent completion');
          } catch (error) {
            console.error('Failed to update user role from setup intent:', error);
          }
        }
        break;
      }

      default:
        // No hacemos nada para otros tipos de eventos
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true, event: event.type });
  } catch (error) {
    console.error('Error handling webhook:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    );
  }
}