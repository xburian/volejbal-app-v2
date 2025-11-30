import { describe, it, expect, beforeEach } from 'vitest';
import * as storage from './storage';
import { VolleyballEvent } from '../types';

describe('Storage Service', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('creates and retrieves a user', async () => {
    const user = await storage.createUser('Test User');
    expect(user.name).toBe('Test User');
    expect(user.id).toBeDefined();

    const users = await storage.getUsers();
    expect(users).toHaveLength(1);
    expect(users[0]).toEqual(user);
  });

  it('throws error when creating duplicate user name', async () => {
    await storage.createUser('Alice');
    await expect(storage.createUser('Alice')).rejects.toThrow('Uživatel s tímto jménem již existuje.');
    await expect(storage.createUser('alice ')).rejects.toThrow(); // Case insensitive check
  });

  it('creates and retrieves an event', async () => {
    const newEvent: VolleyballEvent = {
      id: '1',
      title: 'Match',
      date: '2024-01-01',
      time: '18:00',
      location: 'Gym',
      totalCost: 100,
      accountNumber: '',
      participants: []
    };

    const events = await storage.createEvent(newEvent);
    expect(events).toHaveLength(1);
    expect(events[0].title).toBe('Match');
  });

  it('manages attendance correctly', async () => {
    const user = await storage.createUser('Player 1');
    const events = await storage.createEvent({
      id: 'evt1',
      title: 'Game',
      date: '2024-01-01',
      time: '12:00',
      location: 'Loc',
      totalCost: 500,
      accountNumber: '',
      participants: []
    });
    const event = events[0];

    // Join
    await storage.updateAttendance(event.id, user.id, 'joined');
    
    let updatedEvents = await storage.getEvents();
    let participant = updatedEvents[0].participants.find(p => p.userId === user.id);
    expect(participant?.status).toBe('joined');
    expect(participant?.hasPaid).toBe(false);

    // Pay
    await storage.updateAttendance(event.id, user.id, 'joined', true);
    updatedEvents = await storage.getEvents();
    participant = updatedEvents[0].participants.find(p => p.userId === user.id);
    expect(participant?.hasPaid).toBe(true);
  });

  it('removes user from events when user is deleted', async () => {
    // 1. Create User & Event
    const user = await storage.createUser('ToBeDeleted');
    const eventsList = await storage.createEvent({
      id: 'evt-del',
      title: 'Delete Test',
      date: '2024-01-01',
      time: '12:00',
      location: 'Loc',
      totalCost: 100,
      accountNumber: '',
      participants: []
    });
    const event = eventsList[0];

    // 2. User Joins
    await storage.updateAttendance(event.id, user.id, 'joined');
    
    // Verify joined
    let events = await storage.getEvents();
    let participant = events[0].participants.find(p => p.userId === user.id);
    expect(participant).toBeDefined();

    // 3. Delete User
    await storage.deleteUser(user.id);

    // 4. Verify gone from events list (via participants)
    events = await storage.getEvents();
    participant = events[0].participants.find(p => p.userId === user.id);
    expect(participant).toBeUndefined();
    
    // Verify User gone from users list
    expect(await storage.getUser(user.id)).toBeUndefined();
  });
});