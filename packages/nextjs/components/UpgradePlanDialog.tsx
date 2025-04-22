'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, CheckCircle, CreditCard } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { useTheme } from 'next-themes';
import { useAuthStore } from '~~/store/authStore';
import StripePaymentForm from './StripePaymentForm';

interface UpgradePlanDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

// Initialize Stripe with your publishable key
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

export default function UpgradePlanDialog({ isOpen, onClose }: UpgradePlanDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [paymentStep, setPaymentStep] = useState<'info' | 'payment' | 'success'>('info');
  const [clientSecret, setClientSecret] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const { resolvedTheme } = useTheme();
  const { user } = useAuthStore();
  const isDarkMode = resolvedTheme === "dark";

  // Limpiar estados al cerrar el diálogo
  useEffect(() => {
    if (!isOpen) {
      setPaymentStep('info');
      setErrorMessage('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleStartPayment = async () => {
    try {
      setIsLoading(true);
      setErrorMessage('');
      
      // Obtener una SetupIntent para el pago
      const response = await fetch('/api/create-payment-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: user?.email || '',
        }),
      });

      const data = await response.json();
      
      if (data.error) {
        setErrorMessage(data.error);
        return;
      }
      
      setClientSecret(data.clientSecret);
      setCustomerId(data.customerId);
      setPaymentStep('payment');
    } catch (error) {
      console.error('Error iniciando el pago:', error);
      setErrorMessage('Ocurrió un error al iniciar el proceso de pago. Por favor, inténtalo de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePaymentSuccess = () => {
    setPaymentStep('success');
  };

  const handlePaymentError = (message: string) => {
    setErrorMessage(message);
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div 
          className={`${isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'} rounded-xl shadow-xl max-w-md w-full max-h-[90vh] flex flex-col`}
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
        >
          {/* Encabezado - Fijo en la parte superior */}
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-display flex items-center gap-2">
                <Sparkles className="h-6 w-6 text-aura-primary" />
                Upgrade to Premium
              </h2>
              <button 
                onClick={onClose}
                className={`${isDarkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'} transition-colors`}
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Mensaje de error */}
            {errorMessage && (
              <div className={`mt-4 ${isDarkMode ? 'bg-red-900/30 border-red-800' : 'bg-red-50 border-red-200'} border text-red-700 p-3 rounded-md`}>
                {errorMessage}
              </div>
            )}
          </div>

          {/* Contenido con scroll si es necesario */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Contenido según el paso */}
            {paymentStep === 'info' && (
              <>
                <div className={`${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'} p-4 rounded-lg mb-6`}>
                  <h3 className="font-semibold text-lg mb-2">Premium Benefits:</h3>
                  <ul className="space-y-2">
                    <li className="flex items-start">
                      <span className="text-aura-primary mr-2">✓</span>
                      <span>Track up to 5 habits simultaneously</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-aura-primary mr-2">✓</span>
                      <span>After completing 5 habits, get 5 more slots</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-aura-primary mr-2">✓</span>
                      <span>Priority support</span>
                    </li>
                  </ul>
                </div>
                
                <div className="text-center mb-6">
                  <div className="text-3xl font-bold text-aura-primary mb-1">$6.99<span className="text-base font-normal">/month</span></div>
                  <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-500'} text-sm`}>Cancel anytime</p>
                </div>
              </>
            )}

            {paymentStep === 'payment' && clientSecret && (
              <Elements stripe={stripePromise} options={{ 
                clientSecret,
                appearance: { 
                  theme: isDarkMode ? 'night' : 'stripe',
                  variables: {
                    colorPrimary: '#8b5cf6', // aura-primary
                  } 
                } 
              }}>
                <StripePaymentForm 
                  clientSecret={clientSecret} 
                  customerId={customerId}
                  onSuccess={handlePaymentSuccess} 
                  onError={handlePaymentError} 
                />
              </Elements>
            )}

            {paymentStep === 'success' && (
              <div className="text-center py-4">
                <CheckCircle className="h-16 w-16 mx-auto text-green-500 mb-4" />
                <h3 className="text-xl font-semibold mb-2">Subscription Successful!</h3>
                <p className="mb-6">Your account has been upgraded to Premium. You can now enjoy all the benefits.</p>
              </div>
            )}
          </div>

          {/* Botones - Fijos en la parte inferior */}
          <div className="p-6 border-t border-gray-200 dark:border-gray-700">
            {paymentStep === 'info' && (
              <button
                onClick={handleStartPayment}
                disabled={isLoading}
                className={`w-full flex items-center justify-center gap-3 py-3 px-4 rounded-lg font-medium bg-aura-primary text-white hover:bg-aura-secondary transition-colors ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                {isLoading ? 'Processing...' : (
                  <>
                    <CreditCard className="h-5 w-5" /> 
                    Continue to payment
                  </>
                )}
              </button>
            )}

            {paymentStep === 'success' && (
              <button
                onClick={onClose}
                className="w-full py-3 px-4 rounded-lg font-medium bg-aura-primary text-white hover:bg-aura-secondary transition-colors"
              >
                Continue
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}