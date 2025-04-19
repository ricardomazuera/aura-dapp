'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '~~/store/authStore';
import { useHabitStore } from '~~/store/habitStore';
import { PlusCircle } from 'lucide-react';
import UserMenu from '~~/components/UserMenu';

export default function DashboardPage() {
  const { user, checkSession } = useAuthStore();
  const { habits, isLoading, error, fetchHabits, updateProgress, addHabit, clearError, canCreateHabit } = useHabitStore();
  const [newHabitName, setNewHabitName] = useState('');
  const [showNewHabitForm, setShowNewHabitForm] = useState(false);

  useEffect(() => {
    const initPage = async () => {
      console.log("Initializing dashboard page");
      // Ensure we have the latest authentication state
      await checkSession();
      await fetchHabits();
    };
    
    initPage();
  }, [checkSession, fetchHabits]);

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

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-display text-aura-gray-800">Your Habits</h1>
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
            {user && canCreateHabit() && (
              <div className="mb-6">
                {showNewHabitForm ? (
                  <form onSubmit={handleAddHabit} className="bg-white p-4 rounded-lg shadow flex items-center">
                    <input
                      type="text"
                      placeholder="Enter habit name..."
                      value={newHabitName}
                      onChange={e => setNewHabitName(e.target.value)}
                      className="flex-1 border border-gray-300 rounded py-2 px-4 focus:outline-none focus:ring-2 focus:ring-aura-primary"
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
                      className="ml-2 text-gray-500 px-4 py-2 rounded hover:bg-gray-100"
                    >
                      Cancel
                    </button>
                  </form>
                ) : (
                  <button
                    onClick={() => setShowNewHabitForm(true)}
                    className="inline-flex items-center px-4 py-2 bg-aura-primary text-white rounded hover:bg-aura-secondary"
                  >
                    <PlusCircle className="mr-2 h-4 w-4" />
                    New Habit
                  </button>
                )}
              </div>
            )}
            
            {habits.length > 0 ? (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Habit
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Progress
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Days Remaining
                      </th>
                      <th scope="col" className="relative px-6 py-3">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {habits.map(habit => (
                      <tr key={habit.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{habit.name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="w-full bg-gray-200 rounded-full h-2.5">
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
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {habit.completed ? 'Completed' : 'In Progress'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {habit.completed ? '0' : 7 - habit.daysCompleted} days
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          {!habit.completed && (
                            <button
                              onClick={() => updateProgress(habit.id)}
                              className="text-aura-primary hover:text-aura-secondary"
                              disabled={isLoading}
                            >
                              Track Today
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="bg-white p-8 rounded-lg shadow text-center">
                <h3 className="text-lg font-medium text-gray-900 mb-2">No habits found</h3>
                <p className="text-gray-500 mb-4">
                  {user ? "You haven't created any habits yet. Start by creating your first habit!" : "Please log in to view your habits."}
                </p>
                {user && canCreateHabit() && !showNewHabitForm && (
                  <button
                    onClick={() => setShowNewHabitForm(true)}
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
  );
}