import React, { useState, useEffect, useCallback } from 'react';
import { Issue, IssueTag, IssueStatus, User } from '../types';
import * as storage from '../services/storage';
import { X, Bug, Sparkles, Plus, Loader2, ChevronUp, Trash2 } from 'lucide-react';

interface IssueDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
}

const TAG_CONFIG: Record<IssueTag, { label: string; icon: React.ReactNode; className: string }> = {
  bug: { label: 'Bug', icon: <Bug size={12} />, className: 'bg-red-100 text-red-700 border-red-200' },
  feature: { label: 'Vylepšení', icon: <Sparkles size={12} />, className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
};

const STATUS_CONFIG: Record<IssueStatus, { label: string; className: string }> = {
  todo: { label: 'K vyřešení', className: 'bg-slate-100 text-slate-700' },
  in_progress: { label: 'Rozpracováno', className: 'bg-amber-100 text-amber-700' },
  done: { label: 'Hotovo', className: 'bg-green-100 text-green-700' },
};

const STATUS_ORDER: IssueStatus[] = ['todo', 'in_progress', 'done'];

export const IssueDrawer: React.FC<IssueDrawerProps> = ({ isOpen, onClose, currentUser }) => {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [filterStatus, setFilterStatus] = useState<IssueStatus | 'all'>('all');

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tag, setTag] = useState<IssueTag>('feature');

  const loadIssues = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await storage.getIssues();
      setIssues(data);
    } catch (e) {
      console.error('Failed to load issues:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadIssues();
    }
  }, [isOpen, loadIssues]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    try {
      const newIssue = await storage.createIssue({
        id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).substring(2),
        title: title.trim(),
        description: description.trim(),
        tag,
        authorId: currentUser.id,
        authorName: currentUser.name,
      });
      setIssues(prev => [newIssue, ...prev]);
      setTitle('');
      setDescription('');
      setTag('feature');
      setShowForm(false);
    } catch (e) {
      console.error('Failed to create issue:', e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (issue: Issue, newStatus: IssueStatus) => {
    // Optimistic update
    setIssues(prev => prev.map(i => i.id === issue.id ? { ...i, status: newStatus, updatedAt: new Date().toISOString() } : i));
    try {
      await storage.updateIssue(issue.id, { status: newStatus });
    } catch (e) {
      console.error('Failed to update issue:', e);
      setIssues(prev => prev.map(i => i.id === issue.id ? issue : i));
    }
  };

  const handleDelete = async (issue: Issue) => {
    setIssues(prev => prev.filter(i => i.id !== issue.id));
    try {
      await storage.deleteIssue(issue.id);
    } catch (e) {
      console.error('Failed to delete issue:', e);
      setIssues(prev => [...prev, issue]);
    }
  };

  const filteredIssues = filterStatus === 'all'
    ? issues
    : issues.filter(i => i.status === filterStatus);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' });
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60] animate-backdrop-in"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-[70] w-full sm:w-[540px] lg:w-[600px] bg-white shadow-2xl flex flex-col animate-drawer-in">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Bug size={20} className="text-blue-600" />
            Náměty a chyby
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
          >
            <X size={20} />
          </button>
        </div>

        {/* New issue toggle */}
        <div className="px-4 pt-3">
          <button
            onClick={() => setShowForm(f => !f)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors"
          >
            {showForm ? <ChevronUp size={16} /> : <Plus size={16} />}
            {showForm ? 'Skrýt formulář' : 'Nový námět'}
          </button>
        </div>

        {/* Form */}
        {showForm && (
          <form onSubmit={handleSubmit} className="px-4 pt-3 pb-2 space-y-3 border-b border-slate-100 animate-fade-in-up">
            <div>
              <input
                type="text"
                placeholder="Název..."
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <textarea
                placeholder="Popis (volitelné)..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setTag('feature')}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                  tag === 'feature'
                    ? 'bg-emerald-100 text-emerald-700 border-emerald-300 ring-2 ring-emerald-200'
                    : 'bg-white text-slate-500 border-slate-200 hover:border-emerald-200'
                }`}
              >
                <Sparkles size={12} />
                Vylepšení
              </button>
              <button
                type="button"
                onClick={() => setTag('bug')}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                  tag === 'bug'
                    ? 'bg-red-100 text-red-700 border-red-300 ring-2 ring-red-200'
                    : 'bg-white text-slate-500 border-slate-200 hover:border-red-200'
                }`}
              >
                <Bug size={12} />
                Bug
              </button>
            </div>
            <button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-lg font-medium text-sm transition-colors"
            >
              {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : null}
              Odeslat
            </button>
          </form>
        )}

        {/* Filters */}
        <div className="flex gap-1.5 px-4 py-3 border-b border-slate-100 overflow-x-auto">
          <FilterButton
            active={filterStatus === 'all'}
            onClick={() => setFilterStatus('all')}
            label={`Vše (${issues.length})`}
          />
          {STATUS_ORDER.map(s => {
            const count = issues.filter(i => i.status === s).length;
            return (
              <FilterButton
                key={s}
                active={filterStatus === s}
                onClick={() => setFilterStatus(s)}
                label={`${STATUS_CONFIG[s].label} (${count})`}
              />
            );
          })}
        </div>

        {/* Issue list */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 custom-scrollbar">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-blue-500" />
            </div>
          ) : filteredIssues.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Bug size={32} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">Žádné náměty k zobrazení</p>
            </div>
          ) : (
            filteredIssues.map((issue, index) => (
              <IssueCard
                key={issue.id}
                issue={issue}
                index={index}
                onStatusChange={handleStatusChange}
                onDelete={handleDelete}
                formatDate={formatDate}
              />
            ))
          )}
        </div>
      </div>
    </>
  );
};

