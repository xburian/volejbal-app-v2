import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminImpersonationBanner } from './AdminImpersonationBanner';

describe('AdminImpersonationBanner Component', () => {
  it('renders team name and bypass indicator', () => {
    render(
      <AdminImpersonationBanner
        teamName="Nahravame-si"
        onReturnToAdmin={vi.fn()}
        onExitSession={vi.fn()}
      />
    );

    expect(screen.getByTestId('admin-impersonation-banner')).toBeInTheDocument();
    expect(screen.getByText('Nahravame-si')).toBeInTheDocument();
    expect(screen.getByText('Bypass aktivní')).toBeInTheDocument();
  });

  it('triggers onReturnToAdmin when button is clicked', async () => {
    const onReturn = vi.fn();
    render(
      <AdminImpersonationBanner
        teamName="Nahravame-si"
        onReturnToAdmin={onReturn}
        onExitSession={vi.fn()}
      />
    );

    await userEvent.click(screen.getByTestId('return-to-admin-button'));
    expect(onReturn).toHaveBeenCalledTimes(1);
  });

  it('triggers onExitSession when exit button is clicked', async () => {
    const onExit = vi.fn();
    render(
      <AdminImpersonationBanner
        teamName="Nahravame-si"
        onReturnToAdmin={vi.fn()}
        onExitSession={onExit}
      />
    );

    await userEvent.click(screen.getByTestId('exit-admin-session-button'));
    expect(onExit).toHaveBeenCalledTimes(1);
  });
});
