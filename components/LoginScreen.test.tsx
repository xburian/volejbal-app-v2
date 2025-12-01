import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginScreen } from './LoginScreen';
import * as storage from '../services/storage';
import { User } from '../types';

// Mock storage module
vi.mock('../services/storage', () => ({
  getUsers: vi.fn(),
  createUser: vi.fn(),
  deleteUser: vi.fn(),
}));

describe('LoginScreen - Photo Upload Feature', () => {
  const mockOnLogin = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(storage.getUsers).mockResolvedValue([]);
  });

  it('displays photo upload area in create user form', async () => {
    render(<LoginScreen onLogin={mockOnLogin} />);

    await waitFor(() => {
      expect(screen.getByText('Vítejte ve Volejbalu')).toBeInTheDocument();
    });

    expect(screen.getByText(/Přidat/)).toBeInTheDocument();
    expect(screen.getByText(/foto/)).toBeInTheDocument();
    expect(screen.getByText('Volitelné')).toBeInTheDocument();
  });

  it('creates user without photo', async () => {
    const mockUser: User = { id: '1', name: 'Test User' };
    vi.mocked(storage.createUser).mockResolvedValue(mockUser);

    const user = userEvent.setup();
    render(<LoginScreen onLogin={mockOnLogin} />);

    await waitFor(() => {
      expect(screen.getByText('Vítejte ve Volejbalu')).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText('Vaše jméno...');
    await user.type(input, 'Test User');

    const createBtn = screen.getByText('Vytvořit');
    await user.click(createBtn);

    await waitFor(() => {
      expect(storage.createUser).toHaveBeenCalledWith('Test User', undefined);
      expect(mockOnLogin).toHaveBeenCalledWith(mockUser);
    });
  });

  it('displays users with photos correctly', async () => {
    const usersWithPhotos: User[] = [
      { id: '1', name: 'User With Photo', photoUrl: 'data:image/png;base64,test' },
      { id: '2', name: 'User Without Photo' },
    ];
    vi.mocked(storage.getUsers).mockResolvedValue(usersWithPhotos);

    render(<LoginScreen onLogin={mockOnLogin} />);

    await waitFor(() => {
      expect(screen.getByText('User With Photo')).toBeInTheDocument();
      expect(screen.getByText('User Without Photo')).toBeInTheDocument();
    });

    // User with photo should have img element
    const imgElements = screen.getAllByRole('img');
    expect(imgElements.some(img => img.getAttribute('alt') === 'User With Photo')).toBe(true);

    // User without photo should display initial
    expect(screen.getByText('U')).toBeInTheDocument(); // First letter of "User Without Photo"
  });

  it('shows file size validation error', async () => {
    render(<LoginScreen onLogin={mockOnLogin} />);

    await waitFor(() => {
      expect(screen.getByText('Vítejte ve Volejbalu')).toBeInTheDocument();
    });

    // Find the file input
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeTruthy();

    // Create a file larger than 2MB
    const largeFile = new File(['x'.repeat(3 * 1024 * 1024)], 'large.png', { type: 'image/png' });

    await userEvent.upload(fileInput, largeFile);

    await waitFor(() => {
      expect(screen.getByText(/příliš velký/i)).toBeInTheDocument();
    });
  });

  it('displays initials for users without photos', async () => {
    const users: User[] = [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
    ];
    vi.mocked(storage.getUsers).mockResolvedValue(users);

    render(<LoginScreen onLogin={mockOnLogin} />);

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
    });

    // Check that initials are displayed
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
  });

  it('search functionality works with photo users', async () => {
    const users: User[] = [
      { id: '1', name: 'Šimon', photoUrl: 'data:image/png;base64,test' },
      { id: '2', name: 'Petr' },
    ];
    vi.mocked(storage.getUsers).mockResolvedValue(users);

    const user = userEvent.setup();
    render(<LoginScreen onLogin={mockOnLogin} />);

    await waitFor(() => {
      expect(screen.getByText('Šimon')).toBeInTheDocument();
      expect(screen.getByText('Petr')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Hledat hráče...');
    await user.type(searchInput, 'simon');

    await waitFor(() => {
      expect(screen.getByText('Šimon')).toBeInTheDocument();
      expect(screen.queryByText('Petr')).not.toBeInTheDocument();
    });
  });
});

