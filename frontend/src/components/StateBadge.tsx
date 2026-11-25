import React from 'react';
import { Check, AlertTriangle, AlertOctagon, WifiOff } from 'lucide-react';
import { CrowdState } from '../types';
import { STATE_DESIGN } from '../lib/tokens';

interface StateBadgeProps {
  state: CrowdState;
  size?: 'sm' | 'md' | 'lg';
  showShapeOutline?: boolean;
}

export const StateBadge: React.FC<StateBadgeProps> = ({
  state,
  size = 'md'
}) => {
  const design = STATE_DESIGN[state] || STATE_DESIGN.OFFLINE;

  const iconSizeClass = size === 'sm' ? 'w-3 h-3' : size === 'lg' ? 'w-4 h-4' : 'w-3.5 h-3.5';
  const paddingClass = size === 'sm' ? 'px-2 py-0.5 text-xs' : size === 'lg' ? 'px-3 py-1.5 text-sm' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium border rounded ${paddingClass} ${design.badgeBg} ${design.badgeBorder} ${design.badgeText}`}
      role="status"
      aria-label={`Zone status: ${design.label}`}
    >
      {/* Icon representing the shape & semantic symbol */}
      {state === 'GREEN' && <Check className={`${iconSizeClass} shrink-0`} aria-hidden="true" />}
      {state === 'AMBER' && <AlertTriangle className={`${iconSizeClass} shrink-0`} aria-hidden="true" />}
      {state === 'RED' && <AlertOctagon className={`${iconSizeClass} shrink-0`} aria-hidden="true" />}
      {state === 'OFFLINE' && <WifiOff className={`${iconSizeClass} shrink-0`} aria-hidden="true" />}

      <span className="font-semibold tracking-normal">{design.label}</span>
    </span>
  );
};

