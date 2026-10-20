import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MobileHeader } from './MobileHeader';
import { User, SportEvent } from '../types';

const mockUser: User = { id: 'u1', name: 'Honza', photoUrl: 'photo.jpg' };
const mockEvent: SportEvent = {
  id: 'e1',
  title: 'Volejbal Pondělí',
  date: '2026-03-30',
  time: '18:00',
  location: 'Hall',
  totalCost: 1000,
  accountNumber: '',
  participants: [],
};

describe('MobileHeader', () => {
  it('shows app name and logout on calendar view', () => {
    render(
      <MobileHeader
        mobileView="calendar"
        currentUser={mockUser}
        selectedEvent={undefined}
        onBack={vi.fn()}
        onLogout={vi.fn()}
      />
    );
    expect(screen.getByText('Sport Plánovač')).toBeInTheDocument();
    expect(screen.getByTestId('mobile-logout')).toBeInTheDocument();
    expect(screen.queryByTestId('mobile-back')).not.toBeInTheDocument();
  });

  it('shows user photo on calendar view', () => {
    render(
      <MobileHeader
        mobileView="calendar"
        currentUser={mockUser}
        selectedEvent={undefined}
        onBack={vi.fn()}
        onLogout={vi.fn()}
      />
    );
    const img = screen.getByAltText('Honza');
    expect(img).toHaveAttribute('src', 'photo.jpg');
  });

  it('shows back button and event title on detail view', () => {
    render(
      <MobileHeader
        mobileView="detail"
        currentUser={mockUser}
        selectedEvent={mockEvent}
        onBack={vi.fn()}
        onLogout={vi.fn()}
      />
    );
    expect(screen.getByTestId('mobile-back')).toBeInTheDocument();
    expect(screen.getByTestId('mobile-title')).toHaveTextContent('Volejbal Pondělí');
  });

  it('shows back button and "Statistiky" on stats view', () => {
    render(
      <MobileHeader
        mobileView="stats"
        currentUser={mockUser}
        selectedEvent={undefined}
        onBack={vi.fn()}
        onLogout={vi.fn()}
      />
    );
    expect(screen.getByTestId('mobile-back')).toBeInTheDocument();
    expect(screen.getByTestId('mobile-title')).toHaveTextContent('Statistiky');
  });

  it('calls onBack when back button is clicked', async () => {
    const onBack = vi.fn();
    const user = userEvent.setup();
    render(
      <MobileHeader
        mobileView="detail"
        currentUser={mockUser}
        selectedEvent={mockEvent}
        onBack={onBack}
        onLogout={vi.fn()}
      />
    );
    await user.click(screen.getByTestId('mobile-back'));
    expect(onBack).toHaveBeenCalled();
  });

  it('calls onLogout when logout button is clicked', async () => {
    const onLogout = vi.fn();
    const user = userEvent.setup();
    render(
      <MobileHeader
        mobileView="calendar"
        currentUser={mockUser}
        selectedEvent={undefined}
        onBack={vi.fn()}
        onLogout={onLogout}
      />
    );
    await user.click(screen.getByTestId('mobile-logout'));
    expect(onLogout).toHaveBeenCalled();
  });

  it('hides photo when user has no photoUrl', () => {
    render(
      <MobileHeader
        mobileView="calendar"
        currentUser={{ id: 'u1', name: 'Honza' }}
        selectedEvent={undefined}
        onBack={vi.fn()}
        onLogout={vi.fn()}
      />
    );
    expect(screen.queryByAltText('Honza')).not.toBeInTheDocument();
  });

  it('renders currentTeam name badge when currentTeam is provided', () => {
    const mockTeam = { id: 'team-nahravame-si', name: 'nahravame-si', createdAt: '2026-01-01' };
    render(
      <MobileHeader
        mobileView="calendar"
        currentUser={mockUser}
        currentTeam={mockTeam}
        selectedEvent={undefined}
        onBack={vi.fn()}
        onLogout={vi.fn()}
      />
    );
    expect(screen.getByText('Tým: nahravame-si')).toBeInTheDocument();
  });

  it('calls onLogoutTeam when team switch button is clicked', async () => {
    const onLogoutTeam = vi.fn();
    const user = userEvent.setup();
    render(
      <MobileHeader
        mobileView="calendar"
        currentUser={mockUser}
        selectedEvent={undefined}
        onBack={vi.fn()}
        onLogout={vi.fn()}
        onLogoutTeam={onLogoutTeam}
      />
    );
    await user.click(screen.getByTestId('mobile-logout-team'));
    expect(onLogoutTeam).toHaveBeenCalled();
  });

  it('calls onOpenMenu when user avatar is clicked on calendar view', async () => {
    const onOpenMenu = vi.fn();
    const user = userEvent.setup();
    render(
      <MobileHeader
        mobileView="calendar"
        currentUser={mockUser}
        selectedEvent={undefined}
        onBack={vi.fn()}
        onLogout={vi.fn()}
        onOpenMenu={onOpenMenu}
      />
    );
    await user.click(screen.getByTestId('mobile-user-menu'));
    expect(onOpenMenu).toHaveBeenCalled();
  });

  it('includes safe-area-inset-top padding and >=44px touch targets', () => {
    const { container } = render(
      <MobileHeader
        mobileView="calendar"
        currentUser={mockUser}
        selectedEvent={undefined}
        onBack={vi.fn()}
        onLogout={vi.fn()}
        onLogoutTeam={vi.fn()}
        onRefresh={vi.fn()}
        onOpenMenu={vi.fn()}
      />
    );
    const header = container.querySelector('header');
    expect(header?.className).toContain('pt-[env(safe-area-inset-top,0px)]');

    const refreshBtn = screen.getByTestId('mobile-refresh');
    expect(refreshBtn.className).toContain('w-11');
    expect(refreshBtn.className).toContain('h-11');

    const logoutBtn = screen.getByTestId('mobile-logout');
    expect(logoutBtn.className).toContain('w-11');
    expect(logoutBtn.className).toContain('h-11');

    const logoutTeamBtn = screen.getByTestId('mobile-logout-team');
    expect(logoutTeamBtn.className).toContain('w-11');
    expect(logoutTeamBtn.className).toContain('h-11');

    const userMenuBtn = screen.getByTestId('mobile-user-menu');
    expect(userMenuBtn.className).toContain('min-w-[44px]');
    expect(userMenuBtn.className).toContain('min-h-[44px]');
  });

  it('provides >=44px back and refresh touch targets on detail view', () => {
    render(
      <MobileHeader
        mobileView="detail"
        currentUser={mockUser}
        selectedEvent={mockEvent}
        onBack={vi.fn()}
        onLogout={vi.fn()}
        onRefresh={vi.fn()}
      />
    );
    const backBtn = screen.getByTestId('mobile-back');
    expect(backBtn.className).toContain('min-w-[44px]');
    expect(backBtn.className).toContain('min-h-[44px]');

    const refreshBtn = screen.getByTestId('mobile-refresh-detail');
    expect(refreshBtn.className).toContain('w-11');
    expect(refreshBtn.className).toContain('h-11');
  });
});


