import { VolleyballEvent, User, AttendanceRecord, Participant } from '../types';

// Local Storage Keys (fallback for offline / test / dev:vite mode)
const LS_USERS = 'volleyball_users_db_v1';
const LS_EVENTS = 'volleyball_events_db_v1';
const LS_ATTENDANCE = 'volleyball_attendance_db_v1';

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

// --- Users ---

export const getUsers = async (): Promise<User[]> => {
  if (!useApi()) {
    return getLS<User>(LS_USERS);
  }
  try {
    return await apiFetch<User[]>('/users');
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

  return apiFetch<User>('/users', {
    method: 'POST',
    body: JSON.stringify({ name, photoUrl }),
  });
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

  return apiFetch<User>('/users', {
    method: 'PUT',
    body: JSON.stringify({ id: userId, ...updates }),
  });
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

  try {
    return await apiFetch<VolleyballEvent[]>('/events');
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
  return getEvents();
};