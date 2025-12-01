import { describe, it, expect, beforeEach } from 'vitest';
import * as storage from './storage';
import { VolleyballEvent } from '../types';

describe('Storage Service', () => {
  beforeEach(async () => {
    localStorage.clear();
    // Ensure storage is completely reset
    await storage.getUsers(); // This will initialize empty arrays if needed
  });

  it('creates and retrieves a user', async () => {
    const uniqueName = 'TestUser_' + Date.now();
    const user = await storage.createUser(uniqueName);
    expect(user.name).toBe(uniqueName);
    expect(user.id).toBeDefined();

    const users = await storage.getUsers();
    expect(users.length).toBeGreaterThanOrEqual(1);
    expect(users.find(u => u.id === user.id)).toEqual(user);
  });

  it('throws error when creating duplicate user name', async () => {
    // Clear localStorage again to ensure clean state for this test
    localStorage.clear();

    const uniqueName = 'AliceUnique_' + Date.now() + '_' + Math.random();
    const user1 = await storage.createUser(uniqueName);
    expect(user1).toBeDefined();
    await expect(storage.createUser(uniqueName)).rejects.toThrow('Uživatel s tímto jménem již existuje.');
    await expect(storage.createUser(uniqueName.toLowerCase() + ' ')).rejects.toThrow(); // Case insensitive check
  });

  it('creates and retrieves an event', async () => {
    const newEvent: VolleyballEvent = {
      id: 'unique-event-123',
      title: 'Match',
      date: '2024-01-01',
      time: '18:00',
      location: 'Gym',
      totalCost: 100,
      accountNumber: '',
      participants: []
    };

    const events = await storage.createEvent(newEvent);
    const createdEvent = events.find(e => e.id === 'unique-event-123');
    expect(createdEvent).toBeDefined();
    expect(createdEvent?.title).toBe('Match');
  });

  it('manages attendance correctly', async () => {
    const uniqueName = 'Player1_' + Date.now();
    const user = await storage.createUser(uniqueName);
    const events = await storage.createEvent({
      id: 'evt-attendance-test',
      title: 'Game',
      date: '2024-01-01',
      time: '12:00',
      location: 'Loc',
      totalCost: 500,
      accountNumber: '',
      participants: []
    });
    const event = events.find(e => e.id === 'evt-attendance-test');
    expect(event).toBeDefined();

    // Join
    await storage.updateAttendance(event!.id, user.id, 'joined');

    let updatedEvents = await storage.getEvents();
    let updatedEvent = updatedEvents.find(e => e.id === 'evt-attendance-test');
    let participant = updatedEvent?.participants.find(p => p.userId === user.id);
    expect(participant?.status).toBe('joined');
    expect(participant?.hasPaid).toBe(false);

    // Pay
    await storage.updateAttendance(event!.id, user.id, 'joined', true);
    updatedEvents = await storage.getEvents();
    updatedEvent = updatedEvents.find(e => e.id === 'evt-attendance-test');
    participant = updatedEvent?.participants.find(p => p.userId === user.id);
    expect(participant?.hasPaid).toBe(true);
  });

  it('removes user from events when user is deleted', async () => {
    // 1. Create User & Event
    const uniqueName = 'ToBeDeleted_' + Date.now();
    const user = await storage.createUser(uniqueName);
    const eventsList = await storage.createEvent({
      id: 'evt-del-test',
      title: 'Delete Test',
      date: '2024-01-01',
      time: '12:00',
      location: 'Loc',
      totalCost: 100,
      accountNumber: '',
      participants: []
    });
    const event = eventsList.find(e => e.id === 'evt-del-test');
    expect(event).toBeDefined();

    // 2. User Joins
    await storage.updateAttendance(event!.id, user.id, 'joined');

    // Verify joined
    let events = await storage.getEvents();
    let deletedEvent = events.find(e => e.id === 'evt-del-test');
    let participant = deletedEvent?.participants.find(p => p.userId === user.id);
    expect(participant).toBeDefined();

    // 3. Delete User
    await storage.deleteUser(user.id);

    // 4. Verify gone from events list (via participants)
    events = await storage.getEvents();
    deletedEvent = events.find(e => e.id === 'evt-del-test');
    participant = deletedEvent?.participants.find(p => p.userId === user.id);
    expect(participant).toBeUndefined();
    
    // Verify User gone from users list
    expect(await storage.getUser(user.id)).toBeUndefined();
  });
});