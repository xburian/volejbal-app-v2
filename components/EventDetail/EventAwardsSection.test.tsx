import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EventAwardsSection } from './EventAwardsSection';
import { SportEvent, User } from '../../types';

describe('EventAwardsSection Component', () => {
  const mockParticipants = [
    { userId: 'u1', name: 'Adam Smečař', status: 'joined' as const, hasPaid: true },
    { userId: 'u2', name: 'Bára Nahrávačka', status: 'joined' as const, hasPaid: true },
    { userId: 'u3', name: 'Cyril Blokař', status: 'joined' as const, hasPaid: false },
    { userId: 'u4', name: 'David Čekač', status: 'waitlist' as const, hasPaid: false },
  ];

  const mockUsers: User[] = [
    { id: 'u1', name: 'Adam Smečař' },
    { id: 'u2', name: 'Bára Nahrávačka' },
    { id: 'u3', name: 'Cyril Blokař' },
  ];

  const baseEvent: SportEvent = {
    id: 'e1',
    title: 'Pondělní volejbal',
    date: '2026-10-20',
    time: '18:00',
    location: 'Hala',
    totalCost: 1200,
    accountNumber: '123/0100',
    participants: mockParticipants,
    eventAwards: {},
  };

  it('renders nothing when no participants are joined', () => {
    const emptyEvent: SportEvent = {
      ...baseEvent,
      participants: [{ userId: 'u4', name: 'David Čekač', status: 'waitlist', hasPaid: false }],
    };
    const { container } = render(
      <EventAwardsSection event={emptyEvent} allUsers={mockUsers} onUpdate={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders the 3 award summary cards in default view', () => {
    const eventWithAwards: SportEvent = {
      ...baseEvent,
      eventAwards: {
        mvpUserId: 'u1',
        fairPlayUserId: 'u2',
        ironmanUserId: 'u3',
      },
    };

    render(
      <EventAwardsSection event={eventWithAwards} allUsers={mockUsers} onUpdate={vi.fn()} />
    );

    expect(screen.getByText('Ocenění večera & Hvězdy zápasu')).toBeInTheDocument();
    expect(screen.getByTestId('award-display-mvp')).toHaveTextContent('Adam Smečař');
    expect(screen.getByTestId('award-display-fairplay')).toHaveTextContent('Bára Nahrávačka');
    expect(screen.getByTestId('award-display-ironman')).toHaveTextContent('Cyril Blokař');
  });

  it('shows "Nezvoleno" when awards are not yet assigned', () => {
    render(
      <EventAwardsSection event={baseEvent} allUsers={mockUsers} onUpdate={vi.fn()} />
    );

    expect(screen.getByTestId('award-display-mvp')).toHaveTextContent('Nezvoleno');
    expect(screen.getByTestId('award-display-fairplay')).toHaveTextContent('Nezvoleno');
    expect(screen.getByTestId('award-display-ironman')).toHaveTextContent('Nezvoleno');
  });

  it('opens editor drawer with all 3 selectors when "Upravit ocenění" is clicked', async () => {
    const user = userEvent.setup();
    render(
      <EventAwardsSection event={baseEvent} allUsers={mockUsers} onUpdate={vi.fn()} />
    );

    expect(screen.queryByTestId('awards-editor')).not.toBeInTheDocument();

    const editBtn = screen.getByRole('button', { name: 'Upravit ocenění' });
    await user.click(editBtn);

    expect(screen.getByTestId('awards-editor')).toBeInTheDocument();
    expect(screen.getByTestId('award-select-mvp')).toBeInTheDocument();
    expect(screen.getByTestId('award-select-fairplay')).toBeInTheDocument();
    expect(screen.getByTestId('award-select-ironman')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hotovo' })).toBeInTheDocument();
  });

  it('calls onUpdate with mvpUserId when MVP selector value changes', async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    render(
      <EventAwardsSection event={baseEvent} allUsers={mockUsers} onUpdate={onUpdate} />
    );

    await user.click(screen.getByRole('button', { name: 'Upravit ocenění' }));

    const mvpSelect = screen.getByTestId('award-select-mvp');
    await user.selectOptions(mvpSelect, 'u1');

    expect(onUpdate).toHaveBeenCalledWith({
      ...baseEvent,
      eventAwards: {
        mvpUserId: 'u1',
      },
    });
  });

  it('calls onUpdate with fairPlayUserId when Fair-Play selector value changes', async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    render(
      <EventAwardsSection event={baseEvent} allUsers={mockUsers} onUpdate={onUpdate} />
    );

    await user.click(screen.getByRole('button', { name: 'Upravit ocenění' }));

    const fairPlaySelect = screen.getByTestId('award-select-fairplay');
    await user.selectOptions(fairPlaySelect, 'u2');

    expect(onUpdate).toHaveBeenCalledWith({
      ...baseEvent,
      eventAwards: {
        fairPlayUserId: 'u2',
      },
    });
  });

  it('calls onUpdate with ironmanUserId when Bojovník večera selector value changes', async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    render(
      <EventAwardsSection event={baseEvent} allUsers={mockUsers} onUpdate={onUpdate} />
    );

    await user.click(screen.getByRole('button', { name: 'Upravit ocenění' }));

    const ironmanSelect = screen.getByTestId('award-select-ironman');
    await user.selectOptions(ironmanSelect, 'u3');

    expect(onUpdate).toHaveBeenCalledWith({
      ...baseEvent,
      eventAwards: {
        ironmanUserId: 'u3',
      },
    });
  });

  it('clears award when selecting the empty option', async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    const eventWithMVP: SportEvent = {
      ...baseEvent,
      eventAwards: {
        mvpUserId: 'u1',
      },
    };

    render(
      <EventAwardsSection event={eventWithMVP} allUsers={mockUsers} onUpdate={onUpdate} />
    );

    await user.click(screen.getByRole('button', { name: 'Upravit ocenění' }));

    const mvpSelect = screen.getByTestId('award-select-mvp');
    await user.selectOptions(mvpSelect, '');

    expect(onUpdate).toHaveBeenCalledWith({
      ...eventWithMVP,
      eventAwards: {
        mvpUserId: undefined,
      },
    });
  });
});
