/**
 * Shared UI utility functions used across dashboard, brand pages, and intelligence.
 * Extracted to eliminate code duplication.
 */

/** Score color: red → amber → green based on value */
export function scoreColor(score: number): string {
  if (score >= 85) return '#34d399'; // emerald
  if (score >= 70) return '#a3e635'; // lime
  if (score >= 55) return '#facc15'; // yellow
  if (score >= 40) return '#fb923c'; // orange
  return '#f87171'; // red
}

/** Tailwind gradient classes based on score */
export function scoreGradient(score: number): string {
  if (score >= 85) return 'from-emerald-400 to-cyan-400';
  if (score >= 70) return 'from-lime-400 to-emerald-400';
  if (score >= 55) return 'from-yellow-400 to-lime-400';
  if (score >= 40) return 'from-orange-400 to-yellow-400';
  return 'from-red-400 to-orange-400';
}

/** Human-readable score label */
export function scoreLabel(score: number): string {
  if (score >= 85) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 55) return 'Average';
  if (score >= 40) return 'Below Average';
  return 'Needs Work';
}
