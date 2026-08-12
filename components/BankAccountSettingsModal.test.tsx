import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BankAccountSettingsModal } from './BankAccountSettingsModal';
import { User, BankAccount, SportConfig } from '../types';

// Mock storage module
vi.mock('../services/storage', () => ({
  updateUser: vi.fn(),
  uploadUserPhoto: vi.fn(),
  deleteUserPhoto: vi.fn(),
  getBankAccounts: vi.fn().mockResolvedValue([]),
  createBankAccount: vi.fn(),
}));

import * as storage from '../services/storage';

const mockUser: User = {
  id: 'user-123-abcdef',
  name: 'Jan Novák',
};

const mockUserWithPhoto: User = {
  ...mockUser,
  photoUrl: 'data:image/png;base64,abc123',
};

const mockUserWithAutoAttend: User = {
  ...mockUser,
  autoAttendSportTypes: ['volejbal'],
};

const mockSportConfigs: SportConfig[] = [
  { type: 'volejbal', label: 'Volejbal', maxPlayers: 12, defaultCost: 1000, defaultLocation: 'Hala', teamSize: null },
  { type: 'tenis', label: 'Tenis', maxPlayers: 4, defaultCost: 500, defaultLocation: 'Tenisový kurt', teamSize: 2 },
  { type: 'badminton', label: 'Badminton', maxPlayers: 4, defaultCost: 400, defaultLocation: 'Sportovní centrum', teamSize: 2 },
];

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  currentUser: mockUser,
  bankAccounts: [] as BankAccount[],
  onBankAccountsChange: vi.fn(),
  onUserUpdate: vi.fn(),
  onShowChangelog: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('BankAccountSettingsModal — Profile Section', () => {
  it('renders profile section with user name and initial', () => {
    render(<BankAccountSettingsModal {...defaultProps} />);
    expect(screen.getByText('Profil')).toBeInTheDocument();
    expect(screen.getByTestId('profile-name')).toHaveTextContent('Jan Novák');
    // Shows initial when no photo
    expect(screen.getByText('J')).toBeInTheDocument();
  });

  it('renders profile photo when user has one', () => {
    render(<BankAccountSettingsModal {...defaultProps} currentUser={mockUserWithPhoto} />);
    const img = screen.getByAltText('Jan Novák');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'data:image/png;base64,abc123');
  });

  it('shows remove photo button only when user has a photo', () => {
    const { rerender } = render(<BankAccountSettingsModal {...defaultProps} />);
    expect(screen.queryByTestId('remove-photo-btn')).not.toBeInTheDocument();

    rerender(<BankAccountSettingsModal {...defaultProps} currentUser={mockUserWithPhoto} />);
    expect(screen.getByTestId('remove-photo-btn')).toBeInTheDocument();
  });

  it('shows edit name input when pencil button is clicked', async () => {
    render(<BankAccountSettingsModal {...defaultProps} />);
    expect(screen.queryByTestId('edit-name-input')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('edit-name-btn'));

    const input = screen.getByTestId('edit-name-input');
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue('Jan Novák');
  });

  it('saves new name when save button is clicked', async () => {
    const updatedUser = { ...mockUser, name: 'Petr Novotný' };
    (storage.updateUser as ReturnType<typeof vi.fn>).mockResolvedValue(updatedUser);

    render(<BankAccountSettingsModal {...defaultProps} />);
    fireEvent.click(screen.getByTestId('edit-name-btn'));

    const input = screen.getByTestId('edit-name-input');
    await userEvent.clear(input);
    await userEvent.type(input, 'Petr Novotný');

    fireEvent.click(screen.getByTestId('save-name-btn'));

    await waitFor(() => {
      expect(storage.updateUser).toHaveBeenCalledWith('user-123-abcdef', { name: 'Petr Novotný' });
    });
    await waitFor(() => {
      expect(defaultProps.onUserUpdate).toHaveBeenCalledWith(updatedUser);
    });
  });

  it('does not save when name is unchanged', async () => {
    render(<BankAccountSettingsModal {...defaultProps} />);
    fireEvent.click(screen.getByTestId('edit-name-btn'));

    // Name hasn't changed — click save
    fireEvent.click(screen.getByTestId('save-name-btn'));

    expect(storage.updateUser).not.toHaveBeenCalled();
    // Input should be hidden again
    expect(screen.queryByTestId('edit-name-input')).not.toBeInTheDocument();
  });

  it('cancels name editing with X button', async () => {
    render(<BankAccountSettingsModal {...defaultProps} />);
    fireEvent.click(screen.getByTestId('edit-name-btn'));

    const input = screen.getByTestId('edit-name-input');
    await userEvent.clear(input);
    await userEvent.type(input, 'Something new');

    // Click X cancel button
    const cancelBtns = screen.getAllByRole('button');
    cancelBtns.find(b => b.querySelector('.lucide-x'));
// Find the cancel button within the edit area (has X icon, after save button)
    const editArea = input.closest('div');
    const xButton = editArea?.querySelectorAll('button')[1]; // second button is X
    if (xButton) fireEvent.click(xButton);

    await waitFor(() => {
      expect(screen.queryByTestId('edit-name-input')).not.toBeInTheDocument();
    });
    expect(screen.getByTestId('profile-name')).toHaveTextContent('Jan Novák');
    expect(storage.updateUser).not.toHaveBeenCalled();
  });

  it('saves name on Enter key', async () => {
    const updatedUser = { ...mockUser, name: 'Nové Jméno' };
    (storage.updateUser as ReturnType<typeof vi.fn>).mockResolvedValue(updatedUser);

    render(<BankAccountSettingsModal {...defaultProps} />);
    fireEvent.click(screen.getByTestId('edit-name-btn'));

    const input = screen.getByTestId('edit-name-input');
    await userEvent.clear(input);
    await userEvent.type(input, 'Nové Jméno');
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(storage.updateUser).toHaveBeenCalledWith('user-123-abcdef', { name: 'Nové Jméno' });
    });
  });

  it('cancels name editing on Escape key', async () => {
    render(<BankAccountSettingsModal {...defaultProps} />);
    fireEvent.click(screen.getByTestId('edit-name-btn'));

    const input = screen.getByTestId('edit-name-input');
    await userEvent.clear(input);
    await userEvent.type(input, 'Something');
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(screen.queryByTestId('edit-name-input')).not.toBeInTheDocument();
    expect(screen.getByTestId('profile-name')).toHaveTextContent('Jan Novák');
  });

  it('shows error when name save fails', async () => {
    (storage.updateUser as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Server error'));

    render(<BankAccountSettingsModal {...defaultProps} />);
    fireEvent.click(screen.getByTestId('edit-name-btn'));

    const input = screen.getByTestId('edit-name-input');
    await userEvent.clear(input);
    await userEvent.type(input, 'New Name');
    fireEvent.click(screen.getByTestId('save-name-btn'));

    await waitFor(() => {
      expect(screen.getByText('Server error')).toBeInTheDocument();
    });
  });

  it('calls deleteUserPhoto and onUserUpdate when remove photo is clicked', async () => {
    (storage.deleteUserPhoto as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    render(<BankAccountSettingsModal {...defaultProps} currentUser={mockUserWithPhoto} />);
    fireEvent.click(screen.getByTestId('remove-photo-btn'));

    await waitFor(() => {
      expect(storage.deleteUserPhoto).toHaveBeenCalledWith('user-123-abcdef');
    });
    await waitFor(() => {
      expect(defaultProps.onUserUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'user-123-abcdef', photoUrl: undefined })
      );
    });
  });

  it('does not render when isOpen is false', () => {
    render(<BankAccountSettingsModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByText('Nastavení')).not.toBeInTheDocument();
  });

  it('shows change photo button', () => {
    render(<BankAccountSettingsModal {...defaultProps} />);
    expect(screen.getByTestId('change-photo-btn')).toBeInTheDocument();
  });

  it('displays user ID prefix', () => {
    render(<BankAccountSettingsModal {...defaultProps} />);
    expect(screen.getByText(/ID: user-123/)).toBeInTheDocument();
  });
});

