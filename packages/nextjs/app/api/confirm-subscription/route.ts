import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { cookies } from 'next/headers';

// Inicializamos Stripe con la clave privada
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-03-31.basil',
});

export async function POST(request: Request) {
  try {
    // Obtenemos el token de autenticación
    const cookieStore = cookies();
    const token = cookieStore.get('aura_token')?.value || '';
    
    // Obtenemos los datos de la solicitud
    const { customerId, email, paymentMethodId } = await request.json();
    
    if (!customerId) {
      return NextResponse.json(
        { error: 'Customer ID is required' },
        { status: 400 }
      );
    }

    console.log(`[Subscription] Processing subscription for customer: ${customerId}`);
    if (!token) {
      console.warn(`[Subscription] Warning: No auth token found for customer ${customerId}. User role might not be updated.`);
    }

    let defaultPaymentMethodId = paymentMethodId;

    // Si no se proporcionó un ID de método de pago, intentamos obtener el predeterminado
    if (!defaultPaymentMethodId) {
      try {
        console.log('[Subscription] No payment method ID provided, looking for existing payment methods');
        
        // Obtenemos el setup intent más reciente para este cliente
        const setupIntents = await stripe.setupIntents.list({
          customer: customerId,
          limit: 1,
        });

        if (setupIntents.data.length > 0 && setupIntents.data[0].payment_method) {
          defaultPaymentMethodId = setupIntents.data[0].payment_method as string;
          console.log(`[Subscription] Found payment method from setup intent: ${defaultPaymentMethodId}`);
        } else {
          // Buscar métodos de pago asociados al cliente
          const paymentMethods = await stripe.paymentMethods.list({
            customer: customerId,
            type: 'card',
          });

          if (paymentMethods.data.length > 0) {
            defaultPaymentMethodId = paymentMethods.data[0].id;
            console.log(`[Subscription] Found payment method from customer: ${defaultPaymentMethodId}`);
          }
        }
      } catch (error) {
        console.error('[Subscription] Error getting payment methods:', error);
      }
    }

    if (!defaultPaymentMethodId) {
      console.error('[Subscription] No payment method found for customer');
      return NextResponse.json(
        { error: 'No payment method found. Please try again.' },
        { status: 400 }
      );
    }

    // Asociar el método de pago con el cliente si no estaba previamente asociado
    try {
      await stripe.paymentMethods.attach(defaultPaymentMethodId, {
        customer: customerId,
      });
      console.log(`[Subscription] Attached payment method ${defaultPaymentMethodId} to customer ${customerId}`);
    } catch (error) {
      // Si ya está asociado, ignoramos el error
      console.log('[Subscription] Payment method might already be attached to this customer');
    }
    
    // Establecer este método de pago como el predeterminado para el cliente
    await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: defaultPaymentMethodId },
    });
    console.log(`[Subscription] Set payment method ${defaultPaymentMethodId} as default for customer ${customerId}`);

    // Verificar si el usuario ya tiene una suscripción, incluso si no está activa
    const existingSubscriptions = await stripe.subscriptions.list({
      customer: customerId,
      limit: 1,
      status: 'all',
    });

    // Si ya existe una suscripción de cualquier tipo
    if (existingSubscriptions.data.length > 0) {
      const existingSub = existingSubscriptions.data[0];
      console.log(`[Subscription] Customer ${customerId} already has a subscription ${existingSub.id} with status ${existingSub.status}`);
      
      // Si la suscripción está en estado cancellation_requested, canceled, incomplete_expired,
      // creamos una nueva en lugar de intentar reactivar
      if (['cancellation_requested', 'canceled', 'incomplete_expired'].includes(existingSub.status)) {
        console.log(`[Subscription] Creating new subscription because existing one is in state: ${existingSub.status}`);
      } 
      // Si la suscripción está activa, trialing o unpaid, la actualizamos
      else if (['active', 'trialing', 'past_due', 'unpaid'].includes(existingSub.status)) {
        // Actualizar los metadatos para asegurar que tiene el token
        if (token) {
          await stripe.subscriptions.update(existingSub.id, {
            metadata: { auth_token: token },
          });
          console.log(`[Subscription] Updated metadata with auth token for subscription ${existingSub.id}`);
        }
        
        // Intentar actualizar el rol de usuario para asegurarnos
        await updateUserRoleDirectly(token, customerId);
        
        return NextResponse.json({
          subscription: existingSub,
          success: true,
          status: existingSub.status,
          user_updated: true
        });
      }
      // Si la suscripción está en estado 'incomplete', intentamos completarla
      else if (existingSub.status === 'incomplete') {
        try {
          // Actualizar los metadatos para asegurar que tiene el token
          if (token) {
            await stripe.subscriptions.update(existingSub.id, {
              metadata: { auth_token: token },
              default_payment_method: defaultPaymentMethodId
            });
            console.log(`[Subscription] Updated incomplete subscription ${existingSub.id} with token and payment method`);
          }
          
          // Intentar actualizar el rol de usuario de todos modos
          await updateUserRoleDirectly(token, customerId);
          
          return NextResponse.json({
            subscription: existingSub,
            success: true,
            status: 'incomplete_but_processing',
            user_updated: true
          });
        } catch (error) {
          console.error(`[Subscription] Error updating incomplete subscription: ${error}`);
        }
      }
    }

    // Crear una nueva suscripción
    console.log(`[Subscription] Creating new subscription for customer ${customerId}`);
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [
        {
          price: process.env.STRIPE_PREMIUM_PRICE_ID,
        },
      ],
      default_payment_method: defaultPaymentMethodId,
      payment_behavior: 'error_if_incomplete',  // Cambiado para que falle inmediatamente si hay problemas
      payment_settings: {
        payment_method_types: ['card'],
        save_default_payment_method: 'on_subscription',
      },
      expand: ['latest_invoice.payment_intent'],
      metadata: {
        auth_token: token,
        email: email || '',
      },
    });
    
    console.log(`[Subscription] Created subscription ${subscription.id} for customer ${customerId} with status ${subscription.status}`);

    // Si la suscripción requiere acción adicional, devolvemos la información necesaria
    const invoice = subscription.latest_invoice as Stripe.Invoice;
    const paymentIntent = invoice?.payment_intent as Stripe.PaymentIntent;

    if (paymentIntent && paymentIntent.status === 'requires_action') {
      console.log(`[Subscription] Payment for subscription ${subscription.id} requires additional action`);
      
      return NextResponse.json({
        subscription: subscription,
        paymentIntent: paymentIntent,
        clientSecret: paymentIntent.client_secret,
        success: false,
        status: 'requires_action',
      });
    }

    // Actualizar el rol del usuario independientemente del estado de la suscripción
    // Nota: La suscripción podría estar en estado 'incomplete' o 'active' en este punto
    console.log(`[Subscription] Subscription ${subscription.id} created with status ${subscription.status}, updating user role now`);
    
    // IMPORTANTE: Siempre intentamos actualizar el rol del usuario, incluso si la suscripción
    // no está completamente activa todavía
    try {
      await updateUserRoleDirectly(token, customerId);
      console.log(`[Subscription] User role update attempted for subscription ${subscription.id}`);
    } catch (error) {
      console.error(`[Subscription] Failed to update user role, but subscription was created: ${error}`);
    }

    return NextResponse.json({
      subscription: subscription,
      success: true,
      status: subscription.status,
      user_updated: true
    });
  } catch (error) {
    console.error('[Subscription] Error creating subscription:', error);
    return NextResponse.json(
      { error: 'Error creating subscription', details: (error as Error).message },
      { status: 500 }
    );
  }
}

// Función separada para actualizar el rol del usuario
async function updateUserRoleDirectly(token: string, customerId?: string) {
  if (!token) {
    console.error('[Subscription] No auth token available, cannot update user role');
    return;
  }

  try {
    console.log('[Subscription] Attempting to update user role directly');
    
    const backendResponse = await fetch(`${process.env.BACKEND_API_URL}/api/user/upgrade`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ customerId })  // Opcionalmente enviamos el ID de cliente de Stripe al backend
    });
    
    if (!backendResponse.ok) {
      const errorText = await backendResponse.text();
      console.error(`[Subscription] Error upgrading user role in backend: ${errorText}`);
      throw new Error(`Backend returned error: ${backendResponse.status} ${errorText}`);
    }
    
    const result = await backendResponse.json();
    console.log('[Subscription] User role updated successfully:', result);
    return result;
  } catch (backendError) {
    console.error('[Subscription] Failed to communicate with backend:', backendError);
    throw backendError;
  }
}