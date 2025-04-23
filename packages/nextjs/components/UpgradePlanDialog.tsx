'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, CreditCard } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useAuthStore } from '~~/store/authStore';

interface UpgradePlanDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UpgradePlanDialog({ isOpen, onClose }: UpgradePlanDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const { resolvedTheme } = useTheme();
  const { user } = useAuthStore();
  const isDarkMode = resolvedTheme === 'dark';

  // Get token from localStorage only on client-side
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedToken = localStorage.getItem('aura_token');
      setToken(storedToken);
    }
  }, []);

  // Clear states when closing the dialog
  useEffect(() => {
    if (!isOpen) {
      setErrorMessage('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleStartPayment = async () => {
    try {
      setIsLoading(true);
      setErrorMessage('');
  
      // Make sure we're in the browser and get the token directly
      let token: string | null = null;
      if (typeof window !== 'undefined') {
        token = localStorage.getItem('aura_token');
      }
  
      if (!token) {
        setErrorMessage('Authentication failed. Please try logging in again.');
        return;
      }
  
      const response = await fetch('/api/create-checkout-session', {
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
  
      // Redirect to Stripe checkout page
      window.location.href = data.url;
    } catch (error) {
      console.error('Error starting checkout:', error);
      setErrorMessage('An error occurred when starting the payment process. Please try again.');
    } finally {
      setIsLoading(false);
    }
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

            {errorMessage && (
              <div className={`mt-4 ${isDarkMode ? 'bg-red-900/30 border-red-800' : 'bg-red-50 border-red-200'} border text-red-700 p-3 rounded-md`}>
                {errorMessage}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            <div className={`${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'} p-4 rounded-lg mb-6`}>
              <h3 className="font-semibold text-lg mb-2">Premium Benefits:</h3>
              <ul className="space-y-2">
                <li className="flex items-start"><span className="text-aura-primary mr-2">✓</span><span>Track up to 5 habits simultaneously</span></li>
                <li className="flex items-start"><span className="text-aura-primary mr-2">✓</span><span>After completing 5 habits, get 5 more slots</span></li>
                <li className="flex items-start"><span className="text-aura-primary mr-2">✓</span><span>Priority support</span></li>
              </ul>
            </div>
            <div className="text-center mb-6">
              <div className="text-3xl font-bold text-aura-primary mb-1">$6.99<span className="text-base font-normal">/month</span></div>
              <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-500'} text-sm`}>Cancel anytime</p>
            </div>
          </div>

          <div className="p-6 border-t border-gray-200 dark:border-gray-700">
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
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