describe('BankAccountSettingsModal — Auto-attend Section', () => {
  it('renders auto-attend section heading', () => {
    render(<BankAccountSettingsModal {...defaultProps} sportConfigs={mockSportConfigs} />);
    expect(screen.getByText('Automatická účast')).toBeInTheDocument();
  });

  it('renders a checkbox for each sport type', () => {
    render(<BankAccountSettingsModal {...defaultProps} sportConfigs={mockSportConfigs} />);
    expect(screen.getByTestId('auto-attend-checkbox-volejbal')).toBeInTheDocument();
    expect(screen.getByTestId('auto-attend-checkbox-tenis')).toBeInTheDocument();
    expect(screen.getByTestId('auto-attend-checkbox-badminton')).toBeInTheDocument();
  });

  it('all checkboxes are unchecked when autoAttendSportTypes is undefined', () => {
    render(<BankAccountSettingsModal {...defaultProps} sportConfigs={mockSportConfigs} />);
    expect(screen.getByTestId('auto-attend-checkbox-volejbal')).not.toBeChecked();
    expect(screen.getByTestId('auto-attend-checkbox-tenis')).not.toBeChecked();
    expect(screen.getByTestId('auto-attend-checkbox-badminton')).not.toBeChecked();
  });

  it('checkbox is checked for sport type in autoAttendSportTypes, others unchecked', () => {
    render(<BankAccountSettingsModal {...defaultProps} currentUser={mockUserWithAutoAttend} sportConfigs={mockSportConfigs} />);
    expect(screen.getByTestId('auto-attend-checkbox-volejbal')).toBeChecked();
    expect(screen.getByTestId('auto-attend-checkbox-tenis')).not.toBeChecked();
    expect(screen.getByTestId('auto-attend-checkbox-badminton')).not.toBeChecked();
  });

  it('checking a sport type calls updateUser with that type added', async () => {
    const updatedUser = { ...mockUser, autoAttendSportTypes: ['volejbal'] as const };
    (storage.updateUser as ReturnType<typeof vi.fn>).mockResolvedValue(updatedUser);

    render(<BankAccountSettingsModal {...defaultProps} sportConfigs={mockSportConfigs} />);
    fireEvent.click(screen.getByTestId('auto-attend-checkbox-volejbal'));

    await waitFor(() => {
      expect(storage.updateUser).toHaveBeenCalledWith('user-123-abcdef', { autoAttendSportTypes: ['volejbal'] });
    });
    await waitFor(() => {
      expect(defaultProps.onUserUpdate).toHaveBeenCalledWith(updatedUser);
    });
  });

  it('unchecking a sport type calls updateUser with that type removed', async () => {
    const updatedUser = { ...mockUserWithAutoAttend, autoAttendSportTypes: [] };
    (storage.updateUser as ReturnType<typeof vi.fn>).mockResolvedValue(updatedUser);

    render(<BankAccountSettingsModal {...defaultProps} currentUser={mockUserWithAutoAttend} sportConfigs={mockSportConfigs} />);
    fireEvent.click(screen.getByTestId('auto-attend-checkbox-volejbal'));

    await waitFor(() => {
      expect(storage.updateUser).toHaveBeenCalledWith('user-123-abcdef', { autoAttendSportTypes: [] });
    });
    await waitFor(() => {
      expect(defaultProps.onUserUpdate).toHaveBeenCalledWith(updatedUser);
    });
  });

  it('shows error message when auto-attend toggle fails', async () => {
    (storage.updateUser as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Server error'));

    render(<BankAccountSettingsModal {...defaultProps} sportConfigs={mockSportConfigs} />);
    fireEvent.click(screen.getByTestId('auto-attend-checkbox-volejbal'));

    await waitFor(() => {
      expect(screen.getByText('Server error')).toBeInTheDocument();
    });
  });
});

