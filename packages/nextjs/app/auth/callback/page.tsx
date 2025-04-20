"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '~~/store/authStore';

export default function AuthCallback() {
  const router = useRouter();
  const { handleAuthRedirect, isLoading, error, isWalletCreated } = useAuthStore();
  const [processingState, setProcessingState] = useState<string>('Completing authentication...');

  useEffect(() => {
    const processAuth = async () => {
      try {
        setProcessingState('Completing authentication...');
        await handleAuthRedirect();
        
        // If there's no error, redirecting will happen in the handleAuthRedirect function
      } catch (error) {
        console.error('Error processing authentication:', error);
        setProcessingState('Authentication failed. Redirecting to homepage...');
        setTimeout(() => {
          router.push('/');
        }, 2000);
      }
    };

    processAuth();
  }, [handleAuthRedirect, router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-5">
      <div className="text-center max-w-md mx-auto p-6 bg-white rounded-lg shadow-lg dark:bg-gray-800">
        <h1 className="text-xl font-bold mb-4">Processing Your Sign In</h1>
        
        {isLoading && (
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-aura-blue mb-4"></div>
            <p>{processingState}</p>
            {isWalletCreated === false && (
              <p className="text-sm mt-2 text-aura-gray-600">
                Setting up your wallet... This may take a moment.
              </p>
            )}
          </div>
        )}
        
        {error && (
          <div className="text-red-500 mt-4">
            <p>Error: {error}</p>
            <button 
              onClick={() => router.push('/')}
              className="mt-4 px-4 py-2 bg-aura-blue text-white rounded hover:bg-aura-blue-dark transition-colors"
            >
              Return to Home
            </button>
          </div>
        )}
      </div>
    </div>
  );
}