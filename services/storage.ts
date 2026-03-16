import { VolleyballEvent, User, AttendanceRecord, Participant, BankAccount } from '../types';

// Local Storage Keys (fallback for offline / test / dev:vite mode)
const LS_USERS = 'volleyball_users_db_v1';
const LS_EVENTS = 'volleyball_events_db_v1';
const LS_ATTENDANCE = 'volleyball_attendance_db_v1';
const LS_BANK_ACCOUNTS = 'volleyball_bank_accounts_db_v1';

// Detect if API is available (running via `vercel dev` or deployed on Vercel)
const API_BASE = '/api';

const useApi = (): boolean => {
  // In test environment (vitest / jsdom), always use localStorage
  if (typeof process !== 'undefined' && (process as any).env?.VITEST) return false;
  if (typeof window !== 'undefined' && (window as any).__VITEST__) return false;
  // If running in browser, try API
  return typeof window !== 'undefined';
};

// Helper for ID generation
const generateId = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

// Local Storage Helpers
const getLS = <T>(key: string): T[] => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : [];
  } catch { return []; }
};

const setLS = (key: string, data: any[]) => {
  localStorage.setItem(key, JSON.stringify(data));
};

// --- Fetch helper ---
async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `API error ${res.status}`);
  }
  return res.json();
}

// --- In-memory cache with TTL ---
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const USERS_CACHE_TTL = 60_000;  // 60 seconds
const EVENTS_CACHE_TTL = 30_000; // 30 seconds
const BANK_ACCOUNTS_CACHE_TTL = 30_000; // 30 seconds

let usersCache: CacheEntry<User[]> | null = null;
let eventsCache: CacheEntry<VolleyballEvent[]> | null = null;
let bankAccountsCache: CacheEntry<BankAccount[]> | null = null;

function getCached<T>(entry: CacheEntry<T> | null, ttl: number): T | null {
  if (entry && Date.now() - entry.timestamp < ttl) {
    return entry.data;
  }
  return null;
}

export const invalidateUsersCache = () => { usersCache = null; };
export const invalidateEventsCache = () => { eventsCache = null; };
export const invalidateBankAccountsCache = () => { bankAccountsCache = null; };

// --- Users ---

export const getUsers = async (): Promise<User[]> => {
  if (!useApi()) {
    return getLS<User>(LS_USERS);
  }

  const cached = getCached(usersCache, USERS_CACHE_TTL);
  if (cached) return cached;

  try {
    const data = await apiFetch<User[]>('/users');
    usersCache = { data, timestamp: Date.now() };
    return data;
  } catch (e) {
    console.error("Failed to load users from API, falling back to localStorage", e);
    return getLS<User>(LS_USERS);
  }
};

export const getUser = async (id: string): Promise<User | undefined> => {
  const users = await getUsers();
  return users.find(u => u.id === id);
};

export const createUser = async (name: string, photoUrl?: string): Promise<User> => {
  if (!useApi()) {
    const users = getLS<User>(LS_USERS);
    if (users.some(u => u.name.toLowerCase() === name.trim().toLowerCase())) {
      throw new Error('Uživatel s tímto jménem již existuje.');
    }
    const newUser: User = {
      id: generateId(),
      name: name.trim(),
      ...(photoUrl && { photoUrl })
    };
    users.push(newUser);
    setLS(LS_USERS, users);
    return newUser;
  }

  const newUser = await apiFetch<User>('/users', {
    method: 'POST',
    body: JSON.stringify({ name, photoUrl }),
  });
  invalidateUsersCache();
  return newUser;
};

export const updateUser = async (userId: string, updates: Partial<User>): Promise<User> => {
  if (!useApi()) {
    const users = getLS<User>(LS_USERS);
    const idx = users.findIndex(u => u.id === userId);
    if (idx === -1) throw new Error('Uživatel nenalezen.');
    users[idx] = { ...users[idx], ...updates };
    setLS(LS_USERS, users);
    return users[idx];
  }

  const updatedUser = await apiFetch<User>('/users', {
    method: 'PUT',
    body: JSON.stringify({ id: userId, ...updates }),
  });
  invalidateUsersCache();
  return updatedUser;
};

export const deleteUser = async (userId: string): Promise<void> => {
  if (!useApi()) {
    const users = getLS<User>(LS_USERS).filter(u => u.id !== userId);
    setLS(LS_USERS, users);
    const attendance = getLS<AttendanceRecord>(LS_ATTENDANCE).filter(a => a.userId !== userId);
    setLS(LS_ATTENDANCE, attendance);
    return;
  }

  await apiFetch<void>(`/users?id=${encodeURIComponent(userId)}`, {
    method: 'DELETE',
  });
  invalidateUsersCache();
};

// --- User Photos ---

export const uploadUserPhoto = async (userId: string, photoBase64: string): Promise<string> => {
  if (!useApi()) {
    const users = getLS<User>(LS_USERS);
    const idx = users.findIndex(u => u.id === userId);
    if (idx !== -1) {
      users[idx].photoUrl = photoBase64;
      setLS(LS_USERS, users);
    }
    return photoBase64;
  }

  const result = await apiFetch<{ photoUrl: string }>('/photos', {
    method: 'POST',
    body: JSON.stringify({ userId, photoBase64 }),
  });
  invalidateUsersCache();
  return result.photoUrl;
};

export const deleteUserPhoto = async (userId: string): Promise<void> => {
  if (!useApi()) {
    const users = getLS<User>(LS_USERS);
    const idx = users.findIndex(u => u.id === userId);
    if (idx !== -1) {
      delete users[idx].photoUrl;
      setLS(LS_USERS, users);
    }
    return;
  }

  await apiFetch<void>(`/photos?id=${encodeURIComponent(userId)}`, {
    method: 'DELETE',
  });
  invalidateUsersCache();
};

