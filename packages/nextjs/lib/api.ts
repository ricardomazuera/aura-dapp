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

export const getUserRole = async (token: string): Promise<User> => {
  try {
    const response = await fetch(`${API_URL}/api/user/role`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
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

export const getHabits = async (token: string): Promise<Habit[]> => {
  try {
    const response = await fetch(`${API_URL}/api/habits`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
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

export const createHabit = async (token: string, name: string): Promise<Habit> => {
  try {
    const response = await fetch(`${API_URL}/api/habits`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
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

export const updateHabitProgress = async (token: string, habitId: string): Promise<Habit> => {
  try {
    const response = await fetch(`${API_URL}/api/habits/${habitId}/progress`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
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