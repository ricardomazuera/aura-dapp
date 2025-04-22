import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
  try {
    // Obtener el token del usuario desde las cookies
    const cookieStore = cookies();
    const token = cookieStore.get('aura_token')?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'No authentication token found' },
        { status: 401 }
      );
    }

    console.log('Updating user session to reflect premium status');

    // Llamar al backend para obtener información actualizada del usuario
    const response = await fetch(`${process.env.BACKEND_API_URL}/api/user/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.error(`Error getting user info: ${response.statusText}`);
      return NextResponse.json(
        { error: 'Failed to fetch updated user information' },
        { status: response.status }
      );
    }

    // Si la suscripción aún no se ha reflejado en el backend, llamamos a upgrade directamente
    const userData = await response.json();
    
    if (userData.role !== 'premium') {
      console.log('User not yet premium, calling upgrade endpoint directly');
      
      const upgradeResponse = await fetch(`${process.env.BACKEND_API_URL}/api/user/upgrade`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!upgradeResponse.ok) {
        console.error(`Error upgrading user: ${upgradeResponse.statusText}`);
        return NextResponse.json(
          { error: 'Failed to upgrade user' },
          { status: upgradeResponse.status }
        );
      }
      
      console.log('User upgraded to premium successfully');
    } else {
      console.log('User is already premium');
    }

    return NextResponse.json({ success: true, message: 'Session updated successfully' });
  } catch (error) {
    console.error('Error updating session:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}