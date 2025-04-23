'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '~~/store/authStore';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

export default function CheckoutCallback() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Processing your payment...');
  const router = useRouter();
  const searchParams = useSearchParams();
  const { updateRoleUser, refetchUser } = useAuthStore();
  
  // Control redirection manually to ensure it always happens
  const [redirectCountdown, setRedirectCountdown] = useState(3);

  useEffect(() => {
    // Ensure redirection occurs even if there are errors in processing
    const redirectTimer = setTimeout(() => {
      console.log('Redirecting to dashboard after timeout');
      router.push('/dashboard');
    }, 5000); // 5 seconds as a safety fallback
    
    return () => clearTimeout(redirectTimer);
  }, [router]);

  // Countdown for redirection
  useEffect(() => {
    if (status !== 'loading' && redirectCountdown > 0) {
      const countdownInterval = setInterval(() => {
        setRedirectCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownInterval);
            router.push('/dashboard');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      return () => clearInterval(countdownInterval);
    }
  }, [status, redirectCountdown, router]);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get URL parameters
        const success = searchParams.get('success');
        const canceled = searchParams.get('canceled');
        const sessionId = searchParams.get('session_id');
        
        // IMPORTANT: Get the authentication token from localStorage
        let authToken = '';
        if (typeof window !== 'undefined') {
          authToken = localStorage.getItem('aura_token') || '';
          console.log('Auth token retrieved from localStorage:', authToken ? 'present' : 'not found');
        }

        if (success === 'true' && sessionId) {
          console.log('Payment successful, updating user role...');
          
          if (!authToken) {
            console.error('Auth token not found in localStorage');
            setStatus('error');
            setMessage('Authentication error. Could not update your plan. Please contact support.');
            return;
          }
          
          // Make direct call to backend API instead of using updateRoleUser
          const backendUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://localhost:8080';
          const updateRoleUrl = `${backendUrl}/api/user/role`;
          
          console.log('Calling backend API to update role:', updateRoleUrl);
          
          const response = await fetch(updateRoleUrl, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
              role: 'pro',
              sessionId: sessionId,
              fromWebhook: false
            })
          });
          
          if (response.ok) {
            console.log('User role updated successfully');
            // Update user data in the store
            await refetchUser();
            setStatus('success');
            setMessage('Your subscription has been successfully activated! You now have access to all premium benefits.');
          } else {
            console.error('Failed to update user role:', response.status);
            setStatus('error');
            setMessage('Payment was processed successfully, but there was a problem updating your plan. Please contact support.');
          }
        } else if (canceled === 'true') {
          setStatus('error');
          setMessage('You have canceled the payment process. You can try again whenever you want.');
        } else {
          // If there are no valid parameters
          setStatus('error');
          setMessage('Could not validate payment status. Please contact support if you made a payment.');
        }
      } catch (error) {
        console.error('Error processing checkout callback:', error);
        setStatus('error');
        setMessage('An unexpected error occurred. Please contact support.');
      }
    };

    handleCallback();
  }, [searchParams, router, updateRoleUser, refetchUser]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-aura-primary/10 to-aura-secondary/5 p-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-xl shadow-xl p-8 text-center">
        {status === 'loading' && (
          <>
            <Loader2 className="h-16 w-16 mx-auto text-aura-primary animate-spin mb-4" />
            <h2 className="text-2xl font-bold mb-2">Processing</h2>
          </>
        )}
        
        {status === 'success' && (
          <>
            <CheckCircle className="h-16 w-16 mx-auto text-green-500 mb-4" />
            <h2 className="text-2xl font-bold mb-2">Payment Successful!</h2>
          </>
        )}
        
        {status === 'error' && (
          <>
            <XCircle className="h-16 w-16 mx-auto text-red-500 mb-4" />
            <h2 className="text-2xl font-bold mb-2">Payment Error</h2>
          </>
        )}
        
        <p className="text-gray-600 dark:text-gray-300 mb-6">{message}</p>
        
        <div className="text-sm text-gray-500 dark:text-gray-400">
          You will be redirected to the dashboard in {redirectCountdown} {redirectCountdown === 1 ? 'second' : 'seconds'}...
        </div>
      </div>
    </div>
  );
}