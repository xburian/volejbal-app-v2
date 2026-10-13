import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsDrawer } from './SettingsDrawer';
import { User, BankAccount, SportConfig, Team } from '../types';

vi.mock('../services/storage', () => ({
  updateUser: vi.fn(),
  uploadUserPhoto: vi.fn(),
  deleteUserPhoto: vi.fn(),
  getBankAccounts: vi.fn().mockResolvedValue([]),
  createBankAccount: vi.fn(),
  changeTeamPassword: vi.fn(),
}));

const mockUser: User = {
  id: 'user-drawer-test',
  name: 'Petr Tester',
};

const mockTeam: Team = {
  id: 'team-1',
  name: 'Brněnští Vlci',
  createdAt: '2026-01-01',
};

const mockSportConfigs: SportConfig[] = [
  { type: 'volejbal', label: 'Volejbal', maxPlayers: 12, defaultCost: 1000, defaultLocation: 'Hala', teamSize: null },
  { type: 'tenis', label: 'Tenis', maxPlayers: 4, defaultCost: 500, defaultLocation: 'Kurty', teamSize: 2 },
];

const mockAccounts: BankAccount[] = [
  { id: 'acc-1', ownerName: 'Petr Tester', accountNumber: '123456789/0100', userId: 'user-drawer-test' },
];

describe('SettingsDrawer Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    currentUser: mockUser,
    bankAccounts: mockAccounts,
    currentTeam: mockTeam,
    onBankAccountsChange: vi.fn(),
    onUserUpdate: vi.fn(),
    onShowChangelog: vi.fn(),
    onShowIssues: vi.fn(),
    sportConfigs: mockSportConfigs,
    onSportConfigsChange: vi.fn(),
  };

  it('renders drawer and backdrop when isOpen is true', () => {
    render(<SettingsDrawer {...defaultProps} />);
    expect(screen.getByTestId('settings-drawer')).toBeInTheDocument();
    expect(screen.getByTestId('settings-drawer-backdrop')).toBeInTheDocument();
    expect(screen.getByText('Nastavení a profil')).toBeInTheDocument();
  });

  it('does not render anything when isOpen is false', () => {
    const { container } = render(<SettingsDrawer {...defaultProps} isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('calls onClose when close button is clicked', async () => {
    const onClose = vi.fn();
    render(<SettingsDrawer {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('settings-drawer-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when backdrop is clicked', async () => {
    const onClose = vi.fn();
    render(<SettingsDrawer {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('settings-drawer-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders tab buttons for all sections', () => {
    render(<SettingsDrawer {...defaultProps} />);
    expect(screen.getByTestId('tab-all')).toBeInTheDocument();
    expect(screen.getByTestId('tab-profile')).toBeInTheDocument();
    expect(screen.getByTestId('tab-accounts')).toBeInTheDocument();
    expect(screen.getByTestId('tab-sports')).toBeInTheDocument();
    expect(screen.getByTestId('tab-team')).toBeInTheDocument();
  });

  it('filters to only profile section when profile tab is clicked', async () => {
    render(<SettingsDrawer {...defaultProps} />);
    
    // Switch to profile tab
    fireEvent.click(screen.getByTestId('tab-profile'));
    
    // Profile is visible
    expect(screen.getByTestId('profile-name')).toBeInTheDocument();
    expect(screen.getByTestId('multisport-toggle')).toBeInTheDocument();
    
    // Other sections are hidden
    expect(screen.queryByText('Typy sportů')).not.toBeInTheDocument();
    expect(screen.queryByText('Zabezpečení týmu')).not.toBeInTheDocument();
  });

  it('filters to only accounts section when accounts tab is clicked', async () => {
    render(<SettingsDrawer {...defaultProps} />);
    
    fireEvent.click(screen.getByTestId('tab-accounts'));
    
    // Account section visible
    expect(screen.getByText('Bankovní účet')).toBeInTheDocument();
    expect(screen.getByText('•••789/0100')).toBeInTheDocument();
    
    // Profile and team hidden
    expect(screen.queryByTestId('profile-name')).not.toBeInTheDocument();
    expect(screen.queryByText('Zabezpečení týmu')).not.toBeInTheDocument();
  });

  it('filters to only sports section when sports tab is clicked', async () => {
    render(<SettingsDrawer {...defaultProps} />);
    
    fireEvent.click(screen.getByTestId('tab-sports'));
    
    expect(screen.getByText('Typy sportů')).toBeInTheDocument();
    expect(screen.getByTestId('sport-config-volejbal')).toBeInTheDocument();
    
    // Profile hidden
    expect(screen.queryByTestId('profile-name')).not.toBeInTheDocument();
  });

  it('filters to only team section when team tab is clicked', async () => {
    render(<SettingsDrawer {...defaultProps} />);
    
    fireEvent.click(screen.getByTestId('tab-team'));
    
    expect(screen.getByText('Zabezpečení týmu')).toBeInTheDocument();
    expect(screen.getByText(/Brněnští Vlci/)).toBeInTheDocument();
    
    expect(screen.queryByTestId('profile-name')).not.toBeInTheDocument();
    expect(screen.queryByText('Typy sportů')).not.toBeInTheDocument();
  });

  it('shows all sections when tab-all is selected', () => {
    render(<SettingsDrawer {...defaultProps} initialTab="all" />);
    
    expect(screen.getByTestId('profile-name')).toBeInTheDocument();
    expect(screen.getByText('Bankovní účet')).toBeInTheDocument();
    expect(screen.getByText('Typy sportů')).toBeInTheDocument();
    expect(screen.getByText('Zabezpečení týmu')).toBeInTheDocument();
  });

  it('triggers onShowChangelog and onClose when changelog button is clicked', async () => {
    const onShowChangelog = vi.fn();
    const onClose = vi.fn();
    render(<SettingsDrawer {...defaultProps} onShowChangelog={onShowChangelog} onClose={onClose} />);
    
    const changelogBtn = screen.getByText('Seznam změn');
    fireEvent.click(changelogBtn);
    
    expect(onClose).toHaveBeenCalled();
    expect(onShowChangelog).toHaveBeenCalled();
  });

  it('triggers onShowIssues and onClose when issues button is clicked', async () => {
    const onShowIssues = vi.fn();
    const onClose = vi.fn();
    render(<SettingsDrawer {...defaultProps} onShowIssues={onShowIssues} onClose={onClose} />);
    
    const issuesBtn = screen.getByText('Náměty a chyby');
    fireEvent.click(issuesBtn);
    
    expect(onClose).toHaveBeenCalled();
    expect(onShowIssues).toHaveBeenCalled();
  });
});
