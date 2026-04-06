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
});
