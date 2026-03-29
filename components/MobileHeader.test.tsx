import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MobileHeader } from './MobileHeader';
import { User, VolleyballEvent } from '../types';

const mockUser: User = { id: 'u1', name: 'Honza', photoUrl: 'photo.jpg' };
const mockEvent: VolleyballEvent = {
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
    expect(screen.getByText('Volejbal')).toBeInTheDocument();
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
});

