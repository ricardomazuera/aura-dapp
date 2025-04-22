const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

export interface User {
  id: string;
  email: string;
  role: 'free' | 'pro';
  firstName: string | null;
  lastName: string | null;
}

export interface Habit {
  id: string;
  userId: string;
  name: string;
  daysCompleted: number;
  completed: boolean;
  createdAt: string;
}

// Cache system to reduce redundant API calls
interface CacheItem<T> {
  data: T;
  timestamp: number;
  expiresIn: number; // Time to live in milliseconds
}

class APICache {
  private cache: Map<string, CacheItem<any>> = new Map();
  private readonly defaultTTL = 5 * 60 * 1000; // 5 minutes per default

  get<T>(key: string): T | null {
    const item = this.cache.get(key);
    
    if (!item) return null;
    
    // Verify if the item has expired
    if (Date.now() - item.timestamp > item.expiresIn) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data;
  }
  
  set<T>(key: string, data: T, ttl: number = this.defaultTTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expiresIn: ttl
    });
  }
  
  invalidate(keyPrefix: string): void {
    // Remove all cache items that start with the prefix
    for (const key of this.cache.keys()) {
      if (key.startsWith(keyPrefix)) {
        this.cache.delete(key);
      }
    }
  }
}

const apiCache = new APICache();

const getAuthToken = (): string | null => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('aura_token');
  }
  return null;
};

const createAuthHeaders = (providedToken?: string) => {
  const token = providedToken || getAuthToken();
  return {
    'Authorization': token ? `Bearer ${token}` : '',
    'Content-Type': 'application/json'
  };
};

export const getUserRole = async (token?: string): Promise<User> => {
  try {
    const authToken = token || getAuthToken();
    if (!authToken) throw new Error('No authentication token available');
    
    const cacheKey = `user_role_${authToken.slice(-10)}`;
    const cachedData = apiCache.get<User>(cacheKey);
    
    if (cachedData) {
      console.log('Using cached user role data');
      return cachedData;
    }
    
    const response = await fetch(`${API_URL}/api/user/role`, {
      method: 'GET',
      headers: createAuthHeaders(token)
    });
    
    if (!response.ok) {
      throw new Error('Failed to get user role');
    }
    
    const userData = await response.json();
    
    // Save in cache for 10 minutes
    apiCache.set(cacheKey, userData, 10 * 60 * 1000);
    
    return userData;
  } catch (error) {
    console.error('Error getting user role:', error);
    throw error;
  }
};

export const getHabits = async (token?: string): Promise<Habit[]> => {
  try {
    const authToken = token || getAuthToken();
    if (!authToken) throw new Error('No authentication token available');
    
    const cacheKey = `habits_${authToken.slice(-10)}`;
    const cachedData = apiCache.get<Habit[]>(cacheKey);
    
    if (cachedData) {
      console.log('Using cached habits data');
      return cachedData;
    }
    
    const response = await fetch(`${API_URL}/api/habits`, {
      method: 'GET',
      headers: createAuthHeaders(token)
    });
    
    if (!response.ok) {
      throw new Error('Failed to get habits');
    }
    
    const habitsData = await response.json();
    
    // Save caché per 1 minute (habits can change more frequently)
    apiCache.set(cacheKey, habitsData, 60 * 1000);
    
    return habitsData;
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
    
    const newHabit = await response.json();
    
    // Invalidate the cache for habits when a new one is created
    apiCache.invalidate('habits_');
    
    return newHabit;
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
    
    const updatedHabit = await response.json();
    
    // Invalidate the cache for habits when one is updated
    apiCache.invalidate('habits_');
    
    return updatedHabit;
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
    const authToken = accessToken || getAuthToken();
    if (!authToken) throw new Error('No authentication token available');
    
    // Try to get from cache first to avoid creating multiple wallets
    const cacheKey = `wallet_${userId}`;
    const cachedData = apiCache.get(cacheKey);
    
    if (cachedData) {
      console.log('Using cached wallet data');
      return cachedData;
    }
    
    // If not in cache, make the API call
    const response = await fetch(`${API_URL}/api/login`, {
      method: 'POST',
      headers: createAuthHeaders(authToken),
      body: JSON.stringify({ userId, email })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to parse error' }));
      throw new Error(errorData.message || `Error ${response.status}: ${response.statusText}`);
    }

    const walletData = await response.json();
    
    // Save the wallet data in cache for 24 hours
    if (walletData.success) {
      apiCache.set(cacheKey, walletData, 24 * 60 * 60 * 1000);
    }
    
    return walletData;
  } catch (error) {
    console.error('Error creating/getting wallet:', error);
    throw error;
  }
};