'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '~~/store/authStore';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isLoading, checkSession } = useAuthStore();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [checkComplete, setCheckComplete] = useState(false);

  useEffect(() => {
    const checkAuthentication = async () => {
      try {
        console.log("AuthGuard: Checking session");
        // Ensure that you have the most up-to-date user information
        await checkSession();
        
        console.log("AuthGuard: Session check complete, user:", !!user);
        setCheckComplete(true);
        
        // If there's no user and loading is complete, redirect to the home page
        if (!user && !isLoading) {
          console.log("AuthGuard: No user found, redirecting to home");
          setIsRedirecting(true);
          router.push('/');
        }
      } catch (error) {
        console.error("Error in AuthGuard:", error);
        setCheckComplete(true);
      }
    };
    
    if (!checkComplete && !isRedirecting) {
      checkAuthentication();
    }
  }, [isLoading, router, checkSession]);

  // Show spinner while checking authentication or loading
  if (isLoading || !checkComplete) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-aura-primary"></div>
      </div>
    );
  }

  // If redirecting, show spinner
  if (isRedirecting) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-aura-primary"></div>
      </div>
    );
  }


  // If there's no user, we shouldn't be here, but just in case
  // we try to redirect again
  if (!user) {
    // Try to redirect again if for some reason it didn't redirect before
    if (!isRedirecting) {
      router.push('/');
      setIsRedirecting(true);
    }
    
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-aura-primary"></div>
      </div>
    );
  }
  
  // If there is an authenticated user, show the protected content
  return <>{children}</>;
}