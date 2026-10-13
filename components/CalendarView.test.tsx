import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CalendarView } from './CalendarView';
import { SportEvent } from '../types';

const mockEvents: SportEvent[] = [
  {
    id: 'e1',
    title: 'Pondělní volejbal',
    date: '2026-10-12',
    time: '18:00',
    location: 'Hala',
    totalCost: 1000,
    accountNumber: '123/0100',
    participants: [],
  },
];

describe('CalendarView Component', () => {
  const currentDate = new Date('2026-10-15T10:00:00Z');

  it('renders month view by default with day names and month title', () => {
    render(
      <CalendarView
        currentDate={currentDate}
        selectedDate={null}
        onDateChange={vi.fn()}
        onMonthChange={vi.fn()}
        events={mockEvents}
      />
    );

    expect(screen.getByTestId('calendar-view')).toBeInTheDocument();
    expect(screen.getByTestId('calendar-title')).toHaveTextContent(/říjn.*2026/i);
    expect(screen.getByText('Po')).toBeInTheDocument();
    expect(screen.getByText('Ne')).toBeInTheDocument();
    
    // In month mode for October 2026, there are 35 buttons (5 weeks x 7 days)
    const gridButtons = screen.getByTestId('calendar-grid').querySelectorAll('button');
    expect(gridButtons.length).toBeGreaterThan(28);
  });

  it('switches to week mode when week button is clicked', () => {
    render(
      <CalendarView
        currentDate={currentDate}
        selectedDate={null}
        onDateChange={vi.fn()}
        onMonthChange={vi.fn()}
        events={mockEvents}
      />
    );

    const weekBtn = screen.getByTestId('calendar-mode-week');
    fireEvent.click(weekBtn);

    // In week mode, exactly 7 day buttons are rendered
    const gridButtons = screen.getByTestId('calendar-grid').querySelectorAll('button');
    expect(gridButtons.length).toBe(7);
  });

  it('switches back to month mode when month button is clicked', () => {
    render(
      <CalendarView
        currentDate={currentDate}
        selectedDate={null}
        onDateChange={vi.fn()}
        onMonthChange={vi.fn()}
        events={mockEvents}
        initialMode="week"
      />
    );

    let gridButtons = screen.getByTestId('calendar-grid').querySelectorAll('button');
    expect(gridButtons.length).toBe(7);

    fireEvent.click(screen.getByTestId('calendar-mode-month'));
    gridButtons = screen.getByTestId('calendar-grid').querySelectorAll('button');
    expect(gridButtons.length).toBeGreaterThan(28);
  });

  it('calls onMonthChange with next/prev month in month mode', () => {
    const onMonthChange = vi.fn();
    render(
      <CalendarView
        currentDate={currentDate}
        selectedDate={null}
        onDateChange={vi.fn()}
        onMonthChange={onMonthChange}
        events={mockEvents}
        initialMode="month"
      />
    );

    fireEvent.click(screen.getByTestId('calendar-next-btn'));
    expect(onMonthChange).toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('calendar-prev-btn'));
    expect(onMonthChange).toHaveBeenCalledTimes(2);
  });

  it('calls onMonthChange with next/prev week in week mode', () => {
    const onMonthChange = vi.fn();
    render(
      <CalendarView
        currentDate={currentDate}
        selectedDate={null}
        onDateChange={vi.fn()}
        onMonthChange={onMonthChange}
        events={mockEvents}
        initialMode="week"
      />
    );

    fireEvent.click(screen.getByTestId('calendar-next-btn'));
    expect(onMonthChange).toHaveBeenCalled();
  });

  it('calls onDateChange when a day is clicked', () => {
    const onDateChange = vi.fn();
    render(
      <CalendarView
        currentDate={currentDate}
        selectedDate={null}
        onDateChange={onDateChange}
        onMonthChange={vi.fn()}
        events={mockEvents}
      />
    );

    const dayButtons = screen.getByTestId('calendar-grid').querySelectorAll('button');
    fireEvent.click(dayButtons[10]);
    expect(onDateChange).toHaveBeenCalled();
  });
});