// ── Sub-components ──

const FilterButton: React.FC<{ active: boolean; onClick: () => void; label: string }> = ({ active, onClick, label }) => (
  <button
    onClick={onClick}
    className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
      active
        ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-200'
        : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
    }`}
  >
    {label}
  </button>
);

const IssueCard: React.FC<{
  issue: Issue;
  index: number;
  onStatusChange: (issue: Issue, status: IssueStatus) => void;
  onDelete: (issue: Issue) => void;
  formatDate: (iso: string) => string;
}> = ({ issue, index, onStatusChange, onDelete, formatDate }) => {
  const tagCfg = TAG_CONFIG[issue.tag];
  const statusCfg = STATUS_CONFIG[issue.status];

  return (
    <div
      className={`p-3 rounded-xl border transition-all animate-issue-card ${
        issue.status === 'done' ? 'bg-slate-50 border-slate-100 opacity-60' : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
      }`}
      style={{ animationDelay: `${Math.min(index * 50, 500)}ms` }}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <h3 className={`text-sm font-semibold leading-tight ${issue.status === 'done' ? 'line-through text-slate-400' : 'text-slate-800'}`}>
          {issue.title}
        </h3>
        <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold border shrink-0 ${tagCfg.className}`}>
          {tagCfg.icon}
          {tagCfg.label}
        </span>
      </div>

      {issue.description && (
        <p className="text-xs text-slate-500 mb-2 line-clamp-2 leading-relaxed">{issue.description}</p>
      )}

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {/* Status selector */}
          <select
            value={issue.status}
            onChange={e => onStatusChange(issue, e.target.value as IssueStatus)}
            className={`text-[11px] font-medium px-2 py-1 rounded-md border-0 cursor-pointer focus:ring-2 focus:ring-blue-300 ${statusCfg.className}`}
          >
            {STATUS_ORDER.map(s => (
              <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
            ))}
          </select>
          <span className="text-[10px] text-slate-400">
            {issue.authorName} · {formatDate(issue.createdAt)}
          </span>
        </div>
        <button
          onClick={() => onDelete(issue)}
          className="p-1 text-slate-300 hover:text-red-500 rounded transition-colors"
          title="Smazat"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
};
