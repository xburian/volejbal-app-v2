import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePersistedAuth } from './usePersistedAuth';
import * as storage from '../services/storage';
import { User, Team } from '../types';

vi.mock('../services/storage', () => ({
  getCurrentTeam: vi.fn(),
  setSession: vi.fn(),
  logoutTeamSession: vi.fn(),
}));

describe('usePersistedAuth hook', () => {
  const mockUser: User = { id: 'u1', name: 'Petr' };
  const mockTeam: Team = { id: 'team-test', name: 'Test Team', createdAt: '2026-01-01' };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('initializes with fallback team in vitest and null user if storage empty', () => {
    const { result } = renderHook(() => usePersistedAuth());
    expect(result.current.currentTeam).toBeDefined();
    expect(result.current.currentTeam?.name).toBe('nahravame-si');
    expect(result.current.currentUser).toBeNull();
  });

  it('restores currentUser from localStorage on mount', () => {
    localStorage.setItem('currentUser', JSON.stringify(mockUser));
    const { result } = renderHook(() => usePersistedAuth());
    expect(result.current.currentUser).toEqual(mockUser);
  });

  it('loginTeam updates currentTeam and calls storage.setSession', () => {
    const { result } = renderHook(() => usePersistedAuth());

    act(() => {
      result.current.loginTeam(mockTeam, 'access-123', 'refresh-456');
    });

    expect(result.current.currentTeam).toEqual(mockTeam);
    expect(storage.setSession).toHaveBeenCalledWith('access-123', 'refresh-456', mockTeam);
  });

  it('logoutTeam clears currentTeam, currentUser, and cleans localStorage', () => {
    localStorage.setItem('currentUser', JSON.stringify(mockUser));
    localStorage.setItem('selectedEventId', 'event-999');

    const { result } = renderHook(() => usePersistedAuth());

    act(() => {
      result.current.logoutTeam();
    });

    expect(result.current.currentTeam).toBeNull();
    expect(result.current.currentUser).toBeNull();
    expect(storage.logoutTeamSession).toHaveBeenCalled();
    expect(localStorage.getItem('currentUser')).toBeNull();
    expect(localStorage.getItem('selectedEventId')).toBeNull();
  });

  it('login updates currentUser and persists to localStorage', () => {
    const { result } = renderHook(() => usePersistedAuth());

    act(() => {
      result.current.login(mockUser);
    });

    expect(result.current.currentUser).toEqual(mockUser);
    expect(JSON.parse(localStorage.getItem('currentUser') || '{}')).toEqual(mockUser);
  });

  it('logout clears currentUser and removes from localStorage', () => {
    localStorage.setItem('currentUser', JSON.stringify(mockUser));
    const { result } = renderHook(() => usePersistedAuth());

    act(() => {
      result.current.logout();
    });

    expect(result.current.currentUser).toBeNull();
    expect(localStorage.getItem('currentUser')).toBeNull();
  });

  it('updateUser updates currentUser in state and localStorage', () => {
    localStorage.setItem('currentUser', JSON.stringify(mockUser));
    const { result } = renderHook(() => usePersistedAuth());

    const updatedUser = { ...mockUser, name: 'Petr Nový' };
    act(() => {
      result.current.updateUser(updatedUser);
    });

    expect(result.current.currentUser).toEqual(updatedUser);
    expect(JSON.parse(localStorage.getItem('currentUser') || '{}')).toEqual(updatedUser);
  });
});
