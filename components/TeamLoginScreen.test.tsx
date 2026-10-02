import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TeamLoginScreen } from './TeamLoginScreen';
import * as storage from '../services/storage';
import { Team } from '../types';

vi.mock('../services/storage', () => ({
  getTeams: vi.fn(),
  loginTeam: vi.fn(),
  createTeam: vi.fn(),
}));

describe('TeamLoginScreen', () => {
  const mockOnLoginTeam = vi.fn();
  const mockTeams: Team[] = [
    { id: 'team-1', name: 'nahravame-si', createdAt: '2026-01-01' },
    { id: 'team-2', name: 'Volejbal Brno', createdAt: '2026-01-02' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(storage.getTeams).mockResolvedValue(mockTeams);
  });

  it('renders team selection with default team preselected', async () => {
    render(<TeamLoginScreen onLoginTeam={mockOnLoginTeam} />);

    await waitFor(() => {
      expect(screen.getByText('Sport Plánovač')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Vstoupit do týmu/i })).toBeInTheDocument();
      expect(screen.getByText(/nahravame-si/)).toBeInTheDocument();
    });
  });

  it('logs into team with password', async () => {
    const user = userEvent.setup();
    const mockAuthResponse = {
      accessToken: 'acc-123',
      refreshToken: 'ref-123',
      team: mockTeams[0],
    };
    vi.mocked(storage.loginTeam).mockResolvedValue(mockAuthResponse);

    render(<TeamLoginScreen onLoginTeam={mockOnLoginTeam} />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Zadejte heslo...')).toBeInTheDocument();
    });

    const passwordInput = screen.getByPlaceholderText('Zadejte heslo...');
    await user.type(passwordInput, '1234');

    const submitBtn = screen.getByRole('button', { name: /Vstoupit do týmu/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(storage.loginTeam).toHaveBeenCalledWith('team-1', '1234');
      expect(mockOnLoginTeam).toHaveBeenCalledWith(mockTeams[0], 'acc-123', 'ref-123');
    });
  });

  it('displays error message when login fails', async () => {
    const user = userEvent.setup();
    vi.mocked(storage.loginTeam).mockRejectedValue(new Error('Nesprávné heslo týmu.'));

    render(<TeamLoginScreen onLoginTeam={mockOnLoginTeam} />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Zadejte heslo...')).toBeInTheDocument();
    });

    const passwordInput = screen.getByPlaceholderText('Zadejte heslo...');
    await user.type(passwordInput, 'wrongpass');

    const submitBtn = screen.getByRole('button', { name: /Vstoupit do týmu/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Nesprávné heslo týmu.')).toBeInTheDocument();
    });
    expect(mockOnLoginTeam).not.toHaveBeenCalled();
  });

  it('allows creating a new team', async () => {
    const user = userEvent.setup();
    const newTeam: Team = { id: 'team-new', name: 'Tenisti', createdAt: '2026-03-01' };
    const mockCreateResponse = {
      accessToken: 'acc-new',
      refreshToken: 'ref-new',
      team: newTeam,
    };
    vi.mocked(storage.createTeam).mockResolvedValue(mockCreateResponse);

    render(<TeamLoginScreen onLoginTeam={mockOnLoginTeam} />);

    await waitFor(() => {
      expect(screen.getByText('Nový tým')).toBeInTheDocument();
    });

    // Switch to create team tab
    await user.click(screen.getByText('Nový tým'));

    const nameInput = screen.getByPlaceholderText(/např. Volejbal Brno/i);
    const passInput = screen.getByPlaceholderText(/Minimálně 3 znaky/i);
    const confirmInput = screen.getByPlaceholderText(/Zadejte heslo znovu/i);

    await user.type(nameInput, 'Tenisti');
    await user.type(passInput, 'tenis123');
    await user.type(confirmInput, 'tenis123');

    const createBtn = screen.getByRole('button', { name: /Vytvořit a vstoupit/i });
    await user.click(createBtn);

    await waitFor(() => {
      expect(storage.createTeam).toHaveBeenCalledWith('Tenisti', 'tenis123');
      expect(mockOnLoginTeam).toHaveBeenCalledWith(newTeam, 'acc-new', 'ref-new');
    });
  });

  it('validates password match when creating new team', async () => {
    const user = userEvent.setup();

    render(<TeamLoginScreen onLoginTeam={mockOnLoginTeam} />);

    await waitFor(() => {
      expect(screen.getByText('Nový tým')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Nový tým'));

    const nameInput = screen.getByPlaceholderText(/např. Volejbal Brno/i);
    const passInput = screen.getByPlaceholderText(/Minimálně 3 znaky/i);
    const confirmInput = screen.getByPlaceholderText(/Zadejte heslo znovu/i);

    await user.type(nameInput, 'Tenisti');
    await user.type(passInput, 'pass1');
    await user.type(confirmInput, 'pass2');

    const createBtn = screen.getByRole('button', { name: /Vytvořit a vstoupit/i });
    await user.click(createBtn);

    await waitFor(() => {
      expect(screen.getByText('Zadaná hesla se neshodují.')).toBeInTheDocument();
    });
    expect(storage.createTeam).not.toHaveBeenCalled();
  });

  it('validates empty name and short password when creating new team', async () => {
    const user = userEvent.setup();

    render(<TeamLoginScreen onLoginTeam={mockOnLoginTeam} />);
    await user.click(screen.getByText('Nový tým'));

    const createBtn = screen.getByRole('button', { name: /Vytvořit a vstoupit/i });
    await user.click(createBtn);

    expect(screen.getByText('Zadejte název nového týmu.')).toBeInTheDocument();

    const nameInput = screen.getByPlaceholderText(/např. Volejbal Brno/i);
    await user.type(nameInput, 'Nový Tým');
    await user.click(createBtn);

    expect(screen.getByText('Heslo musí mít alespoň 3 znaky.')).toBeInTheDocument();
  });

  it('toggles password visibility', async () => {
    const user = userEvent.setup();
    render(<TeamLoginScreen onLoginTeam={mockOnLoginTeam} />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Zadejte heslo...')).toBeInTheDocument();
    });

    const passwordInput = screen.getByPlaceholderText('Zadejte heslo...');
    expect(passwordInput).toHaveAttribute('type', 'password');

    // Find the toggle button inside the password container
    const toggleBtn = passwordInput.parentElement?.querySelector('button');
    expect(toggleBtn).toBeTruthy();

    await user.click(toggleBtn!);
    expect(passwordInput).toHaveAttribute('type', 'text');

    await user.click(toggleBtn!);
    expect(passwordInput).toHaveAttribute('type', 'password');
  });
});
