import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EventBottomActionDock, EventBottomActionDockProps } from './EventBottomActionDock';

describe('EventBottomActionDock', () => {
  const defaultProps: EventBottomActionDockProps = {
    isCurrentUserJoined: false,
    isWaitlisted: false,
    isAtCapacity: false,
    countJoined: 8,
    maxPlayers: 12,
    costPerPerson: 150,
    hasPaid: false,
    isSaving: false,
    onJoinOrWaitlist: vi.fn(),
    onDecline: vi.fn(),
    onGoToPayment: vi.fn(),
  };

  it('renders correctly with root testid', () => {
    render(<EventBottomActionDock {...defaultProps} />);
    expect(screen.getByTestId('event-bottom-action-dock')).toBeInTheDocument();
  });

  describe('When user is not registered and spots are available', () => {
    it('renders join button with spots badge and triggers onJoinOrWaitlist', async () => {
      const onJoinOrWaitlist = vi.fn();
      const user = userEvent.setup();

      render(
        <EventBottomActionDock
          {...defaultProps}
          isCurrentUserJoined={false}
          isAtCapacity={false}
          countJoined={7}
          maxPlayers={12}
          onJoinOrWaitlist={onJoinOrWaitlist}
        />
      );

      const joinBtn = screen.getByTestId('action-dock-join');
      expect(joinBtn).toBeInTheDocument();
      expect(joinBtn).toHaveTextContent('🏐 Jdu hrát');
      expect(joinBtn).toHaveTextContent('7/12 hráčů');

      await user.click(joinBtn);
      expect(onJoinOrWaitlist).toHaveBeenCalledTimes(1);
    });
  });

  describe('When user is not registered and event is at capacity', () => {
    it('renders waitlist button with capacity badge and triggers onJoinOrWaitlist', async () => {
      const onJoinOrWaitlist = vi.fn();
      const user = userEvent.setup();

      render(
        <EventBottomActionDock
          {...defaultProps}
          isCurrentUserJoined={false}
          isAtCapacity={true}
          countJoined={12}
          maxPlayers={12}
          onJoinOrWaitlist={onJoinOrWaitlist}
        />
      );

      const waitlistBtn = screen.getByTestId('action-dock-join');
      expect(waitlistBtn).toBeInTheDocument();
      expect(waitlistBtn).toHaveTextContent('⏳ Na čekací listinu');
      expect(waitlistBtn).toHaveTextContent('12/12 plno');

      await user.click(waitlistBtn);
      expect(onJoinOrWaitlist).toHaveBeenCalledTimes(1);
    });
  });

  describe('When user is joined', () => {
    it('renders status card with "✓ Jdeš hrát", decline button, and payment button', async () => {
      const onDecline = vi.fn();
      const onGoToPayment = vi.fn();
      const user = userEvent.setup();

      render(
        <EventBottomActionDock
          {...defaultProps}
          isCurrentUserJoined={true}
          hasPaid={false}
          costPerPerson={200}
          onDecline={onDecline}
          onGoToPayment={onGoToPayment}
        />
      );

      expect(screen.getByText('✓ Jdeš hrát')).toBeInTheDocument();

      const declineBtn = screen.getByTestId('action-dock-decline');
      expect(declineBtn).toBeInTheDocument();
      expect(declineBtn).toHaveTextContent('Odhlásit');
      await user.click(declineBtn);
      expect(onDecline).toHaveBeenCalledTimes(1);

      const payBtn = screen.getByTestId('action-dock-pay');
      expect(payBtn).toBeInTheDocument();
      expect(payBtn).toHaveTextContent('Zaplatit 200 Kč');
      await user.click(payBtn);
      expect(onGoToPayment).toHaveBeenCalledTimes(1);
    });

    it('shows "Zaplaceno ✓" when hasPaid is true', () => {
      render(
        <EventBottomActionDock
          {...defaultProps}
          isCurrentUserJoined={true}
          hasPaid={true}
        />
      );

      const payBtn = screen.getByTestId('action-dock-pay');
      expect(payBtn).toHaveTextContent('Zaplaceno ✓');
    });
  });

  describe('When user is waitlisted', () => {
    it('renders status card with "Na čekačce" and decline button', async () => {
      const onDecline = vi.fn();
      const user = userEvent.setup();

      render(
        <EventBottomActionDock
          {...defaultProps}
          isCurrentUserJoined={false}
          isWaitlisted={true}
          onDecline={onDecline}
        />
      );

      expect(screen.getByText('Na čekačce')).toBeInTheDocument();

      const declineBtn = screen.getByTestId('action-dock-decline');
      await user.click(declineBtn);
      expect(onDecline).toHaveBeenCalledTimes(1);
    });
  });

  describe('When isSaving is true', () => {
    it('disables join button and shows saving indicator', () => {
      render(
        <EventBottomActionDock
          {...defaultProps}
          isCurrentUserJoined={false}
          isSaving={true}
        />
      );

      const joinBtn = screen.getByTestId('action-dock-join');
      expect(joinBtn).toBeDisabled();
      expect(joinBtn).toHaveTextContent('Ukládání...');
    });

    it('disables decline button during saving when user is joined', () => {
      render(
        <EventBottomActionDock
          {...defaultProps}
          isCurrentUserJoined={true}
          isSaving={true}
        />
      );

      const declineBtn = screen.getByTestId('action-dock-decline');
      expect(declineBtn).toBeDisabled();
    });
  });
});
