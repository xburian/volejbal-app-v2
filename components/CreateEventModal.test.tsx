import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreateEventModal } from './CreateEventModal';
import { SportConfig, SportEvent } from '../types';

const defaultConfigs: SportConfig[] = [
  { type: 'volejbal', label: 'Volejbal', maxPlayers: 12, defaultCost: 1000, defaultLocation: 'Hala', teamSize: null },
  { type: 'tenis', label: 'Tenis', maxPlayers: 4, defaultCost: 500, defaultLocation: 'Kurt', teamSize: 2 },
];

const renderModal = (onCreateSpy = vi.fn()) => {
  return render(
    <CreateEventModal
      selectedDate={new Date('2026-05-13')}
      onClose={vi.fn()}
      onCreate={onCreateSpy}
      sportConfigs={defaultConfigs}
      bankAccounts={[]}
    />
  );
};

describe('CreateEventModal — Recurrence', () => {
  it('renders recurrence toggle', () => {
    renderModal();
    expect(screen.getByTestId('recurrence-section')).toBeInTheDocument();
    expect(screen.getByTestId('recurrence-toggle')).toBeInTheDocument();
    expect(screen.getByText('Opakovat událost')).toBeInTheDocument();
  });

  it('does not show recurrence options when toggle is off', () => {
    renderModal();
    expect(screen.queryByTestId('recurrence-options')).not.toBeInTheDocument();
  });

  it('shows frequency and count controls when toggle is enabled', async () => {
    renderModal();
    const toggle = screen.getByTestId('recurrence-toggle');
    await userEvent.click(toggle);

    expect(screen.getByTestId('recurrence-options')).toBeInTheDocument();
    expect(screen.getByTestId('recurrence-frequency')).toBeInTheDocument();
    expect(screen.getByTestId('recurrence-count')).toBeInTheDocument();
  });

  it('submits single event when recurrence is disabled', async () => {
    const onCreateSpy = vi.fn();
    renderModal(onCreateSpy);

    // Submit without enabling recurrence
    const submitBtn = screen.getByRole('button', { name: /vytvořit událost/i });
    fireEvent.click(submitBtn);

    expect(onCreateSpy).toHaveBeenCalledTimes(1);
    const arg = onCreateSpy.mock.calls[0][0];
    // Should be a single event (not an array)
    expect(arg).not.toBeInstanceOf(Array);
    expect(arg).toHaveProperty('id');
    expect(arg).toHaveProperty('date', '2026-05-13');
  });

  it('submits array of events with correct dates when recurrence is enabled (weekly, default count=4)', async () => {
    const onCreateSpy = vi.fn();
    renderModal(onCreateSpy);

    // Enable recurrence (default count is 4, frequency weekly)
    await userEvent.click(screen.getByTestId('recurrence-toggle'));

    // Submit with default count=4
    const submitBtn = screen.getByRole('button', { name: /vytvořit 4/i });
    fireEvent.click(submitBtn);

    expect(onCreateSpy).toHaveBeenCalledTimes(1);
    const arg = onCreateSpy.mock.calls[0][0];
    expect(Array.isArray(arg)).toBe(true);
    expect(arg).toHaveLength(4);
    expect(arg[0].date).toBe('2026-05-13');
    expect(arg[1].date).toBe('2026-05-20');
    expect(arg[2].date).toBe('2026-05-27');
    expect(arg[3].date).toBe('2026-06-03');
  });

  it('each event in batch has a unique ID', async () => {
    const onCreateSpy = vi.fn();
    renderModal(onCreateSpy);

    await userEvent.click(screen.getByTestId('recurrence-toggle'));

    // Default count is 4
    const submitBtn = screen.getByRole('button', { name: /vytvořit 4/i });
    fireEvent.click(submitBtn);

    const events: SportEvent[] = onCreateSpy.mock.calls[0][0];
    const ids = events.map(e => e.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(4);
  });

  it('submits biweekly events when frequency is changed', async () => {
    const onCreateSpy = vi.fn();
    renderModal(onCreateSpy);

    await userEvent.click(screen.getByTestId('recurrence-toggle'));

    // Change frequency to biweekly
    const freqSelect = screen.getByTestId('recurrence-frequency');
    await userEvent.selectOptions(freqSelect, 'biweekly');

    // Default count is 4
    const submitBtn = screen.getByRole('button', { name: /vytvořit 4/i });
    fireEvent.click(submitBtn);

    const events: SportEvent[] = onCreateSpy.mock.calls[0][0];
    expect(events[0].date).toBe('2026-05-13');
    expect(events[1].date).toBe('2026-05-27');
    expect(events[2].date).toBe('2026-06-10');
    expect(events[3].date).toBe('2026-06-24');
  });

  it('clamps count input to max 26', async () => {
    renderModal();
    await userEvent.click(screen.getByTestId('recurrence-toggle'));

    const countInput = screen.getByTestId('recurrence-count') as HTMLInputElement;
    await userEvent.clear(countInput);
    await userEvent.type(countInput, '50');

    // After typing "5", value → 5; after typing "0" (making "50"), clamped to 26
    expect(Number(countInput.value)).toBeLessThanOrEqual(26);
  });

  it('clamps count input to min 2', async () => {
    renderModal();
    await userEvent.click(screen.getByTestId('recurrence-toggle'));

    const countInput = screen.getByTestId('recurrence-count') as HTMLInputElement;
    await userEvent.clear(countInput);
    await userEvent.type(countInput, '1');

    // Clamped to minimum 2
    expect(Number(countInput.value)).toBeGreaterThanOrEqual(2);
  });

  it('all recurring events share the same title, time, location, and sport type', async () => {
    const onCreateSpy = vi.fn();
    renderModal(onCreateSpy);

    await userEvent.click(screen.getByTestId('recurrence-toggle'));

    // Default count 4
    const submitBtn = screen.getByRole('button', { name: /vytvořit 4/i });
    fireEvent.click(submitBtn);

    const events: SportEvent[] = onCreateSpy.mock.calls[0][0];
    for (const event of events) {
      expect(event.title).toBe('Volejbal');
      expect(event.time).toBe('18:00');
      expect(event.location).toBe('Hala');
      expect(event.sportType).toBe('volejbal');
      expect(event.totalCost).toBe(1000);
    }
  });
});

