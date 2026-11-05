import { useState, useCallback, useEffect } from 'react';
import { AdminUser, AdminOverviewData, Team } from '@/types';
import * as storage from '@/services/storage';

const SS_ADMIN_TOKEN = 'admin_access_token';
const SS_ADMIN_USER = 'admin_user_profile';
const SS_ADMIN_IMPERSONATING_TEAM = 'admin_impersonating_team';

export function useAdminAuth() {
  const [adminToken, setAdminToken] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(SS_ADMIN_TOKEN);
    } catch {
      return null;
    }
  });

  const [adminUser, setAdminUser] = useState<AdminUser | null>(() => {
    try {
      const raw = sessionStorage.getItem(SS_ADMIN_USER);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const [impersonatingTeam, setImpersonatingTeam] = useState<Team | null>(() => {
    try {
      const raw = sessionStorage.getItem(SS_ADMIN_IMPERSONATING_TEAM);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync state if sessionStorage changes or on tab mount
  useEffect(() => {
    const checkState = () => {
      try {
        const token = sessionStorage.getItem(SS_ADMIN_TOKEN);
        setAdminToken(token);
        const user = sessionStorage.getItem(SS_ADMIN_USER);
        setAdminUser(user ? JSON.parse(user) : null);
        const team = sessionStorage.getItem(SS_ADMIN_IMPERSONATING_TEAM);
        setImpersonatingTeam(team ? JSON.parse(team) : null);
      } catch {
        /* ignore storage errors */
      }
    };
    window.addEventListener('storage', checkState);
    return () => window.removeEventListener('storage', checkState);
  }, []);

  const loginAdmin = useCallback(async (username: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', username, password }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Neplatné přihlašovací údaje správce.');
      }

      const data = await res.json();
      sessionStorage.setItem(SS_ADMIN_TOKEN, data.accessToken);
      sessionStorage.setItem(SS_ADMIN_USER, JSON.stringify(data.admin));

      setAdminToken(data.accessToken);
      setAdminUser(data.admin);
      return data.admin;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logoutAdmin = useCallback(() => {
    try {
      sessionStorage.removeItem(SS_ADMIN_TOKEN);
      sessionStorage.removeItem(SS_ADMIN_USER);
      sessionStorage.removeItem(SS_ADMIN_IMPERSONATING_TEAM);
      storage.clearImpersonationSession();
    } catch {
      /* ignore storage errors */
    }

    setAdminToken(null);
    setAdminUser(null);
    setImpersonatingTeam(null);
  }, []);

  const fetchOverview = useCallback(async (): Promise<AdminOverviewData> => {
    if (!adminToken) {
      throw new Error('Vyžadováno přihlášení správce.');
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/admin?action=overview', {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
      });

      if (!res.ok) {
        if (res.status === 401) {
          logoutAdmin();
          throw new Error('Platnost přihlášení správce vypršela. Přihlaste se prosím znovu.');
        }
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Nepodařilo se načíst přehled týmů.');
      }

      return await res.json();
    } finally {
      setIsLoading(false);
    }
  }, [adminToken, logoutAdmin]);

  const impersonateTeam = useCallback(
    async (teamId: string) => {
      if (!adminToken) {
        throw new Error('Vyžadováno přihlášení správce.');
      }

      setIsLoading(true);
      try {
        const res = await fetch('/api/admin', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({ action: 'impersonate', teamId }),
        });

        if (!res.ok) {
          if (res.status === 401) {
            logoutAdmin();
            throw new Error('Platnost přihlášení správce vypršela.');
          }
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Nepodařilo se přepnout do týmu.');
        }

        const data = await res.json();
        // Save impersonation tokens into sessionStorage
        storage.setSession(data.accessToken, data.refreshToken, data.team, true);
        sessionStorage.setItem(SS_ADMIN_IMPERSONATING_TEAM, JSON.stringify(data.team));
        setImpersonatingTeam(data.team);

        return data; // { team, accessToken, refreshToken, isImpersonated: true }
      } finally {
        setIsLoading(false);
      }
    },
    [adminToken, logoutAdmin]
  );

  const endImpersonation = useCallback(() => {
    try {
      storage.clearImpersonationSession();
      sessionStorage.removeItem(SS_ADMIN_IMPERSONATING_TEAM);
    } catch {
      /* ignore storage errors */
    }
    setImpersonatingTeam(null);
  }, []);

  const resetTeamPassword = useCallback(
    async (teamId: string, newPassword: string) => {
      if (!adminToken) {
        throw new Error('Vyžadováno přihlášení správce.');
      }

      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ action: 'reset-team-password', teamId, newPassword }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Nepodařilo se změnit heslo týmu.');
      }

      return await res.json();
    },
    [adminToken]
  );

  return {
    adminToken,
    adminUser,
    impersonatingTeam,
    isAdminAuthenticated: Boolean(adminToken),
    isImpersonating: Boolean(impersonatingTeam),
    isLoading,
    error,
    loginAdmin,
    logoutAdmin,
    fetchOverview,
    impersonateTeam,
    endImpersonation,
    resetTeamPassword,
  };
}
