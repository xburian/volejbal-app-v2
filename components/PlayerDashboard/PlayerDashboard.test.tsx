import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PlayerDashboard } from './PlayerDashboard';
import { User, SportEvent } from '../../types';

describe('PlayerDashboard Component', () => {
  const mockUser: User = {
    id: 'u1',
    name: 'Lukáš Burian',
    photoUrl: 'https://example.com/lukas.jpg',
    teamId: 'team-nahravame-si',
    preferredPosition: 'setter',
    playerMotto: 'Příjem je základ všeho! 🏐',
  };

  const mockEvents: SportEvent[] = [
    {
      id: 'e1',
      title: 'Pravidelný volejbal',
      date: '2026-10-10',
      time: '18:00',
      location: 'Hala',
      totalCost: 1000,
      accountNumber: '123/0100',
      participants: [
        { userId: 'u1', name: 'Lukáš Burian', status: 'joined', hasPaid: true },
      ],
      teams: [
        [{ userId: 'u1', name: 'Lukáš Burian' }],
        [{ userId: 'u2', name: 'Petr Novák' }],
      ],
      winningTeam: 0,
      score: [[25, 20], [25, 22]],
    },
  ];

  it('renders player dashboard with user name, rank, and hero card', () => {
    render(
      <PlayerDashboard
        currentUser={mockUser}
        events={mockEvents}
        onOpenSettings={vi.fn()}
      />
    );

    expect(screen.getByText('Můj hráčský profil')).toBeInTheDocument();
    expect(screen.getByText('Lukáš Burian')).toBeInTheDocument();
    expect(screen.getByText(/Příjem je základ všeho!/)).toBeInTheDocument();
    expect(screen.getByTestId('player-hero-card')).toBeInTheDocument();
  });

  it('renders radar chart attributes and active quests', () => {
    render(
      <PlayerDashboard
        currentUser={mockUser}
        events={mockEvents}
        onOpenSettings={vi.fn()}
      />
    );

    expect(screen.getByText('Herní atributy')).toBeInTheDocument();
    expect(screen.getByText('Aktivní výzvy & Milníky')).toBeInTheDocument();
    expect(screen.getByText('Síň slávy & Odznaky')).toBeInTheDocument();
  });

  it('opens profile editing modal and calls onUpdateUser', async () => {
    const onUpdateUser = vi.fn().mockResolvedValue(undefined);

    render(
      <PlayerDashboard
        currentUser={mockUser}
        events={mockEvents}
        onOpenSettings={vi.fn()}
        onUpdateUser={onUpdateUser}
      />
    );

    // Click edit button in hero card
    const editBtn = screen.getByTitle('Upravit pozici a motto');
    fireEvent.click(editBtn);

    expect(screen.getByText('Upravit hráčskou identitu')).toBeInTheDocument();
    expect(screen.getByText('Preferovaná herní pozice')).toBeInTheDocument();

    // Select different position (e.g. Smečař)
    const smecarBtn = screen.getByText('Smečař');
    fireEvent.click(smecarBtn);

    // Save
    const saveBtn = screen.getByText('Uložit profil');
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(onUpdateUser).toHaveBeenCalledWith({
        preferredPosition: 'outside_hitter',
        playerMotto: 'Příjem je základ všeho! 🏐',
      });
    });
  });

  it('calls onOpenSettings when clicking the settings button', () => {
    const onOpenSettings = vi.fn();
    render(
      <PlayerDashboard
        currentUser={mockUser}
        events={mockEvents}
        onOpenSettings={onOpenSettings}
      />
    );

    const settingsBtn = screen.getByTitle('Nastavení účtu a aplikace');
    fireEvent.click(settingsBtn);

    expect(onOpenSettings).toHaveBeenCalled();
  });
});
