import { useState, useCallback } from 'react';
import { User } from '@/types.ts';

const STORAGE_KEY = 'currentUser';

export function usePersistedAuth() {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const login = useCallback((user: User) => {
    setCurrentUser(user);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  }, []);

  const logout = useCallback(() => {
    setCurrentUser(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const updateUser = useCallback((user: User) => {
    setCurrentUser(user);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  }, []);

  return { currentUser, login, logout, updateUser };
}

