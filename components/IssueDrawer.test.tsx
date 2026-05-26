import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IssueDrawer } from './IssueDrawer';
import { Issue, User } from '../types';
import * as storage from '../services/storage';

vi.mock('../services/storage');

const mockUser: User = { id: 'u1', name: 'Lukáš' };

const mockIssues: Issue[] = [
  {
    id: 'i1',
    title: 'Opravit přihlášení',
    description: 'Tlačítko nereaguje na kliknutí',
    tag: 'bug',
    status: 'todo',
    authorId: 'u1',
    authorName: 'Lukáš',
    createdAt: '2026-05-20T10:00:00Z',
    updatedAt: '2026-05-20T10:00:00Z',
  },
  {
    id: 'i2',
    title: 'Přidat tmavý režim',
    description: '',
    tag: 'feature',
    status: 'in_progress',
    authorId: 'u2',
    authorName: 'Jana',
    createdAt: '2026-05-21T12:00:00Z',
    updatedAt: '2026-05-22T08:00:00Z',
  },
  {
    id: 'i3',
    title: 'Hotový úkol',
    description: 'Tento je dokončený',
    tag: 'feature',
    status: 'done',
    authorId: 'u1',
    authorName: 'Lukáš',
    createdAt: '2026-05-19T09:00:00Z',
    updatedAt: '2026-05-20T15:00:00Z',
  },
];

