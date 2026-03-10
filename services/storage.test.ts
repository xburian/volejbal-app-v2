import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as storage from './storage';
import { VolleyballEvent } from '../types';

// Spy on fetch to guarantee tests never hit the real API
const fetchSpy = vi.spyOn(globalThis, 'fetch');

describe('Storage Service (localStorage)', () => {
  beforeEach(() => {
    localStorage.clear();
    fetchSpy.mockClear();
  });

  afterEach(() => {
    // Verify no API calls were made — all operations used localStorage
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  // ---- Users ----

  describe('Users', () => {
    it('creates and retrieves a user', async () => {
      const user = await storage.createUser('Alice');
      expect(user.name).toBe('Alice');
      expect(user.id).toBeDefined();

      const users = await storage.getUsers();
      expect(users).toHaveLength(1);
      expect(users[0]).toEqual(user);
    });

    it('creates a user with photo URL', async () => {
      const photoUrl = 'data:image/png;base64,abc123';
      const user = await storage.createUser('Bob', photoUrl);
      expect(user.photoUrl).toBe(photoUrl);

      const fetched = await storage.getUser(user.id);
      expect(fetched?.photoUrl).toBe(photoUrl);
    });

    it('getUser returns undefined for non-existent ID', async () => {
      const result = await storage.getUser('non-existent-id');
      expect(result).toBeUndefined();
    });

    it('throws error when creating duplicate user name', async () => {
      await storage.createUser('Alice');
      await expect(storage.createUser('Alice')).rejects.toThrow('Uživatel s tímto jménem již existuje.');
      // Case insensitive + trimmed
      await expect(storage.createUser('alice ')).rejects.toThrow();
      await expect(storage.createUser(' ALICE')).rejects.toThrow();
    });

    it('updates a user', async () => {
      const user = await storage.createUser('Alice');
      const updated = await storage.updateUser(user.id, { name: 'Alice Updated' });

      expect(updated.name).toBe('Alice Updated');
      expect(updated.id).toBe(user.id);

      const fetched = await storage.getUser(user.id);
      expect(fetched?.name).toBe('Alice Updated');
    });

    it('updates user photo URL', async () => {
      const user = await storage.createUser('Alice');
      expect(user.photoUrl).toBeUndefined();

      const updated = await storage.updateUser(user.id, { photoUrl: 'new-photo.jpg' });
      expect(updated.photoUrl).toBe('new-photo.jpg');
    });

    it('throws error when updating non-existent user', async () => {
      await expect(storage.updateUser('fake-id', { name: 'X' })).rejects.toThrow('Uživatel nenalezen.');
    });

    it('deletes a user', async () => {
      const user = await storage.createUser('ToDelete');
      expect(await storage.getUsers()).toHaveLength(1);

      await storage.deleteUser(user.id);
      expect(await storage.getUsers()).toHaveLength(0);
      expect(await storage.getUser(user.id)).toBeUndefined();
    });

    it('creates multiple users and retrieves all', async () => {
      await storage.createUser('User1');
      await storage.createUser('User2');
      await storage.createUser('User3');

      const users = await storage.getUsers();
      expect(users).toHaveLength(3);
      expect(users.map(u => u.name).sort()).toEqual(['User1', 'User2', 'User3']);
    });
  });

  // ---- Events ----

  describe('Events', () => {
    const makeEvent = (overrides: Partial<VolleyballEvent> = {}): VolleyballEvent => ({
      id: 'evt-' + Date.now() + Math.random(),
      title: 'Test Match',
      date: '2024-06-15',
      time: '18:00',
      location: 'Gym',
      totalCost: 200,
      accountNumber: '123456/0100',
      participants: [],
      ...overrides,
    });

    it('creates and retrieves an event', async () => {
      const events = await storage.createEvent(makeEvent({ id: 'evt-1', title: 'Match A' }));
      expect(events).toHaveLength(1);
      expect(events[0].title).toBe('Match A');
      expect(events[0].participants).toEqual([]);
    });

    it('creates multiple events', async () => {
      await storage.createEvent(makeEvent({ id: 'evt-1' }));
      const events = await storage.createEvent(makeEvent({ id: 'evt-2' }));
      expect(events).toHaveLength(2);
    });

    it('updates an event', async () => {
      await storage.createEvent(makeEvent({ id: 'evt-upd', title: 'Old Title', totalCost: 100 }));

      const updated = await storage.updateEvent(makeEvent({
        id: 'evt-upd',
        title: 'New Title',
        totalCost: 300,
      }));

      const evt = updated.find(e => e.id === 'evt-upd');
      expect(evt?.title).toBe('New Title');
      expect(evt?.totalCost).toBe(300);
    });

    it('preserves other event fields on update', async () => {
      await storage.createEvent(makeEvent({
        id: 'evt-merge',
        title: 'Original',
        location: 'Hall A',
        description: 'Important game',
      }));

      const updated = await storage.updateEvent(makeEvent({
        id: 'evt-merge',
        title: 'Updated',
        location: 'Hall A',
      }));

      const evt = updated.find(e => e.id === 'evt-merge');
      expect(evt?.title).toBe('Updated');
      expect(evt?.location).toBe('Hall A');
    });

    it('deletes an event', async () => {
      await storage.createEvent(makeEvent({ id: 'evt-keep' }));
      await storage.createEvent(makeEvent({ id: 'evt-del' }));

      const remaining = await storage.deleteEvent('evt-del');
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe('evt-keep');
    });

    it('returns empty array when no events exist', async () => {
      const events = await storage.getEvents();
      expect(events).toEqual([]);
    });
  });

  // ---- Attendance ----

  describe('Attendance', () => {
    const createTestSetup = async () => {
      const user = await storage.createUser('Player');
      await storage.createEvent({
        id: 'evt-att',
        title: 'Game',
        date: '2024-01-01',
        time: '12:00',
        location: 'Loc',
        totalCost: 500,
        accountNumber: '',
        participants: [],
      });
      return user;
    };

    it('joins an event', async () => {
      const user = await createTestSetup();
      await storage.updateAttendance('evt-att', user.id, 'joined');

      const events = await storage.getEvents();
      const participant = events[0].participants.find(p => p.userId === user.id);
      expect(participant?.status).toBe('joined');
      expect(participant?.hasPaid).toBe(false);
      expect(participant?.name).toBe('Player');
    });

    it('declines an event', async () => {
      const user = await createTestSetup();
      await storage.updateAttendance('evt-att', user.id, 'declined');

      const events = await storage.getEvents();
      const participant = events[0].participants.find(p => p.userId === user.id);
      expect(participant?.status).toBe('declined');
    });

    it('sets maybe status', async () => {
      const user = await createTestSetup();
      await storage.updateAttendance('evt-att', user.id, 'maybe');

      const events = await storage.getEvents();
      const participant = events[0].participants.find(p => p.userId === user.id);
      expect(participant?.status).toBe('maybe');
    });

    it('transitions status: maybe → joined → declined', async () => {
      const user = await createTestSetup();

      await storage.updateAttendance('evt-att', user.id, 'maybe');
      let events = await storage.getEvents();
      expect(events[0].participants[0].status).toBe('maybe');

      await storage.updateAttendance('evt-att', user.id, 'joined');
      events = await storage.getEvents();
      expect(events[0].participants[0].status).toBe('joined');

      await storage.updateAttendance('evt-att', user.id, 'declined');
      events = await storage.getEvents();
      expect(events[0].participants[0].status).toBe('declined');
    });

    it('marks payment', async () => {
      const user = await createTestSetup();
      await storage.updateAttendance('evt-att', user.id, 'joined');

      // Initially unpaid
      let events = await storage.getEvents();
      expect(events[0].participants[0].hasPaid).toBe(false);

      // Mark as paid
      await storage.updateAttendance('evt-att', user.id, 'joined', true);
      events = await storage.getEvents();
      expect(events[0].participants[0].hasPaid).toBe(true);
    });

    it('supports multiple participants per event', async () => {
      const user1 = await storage.createUser('Player1');
      const user2 = await storage.createUser('Player2');
      const user3 = await storage.createUser('Player3');
      await storage.createEvent({
        id: 'evt-multi',
        title: 'Team Game',
        date: '2024-01-01',
        time: '12:00',
        location: 'Court',
        totalCost: 600,
        accountNumber: '',
        participants: [],
      });

      await storage.updateAttendance('evt-multi', user1.id, 'joined');
      await storage.updateAttendance('evt-multi', user2.id, 'declined');
      await storage.updateAttendance('evt-multi', user3.id, 'maybe');

      const events = await storage.getEvents();
      const evt = events.find(e => e.id === 'evt-multi')!;
      expect(evt.participants).toHaveLength(3);

      const p1 = evt.participants.find(p => p.userId === user1.id);
      const p2 = evt.participants.find(p => p.userId === user2.id);
      const p3 = evt.participants.find(p => p.userId === user3.id);
      expect(p1?.status).toBe('joined');
      expect(p2?.status).toBe('declined');
      expect(p3?.status).toBe('maybe');
    });

    it('hydrates participant names and photos from user data', async () => {
      const user = await storage.createUser('Alice', 'photo.jpg');
      await storage.createEvent({
        id: 'evt-hydrate',
        title: 'Game',
        date: '2024-01-01',
        time: '12:00',
        location: 'Loc',
        totalCost: 100,
        accountNumber: '',
        participants: [],
      });
      await storage.updateAttendance('evt-hydrate', user.id, 'joined');

      const events = await storage.getEvents();
      const participant = events[0].participants[0];
      expect(participant.name).toBe('Alice');
      expect(participant.photoUrl).toBe('photo.jpg');
    });

    it('shows "Neznámý" for attendance with deleted user', async () => {
      const user = await storage.createUser('Ghost');
      await storage.createEvent({
        id: 'evt-ghost',
        title: 'Game',
        date: '2024-01-01',
        time: '12:00',
        location: 'Loc',
        totalCost: 100,
        accountNumber: '',
        participants: [],
      });
      await storage.updateAttendance('evt-ghost', user.id, 'joined');

      // Manually remove user but keep attendance (simulating orphaned record)
      const users = JSON.parse(localStorage.getItem('volleyball_users_db_v1') || '[]');
      localStorage.setItem('volleyball_users_db_v1', JSON.stringify(users.filter((u: any) => u.id !== user.id)));

      const events = await storage.getEvents();
      const participant = events[0].participants[0];
      expect(participant.name).toBe('Neznámý');
    });
  });

  // ---- Cascade Deletes ----

  describe('Cascade deletes', () => {
    it('removes user attendance records when user is deleted', async () => {
      const user = await storage.createUser('ToDelete');
      const otherUser = await storage.createUser('Keeper');
      await storage.createEvent({
        id: 'evt-cascade',
        title: 'Game',
        date: '2024-01-01',
        time: '12:00',
        location: 'Loc',
        totalCost: 100,
        accountNumber: '',
        participants: [],
      });

      await storage.updateAttendance('evt-cascade', user.id, 'joined');
      await storage.updateAttendance('evt-cascade', otherUser.id, 'joined');

      // Verify both are participants
      let events = await storage.getEvents();
      expect(events[0].participants).toHaveLength(2);

      // Delete user
      await storage.deleteUser(user.id);

      // Verify only otherUser remains
      events = await storage.getEvents();
      expect(events[0].participants).toHaveLength(1);
      expect(events[0].participants[0].userId).toBe(otherUser.id);
      expect(await storage.getUser(user.id)).toBeUndefined();
    });

    it('removes event attendance records when event is deleted', async () => {
      const user = await storage.createUser('Player');
      await storage.createEvent({
        id: 'evt-to-delete',
        title: 'Game 1',
        date: '2024-01-01',
        time: '12:00',
        location: 'Loc',
        totalCost: 100,
        accountNumber: '',
        participants: [],
      });
      await storage.createEvent({
        id: 'evt-to-keep',
        title: 'Game 2',
        date: '2024-01-02',
        time: '12:00',
        location: 'Loc',
        totalCost: 100,
        accountNumber: '',
        participants: [],
      });

      await storage.updateAttendance('evt-to-delete', user.id, 'joined');
      await storage.updateAttendance('evt-to-keep', user.id, 'joined');

      // Delete event
      const remaining = await storage.deleteEvent('evt-to-delete');

      // Kept event still has attendance
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe('evt-to-keep');
      expect(remaining[0].participants).toHaveLength(1);

      // Verify attendance for deleted event is gone from localStorage
      const allAttendance = JSON.parse(localStorage.getItem('volleyball_attendance_db_v1') || '[]');
      const orphaned = allAttendance.filter((a: any) => a.eventId === 'evt-to-delete');
      expect(orphaned).toHaveLength(0);
    });
  });
});