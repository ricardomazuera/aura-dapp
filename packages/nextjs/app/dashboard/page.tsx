'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuthStore } from '~~/store/authStore';
import { Habit, useHabitStore } from '~~/store/habitStore';
import { PlusCircle, Sparkles, CheckCircle } from 'lucide-react';
import UserMenu from '~~/components/UserMenu';
import UpgradePlanDialog from '~~/components/UpgradePlanDialog';
import { AuthGuard } from '~~/components/auth/AuthGuard';
import { useTheme } from 'next-themes';

export default function DashboardPage() {
  const { user, checkSession } = useAuthStore();
  const { habits, isLoading, error, fetchHabits, updateProgress, addHabit, clearError, canCreateHabit } = useHabitStore();
  const [newHabitName, setNewHabitName] = useState('');
  const [showNewHabitForm, setShowNewHabitForm] = useState(false);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [showPaymentSuccess, setShowPaymentSuccess] = useState(false);
  const { resolvedTheme } = useTheme();
  const isDarkMode = resolvedTheme === "dark";
  const searchParams = useSearchParams();

  // Function to check if a habit has already been tracked today
  const isTrackedToday = (habit: Habit) => {
    if (!habit.lastTrackedDate) return false;
    
    const today = new Date().toDateString();
    const lastTracked = new Date(habit.lastTrackedDate).toDateString();
    
    return today === lastTracked;
  };

  useEffect(() => {
    const initPage = async () => {
      console.log("Initializing dashboard page");
      
      // Verificar si existe el parámetro success=true en la URL (regreso de Stripe)
      const success = searchParams.get('success');
      if (success === 'true') {
        // Si es exitoso, actualizar la sesión para obtener el nuevo rol
        await checkSession();
        await fetchHabits();
        
        // Mostrar notificación de éxito
        setShowPaymentSuccess(true);
        
        // Ocultar la notificación después de 5 segundos
        setTimeout(() => {
          setShowPaymentSuccess(false);
        }, 5000);
      } else {
        // Flujo normal
        await checkSession();
        await fetchHabits();
      }
    };
    
    initPage();
  }, [checkSession, fetchHabits, searchParams]);

  const handleAddHabit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newHabitName.trim()) {
      const result = await addHabit(newHabitName.trim());
      if (result) {
        setNewHabitName('');
        setShowNewHabitForm(false);
      }
    }
  };

  // Function to handle the "New Habit" button click
  const handleNewHabitClick = () => {
    if (user?.role === 'free' && habits.length >= 1) {
      // If free user has reached limit, show upgrade dialog
      setShowUpgradeDialog(true);
    } else {
      // Otherwise show the form to create a new habit
      setShowNewHabitForm(true);
    }
  };

  return (
    <AuthGuard>
      {/* Upgrade Plan Dialog */}
      <UpgradePlanDialog 
        isOpen={showUpgradeDialog} 
        onClose={() => setShowUpgradeDialog(false)} 
      />

      <div className={`min-h-[calc(100vh-64px)] ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Payment success notification */}
          {showPaymentSuccess && (
            <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md flex items-center justify-between" role="alert">
              <div className="flex items-center">
                <CheckCircle className="h-5 w-5 mr-3" />
                <span>¡Felicidades! Tu cuenta ha sido actualizada a Premium. Ahora puedes crear hasta 5 hábitos simultáneamente.</span>
              </div>
              <button 
                className="text-green-700"
                onClick={() => setShowPaymentSuccess(false)}
              >
                <span className="text-xl">&times;</span>
              </button>
            </div>
          )}
          
          <div className="flex justify-between items-center mb-8">
            <h1 className={`text-2xl font-display ${isDarkMode ? 'text-white' : 'text-aura-gray-800'}`}>Your Habits</h1>
            <UserMenu />
          </div>
          
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative" role="alert">
              <strong className="font-bold">Error: </strong>
              <span className="block sm:inline">{error}</span>
              <button 
                className="absolute top-0 bottom-0 right-0 px-4 py-3"
                onClick={clearError}
              >
                <span className="text-xl">&times;</span>
              </button>
            </div>
          )}

          {isLoading ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-aura-primary"></div>
              <span className="sr-only">Loading...</span>
            </div>
          ) : (
            <>
              <div className="mb-6">
                {showNewHabitForm && canCreateHabit() ? (
                  <form onSubmit={handleAddHabit} className={`${isDarkMode ? 'bg-gray-700' : 'bg-white'} p-4 rounded-lg shadow flex items-center`}>
                    <input
                      type="text"
                      placeholder="Enter habit name..."
                      value={newHabitName}
                      onChange={e => setNewHabitName(e.target.value)}
                      className={`flex-1 border ${isDarkMode ? 'bg-gray-600 border-gray-500 text-white placeholder:text-gray-300' : 'bg-white border-gray-300 text-gray-900'} rounded py-2 px-4 focus:outline-none focus:ring-2 focus:ring-aura-primary`}
                    />
                    <button 
                      type="submit" 
                      className="ml-4 bg-aura-primary text-white px-4 py-2 rounded hover:bg-aura-secondary"
                      disabled={isLoading}
                    >
                      Add Habit
                    </button>
                    <button 
                      type="button"
                      onClick={() => setShowNewHabitForm(false)}
                      className={`ml-2 ${isDarkMode ? 'text-gray-300 hover:bg-gray-600' : 'text-gray-500 hover:bg-gray-100'} px-4 py-2 rounded`}
                    >
                      Cancel
                    </button>
                  </form>
                ) : (
                  // Always show the button, but the action will depend on the user's status
                  user && (
                    <div className={`${user.role === 'free' && habits.length >= 1 ? 'flex justify-center' : ''}`}>
                      <button
                        onClick={handleNewHabitClick}
                        className={`inline-flex items-center px-6 py-3 rounded-lg ${
                          user.role === 'free' && habits.length >= 1 
                            ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600 shadow-md' 
                            : 'bg-aura-primary text-white hover:bg-aura-secondary'
                        }`}
                      >
                        {user.role === 'free' && habits.length >= 1 ? (
                          <>
                            <Sparkles className="mr-2 h-5 w-5 animate-pulse" />
                            <span className="font-medium">Upgrade to Add More Habits</span>
                          </>
                        ) : (
                          <>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            New Habit
                          </>
                        )}
                      </button>
                    </div>
                  )
                )}
              </div>
              
              {habits.length > 0 ? (
                <div className={`${isDarkMode ? 'bg-gray-700' : 'bg-white'} rounded-lg shadow overflow-hidden`}>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className={`${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
                        <tr>
                          <th scope="col" className={`px-6 py-3 text-left text-xs font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
                            Habit
                          </th>
                          <th scope="col" className={`px-6 py-3 text-left text-xs font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
                            Progress
                          </th>
                          <th scope="col" className={`px-6 py-3 text-left text-xs font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
                            Status
                          </th>
                          <th scope="col" className={`px-6 py-3 text-left text-xs font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
                            Days Remaining
                          </th>
                          <th scope="col" className="relative px-6 py-3">
                            <span className="sr-only">Actions</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody className={`${isDarkMode ? 'bg-gray-700 divide-gray-600' : 'bg-white divide-gray-200'}`}>
                        {habits.map(habit => (
                          <tr key={habit.id}>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{habit.name}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className={`w-full ${isDarkMode ? 'bg-gray-600' : 'bg-gray-200'} rounded-full h-2.5`}>
                                <div 
                                  className="bg-aura-primary h-2.5 rounded-full transition-all duration-300"
                                  style={{ width: `${(habit.daysCompleted / 7) * 100}%` }}
                                />
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                habit.completed 
                                  ? 'bg-green-100 text-green-800'
                                  : isDarkMode ? 'bg-yellow-800 text-yellow-100' : 'bg-yellow-100 text-yellow-800'
                              }`}>
                                {habit.completed ? 'Completed' : 'In Progress'}
                              </span>
                            </td>
                            <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                              {habit.completed ? '0' : 7 - habit.daysCompleted} days
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              {!habit.completed && (
                                <button
                                  onClick={() => updateProgress(habit.id)}
                                  className={`px-4 py-2 rounded-md transition-colors ${
                                    isLoading || isTrackedToday(habit)
                                      ? (isDarkMode ? 'bg-gray-600 text-gray-400' : 'bg-gray-200 text-gray-500') + ' cursor-not-allowed'
                                      : 'bg-aura-primary text-white hover:bg-aura-secondary'
                                  }`}
                                  disabled={isLoading || isTrackedToday(habit)}
                                >
                                  {isTrackedToday(habit) ? 'Tracked Today' : 'Track Today'}
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className={`${isDarkMode ? 'bg-gray-700' : 'bg-white'} p-8 rounded-lg shadow text-center`}>
                  <h3 className={`text-lg font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'} mb-2`}>No habits found</h3>
                  <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-500'} mb-4`}>
                    {user ? "You haven't created any habits yet. Start by creating your first habit!" : "Please log in to view your habits."}
                  </p>
                  {user && !showNewHabitForm && (
                    <button
                      onClick={handleNewHabitClick}
                      className="inline-flex items-center px-4 py-2 bg-aura-primary text-white rounded hover:bg-aura-secondary"
                    >
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Create Your First Habit
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </AuthGuard>
  );
}