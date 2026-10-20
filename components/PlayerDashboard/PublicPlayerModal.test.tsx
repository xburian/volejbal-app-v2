import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PublicPlayerModal } from './PublicPlayerModal';
import { User, PlayerGamificationState } from '../../types';

describe('PublicPlayerModal Component', () => {
  const mockUser: User = {
    id: 'u2',
    name: 'Petr Novák',
    preferredPosition: 'outside_hitter',
    playerMotto: 'Na balón se nečeká!',
  };

  const mockGamification: PlayerGamificationState = {
    userId: 'u2',
    totalXp: 4500,
    currentLevel: 10,
    highestLevelAchieved: 10,
    rankTitle: 'Týmový pilíř',
    rankTier: 'silver',
    xpInCurrentLevel: 50,
    xpForNextLevel: 800,
    levelProgressPercent: 6,
    currentAttendanceStreak: 4,
    longestAttendanceStreak: 6,
    streakShieldsAvailable: 1,
    isOnFire: true,
    isStreakFrozen: false,
    attributes: {
      reliability: 88,
      form: 80,
      clutch: 75,
      teamplay: 82,
      endurance: 78,
    },
    activeQuests: [],
    nextLevelDeficit: 750,
    nextLevelHintText: 'Už jen 750 XP!',
    mvpAwardsCount: 2,
    kudosCount: 5,
  };

  it('renders public player card with prestige details and no raw radar', () => {
    render(
      <PublicPlayerModal
        user={mockUser}
        gamification={mockGamification}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByTestId('public-player-modal')).toBeInTheDocument();
    expect(screen.getByText('Petr Novák')).toBeInTheDocument();
    expect(screen.getByText('Týmový pilíř')).toBeInTheDocument();
    expect(screen.getByText('LVL 10')).toBeInTheDocument();
    expect(screen.getByText('SME')).toBeInTheDocument();
    expect(screen.getByText(/Na balón se nečeká!/)).toBeInTheDocument();
    expect(screen.getByText('4 zápasů')).toBeInTheDocument();
    expect(screen.getByText(/2× Hvězda zápasu/)).toBeInTheDocument();
    expect(screen.getByText(/5 pochval/)).toBeInTheDocument();

    // Verify raw radar is NOT present in public card
    expect(screen.queryByText('Herní atributy')).not.toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(
      <PublicPlayerModal
        user={mockUser}
        gamification={mockGamification}
        onClose={onClose}
      />
    );

    const closeBtn = screen.getByTitle('Zavřít');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });
});
