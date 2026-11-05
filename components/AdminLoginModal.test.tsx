import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminLoginModal } from './AdminLoginModal';

describe('AdminLoginModal Component', () => {
  it('does not render when isOpen is false', () => {
    const { container } = render(
      <AdminLoginModal
        isOpen={false}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        loginAdmin={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders modal elements when isOpen is true', () => {
    render(
      <AdminLoginModal
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        loginAdmin={vi.fn()}
      />
    );

    expect(screen.getByTestId('admin-login-modal')).toBeInTheDocument();
    expect(screen.getByText('Správa platformy')).toBeInTheDocument();
    expect(screen.getByTestId('admin-username-input')).toBeInTheDocument();
    expect(screen.getByTestId('admin-password-input')).toBeInTheDocument();
    expect(screen.getByTestId('admin-submit-button')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', async () => {
    const onClose = vi.fn();
    render(
      <AdminLoginModal
        isOpen={true}
        onClose={onClose}
        onSuccess={vi.fn()}
        loginAdmin={vi.fn()}
      />
    );

    await userEvent.click(screen.getByTestId('admin-login-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('submits credentials and calls onSuccess on successful login', async () => {
    const loginAdmin = vi.fn().mockResolvedValue({ username: 'admin', role: 'admin' });
    const onSuccess = vi.fn();

    render(
      <AdminLoginModal
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={onSuccess}
        loginAdmin={loginAdmin}
      />
    );

    await userEvent.type(screen.getByTestId('admin-username-input'), 'admin');
    await userEvent.type(screen.getByTestId('admin-password-input'), 'secret123');
    await userEvent.click(screen.getByTestId('admin-submit-button'));

    expect(loginAdmin).toHaveBeenCalledWith('admin', 'secret123');
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1);
    });
  });

  it('displays error message on failed login', async () => {
    const loginAdmin = vi.fn().mockRejectedValue(new Error('Nesprávné heslo'));

    render(
      <AdminLoginModal
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        loginAdmin={loginAdmin}
      />
    );

    await userEvent.type(screen.getByTestId('admin-username-input'), 'admin');
    await userEvent.type(screen.getByTestId('admin-password-input'), 'wrong');
    await userEvent.click(screen.getByTestId('admin-submit-button'));

    await waitFor(() => {
      expect(screen.getByTestId('admin-login-error')).toHaveTextContent('Nesprávné heslo');
    });
  });
});
