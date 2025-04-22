'use client';

import { useState, useEffect } from 'react';
import { 
  PaymentElement,
  CardElement,
  LinkAuthenticationElement,
  useStripe, 
  useElements 
} from '@stripe/react-stripe-js';
import { useAuthStore } from '~~/store/authStore';

interface StripePaymentFormProps {
  clientSecret: string;
  customerId: string;
  onSuccess: () => void;
  onError: (message: string) => void;
}

export default function StripePaymentForm({ 
  clientSecret, 
  customerId, 
  onSuccess, 
  onError 
}: StripePaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const { user } = useAuthStore();

  useEffect(() => {
    if (user?.email) {
      setEmail(user.email);
    }
  }, [user]);

  // Establecer el clientSecret en el momento del montaje
  useEffect(() => {
    if (!stripe || !clientSecret) {
      return;
    }

    // Si ya tenemos el clientSecret, podemos comprobar si hay algún error pendiente
    stripe
      .retrieveSetupIntent(clientSecret)
      .then(({ setupIntent }) => {
        if (
          setupIntent &&
          setupIntent.status === 'requires_payment_method' &&
          setupIntent.last_setup_error
        ) {
          onError(setupIntent.last_setup_error.message || 'Error in payment setup');
        }
      })
      .catch(error => {
        console.error('Error retrieving setup intent:', error);
      });
  }, [stripe, clientSecret, onError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      // Stripe.js no ha sido cargado todavía
      return;
    }

    setIsLoading(true);

    try {
      // Obtener el elemento de tarjeta
      const cardElement = elements.getElement(CardElement);
      
      if (!cardElement) {
        // Si no encontramos el elemento de tarjeta, intentamos confirmar con PaymentElement
        const { error: submitError } = await stripe.confirmSetup({
          elements,
          confirmParams: {
            return_url: `${window.location.origin}/dashboard?success=true`,
          },
        });

        if (submitError) {
          onError(submitError.message || 'Error processing payment');
          return;
        }

        // Método alternativo para obtener el estado del SetupIntent
        const setupIntent = await stripe.retrieveSetupIntent(clientSecret);
        
        if (setupIntent.setupIntent?.status === 'succeeded') {
          console.log('Setup intent succeeded, creating subscription');
        } else {
          console.log(`Setup intent status: ${setupIntent.setupIntent?.status}`);
          if (setupIntent.setupIntent?.status !== 'processing') {
            onError('Payment processing failed. Please try again.');
            setIsLoading(false);
            return;
          }
        }
      } else {
        // Método alternativo usando CardElement directamente
        const { error, setupIntent } = await stripe.confirmCardSetup(clientSecret, {
          payment_method: {
            card: cardElement,
            billing_details: {
              email: email,
            },
          },
        });

        if (error) {
          onError(error.message || 'Error processing payment');
          return;
        }

        if (setupIntent?.status !== 'succeeded') {
          // En este punto, podemos esperar a que el usuario complete la autenticación 3D Secure, etc.
          onError('Payment processing failed. Please try again.');
          setIsLoading(false);
          return;
        }
      }

      // Llamar a nuestra API para crear la suscripción
      const response = await fetch('/api/confirm-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerId: customerId,
          email: email
        }),
      });

      const subscriptionData = await response.json();

      if (subscriptionData.error) {
        onError(subscriptionData.error);
        return;
      }

      console.log('Subscription created:', subscriptionData);

      // Actualizar directamente el rol del usuario con la función del AuthStore
      // Esto evita la dependencia del webhook y actualiza la UI inmediatamente
      const upgraded = await user?.role === 'pro' || await useAuthStore.getState().upgradeUserRole();
      
      if (!upgraded) {
        console.warn('User role upgrade may have failed, but subscription was created');
      }

      // Suscripción creada exitosamente
      onSuccess();
    } catch (error) {
      console.error('Error en el proceso de pago:', error);
      onError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="mb-4">
        <label htmlFor="email" className="block mb-1 text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-3 py-2 border rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
          placeholder="your-email@example.com"
          required
        />
      </div>
      
      <div className="mb-4">
        <label className="block mb-1 text-sm font-medium">
          Card Details
        </label>
        <div className="p-3 border rounded-md shadow-sm bg-white">
          <PaymentElement />
        </div>
      </div>
      
      <button
        disabled={isLoading || !stripe || !elements}
        className="w-full py-3 px-4 rounded-lg font-medium bg-aura-primary text-white hover:bg-aura-secondary transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
      >
        {isLoading ? 'Processing...' : 'Subscribe Now'}
      </button>
    </form>
  );
}