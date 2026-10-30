import type { CSSProperties } from 'react';

interface ProgressBarProps {
  value: number;
  max?: number;
  label: string;
  /** Optional accent colour (e.g. subject colour). */
  color?: string;
  size?: 'sm' | 'md';
}

export function ProgressBar({ value, max = 100, label, color, size = 'md' }: ProgressBarProps) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const style = { '--bar-fill': `${pct}%`, ...(color ? { '--bar-color': color } : {}) } as CSSProperties;
  return (
    <div
      className={`progress progress--${size}`}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.round(value)}
      style={style}
    >
      <div className="progress__fill" />
    </div>
  );
}
