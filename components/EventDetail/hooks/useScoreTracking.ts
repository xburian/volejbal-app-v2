import { useState } from 'react';
import { SportEvent } from '../../../types';

interface UseScoreTrackingProps {
  event: SportEvent;
  onUpdate: (event: SportEvent) => void;
}

export function useScoreTracking({ event, onUpdate }: UseScoreTrackingProps) {
  const [setScores, setSetScores] = useState<[number, number][]>([]);
  const [isEditingScore, setIsEditingScore] = useState(false);

  const handleAddSet = () => {
    setSetScores(prev => [...prev, [0, 0]]);
  };

  const handleRemoveSet = (idx: number) => {
    setSetScores(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSetScoreChange = (setIdx: number, teamIdx: 0 | 1, value: number) => {
    setSetScores(prev => prev.map((s, i) => {
      if (i !== setIdx) return s;
      const updated: [number, number] = [...s] as [number, number];
      updated[teamIdx] = value;
      return updated;
    }));
  };

  const handleSaveScore = () => {
    const validSets = setScores.filter(([a, b]) => a > 0 || b > 0);
    onUpdate({ ...event, score: validSets.length > 0 ? validSets : undefined });
    setIsEditingScore(false);
  };

  const handleCancelScore = () => {
    setSetScores(event.score ? [...event.score] : []);
    setIsEditingScore(false);
  };

  const handleStartEditScore = () => {
    setSetScores(event.score ? [...event.score] : [[0, 0]]);
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