// --- Attendance ---

export const updateAttendance = async (eventId: string, userId: string, status: Participant['status'], hasPaid?: boolean): Promise<void> => {
  if (!useApi()) {
    const record: AttendanceRecord = {
      eventId,
      userId,
      status,
      hasPaid: hasPaid || false,
      timestamp: Date.now()
    };
    const all = getLS<AttendanceRecord>(LS_ATTENDANCE);
    const existingIndex = all.findIndex(a => a.eventId === eventId && a.userId === userId);
    if (existingIndex >= 0) {
      all[existingIndex] = { ...all[existingIndex], ...record };
    } else {
      all.push(record);
    }
    setLS(LS_ATTENDANCE, all);
    return;
  }

  await apiFetch<void>('/attendance', {
    method: 'PUT',
    body: JSON.stringify({ eventId, userId, status, hasPaid }),
  });
  invalidateEventsCache();
};

// --- Events ---

export const getEvents = async (): Promise<VolleyballEvent[]> => {
  if (!useApi()) {
    // Local join logic (same as before)
    const rawEvents = getLS<Omit<VolleyballEvent, 'participants'>>(LS_EVENTS);
    const attendances = getLS<AttendanceRecord>(LS_ATTENDANCE);
    const users = getLS<User>(LS_USERS);

    return rawEvents.map(event => {
      const eventAttendance = attendances.filter(a => a.eventId === event.id);
      const participants: Participant[] = eventAttendance.map(record => {
        const user = users.find(u => u.id === record.userId);
        return {
          userId: record.userId,
          name: user ? user.name : 'Neznámý',
          photoUrl: user?.photoUrl,
          status: record.status,
          hasPaid: record.hasPaid
        };
      });
      return { ...event, participants };
    });
  }

  const cached = getCached(eventsCache, EVENTS_CACHE_TTL);
  if (cached) return cached;

  try {
    const data = await apiFetch<VolleyballEvent[]>('/events');
    eventsCache = { data, timestamp: Date.now() };
    return data;
  } catch (e) {
    console.error("Failed to load events from API", e);
    return [];
  }
};

export const createEvent = async (event: VolleyballEvent): Promise<VolleyballEvent[]> => {
  if (!event.id) {
    event.id = generateId();
  }
  const { participants, ...eventData } = event;

  if (!useApi()) {
    const events = getLS<Omit<VolleyballEvent, 'participants'>>(LS_EVENTS);
    events.push(eventData);
    setLS(LS_EVENTS, events);
    return getEvents();
  }

  await apiFetch('/events', {
    method: 'POST',
    body: JSON.stringify(eventData),
  });
  invalidateEventsCache();
  return getEvents();
};

export const updateEvent = async (updatedEvent: VolleyballEvent): Promise<VolleyballEvent[]> => {
  const { participants, ...eventData } = updatedEvent;

  if (!useApi()) {
    const events = getLS<Omit<VolleyballEvent, 'participants'>>(LS_EVENTS);
    const idx = events.findIndex(e => e.id === updatedEvent.id);
    if (idx !== -1) {
      events[idx] = { ...events[idx], ...eventData };
      setLS(LS_EVENTS, events);
    }
    return getEvents();
  }

  await apiFetch('/events', {
    method: 'PUT',
    body: JSON.stringify(eventData),
  });
  invalidateEventsCache();
  return getEvents();
};

export const deleteEvent = async (id: string): Promise<VolleyballEvent[]> => {
  if (!useApi()) {
    const events = getLS<Omit<VolleyballEvent, 'participants'>>(LS_EVENTS).filter(e => e.id !== id);
    setLS(LS_EVENTS, events);
    const attendance = getLS<AttendanceRecord>(LS_ATTENDANCE).filter(a => a.eventId !== id);
    setLS(LS_ATTENDANCE, attendance);
    return getEvents();
  }

  await apiFetch(`/events?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  invalidateEventsCache();
  return getEvents();
};

// --- Bank Accounts ---

export const getBankAccounts = async (): Promise<BankAccount[]> => {
  if (!useApi()) {
    return getLS<BankAccount>(LS_BANK_ACCOUNTS);
  }

  const cached = getCached(bankAccountsCache, BANK_ACCOUNTS_CACHE_TTL);
  if (cached) return cached;

  try {
    const data = await apiFetch<BankAccount[]>('/bank-accounts');
    bankAccountsCache = { data, timestamp: Date.now() };
    return data;
  } catch (e) {
    console.error("Failed to load bank accounts from API", e);
    return [];
  }
};

export const createBankAccount = async (
  ownerName: string,
  accountNumber: string,
  userId: string,
): Promise<BankAccount> => {
  if (!useApi()) {
    const accounts = getLS<BankAccount>(LS_BANK_ACCOUNTS);

    if (accounts.some(a => a.userId === userId)) {
      throw new Error('Již máte nastavený bankovní účet.');
    }

    const newAccount: BankAccount = {
      id: generateId(),
      ownerName: ownerName.trim(),
      accountNumber: accountNumber.trim(),
      userId,
    };
    accounts.push(newAccount);
    setLS(LS_BANK_ACCOUNTS, accounts);
    return newAccount;
  }

  const newAccount = await apiFetch<BankAccount>('/bank-accounts', {
    method: 'POST',
    body: JSON.stringify({ ownerName, accountNumber, userId }),
  });
  invalidateBankAccountsCache();
  return newAccount;
};

