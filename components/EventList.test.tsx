import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EventList } from './EventList';
import { VolleyballEvent } from '../types';

const makeEvent = (id: string, title: string): VolleyballEvent => ({
  id,
  title,
  date: '2026-03-30',
  time: '18:00',
  location: 'Hall',
  totalCost: 1000,
  accountNumber: '',
  participants: [
    { userId: 'u1', name: 'A', status: 'joined', hasPaid: false },
  ],
});

describe('EventList', () => {
  const baseProps = {
    selectedEventId: null,
    selectedDate: null as Date | null,
    onSelectEvent: vi.fn(),
    onDeleteEvent: vi.fn(),
    onShowUpcoming: vi.fn(),
    onCreateEvent: vi.fn(),
  };

  it('shows "Nadcházející" header when selectedDate is null', () => {
    render(<EventList {...baseProps} events={[]} />);
    expect(screen.getByText('Nadcházející')).toBeInTheDocument();
  });

  it('shows formatted date header when selectedDate is set', () => {
    render(
      <EventList {...baseProps} events={[]} selectedDate={new Date('2026-03-30')} />
    );
    // Czech locale: 30. března
    expect(screen.getByText(/30\. března/)).toBeInTheDocument();
  });

  it('shows empty state message for upcoming mode', () => {
    render(<EventList {...baseProps} events={[]} />);
    expect(screen.getByText('Žádné nadcházející události.')).toBeInTheDocument();
  });

  it('shows empty state message for date mode', () => {
    render(
      <EventList {...baseProps} events={[]} selectedDate={new Date('2026-03-30')} />
    );
    expect(screen.getByText('Žádné události pro tento den.')).toBeInTheDocument();
  });

  it('shows "Vytvořit novou" button in empty state', async () => {
    const onCreateEvent = vi.fn();
    const user = userEvent.setup();
    render(<EventList {...baseProps} events={[]} onCreateEvent={onCreateEvent} />);
    await user.click(screen.getByText('Vytvořit novou'));
    expect(onCreateEvent).toHaveBeenCalled();
  });

  it('renders event cards for given events', () => {
    const events = [makeEvent('e1', 'Game 1'), makeEvent('e2', 'Game 2')];
    render(<EventList {...baseProps} events={events} />);
    expect(screen.getByText('Game 1')).toBeInTheDocument();
    expect(screen.getByText('Game 2')).toBeInTheDocument();
  });

  it('shows "Přidat" button when showAddButton is true (default)', () => {
    render(<EventList {...baseProps} events={[]} />);
    expect(screen.getByText('Přidat')).toBeInTheDocument();
  });

  it('hides "Přidat" button when showAddButton is false', () => {
    render(<EventList {...baseProps} events={[]} showAddButton={false} />);
    expect(screen.queryByText('Přidat')).not.toBeInTheDocument();
  });

  it('shows back-to-upcoming button when date is selected', async () => {
    const onShowUpcoming = vi.fn();
    const user = userEvent.setup();
    render(
      <EventList
        {...baseProps}
        events={[]}
        selectedDate={new Date('2026-03-30')}
        onShowUpcoming={onShowUpcoming}
      />
    );
    await user.click(screen.getByText('Zobrazit nadcházející'));
    expect(onShowUpcoming).toHaveBeenCalled();
  });

  it('does not show back-to-upcoming button in upcoming mode', () => {
    render(<EventList {...baseProps} events={[]} />);
    expect(screen.queryByText('Zobrazit nadcházející')).not.toBeInTheDocument();
  });
});

