'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '~~/store/authStore';

export function HomeRedirect({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, checkSession } = useAuthStore();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [checkComplete, setCheckComplete] = useState(false);

  useEffect(() => {
    const checkAuthentication = async () => {
      try {
        console.log("HomeRedirect: Checking session");
        // Ensure that you have the most up-to-date user information
        await checkSession();
        
        console.log("HomeRedirect: Session check complete, user:", !!user);
        setCheckComplete(true);
        
        // if exists a user and loading is complete, redirect to the dashboard
        if (user) {
          console.log("HomeRedirect: Redirecting to dashboard");
          setIsRedirecting(true);
          router.push('/dashboard');
        }
      } catch (error) {
        console.error("Error in HomeRedirect:", error);
        setCheckComplete(true);
      }
    };
    
    if (!checkComplete && !isRedirecting) {
      checkAuthentication();
    }
  }, [router, checkSession]);

  // Just show the spinner while loading
  if (!checkComplete) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-aura-primary"></div>
      </div>
    );
  }

  // If redirecting, show a spinner
  if (isRedirecting) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-aura-primary"></div>
      </div>
    );
  }

  // If the user is authenticated, we shouldn't be here, but just in case
  // we try to redirect again
  if (user) {
    // Try to redirect again if for some reason it didn't redirect before
    if (!isRedirecting) {
      router.push('/dashboard');
      setIsRedirecting(true);
    }
    
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-aura-primary"></div>
      </div>
    );
  }
  
  // If there's no user and loading is complete, show the home page content
  return <>{children}</>;
}