describe('IssueDrawer', () => {
  beforeEach(() => {
    vi.mocked(storage.getIssues).mockResolvedValue([...mockIssues]);
    vi.mocked(storage.createIssue).mockImplementation(async (issue) => ({
      ...issue,
      status: 'todo',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
    vi.mocked(storage.updateIssue).mockResolvedValue(mockIssues[0]);
    vi.mocked(storage.deleteIssue).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders nothing when closed', () => {
    const { container } = render(
      <IssueDrawer isOpen={false} onClose={vi.fn()} currentUser={mockUser} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders drawer with header when open', async () => {
    render(<IssueDrawer isOpen={true} onClose={vi.fn()} currentUser={mockUser} />);
    expect(screen.getByText('Náměty a chyby')).toBeInTheDocument();
  });

  it('loads and displays issues on open', async () => {
    render(<IssueDrawer isOpen={true} onClose={vi.fn()} currentUser={mockUser} />);
    await waitFor(() => {
      expect(screen.getByText('Opravit přihlášení')).toBeInTheDocument();
      expect(screen.getByText('Přidat tmavý režim')).toBeInTheDocument();
      expect(screen.getByText('Hotový úkol')).toBeInTheDocument();
    });
  });

  it('shows issue descriptions', async () => {
    render(<IssueDrawer isOpen={true} onClose={vi.fn()} currentUser={mockUser} />);
    await waitFor(() => {
      expect(screen.getByText('Tlačítko nereaguje na kliknutí')).toBeInTheDocument();
    });
  });

  it('displays tag badges (Bug / Vylepšení)', async () => {
    render(<IssueDrawer isOpen={true} onClose={vi.fn()} currentUser={mockUser} />);
    await waitFor(() => {
      expect(screen.getByText('Bug')).toBeInTheDocument();
      expect(screen.getAllByText('Vylepšení').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('calls onClose when backdrop is clicked', async () => {
    const onClose = vi.fn();
    render(<IssueDrawer isOpen={true} onClose={onClose} currentUser={mockUser} />);
    // The backdrop is the first fixed div
    const backdrop = document.querySelector('.animate-backdrop-in');
    await userEvent.click(backdrop!);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when X button is clicked', async () => {
    const onClose = vi.fn();
    render(<IssueDrawer isOpen={true} onClose={onClose} currentUser={mockUser} />);
    // X button is accessible via its parent button near the header
    const closeButtons = screen.getAllByRole('button');
    // The X button is the one in the header (second button, after "Nový námět")
    const xButton = closeButtons.find(btn => btn.querySelector('.lucide-x'));
    await userEvent.click(xButton!);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('toggles the new issue form when button is clicked', async () => {
    render(<IssueDrawer isOpen={true} onClose={vi.fn()} currentUser={mockUser} />);
    expect(screen.getByText('Nový námět')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Nový námět'));
    expect(screen.getByPlaceholderText('Název...')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Popis (volitelné)...')).toBeInTheDocument();
    expect(screen.getByText('Skrýt formulář')).toBeInTheDocument();
  });

  it('submits a new issue', async () => {
    render(<IssueDrawer isOpen={true} onClose={vi.fn()} currentUser={mockUser} />);
    await waitFor(() => expect(storage.getIssues).toHaveBeenCalled());

    await userEvent.click(screen.getByText('Nový námět'));
    await userEvent.type(screen.getByPlaceholderText('Název...'), 'Nový bug');
    await userEvent.type(screen.getByPlaceholderText('Popis (volitelné)...'), 'Detailní popis');

    // Select bug tag
    const bugButtons = screen.getAllByText('Bug');
    const bugTagButton = bugButtons.find(el => el.closest('button[type="button"]'));
    await userEvent.click(bugTagButton!);

    await userEvent.click(screen.getByText('Odeslat'));

    await waitFor(() => {
      expect(storage.createIssue).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Nový bug',
          description: 'Detailní popis',
          tag: 'bug',
          authorId: 'u1',
          authorName: 'Lukáš',
        })
      );
    });
  });

  it('clears form after successful submission', async () => {
    render(<IssueDrawer isOpen={true} onClose={vi.fn()} currentUser={mockUser} />);
    await waitFor(() => expect(storage.getIssues).toHaveBeenCalled());

    await userEvent.click(screen.getByText('Nový námět'));
    await userEvent.type(screen.getByPlaceholderText('Název...'), 'Test');
    await userEvent.click(screen.getByText('Odeslat'));

    await waitFor(() => {
      // Form should be hidden after submit
      expect(screen.queryByPlaceholderText('Název...')).not.toBeInTheDocument();
    });
  });

  it('filters issues by status', async () => {
    render(<IssueDrawer isOpen={true} onClose={vi.fn()} currentUser={mockUser} />);
    await waitFor(() => expect(screen.getByText('Opravit přihlášení')).toBeInTheDocument());

    // Click the "K vyřešení" filter
    await userEvent.click(screen.getByText('K vyřešení (1)'));
    expect(screen.getByText('Opravit přihlášení')).toBeInTheDocument();
    expect(screen.queryByText('Přidat tmavý režim')).not.toBeInTheDocument();
    expect(screen.queryByText('Hotový úkol')).not.toBeInTheDocument();

    // Click "Vše" to show all again
    await userEvent.click(screen.getByText('Vše (3)'));
    expect(screen.getByText('Opravit přihlášení')).toBeInTheDocument();
    expect(screen.getByText('Přidat tmavý režim')).toBeInTheDocument();
  });

  it('changes issue status via dropdown', async () => {
    render(<IssueDrawer isOpen={true} onClose={vi.fn()} currentUser={mockUser} />);
    await waitFor(() => expect(screen.getByText('Opravit přihlášení')).toBeInTheDocument());

    // Find the status select for the first issue (todo)
    const selects = screen.getAllByRole('combobox');
    const firstSelect = selects[0];
    await userEvent.selectOptions(firstSelect, 'in_progress');

    expect(storage.updateIssue).toHaveBeenCalledWith('i1', { status: 'in_progress' });
  });

  it('deletes an issue', async () => {
    render(<IssueDrawer isOpen={true} onClose={vi.fn()} currentUser={mockUser} />);
    await waitFor(() => expect(screen.getByText('Opravit přihlášení')).toBeInTheDocument());

    const deleteButtons = screen.getAllByTitle('Smazat');
    await userEvent.click(deleteButtons[0]);

    expect(storage.deleteIssue).toHaveBeenCalledWith('i1');
    await waitFor(() => {
      expect(screen.queryByText('Opravit přihlášení')).not.toBeInTheDocument();
    });
  });

  it('shows empty state when no issues match filter', async () => {
    vi.mocked(storage.getIssues).mockResolvedValue([]);
    render(<IssueDrawer isOpen={true} onClose={vi.fn()} currentUser={mockUser} />);
    await waitFor(() => {
      expect(screen.getByText('Žádné náměty k zobrazení')).toBeInTheDocument();
    });
  });

  it('shows author name and date on issue cards', async () => {
    render(<IssueDrawer isOpen={true} onClose={vi.fn()} currentUser={mockUser} />);
    await waitFor(() => {
      expect(screen.getAllByText(/Lukáš/).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/Jana/)).toBeInTheDocument();
    });
  });

  it('applies done styling to completed issues', async () => {
    render(<IssueDrawer isOpen={true} onClose={vi.fn()} currentUser={mockUser} />);
    await waitFor(() => {
      const doneTitle = screen.getByText('Hotový úkol');
      expect(doneTitle.className).toContain('line-through');
    });
  });
});
