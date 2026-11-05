import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminDashboard } from './AdminDashboard';
import { AdminOverviewData } from '@/types';

const mockOverviewData: AdminOverviewData = {
  totalTeams: 3,
  totalUsers: 30,
  totalEvents: 45,
  teams: [
    {
      id: 'team-active',
      name: 'Active Eagles',
      createdAt: '2025-01-01',
      userCount: 15,
      eventCount: 25,
      lastActiveAt: new Date().toISOString(), // active (<14d)
    },
    {
      id: 'team-dormant',
      name: 'Dormant Bears',
      createdAt: '2025-02-01',
      userCount: 10,
      eventCount: 15,
      lastActiveAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(), // dormant (25d)
    },
    {
      id: 'team-inactive',
      name: 'Inactive Wolves',
      createdAt: '2025-03-01',
      userCount: 5,
      eventCount: 5,
      lastActiveAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(), // inactive (>45d)
    },
  ],
};

describe('AdminDashboard Component', () => {
  it('renders stats counters and team overview table', async () => {
    const fetchOverview = vi.fn().mockResolvedValue(mockOverviewData);

    render(
      <AdminDashboard
        adminUser={{ username: 'admin', role: 'admin' }}
        onLogout={vi.fn()}
        onImpersonate={vi.fn()}
        onResetPassword={vi.fn()}
        fetchOverview={fetchOverview}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('stat-total-teams')).toHaveTextContent('3');
      expect(screen.getByTestId('stat-total-users')).toHaveTextContent('30');
      expect(screen.getByTestId('stat-total-events')).toHaveTextContent('45');
    });

    const table = screen.getByTestId('teams-table');
    expect(within(table).getByText('Active Eagles')).toBeInTheDocument();
    expect(within(table).getByText('Dormant Bears')).toBeInTheDocument();
    expect(within(table).getByText('Inactive Wolves')).toBeInTheDocument();
  });

  it('filters teams by search query', async () => {
    const fetchOverview = vi.fn().mockResolvedValue(mockOverviewData);

    render(
      <AdminDashboard
        adminUser={{ username: 'admin', role: 'admin' }}
        onLogout={vi.fn()}
        onImpersonate={vi.fn()}
        onResetPassword={vi.fn()}
        fetchOverview={fetchOverview}
      />
    );

    const table = await screen.findByTestId('teams-table');
    expect(within(table).getByText('Active Eagles')).toBeInTheDocument();

    const searchInput = screen.getByTestId('team-search-input');
    await userEvent.type(searchInput, 'Eagles');

    expect(within(table).getByText('Active Eagles')).toBeInTheDocument();
    expect(within(table).queryByText('Dormant Bears')).not.toBeInTheDocument();
    expect(within(table).queryByText('Inactive Wolves')).not.toBeInTheDocument();
  });

  it('triggers onImpersonate when bypass button is clicked', async () => {
    const fetchOverview = vi.fn().mockResolvedValue(mockOverviewData);
    const onImpersonate = vi.fn().mockResolvedValue({});

    render(
      <AdminDashboard
        adminUser={{ username: 'admin', role: 'admin' }}
        onLogout={vi.fn()}
        onImpersonate={onImpersonate}
        onResetPassword={vi.fn()}
        fetchOverview={fetchOverview}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('impersonate-btn-team-active')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByTestId('impersonate-btn-team-active'));
    expect(onImpersonate).toHaveBeenCalledWith('team-active');
  });

  it('opens reset password modal when key icon is clicked', async () => {
    const fetchOverview = vi.fn().mockResolvedValue(mockOverviewData);

    render(
      <AdminDashboard
        adminUser={{ username: 'admin', role: 'admin' }}
        onLogout={vi.fn()}
        onImpersonate={vi.fn()}
        onResetPassword={vi.fn()}
        fetchOverview={fetchOverview}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('reset-pwd-btn-team-active')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByTestId('reset-pwd-btn-team-active'));
    expect(screen.getByTestId('reset-password-modal')).toBeInTheDocument();
    expect(screen.getByText('Tým: Active Eagles')).toBeInTheDocument();
  });
});

