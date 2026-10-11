import { useState } from 'react';
import { SportEvent } from '@/types.ts';

interface UseScoreTrackingProps {
  event: SportEvent;
  onUpdate: (event: SportEvent) => void;
}

export function useScoreTracking({ event, onUpdate }: UseScoreTrackingProps) {
  const [setScores, setSetScores] = useState<[string, string][]>([]);
  const [isEditingScore, setIsEditingScore] = useState(false);

  const handleAddSet = () => {
    setSetScores(prev => [...prev, ['', '']]);
  };

  const handleRemoveSet = (idx: number) => {
    setSetScores(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSetScoreChange = (setIdx: number, teamIdx: 0 | 1, value: string) => {
    const cleaned = value.replace(/\D/g, '');
    setSetScores(prev => prev.map((s, i) => {
      if (i !== setIdx) return s;
      const updated: [string, string] = [...s] as [string, string];
      updated[teamIdx] = cleaned;
      return updated;
    }));
  };

  const handleSaveScore = () => {
    const validSets: [number, number][] = setScores
      .map(([a, b]) => [Number(a) || 0, Number(b) || 0] as [number, number])
      .filter(([a, b]) => a > 0 || b > 0);
    onUpdate({ ...event, score: validSets.length > 0 ? validSets : undefined });
    setIsEditingScore(false);
  };

  const handleCancelScore = () => {
    setSetScores(
      event.score && event.score.length > 0
        ? event.score.map(([a, b]) => [String(a), String(b)])
        : []
    );
    setIsEditingScore(false);
  };

  const handleStartEditScore = () => {
    setSetScores(
      event.score && event.score.length > 0
        ? event.score.map(([a, b]) => [String(a), String(b)])
        : [['', '']]
    );
    setIsEditingScore(true);
  };

  const resetScores = () => {
    setSetScores([]);
    setIsEditingScore(false);
  };

  return {
    setScores,
    isEditingScore,
    handleAddSet,
    handleRemoveSet,
    handleSetScoreChange,
    handleSaveScore,
    handleCancelScore,
    handleStartEditScore,
    resetScores,
  };
}

export type ScoreTracking = ReturnType<typeof useScoreTracking>;

