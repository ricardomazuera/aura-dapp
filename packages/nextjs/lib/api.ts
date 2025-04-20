const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

export interface User {
  id: string;
  email: string;
  role: 'free' | 'pro';
}

export interface Habit {
  id: string;
  userId: string;
  name: string;
  daysCompleted: number;
  completed: boolean;
  createdAt: string;
}

// Helper para obtener el token del localStorage
const getAuthToken = (): string | null => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('aura_token');
  }
  return null;
};

// Helper para crear headers de autenticación
const createAuthHeaders = (providedToken?: string) => {
  const token = providedToken || getAuthToken();
  return {
    'Authorization': token ? `Bearer ${token}` : '',
    'Content-Type': 'application/json'
  };
};

export const getUserRole = async (token?: string): Promise<User> => {
  try {
    const response = await fetch(`${API_URL}/api/user/role`, {
      method: 'GET',
      headers: createAuthHeaders(token)
    });
    
    if (!response.ok) {
      throw new Error('Failed to get user role');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error getting user role:', error);
    throw error;
  }
};

export const getHabits = async (token?: string): Promise<Habit[]> => {
  try {
    const response = await fetch(`${API_URL}/api/habits`, {
      method: 'GET',
      headers: createAuthHeaders(token)
    });
    
    if (!response.ok) {
      throw new Error('Failed to get habits');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error getting habits:', error);
    throw error;
  }
};

export const createHabit = async (name: string, token?: string): Promise<Habit> => {
  try {
    const response = await fetch(`${API_URL}/api/habits`, {
      method: 'POST',
      headers: createAuthHeaders(token),
      body: JSON.stringify({ name })
    });
    
    if (!response.ok) {
      throw new Error('Failed to create habit');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error creating habit:', error);
    throw error;
  }
};

export const updateHabitProgress = async (habitId: string, token?: string): Promise<Habit> => {
  try {
    const response = await fetch(`${API_URL}/api/habits/${habitId}/progress`, {
      method: 'PUT',
      headers: createAuthHeaders(token)
    });
    
    if (!response.ok) {
      throw new Error('Failed to update habit progress');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error updating habit progress:', error);
    throw error;
  }
};

/**
 * Envía la información del usuario al backend para crear una wallet
 * @param userId El ID del usuario de Supabase
 * @param email El correo del usuario
 * @param accessToken Token de acceso (opcional, si no se proporciona se usará el del localStorage)
 * @returns La respuesta del servidor con la información de la wallet creada o existente
 */
export const createOrGetUserWallet = async (userId: string, email: string, accessToken?: string) => {
  try {
    const response = await fetch(`${API_URL}/api/login`, {
      method: 'POST',
      headers: createAuthHeaders(accessToken),
      body: JSON.stringify({ userId, email })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to parse error' }));
      throw new Error(errorData.message || `Error ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error creating/getting wallet:', error);
    throw error;
  }
};