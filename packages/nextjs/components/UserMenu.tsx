'use client';

import { useState, useRef, useEffect } from 'react';
import { UserCircle2, LogOut } from 'lucide-react';
import Image from 'next/image';
import { useAuthStore } from '~~/store/authStore';
import { useTheme } from 'next-themes';

// Helper function to capitalize names correctly
const capitalizeFirstLetter = (str: string): string => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

// Function to properly format full names
const formatName = (firstName: string | null, lastName: string | null): string => {
  if (firstName) {
    return capitalizeFirstLetter(firstName);
  } else if (lastName) {
    return capitalizeFirstLetter(lastName);
  }
  return '';
};

export default function UserMenu() {
  const { user, signOut } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();
  const isDarkMode = resolvedTheme === "dark";

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) return null;

  // Determine the name to display with correct capitalization
  const displayName = (() => {
    // If we have a name, show only the first name
    const formattedName = formatName(user.firstName, user.lastName);
    if (formattedName) {
      return formattedName;
    }
    
    // If we don't have a name, capitalize only the first part of the email username
    const username = user.email.split('@')[0];
    // If the username has dots, take only the first part
    if (username.includes('.')) {
      const parts = username.split('.');
      return capitalizeFirstLetter(parts[0]);
    }
    // If there are no dots, just capitalize
    return capitalizeFirstLetter(username);
  })();

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center space-x-3 ${
          isDarkMode 
            ? 'bg-gray-700 border-gray-600 hover:border-gray-500' 
            : 'bg-white border-gray-200 hover:border-gray-300'
        } rounded-full pl-3 pr-4 py-2 border transition-colors`}
      >
        <Image
          src="https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp"
          alt="User avatar"
          width={32}
          height={32}
          className="rounded-full"
        />
        <div className="flex items-center">
          <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
            {displayName}
          </span>
          <span className={`ml-2 text-xs px-2 py-0.5 ${
            isDarkMode ? 'bg-aura-primary bg-opacity-20' : 'bg-aura-light'
          } ${isDarkMode ? 'text-white' : 'text-aura-primary'} rounded-full`}>
            {user.role === 'pro' ? 'Pro' : 'Free'}
          </span>
        </div>
      </button>

      {isOpen && (
        <div className={`absolute right-0 mt-2 w-48 ${
          isDarkMode 
            ? 'bg-gray-700 border-gray-600 shadow-xl' 
            : 'bg-white border-gray-200 shadow-lg'
        } rounded-lg py-1 border`}>
          <div className={`px-4 py-2 border-b ${isDarkMode ? 'border-gray-600' : 'border-gray-100'}`}>
            <div className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              {displayName}
            </div>
            <div className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-500'} truncate`}>
              {user.email}
            </div>
          </div>
          <button
            onClick={() => {
              setIsOpen(false);
              signOut();
            }}
            className={`flex items-center w-full px-4 py-2 text-sm ${
              isDarkMode 
                ? 'text-gray-300 hover:bg-gray-600' 
                : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}