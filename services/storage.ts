import { VolleyballEvent, User, AttendanceRecord, Participant } from '../types';
import { db } from './firebase';
import { 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  deleteDoc, 
  query, 
  where
} from 'firebase/firestore';

const EVENTS_COL = 'events';
const USERS_COL = 'users';
const ATTENDANCE_COL = 'attendance';

// Local Storage Keys
const LS_USERS = 'volleyball_users_db_v1';
const LS_EVENTS = 'volleyball_events_db_v1';
const LS_ATTENDANCE = 'volleyball_attendance_db_v1';

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

// --- Users ---

export const getUsers = async (): Promise<User[]> => {
  if (!db) {
    return getLS<User>(LS_USERS);
  }

  try {
    const querySnapshot = await getDocs(collection(db, USERS_COL));
    return querySnapshot.docs.map(doc => doc.data() as User);
  } catch (e) {
    console.error("Failed to load users", e);
    return [];
  }
};

export const getUser = async (id: string): Promise<User | undefined> => {
  const users = await getUsers();
  return users.find(u => u.id === id);
};

export const createUser = async (name: string, photoUrl?: string): Promise<User> => {
  const users = await getUsers();
  
  if (users.some(u => u.name.toLowerCase() === name.trim().toLowerCase())) {
    throw new Error('Uživatel s tímto jménem již existuje.');
  }

  const newUser: User = {
    id: generateId(),
    name: name.trim(),
    ...(photoUrl && { photoUrl })
  };

  if (!db) {
    const lsUsers = getLS<User>(LS_USERS);
    lsUsers.push(newUser);
    setLS(LS_USERS, lsUsers);
    return newUser;
  }

  await setDoc(doc(db, USERS_COL, newUser.id), newUser);
  return newUser;
};

export const updateUser = async (userId: string, updates: Partial<User>): Promise<User> => {
  const users = await getUsers();
  const userIndex = users.findIndex(u => u.id === userId);

  if (userIndex === -1) {
    throw new Error('Uživatel nenalezen.');
  }

  const updatedUser = { ...users[userIndex], ...updates };

  if (!db) {
    const lsUsers = getLS<User>(LS_USERS);
    const idx = lsUsers.findIndex(u => u.id === userId);
    if (idx !== -1) {
      lsUsers[idx] = updatedUser;
      setLS(LS_USERS, lsUsers);
    }
    return updatedUser;
  }

  await setDoc(doc(db, USERS_COL, userId), updatedUser);
  return updatedUser;
};

export const deleteUser = async (userId: string): Promise<void> => {
  if (!db) {
    const users = getLS<User>(LS_USERS).filter(u => u.id !== userId);
    setLS(LS_USERS, users);
    
    const attendance = getLS<AttendanceRecord>(LS_ATTENDANCE).filter(a => a.userId !== userId);
    setLS(LS_ATTENDANCE, attendance);
    return;
  }

  // 1. Remove User
  await deleteDoc(doc(db, USERS_COL, userId));

  // 2. Remove Attendance records for this user
  const q = query(collection(db, ATTENDANCE_COL), where("userId", "==", userId));
  const snapshot = await getDocs(q);
  
  const deletePromises = snapshot.docs.map(d => deleteDoc(d.ref));
  await Promise.all(deletePromises);
};

// --- Attendance ---

const getAttendances = async (): Promise<AttendanceRecord[]> => {
  if (!db) {
    return getLS<AttendanceRecord>(LS_ATTENDANCE);
  }
  try {
    const snapshot = await getDocs(collection(db, ATTENDANCE_COL));
    return snapshot.docs.map(doc => doc.data() as AttendanceRecord);
  } catch (e) {
    return [];
  }
};

export const updateAttendance = async (eventId: string, userId: string, status: Participant['status'], hasPaid?: boolean): Promise<void> => {
  const record: AttendanceRecord = {
    eventId,
    userId,
    status,
    hasPaid: hasPaid || false,
    timestamp: Date.now()
  };

  if (!db) {
    const all = getLS<AttendanceRecord>(LS_ATTENDANCE);
    const existingIndex = all.findIndex(a => a.eventId === eventId && a.userId === userId);
    
    if (existingIndex >= 0) {
      // Merge logic similar to Firestore
      all[existingIndex] = { ...all[existingIndex], ...record };
    } else {
      all.push(record);
    }
    setLS(LS_ATTENDANCE, all);
    return;
  }

  // Composite ID for the document to easily find it later
  const docId = `${eventId}_${userId}`;
  const docRef = doc(db, ATTENDANCE_COL, docId);
  await setDoc(docRef, record, { merge: true });
};

// --- Events ---

const getRawEvents = async (): Promise<Omit<VolleyballEvent, 'participants'>[]> => {
  if (!db) {
    return getLS<Omit<VolleyballEvent, 'participants'>>(LS_EVENTS);
  }
  try {
    const snapshot = await getDocs(collection(db, EVENTS_COL));
    return snapshot.docs.map(doc => doc.data() as Omit<VolleyballEvent, 'participants'>);
  } catch (e) {
    return [];
  }
};

// Join Logic
export const getEvents = async (): Promise<VolleyballEvent[]> => {
  // Fetch all collections in parallel
  const [rawEvents, attendances, users] = await Promise.all([
    getRawEvents(),
    getAttendances(),
    getUsers()
  ]);

  return rawEvents.map(event => {
    // Find all attendance records for this event
    const eventAttendance = attendances.filter(a => a.eventId === event.id);
    
    // Map them to Participants with User details
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

    return {
      ...event,
      participants
    };
  });
};

export const createEvent = async (event: VolleyballEvent): Promise<VolleyballEvent[]> => {
  if (!event.id) {
    event.id = generateId();
  }
  const { participants, ...eventData } = event;

  if (!db) {
    const events = getLS<Omit<VolleyballEvent, 'participants'>>(LS_EVENTS);
    events.push(eventData);
    setLS(LS_EVENTS, events);
    return getEvents();
  }

  await setDoc(doc(db, EVENTS_COL, event.id), eventData);
  return getEvents();
};

export const updateEvent = async (updatedEvent: VolleyballEvent): Promise<VolleyballEvent[]> => {
  const { participants, ...eventData } = updatedEvent;

  if (!db) {
    const events = getLS<Omit<VolleyballEvent, 'participants'>>(LS_EVENTS);
    const idx = events.findIndex(e => e.id === updatedEvent.id);
    if (idx !== -1) {
      events[idx] = { ...events[idx], ...eventData };
      setLS(LS_EVENTS, events);
    }
    return getEvents();
  }

  await setDoc(doc(db, EVENTS_COL, updatedEvent.id), eventData, { merge: true });
  return getEvents();
};

export const deleteEvent = async (id: string): Promise<VolleyballEvent[]> => {
  if (!db) {
    const events = getLS<Omit<VolleyballEvent, 'participants'>>(LS_EVENTS).filter(e => e.id !== id);
    setLS(LS_EVENTS, events);
    
    // Cleanup attendance
    const attendance = getLS<AttendanceRecord>(LS_ATTENDANCE).filter(a => a.eventId !== id);
    setLS(LS_ATTENDANCE, attendance);
    return getEvents();
  }

  await deleteDoc(doc(db, EVENTS_COL, id));
  
  // Cleanup attendance
  const q = query(collection(db, ATTENDANCE_COL), where("eventId", "==", id));
  const snapshot = await getDocs(q);
  const deletePromises = snapshot.docs.map(d => deleteDoc(d.ref));
  await Promise.all(deletePromises);

  return getEvents();
};