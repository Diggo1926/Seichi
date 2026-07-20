import type { PlaceStatus } from '../types';
import { STATUS_META } from '../types';

interface StatusPillProps {
  status: PlaceStatus;
  size?: 'sm' | 'md';
}

export default function StatusPill({ status, size = 'sm' }: StatusPillProps) {
  const meta = STATUS_META[status];
  return (
    <span
      className={`status-pill status-pill--${size} status-${meta.var}`}
      style={{ color: meta.color, background: meta.soft }}
    >
      {meta.label}
    </span>
  );
}
