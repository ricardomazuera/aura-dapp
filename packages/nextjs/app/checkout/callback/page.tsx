'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '~~/store/authStore';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

export default function CheckoutCallback() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Procesando tu pago...');
  const router = useRouter();
  const searchParams = useSearchParams();
  const { updateRoleUser, refetchUser } = useAuthStore();
  
  // Controlar la redirección manualmente para asegurarnos que siempre ocurra
  const [redirectCountdown, setRedirectCountdown] = useState(3);

  useEffect(() => {
    // Asegurarse de que la redirección ocurra incluso si hay errores en el procesamiento
    const redirectTimer = setTimeout(() => {
      console.log('Redirecting to dashboard after timeout');
      router.push('/dashboard');
    }, 5000); // 5 segundos como fallback de seguridad
    
    return () => clearTimeout(redirectTimer);
  }, [router]);

  // Cuenta regresiva para la redirección
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
        // Obtener los parámetros de la URL
        const success = searchParams.get('success');
        const canceled = searchParams.get('canceled');
        const sessionId = searchParams.get('session_id');
        
        // IMPORTANTE: Obtener el token de autenticación del localStorage
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
            setMessage('Error de autenticación. No se pudo actualizar tu plan. Por favor, contacta con soporte.');
            return;
          }
          
          // Hacer la llamada directa al API del backend en lugar de usar updateRoleUser
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
            // Actualizar los datos del usuario en el store
            await refetchUser();
            setStatus('success');
            setMessage('¡Tu suscripción ha sido activada con éxito! Ahora disfrutas de todos los beneficios premium.');
          } else {
            console.error('Failed to update user role:', response.status);
            setStatus('error');
            setMessage('El pago se procesó correctamente, pero hubo un problema al actualizar tu plan. Por favor, contacta con soporte.');
          }
        } else if (canceled === 'true') {
          setStatus('error');
          setMessage('Has cancelado el proceso de pago. Puedes intentarlo nuevamente cuando lo desees.');
        } else {
          // Si no hay parámetros válidos
          setStatus('error');
          setMessage('No se pudo validar el estado del pago. Por favor, contacta con soporte si realizaste un pago.');
        }
      } catch (error) {
        console.error('Error processing checkout callback:', error);
        setStatus('error');
        setMessage('Ocurrió un error inesperado. Por favor, contacta con soporte.');
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
            <h2 className="text-2xl font-bold mb-2">Procesando</h2>
          </>
        )}
        
        {status === 'success' && (
          <>
            <CheckCircle className="h-16 w-16 mx-auto text-green-500 mb-4" />
            <h2 className="text-2xl font-bold mb-2">¡Pago Exitoso!</h2>
          </>
        )}
        
        {status === 'error' && (
          <>
            <XCircle className="h-16 w-16 mx-auto text-red-500 mb-4" />
            <h2 className="text-2xl font-bold mb-2">Error en el Pago</h2>
          </>
        )}
        
        <p className="text-gray-600 dark:text-gray-300 mb-6">{message}</p>
        
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Serás redirigido al dashboard en {redirectCountdown} {redirectCountdown === 1 ? 'segundo' : 'segundos'}...
        </div>
      </div>
    </div>
  );
}