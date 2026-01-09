// Shared score thresholds
const HIGH_THRESHOLD = 70;
const MID_THRESHOLD = 40;

export type ScoreLevel = 'high' | 'mid' | 'low';

export function getScoreLevel(score: number): ScoreLevel {
  if (score >= HIGH_THRESHOLD) return 'high';
  if (score >= MID_THRESHOLD) return 'mid';
  return 'low';
}

export function getScoreColor(score: number): string {
  return `var(--vp-score-${getScoreLevel(score)})`;
}
