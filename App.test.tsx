import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach } from 'vitest';
import App from './App';

describe('App Integration', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('shows login screen initially', () => {
    render(<App />);
    expect(screen.getByText('Vítejte ve Volejbalu')).toBeInTheDocument();
    expect(screen.getByText('Nový hráč')).toBeInTheDocument();
  });

  it('allows creating a user and logging in', async () => {
    render(<App />);
    const user = userEvent.setup();

    const input = screen.getByPlaceholderText('Vaše jméno...');
    await user.type(input, 'Honza');
    
    const createBtn = screen.getByText('Vytvořit');
    await user.click(createBtn);

    expect(await screen.findByText('Ahoj, Honza')).toBeInTheDocument();
    expect(screen.getByText('Volejbal Plánovač')).toBeInTheDocument();
  });

  it('allows creating an event and seeing it in the list', async () => {
    // 1. Setup User
    localStorage.setItem('volleyball_users_db_v1', JSON.stringify([{ id: 'u1', name: 'Petr' }]));
    
    render(<App />);
    
    // 2. Login
    const userBtn = await screen.findByText('Petr');
    fireEvent.click(userBtn);

    // 3. Open Modal
    const addBtn = screen.getByText('Přidat', { selector: 'button' });
    fireEvent.click(addBtn);
    
    expect(screen.getByText('Přidat událost')).toBeInTheDocument();

    // 4. Fill Form
    // Note: We need to use fireEvent for simple value changes or userEvent for interactions
    // Since inputs have specific logic, userEvent is safer but slower. fireEvent is fine for integration here.
    fireEvent.change(screen.getByLabelText('Název'), { target: { value: 'Super Zápas' } });
    fireEvent.change(screen.getByLabelText('Cena (Kč)'), { target: { value: '2000' } });
    
    // 5. Submit
    const submitBtn = screen.getByText('Vytvořit událost');
    fireEvent.click(submitBtn);

    // 6. Verify Result
    expect(await screen.findByText('Super Zápas')).toBeInTheDocument();
    // Verify it auto-selected the event (detail view visible)
    expect(screen.getByText('Celkem: 2000 Kč')).toBeInTheDocument();
  });

  it('shows debt banner when user is in debt', async () => {
    // 1. Setup Data: User + Event + Attendance (Joined but Unpaid)
    const today = new Date();
    const pastDate = new Date();
    pastDate.setDate(today.getDate() - 10); // 10 days ago

    localStorage.setItem('volleyball_users_db_v1', JSON.stringify([{ id: 'u1', name: 'Dluh' }]));
    localStorage.setItem('volleyball_events_db_v1', JSON.stringify([{
      id: 'e1',
      title: 'Stará akce',
      date: pastDate.toISOString().split('T')[0],
      time: '10:00',
      location: 'Hala',
      totalCost: 1000,
      accountNumber: '123/0100',
      participants: [] // Storage format
    }]));
    // Attendance
    localStorage.setItem('volleyball_attendance_db_v1', JSON.stringify([{
      eventId: 'e1', userId: 'u1', status: 'joined', hasPaid: false, timestamp: 123
    }]));

    render(<App />);
    
    // Login
    fireEvent.click(await screen.findByText('Dluh'));

    // Verify Banner
    expect(await screen.findByText(/Máte 1 nezaplacené události/i)).toBeInTheDocument();
    expect(screen.getByText('Celkem k úhradě:')).toBeInTheDocument();
  });
});