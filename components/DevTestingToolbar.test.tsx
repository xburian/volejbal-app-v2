import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DevTestingToolbar } from './DevTestingToolbar';
import * as storage from '../services/storage';

vi.mock('../services/storage', () => ({
  loginTeam: vi.fn(),
  setSession: vi.fn(),
}));

describe('DevTestingToolbar', () => {
  const mockOnTeamSwitch = vi.fn();
  const mockOnDataRefresh = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/dev/status') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ isMock: true, teamsCount: 3, usersCount: 16, eventsCount: 12 }),
        });
      }
      if (url === '/api/dev/seed' || url === '/api/dev/reset') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, message: 'OK' }),
        });
      }
      return Promise.reject(new Error('Unknown url'));
    }) as any;
  });

  it('renders collapsed dev button initially', () => {
    render(<DevTestingToolbar onTeamSwitch={mockOnTeamSwitch} onDataRefresh={mockOnDataRefresh} />);
    expect(screen.getByText('Dev DB')).toBeInTheDocument();
  });

  it('expands on click and displays quick login options and stats', async () => {
    const user = userEvent.setup();
    render(<DevTestingToolbar onTeamSwitch={mockOnTeamSwitch} onDataRefresh={mockOnDataRefresh} />);

    await user.click(screen.getByText('Dev DB'));

    expect(screen.getByText('Dev Mock DB')).toBeInTheDocument();
    expect(screen.getByText('In-Memory Mock')).toBeInTheDocument();
    expect(screen.getByText('nahravame-si')).toBeInTheDocument();
    expect(screen.getByText('Volejbal Brno')).toBeInTheDocument();
    expect(screen.getByText('Beach Praha')).toBeInTheDocument();
    expect(screen.getByText('Re-seed dat')).toBeInTheDocument();
    expect(screen.getByText('Reset DB')).toBeInTheDocument();
  });

  it('performs quick team switch when clicking a team', async () => {
    const user = userEvent.setup();
    vi.mocked(storage.loginTeam).mockResolvedValue({
      accessToken: 'acc_token',
      refreshToken: 'ref_token',
      team: { id: 'team-nahravame-si', name: 'nahravame-si', createdAt: '2026-01-01' },
    });

    render(<DevTestingToolbar onTeamSwitch={mockOnTeamSwitch} onDataRefresh={mockOnDataRefresh} />);
    await user.click(screen.getByText('Dev DB'));

    const teamBtn = screen.getByRole('button', { name: /nahravame-si/i });
    await user.click(teamBtn);

    await waitFor(() => {
      expect(storage.loginTeam).toHaveBeenCalledWith('team-nahravame-si', '1234');
      expect(mockOnTeamSwitch).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'nahravame-si' }),
        'acc_token',
        'ref_token'
      );
    });
  });

  it('handles re-seed data action', async () => {
    const user = userEvent.setup();
    render(<DevTestingToolbar onTeamSwitch={mockOnTeamSwitch} onDataRefresh={mockOnDataRefresh} />);
    await user.click(screen.getByText('Dev DB'));

    const seedBtn = screen.getByText('Re-seed dat');
    await user.click(seedBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/dev/seed', { method: 'POST' });
      expect(mockOnDataRefresh).toHaveBeenCalled();
    });
  });

  it('handles reset database action', async () => {
    const user = userEvent.setup();
    render(<DevTestingToolbar onTeamSwitch={mockOnTeamSwitch} onDataRefresh={mockOnDataRefresh} />);
    await user.click(screen.getByText('Dev DB'));

    const resetBtn = screen.getByText('Reset DB');
    await user.click(resetBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/dev/reset', { method: 'POST' });
      expect(mockOnDataRefresh).toHaveBeenCalled();
    });
  });

  it('can be minimized back to pill button', async () => {
    const user = userEvent.setup();
    render(<DevTestingToolbar onTeamSwitch={mockOnTeamSwitch} onDataRefresh={mockOnDataRefresh} />);
    await user.click(screen.getByText('Dev DB'));

    const minimizeBtn = screen.getByTitle('Minimalizovat');
    await user.click(minimizeBtn);

    expect(screen.getByText('Dev DB')).toBeInTheDocument();
    expect(screen.queryByText('Dev Mock DB')).not.toBeInTheDocument();
  });
});
