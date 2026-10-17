import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MobileBottomNav } from './MobileBottomNav';

describe('MobileBottomNav', () => {
  const baseProps = {
    activeView: 'calendar' as const,
    onNavigate: vi.fn(),
    onOpenSettings: vi.fn(),
    onCreateEvent: vi.fn(),
  };

  it('renders all tab buttons', () => {
    render(<MobileBottomNav {...baseProps} />);
    expect(screen.getByTestId('nav-calendar')).toBeInTheDocument();
    expect(screen.getByTestId('nav-stats')).toBeInTheDocument();
    expect(screen.getByTestId('nav-profile')).toBeInTheDocument();
    expect(screen.getByTestId('nav-create')).toBeInTheDocument();
  });

  it('renders tab labels', () => {
    render(<MobileBottomNav {...baseProps} />);
    expect(screen.getByText('Kalendář')).toBeInTheDocument();
    expect(screen.getByText('Statistiky')).toBeInTheDocument();
    expect(screen.getByText('Můj profil')).toBeInTheDocument();
  });

  it('highlights calendar tab when activeView is calendar', () => {
    render(<MobileBottomNav {...baseProps} activeView="calendar" />);
    expect(screen.getByTestId('nav-calendar').className).toContain('text-blue-600');
    expect(screen.getByTestId('nav-stats').className).not.toContain('text-blue-600');
  });

  it('highlights stats tab when activeView is stats', () => {
    render(<MobileBottomNav {...baseProps} activeView="stats" />);
    expect(screen.getByTestId('nav-stats').className).toContain('text-blue-600');
    expect(screen.getByTestId('nav-calendar').className).not.toContain('text-blue-600');
  });

  it('calls onNavigate("calendar") when calendar tab is clicked', async () => {
    const onNavigate = vi.fn();
    const user = userEvent.setup();
    render(<MobileBottomNav {...baseProps} onNavigate={onNavigate} />);
    await user.click(screen.getByTestId('nav-calendar'));
    expect(onNavigate).toHaveBeenCalledWith('calendar');
  });

  it('calls onNavigate("stats") when stats tab is clicked', async () => {
    const onNavigate = vi.fn();
    const user = userEvent.setup();
    render(<MobileBottomNav {...baseProps} onNavigate={onNavigate} />);
    await user.click(screen.getByTestId('nav-stats'));
    expect(onNavigate).toHaveBeenCalledWith('stats');
  });

  it('calls onNavigate("profile") when profile tab is clicked', async () => {
    const onNavigate = vi.fn();
    const user = userEvent.setup();
    render(<MobileBottomNav {...baseProps} onNavigate={onNavigate} />);
    await user.click(screen.getByTestId('nav-profile'));
    expect(onNavigate).toHaveBeenCalledWith('profile');
  });

  it('calls onCreateEvent when FAB button is clicked', async () => {
    const onCreateEvent = vi.fn();
    const user = userEvent.setup();
    render(<MobileBottomNav {...baseProps} onCreateEvent={onCreateEvent} />);
    await user.click(screen.getByTestId('nav-create'));
    expect(onCreateEvent).toHaveBeenCalled();
  });
});

