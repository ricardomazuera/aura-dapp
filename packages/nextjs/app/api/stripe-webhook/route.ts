import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import fs from 'fs/promises';
import path from 'path';

// Inicializamos Stripe con la clave privada
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-03-31.basil',
});

// Función para escribir logs en un archivo
async function logToFile(message: string) {
  try {
    const logDir = path.join(process.cwd(), 'logs');
    await fs.mkdir(logDir, { recursive: true });
    
    const logFilePath = path.join(logDir, 'stripe-webhook.log');
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}\n`;
    
    await fs.appendFile(logFilePath, logEntry);
  } catch (error) {
    console.error('Error writing to log file:', error);
  }
}

// Esta función actualiza el rol del usuario en nuestra base de datos
async function updateUserRole(token: string, customerId?: string) {
  try {
    await logToFile(`🔄 Updating user role with token: ${token.substring(0, 10)}...`);
    
    const response = await fetch(`${process.env.BACKEND_API_URL}/api/user/upgrade`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ customerId }) // Incluimos el customerId si está disponible
    });

    if (!response.ok) {
      const errorText = await response.text();
      await logToFile(`❌ Failed to upgrade user: ${response.status} - ${errorText}`);
      throw new Error(`Failed to upgrade user: ${response.statusText}`);
    }

    const result = await response.json();
    await logToFile(`✅ User role upgrade successful: ${JSON.stringify(result)}`);
    return result;
  } catch (error) {
    await logToFile(`❌ Error upgrading user role: ${(error as Error).message}`);
    console.error('Error upgrading user role:', error);
    throw error;
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature') || '';
    
    await logToFile(`🔔 Received webhook request with signature: ${signature.substring(0, 20)}...`);
    
    let event: Stripe.Event;

    // Verificamos que el webhook proviene de Stripe
    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET || ''
      );
    } catch (error) {
      const errorMessage = (error as Error).message;
      await logToFile(`❌ Webhook signature verification failed: ${errorMessage}`);
      return NextResponse.json(
        { error: 'Webhook signature verification failed' },
        { status: 400 }
      );
    }

    await logToFile(`📥 Received Stripe webhook event: ${event.type}`);

    // Procesamos el evento según su tipo
    switch (event.type) {
      // Manejar eventos de sesiones de checkout (método principal para Checkout)
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await logToFile(`✓ Checkout session completed: ${session.id}, mode: ${session.mode}`);
        
        // Verificamos que sea un pago de suscripción y que tenga el token de usuario
        if (session.mode === 'subscription') {
          if (session.metadata?.auth_token) {
            const authToken = session.metadata.auth_token;
            await logToFile(`🔑 Found auth token in session metadata`);
            
            try {
              await updateUserRole(authToken, session.customer as string);
              await logToFile(`✅ User upgraded to premium through checkout session: ${session.id}`);
            } catch (error) {
              await logToFile(`❌ Failed to upgrade user from checkout session: ${(error as Error).message}`);
            }
          } else {
            await logToFile(`⚠️ No auth_token found in session metadata`);
          }
        } else {
          await logToFile(`ℹ️ Session is not in subscription mode: ${session.mode}`);
        }
        break;
      }

      // Manejar eventos de suscripciones
      case 'customer.subscription.created': {
        const subscription = event.data.object as Stripe.Subscription;
        await logToFile(`✓ Subscription created: ${subscription.id}, status: ${subscription.status}`);
        
        if (subscription.metadata?.auth_token) {
          const authToken = subscription.metadata.auth_token;
          await logToFile(`🔑 Found auth token in subscription metadata`);
          
          try {
            await updateUserRole(authToken, subscription.customer as string);
            await logToFile(`✅ User upgraded to premium through subscription creation: ${subscription.id}`);
          } catch (error) {
            await logToFile(`❌ Failed to upgrade user from subscription: ${(error as Error).message}`);
          }
        } else {
          await logToFile(`⚠️ No auth_token found in subscription metadata`);
          
          // Intenta obtener el token del cliente si no está en la suscripción
          try {
            if (typeof subscription.customer === 'string') {
              const customer = await stripe.customers.retrieve(subscription.customer);
              if ('metadata' in customer && customer.metadata?.auth_token) {
                const authToken = customer.metadata.auth_token;
                await logToFile(`🔑 Found auth token in customer metadata`);
                await updateUserRole(authToken, subscription.customer);
                await logToFile(`✅ User upgraded using token from customer metadata`);
              } else {
                await logToFile(`⚠️ No auth_token found in customer metadata`);
              }
            }
          } catch (customerError) {
            await logToFile(`❌ Failed to retrieve customer: ${(customerError as Error).message}`);
          }
        }
        break;
      }

      // Manejar eventos de facturas pagadas
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        await logToFile(`✓ Invoice paid: ${invoice.id}, subscription: ${invoice.subscription || 'none'}`);
        
        // Si es una factura de suscripción y tiene ID de suscripción
        if (invoice.subscription) {
          try {
            // Obtener la suscripción para verificar el token en sus metadatos
            const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
            await logToFile(`✓ Retrieved subscription: ${subscription.id} for invoice: ${invoice.id}`);
            
            if (subscription.metadata?.auth_token) {
              const authToken = subscription.metadata.auth_token;
              await logToFile(`🔑 Found auth token in subscription metadata`);
              await updateUserRole(authToken, subscription.customer as string);
              await logToFile(`✅ User upgraded to premium through invoice payment: ${invoice.id}`);
            } else {
              await logToFile(`⚠️ No auth_token found in subscription metadata`);
              
              // Intenta obtener el token del cliente
              if (typeof subscription.customer === 'string') {
                const customer = await stripe.customers.retrieve(subscription.customer);
                if ('metadata' in customer && customer.metadata?.auth_token) {
                  const authToken = customer.metadata.auth_token;
                  await logToFile(`🔑 Found auth token in customer metadata`);
                  await updateUserRole(authToken, subscription.customer);
                  await logToFile(`✅ User upgraded using token from customer metadata`);
                } else {
                  await logToFile(`⚠️ No auth_token found in customer metadata`);
                }
              }
            }
          } catch (error) {
            await logToFile(`❌ Failed processing invoice: ${(error as Error).message}`);
          }
        } else {
          await logToFile(`ℹ️ Invoice is not associated with a subscription: ${invoice.id}`);
        }
        break;
      }

      default:
        // No hacemos nada para otros tipos de eventos
        await logToFile(`ℹ️ Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true, event: event.type });
  } catch (error) {
    const errorMessage = (error as Error).message;
    await logToFile(`❌ Error handling webhook: ${errorMessage}`);
    console.error('Error handling webhook:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage },
      { status: 500 }
    );
  }
}