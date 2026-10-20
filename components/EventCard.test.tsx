import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EventCard } from './EventCard';
import { SportEvent } from '../types';

const mockEvent: SportEvent = {
  id: 'evt-1',
  title: 'Volejbal Pondělí',
  date: '2026-03-30',
  time: '18:00',
  location: 'Sportovní hala',
  totalCost: 1000,
  accountNumber: '123/0100',
  sportType: 'volejbal',
  participants: [
    { userId: 'u1', name: 'Alice', status: 'joined', hasPaid: false },
    { userId: 'u2', name: 'Bob', status: 'joined', hasPaid: true },
    { userId: 'u3', name: 'Carl', status: 'declined', hasPaid: false },
  ],
};

describe('EventCard', () => {
  it('renders event title, location, and time', () => {
    render(
      <EventCard event={mockEvent} isSelected={false} onSelect={vi.fn()} onDelete={vi.fn()} />
    );
    expect(screen.getByText('Volejbal Pondělí')).toBeInTheDocument();
    expect(screen.getByText('Sportovní hala')).toBeInTheDocument();
    expect(screen.getByText('18:00')).toBeInTheDocument();
  });

  it('shows joined participant count (not declined)', () => {
    render(
      <EventCard event={mockEvent} isSelected={false} onSelect={vi.fn()} onDelete={vi.fn()} />
    );
    // 2 joined (Alice, Bob), Carl is declined
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('applies selected styles when isSelected is true', () => {
    render(
      <EventCard event={mockEvent} isSelected={true} onSelect={vi.fn()} onDelete={vi.fn()} />
    );
    const card = screen.getByTestId('event-card-evt-1');
    expect(card.className).toContain('bg-blue-50');
    expect(card.className).toContain('ring-1');
  });

  it('does not apply selected styles when isSelected is false', () => {
    render(
      <EventCard event={mockEvent} isSelected={false} onSelect={vi.fn()} onDelete={vi.fn()} />
    );
    const card = screen.getByTestId('event-card-evt-1');
    expect(card.className).not.toContain('bg-blue-50');
  });

  it('calls onSelect with event id when card is clicked', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(
      <EventCard event={mockEvent} isSelected={false} onSelect={onSelect} onDelete={vi.fn()} />
    );
    await user.click(screen.getByTestId('event-card-evt-1'));
    expect(onSelect).toHaveBeenCalledWith('evt-1');
  });

  it('calls onDelete with event id when delete button is clicked', async () => {
    const onDelete = vi.fn();
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(
      <EventCard event={mockEvent} isSelected={false} onSelect={onSelect} onDelete={onDelete} />
    );
    await user.click(screen.getByTitle('Smazat událost'));
    expect(onDelete).toHaveBeenCalledWith('evt-1');
    // Should NOT call onSelect (stopPropagation)
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('shows chevron instead of delete when showChevron is true', () => {
    render(
      <EventCard event={mockEvent} isSelected={false} onSelect={vi.fn()} onDelete={vi.fn()} showChevron />
    );
    expect(screen.queryByTitle('Smazat událost')).not.toBeInTheDocument();
    // Chevron icon should be rendered
    const chevron = document.querySelector('.lucide-chevron-right');
    expect(chevron).toBeInTheDocument();
  });

  it('shows delete button when showChevron is false (default)', () => {
    render(
      <EventCard event={mockEvent} isSelected={false} onSelect={vi.fn()} onDelete={vi.fn()} />
    );
    expect(screen.getByTitle('Smazat událost')).toBeInTheDocument();
  });

  it('shows sport emoji for volejbal', () => {
    render(
      <EventCard event={mockEvent} isSelected={false} onSelect={vi.fn()} onDelete={vi.fn()} />
    );
    expect(screen.getByTestId('sport-emoji')).toHaveTextContent('🏐');
  });

  it('shows sport emoji for tenis', () => {
    const tenisEvent: SportEvent = { ...mockEvent, sportType: 'tenis' };
    render(
      <EventCard event={tenisEvent} isSelected={false} onSelect={vi.fn()} onDelete={vi.fn()} />
    );
    expect(screen.getByTestId('sport-emoji')).toHaveTextContent('🎾');
  });

  it('defaults to volejbal emoji when sportType is undefined', () => {
    const noTypeEvent: SportEvent = { ...mockEvent, sportType: undefined };
    render(
      <EventCard event={noTypeEvent} isSelected={false} onSelect={vi.fn()} onDelete={vi.fn()} />
    );
    expect(screen.getByTestId('sport-emoji')).toHaveTextContent('🏐');
  });

  describe('Mobile ergonomics & capacity pill', () => {
    it('applies comfortable touch target minimum height classes', () => {
      render(
        <EventCard event={mockEvent} isSelected={false} onSelect={vi.fn()} onDelete={vi.fn()} />
      );
      const card = screen.getByTestId('event-card-evt-1');
      expect(card.className).toContain('min-h-[72px]');
      expect(card.className).toContain('sm:min-h-[80px]');
    });

    it('displays spots remaining with green styling when capacity is plentiful', () => {
      // 2 joined out of 12 (default volejbal) => 10 spots remaining
      render(
        <EventCard event={mockEvent} isSelected={false} onSelect={vi.fn()} onDelete={vi.fn()} />
      );
      const pill = screen.getByTestId('capacity-pill');
      expect(pill).toHaveTextContent('10 volných míst');
      expect(pill.className).toContain('bg-emerald-50');
      expect(pill.className).toContain('text-emerald-700');
    });

    it('displays warning style when remaining spots are 2 or fewer', () => {
      // tenis: max 4 players. 2 joined => 2 spots remaining
      const tenisEvent: SportEvent = {
        ...mockEvent,
        sportType: 'tenis',
        participants: [
          { userId: 'u1', name: 'Alice', status: 'joined', hasPaid: true },
          { userId: 'u2', name: 'Bob', status: 'joined', hasPaid: true },
        ],
      };
      render(
        <EventCard event={tenisEvent} isSelected={false} onSelect={vi.fn()} onDelete={vi.fn()} />
      );
      const pill = screen.getByTestId('capacity-pill');
      expect(pill).toHaveTextContent('2 volná místa');
      expect(pill.className).toContain('bg-amber-50');
      expect(pill.className).toContain('text-amber-700');
    });

    it('displays 1 volné místo when only 1 spot remains', () => {
      // tenis: max 4. 3 joined => 1 spot remaining
      const tenisEvent: SportEvent = {
        ...mockEvent,
        sportType: 'tenis',
        participants: [
          { userId: 'u1', name: 'Alice', status: 'joined', hasPaid: true },
          { userId: 'u2', name: 'Bob', status: 'joined', hasPaid: true },
          { userId: 'u3', name: 'Carl', status: 'joined', hasPaid: true },
        ],
      };
      render(
        <EventCard event={tenisEvent} isSelected={false} onSelect={vi.fn()} onDelete={vi.fn()} />
      );
      const pill = screen.getByTestId('capacity-pill');
      expect(pill).toHaveTextContent('1 volné místo');
      expect(pill.className).toContain('bg-amber-50');
    });

    it('displays Plno with red styling when event is at or over capacity', () => {
      // tenis: max 4. 4 joined => full
      const fullEvent: SportEvent = {
        ...mockEvent,
        sportType: 'tenis',
        participants: [
          { userId: 'u1', name: 'Alice', status: 'joined', hasPaid: true },
          { userId: 'u2', name: 'Bob', status: 'joined', hasPaid: true },
          { userId: 'u3', name: 'Carl', status: 'joined', hasPaid: true },
          { userId: 'u4', name: 'Dana', status: 'joined', hasPaid: true },
        ],
      };
      render(
        <EventCard event={fullEvent} isSelected={false} onSelect={vi.fn()} onDelete={vi.fn()} />
      );
      const pill = screen.getByTestId('capacity-pill');
      expect(pill).toHaveTextContent('Plno');
      expect(pill.className).toContain('bg-red-50');
      expect(pill.className).toContain('text-red-700');
    });
  });

  describe('Cost display', () => {
    it('displays calculated cost per person when participants are joined', () => {
      // totalCost 1000, 2 joined => 500 Kč / os.
      render(
        <EventCard event={mockEvent} isSelected={false} onSelect={vi.fn()} onDelete={vi.fn()} />
      );
      const costBadge = screen.getByTestId('cost-display');
      expect(costBadge).toHaveTextContent('500 Kč / os.');
    });

    it('displays total cost when no participants have joined yet', () => {
      const emptyEvent: SportEvent = {
        ...mockEvent,
        totalCost: 1200,
        participants: [],
      };
      render(
        <EventCard event={emptyEvent} isSelected={false} onSelect={vi.fn()} onDelete={vi.fn()} />
      );
      const costBadge = screen.getByTestId('cost-display');
      expect(costBadge).toHaveTextContent('1200 Kč');
    });

    it('displays 0 Kč when total cost is 0', () => {
      const freeEvent: SportEvent = {
        ...mockEvent,
        totalCost: 0,
        participants: [{ userId: 'u1', name: 'Alice', status: 'joined', hasPaid: false }],
      };
      render(
        <EventCard event={freeEvent} isSelected={false} onSelect={vi.fn()} onDelete={vi.fn()} />
      );
      const costBadge = screen.getByTestId('cost-display');
      expect(costBadge).toHaveTextContent('0 Kč');
    });
  });
});
