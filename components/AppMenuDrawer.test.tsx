import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AppMenuDrawer, AppMenuDrawerProps } from './AppMenuDrawer';
import { User, Team } from '../types';

const mockUser: User = {
  id: 'user-app-menu',
  name: 'Karel Hráč',
  hasMultisportCard: true,
};

const mockTeam: Team = {
  id: 'team-menu',
  name: 'Volejbal Brno',
  createdAt: '2026-01-01',
};

describe('AppMenuDrawer Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const defaultProps: AppMenuDrawerProps = {
    isOpen: true,
    onClose: vi.fn(),
    currentUser: mockUser,
    currentTeam: mockTeam,
    onOpenSettings: vi.fn(),
    onOpenIssues: vi.fn(),
    onOpenChangelog: vi.fn(),
    onExportICS: vi.fn(),
    onRefreshData: vi.fn(),
    onLogoutTeam: vi.fn(),
    onLogoutUser: vi.fn(),
  };

  it('renders drawer, user information, and menu items when isOpen is true', () => {
    render(<AppMenuDrawer {...defaultProps} />);
    expect(screen.getByTestId('app-menu-drawer')).toBeInTheDocument();
    expect(screen.getByTestId('menu-user-name')).toHaveTextContent('Karel Hráč');
    expect(screen.getByText(/Volejbal Brno/)).toBeInTheDocument();
    expect(screen.getByText('🎫 MultiSport karta')).toBeInTheDocument();
    expect(screen.getByTestId('menu-item-settings')).toBeInTheDocument();
    expect(screen.getByTestId('menu-item-issues')).toBeInTheDocument();
    expect(screen.getByTestId('menu-item-changelog')).toBeInTheDocument();
    expect(screen.getByTestId('menu-item-export')).toBeInTheDocument();
    expect(screen.getByTestId('menu-item-refresh')).toBeInTheDocument();
    expect(screen.getByTestId('menu-item-change-team')).toBeInTheDocument();
    expect(screen.getByTestId('menu-item-logout')).toBeInTheDocument();
  });

  it('does not render anything when isOpen is false', () => {
    const { container } = render(<AppMenuDrawer {...defaultProps} isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('calls onClose when close button or backdrop is clicked', () => {
    const onClose = vi.fn();
    const { rerender } = render(<AppMenuDrawer {...defaultProps} onClose={onClose} />);
    
    fireEvent.click(screen.getByTestId('app-menu-close'));
    expect(onClose).toHaveBeenCalledTimes(1);

    rerender(<AppMenuDrawer {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('app-menu-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('calls onOpenSettings and closes drawer when settings item is clicked', () => {
    const onOpenSettings = vi.fn();
    const onClose = vi.fn();
    render(<AppMenuDrawer {...defaultProps} onOpenSettings={onOpenSettings} onClose={onClose} />);
    
    fireEvent.click(screen.getByTestId('menu-item-settings'));
    expect(onClose).toHaveBeenCalled();
    expect(onOpenSettings).toHaveBeenCalled();
  });

  it('calls onOpenIssues and closes drawer when issues item is clicked', () => {
    const onOpenIssues = vi.fn();
    const onClose = vi.fn();
    render(<AppMenuDrawer {...defaultProps} onOpenIssues={onOpenIssues} onClose={onClose} />);
    
    fireEvent.click(screen.getByTestId('menu-item-issues'));
    expect(onClose).toHaveBeenCalled();
    expect(onOpenIssues).toHaveBeenCalled();
  });

  it('calls onOpenChangelog and closes drawer when changelog item is clicked', () => {
    const onOpenChangelog = vi.fn();
    const onClose = vi.fn();
    render(<AppMenuDrawer {...defaultProps} onOpenChangelog={onOpenChangelog} onClose={onClose} />);
    
    fireEvent.click(screen.getByTestId('menu-item-changelog'));
    expect(onClose).toHaveBeenCalled();
    expect(onOpenChangelog).toHaveBeenCalled();
  });

  it('calls onExportICS and closes drawer when export item is clicked', () => {
    const onExportICS = vi.fn();
    const onClose = vi.fn();
    render(<AppMenuDrawer {...defaultProps} onExportICS={onExportICS} onClose={onClose} />);
    
    fireEvent.click(screen.getByTestId('menu-item-export'));
    expect(onClose).toHaveBeenCalled();
    expect(onExportICS).toHaveBeenCalled();
  });

  it('calls onRefreshData and closes drawer when refresh item is clicked', () => {
    const onRefreshData = vi.fn();
    const onClose = vi.fn();
    render(<AppMenuDrawer {...defaultProps} onRefreshData={onRefreshData} onClose={onClose} />);
    
    fireEvent.click(screen.getByTestId('menu-item-refresh'));
    expect(onClose).toHaveBeenCalled();
    expect(onRefreshData).toHaveBeenCalled();
  });

  it('calls onLogoutTeam and closes drawer when change team item is clicked', () => {
    const onLogoutTeam = vi.fn();
    const onClose = vi.fn();
    render(<AppMenuDrawer {...defaultProps} onLogoutTeam={onLogoutTeam} onClose={onClose} />);
    
    fireEvent.click(screen.getByTestId('menu-item-change-team'));
    expect(onClose).toHaveBeenCalled();
    expect(onLogoutTeam).toHaveBeenCalled();
  });

  it('calls onLogoutUser and closes drawer when logout item is clicked', () => {
    const onLogoutUser = vi.fn();
    const onClose = vi.fn();
    render(<AppMenuDrawer {...defaultProps} onLogoutUser={onLogoutUser} onClose={onClose} />);
    
    fireEvent.click(screen.getByTestId('menu-item-logout'));
    expect(onClose).toHaveBeenCalled();
    expect(onLogoutUser).toHaveBeenCalled();
  });
});
