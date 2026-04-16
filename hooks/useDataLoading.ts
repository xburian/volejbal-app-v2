import { useState, useEffect, useCallback } from 'react';
import { SportEvent, User, DebtItem, BankAccount, SportConfig } from '@/types.ts';
import * as storage from '@/services/storage.ts';
import { calculateDebts } from '@/utils/debt.ts';

interface UseDataLoadingProps {
  currentUser: User | null;
}

export function useDataLoading({ currentUser }: UseDataLoadingProps) {
  const [events, setEvents] = useState<SportEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [unpaidDebts, setUnpaidDebts] = useState<DebtItem[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [sportConfigs, setSportConfigs] = useState<SportConfig[]>([]);

  const loadEvents = useCallback(async () => {
    setIsLoading(true);
    try {
      setEvents(await storage.getEvents());
    } catch (error) {
      console.error("Failed to load events", error);
    } finally {
      setIsLoading(false);
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

  useEffect(() => {
    if (!currentUser) return;
    loadEvents();
    loadBankAccounts();
    loadSportConfigs();
  }, [currentUser]);

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
    setEvents(updatedList);
    setIsLoading(false);
    return updatedList;
  }, []);

  const updateEvent = useCallback(async (updatedEvent: SportEvent) => {
    setEvents(await storage.updateEvent(updatedEvent));
  }, []);

  const deleteEvent = useCallback(async (id: string) => {
    setIsLoading(true);
    const updatedList = await storage.deleteEvent(id);
    setEvents(updatedList);
    setIsLoading(false);
    return updatedList;
  }, []);

  return {
    events,
    isLoading,
    unpaidDebts,
    bankAccounts,
    setBankAccounts,
    sportConfigs,
    setSportConfigs,
    loadEvents,
    createEvent,
    updateEvent,
    deleteEvent,
  };
}

