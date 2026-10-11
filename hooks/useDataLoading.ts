import { useState, useEffect, useCallback, useRef } from 'react';
import { SportEvent, User, DebtItem, BankAccount, SportConfig } from '@/types.ts';
import * as storage from '@/services/storage.ts';
import { calculateDebts } from '@/utils/debt.ts';

interface UseDataLoadingProps {
  currentUser: User | null;
}

const REFRESH_THROTTLE_MS = 30_000; // 30 seconds

export function useDataLoading({ currentUser }: UseDataLoadingProps) {
  const [events, setEvents] = useState<SportEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [unpaidDebts, setUnpaidDebts] = useState<DebtItem[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [sportConfigs, setSportConfigs] = useState<SportConfig[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const lastFetchedAt = useRef<number>(0);

  const loadEvents = useCallback(async (isBackground = false) => {
    if (!isBackground) setIsLoading(true);
    try {
      setEvents((await storage.getEvents()) ?? []);
    } catch (error) {
      console.error("Failed to load events", error);
    } finally {
      if (!isBackground) setIsLoading(false);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      setUsers(await storage.getUsers());
    } catch (error) {
      console.error("Failed to load users", error);
    }
  }, []);

  const loadBankAccounts = useCallback(async () => {
    try {
      setBankAccounts(await storage.getBankAccounts());
    } catch (error) {
      console.error("Failed to load bank accounts", error);
    }
  }, []);

  const loadSportConfigs = useCallback(async () => {
    try {
      setSportConfigs(await storage.getSportConfigs());
    } catch (error) {
      console.error("Failed to load sport configs", error);
    }
  }, []);

  const refreshAll = useCallback(async (isBackground: boolean | unknown = false) => {
    const isBg = isBackground === true;
    lastFetchedAt.current = Date.now();
    if (isBg) setIsRefreshing(true);
    try {
      await Promise.all([
        loadEvents(isBg),
        loadUsers(),
        loadBankAccounts(),
        loadSportConfigs(),
      ]);
    } finally {
      if (isBg) setIsRefreshing(false);
    }
  }, [loadEvents, loadUsers, loadBankAccounts, loadSportConfigs]);

  // Initial load on login
  useEffect(() => {
    if (!currentUser) return;
    refreshAll(false);
  }, [currentUser, refreshAll]);

  // Refetch when tab becomes visible again (throttled)
  useEffect(() => {
    if (!currentUser) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const elapsed = Date.now() - lastFetchedAt.current;
        if (elapsed >= REFRESH_THROTTLE_MS) {
          refreshAll(true);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [currentUser, refreshAll]);

  // Recalculate debts
  useEffect(() => {
    if (!currentUser || events.length === 0) {
      setUnpaidDebts([]);
      return;
    }
    setUnpaidDebts(calculateDebts(events, currentUser));
  }, [currentUser, events]);

  const createEvent = useCallback(async (newEvent: SportEvent) => {
    setIsLoading(true);
    const updatedList = await storage.createEvent(newEvent);
    setEvents(updatedList ?? []);
    setIsLoading(false);
    return updatedList;
  }, []);

  const createEventsBatch = useCallback(async (newEvents: SportEvent[]) => {
    setIsLoading(true);
    try {
      const updatedList = await storage.createEventsBatch(newEvents);
      setEvents(updatedList ?? []);
      return updatedList;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateEvent = useCallback(async (updatedEvent: SportEvent) => {
    setEvents((await storage.updateEvent(updatedEvent)) ?? []);
  }, []);

  const deleteEvent = useCallback(async (id: string) => {
    setIsLoading(true);
    const updatedList = await storage.deleteEvent(id);
    setEvents(updatedList ?? []);
    setIsLoading(false);
    return updatedList;
  }, []);

  return {
    events,
    isLoading,
    isRefreshing,
    unpaidDebts,
    bankAccounts,
    setBankAccounts,
    sportConfigs,
    setSportConfigs,
    users,
    loadEvents,
    loadUsers,
    refreshAll,
    createEvent,
    createEventsBatch,
    updateEvent,
    deleteEvent,
  };
}
