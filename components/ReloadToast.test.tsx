import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReloadToast } from './ReloadToast';

describe('ReloadToast Component', () => {
  it('renders nothing when status is idle', () => {
    const { container } = render(<ReloadToast status="idle" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders loading indicator and message when status is loading', () => {
    render(<ReloadToast status="loading" />);
    expect(screen.getByTestId('background-refresh-indicator')).toBeInTheDocument();
    expect(screen.getByText('Aktualizace dat…')).toBeInTheDocument();
  });

  it('renders success indicator and message when status is success', () => {
    render(<ReloadToast status="success" />);
    expect(screen.getByTestId('refresh-success-indicator')).toBeInTheDocument();
    expect(screen.getByText('Data byla úspěšně aktualizována')).toBeInTheDocument();
  });

  it('supports custom messages for loading and success', () => {
    const { rerender } = render(
      <ReloadToast status="loading" loadingMessage="Stahuji zápasy..." />
    );
    expect(screen.getByText('Stahuji zápasy...')).toBeInTheDocument();

    rerender(
      <ReloadToast status="success" successMessage="Hotovo, vše uloženo!" />
    );
    expect(screen.getByText('Hotovo, vše uloženo!')).toBeInTheDocument();
  });
});
