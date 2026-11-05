import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ResetTeamPasswordModal } from './ResetTeamPasswordModal';
import { TeamOverviewItem } from '@/types';

const mockTeam: TeamOverviewItem = {
  id: 'team-test',
  name: 'Volejbal Praha',
  createdAt: '2025-01-01',
  userCount: 12,
  eventCount: 20,
  lastActiveAt: '2025-05-01',
};

describe('ResetTeamPasswordModal Component', () => {
  it('does not render when isOpen is false or team is null', () => {
    const { container } = render(
      <ResetTeamPasswordModal
        isOpen={false}
        team={mockTeam}
        onClose={vi.fn()}
        onReset={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders modal with generated passphrase when open', () => {
    render(
      <ResetTeamPasswordModal
        isOpen={true}
        team={mockTeam}
        onClose={vi.fn()}
        onReset={vi.fn()}
      />
    );

    expect(screen.getByTestId('reset-password-modal')).toBeInTheDocument();
    expect(screen.getByText('Tým: Volejbal Praha')).toBeInTheDocument();
    const input = screen.getByTestId('new-password-input') as HTMLInputElement;
    expect(input.value).toMatch(/^[a-z]+-\d{4}$/);
  });

  it('generates a new passphrase on generate button click', async () => {
    render(
      <ResetTeamPasswordModal
        isOpen={true}
        team={mockTeam}
        onClose={vi.fn()}
        onReset={vi.fn()}
      />
    );

    const input = screen.getByTestId('new-password-input') as HTMLInputElement;
    const initialVal = input.value;

    await userEvent.click(screen.getByTestId('generate-passphrase-button'));
    expect(input.value).toMatch(/^[a-z]+-\d{4}$/);
  });

  it('submits new password and calls onReset', async () => {
    const onReset = vi.fn().mockResolvedValue({ success: true });
    render(
      <ResetTeamPasswordModal
        isOpen={true}
        team={mockTeam}
        onClose={vi.fn()}
        onReset={onReset}
      />
    );

    const input = screen.getByTestId('new-password-input');
    await userEvent.clear(input);
    await userEvent.type(input, 'nova-sifra-123');

    await userEvent.click(screen.getByTestId('save-password-button'));
    expect(onReset).toHaveBeenCalledWith('team-test', 'nova-sifra-123');
  });
});
