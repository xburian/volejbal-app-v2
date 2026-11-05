import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAdminAuth } from './useAdminAuth';

describe('useAdminAuth Hook', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('initializes with unauthenticated state', () => {
    const { result } = renderHook(() => useAdminAuth());

    expect(result.current.isAdminAuthenticated).toBe(false);
    expect(result.current.adminToken).toBeNull();
    expect(result.current.adminUser).toBeNull();
    expect(result.current.isImpersonating).toBe(false);
    expect(result.current.impersonatingTeam).toBeNull();
  });

  it('logs in admin successfully and persists token to sessionStorage', async () => {
    const mockResponse = {
      accessToken: 'mock-admin-token-xyz',
      admin: { username: 'admin', role: 'admin' },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as any);

    const { result } = renderHook(() => useAdminAuth());

    await act(async () => {
      await result.current.loginAdmin('admin', 'admin123');
    });

    expect(result.current.isAdminAuthenticated).toBe(true);
    expect(result.current.adminToken).toBe('mock-admin-token-xyz');
    expect(result.current.adminUser).toEqual({ username: 'admin', role: 'admin' });
    expect(sessionStorage.getItem('admin_access_token')).toBe('mock-admin-token-xyz');
  });

  it('throws error when admin login fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Neplatné administrátorské heslo' }),
    } as any);

    const { result } = renderHook(() => useAdminAuth());

    await expect(
      act(async () => {
        await result.current.loginAdmin('admin', 'wrong');
      })
    ).rejects.toThrow('Neplatné administrátorské heslo');

    expect(result.current.isAdminAuthenticated).toBe(false);
  });

  it('clears sessionStorage and state on logoutAdmin', async () => {
    sessionStorage.setItem('admin_access_token', 'token-123');
    sessionStorage.setItem('admin_user_profile', JSON.stringify({ username: 'admin', role: 'admin' }));

    const { result } = renderHook(() => useAdminAuth());
    expect(result.current.isAdminAuthenticated).toBe(true);

    act(() => {
      result.current.logoutAdmin();
    });

    expect(result.current.isAdminAuthenticated).toBe(false);
    expect(result.current.adminToken).toBeNull();
    expect(sessionStorage.getItem('admin_access_token')).toBeNull();
  });

  it('fetches team overview data with Bearer token', async () => {
    sessionStorage.setItem('admin_access_token', 'token-123');
    const mockOverview = {
      totalTeams: 2,
      totalUsers: 10,
      totalEvents: 15,
      teams: [
        { id: 't1', name: 'Team 1', createdAt: '2025-01-01', userCount: 5, eventCount: 8, lastActiveAt: null },
      ],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockOverview,
    } as any);

    const { result } = renderHook(() => useAdminAuth());

    let overviewData: any;
    await act(async () => {
      overviewData = await result.current.fetchOverview();
    });

    expect(global.fetch).toHaveBeenCalledWith('/api/admin?action=overview', {
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-123',
      },
    });
    expect(overviewData).toEqual(mockOverview);
  });

  it('impersonates a team and manages impersonation state in sessionStorage', async () => {
    sessionStorage.setItem('admin_access_token', 'admin-token');
    const mockImpersonateRes = {
      team: { id: 'team-42', name: 'Volley 42', createdAt: '2025-01-01' },
      accessToken: 'impersonated-jwt',
      refreshToken: 'impersonated-refresh',
      isImpersonated: true,
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockImpersonateRes,
    } as any);

    const { result } = renderHook(() => useAdminAuth());

    await act(async () => {
      await result.current.impersonateTeam('team-42');
    });

    expect(result.current.isImpersonating).toBe(true);
    expect(result.current.impersonatingTeam?.id).toBe('team-42');
    expect(sessionStorage.getItem('impersonation_team_token')).toBe('impersonated-jwt');
    expect(sessionStorage.getItem('admin_impersonating_team')).toContain('Volley 42');

    // Test ending impersonation
    act(() => {
      result.current.endImpersonation();
    });

    expect(result.current.isImpersonating).toBe(false);
    expect(result.current.impersonatingTeam).toBeNull();
    expect(sessionStorage.getItem('impersonation_team_token')).toBeNull();
  });
});
