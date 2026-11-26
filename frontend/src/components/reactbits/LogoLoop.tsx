import React from 'react';

export interface LogoLoopItem {
  label: string;
  tag?: string;
}

interface LogoLoopProps {
  items: LogoLoopItem[];
  className?: string;
}

export const LogoLoop: React.FC<LogoLoopProps> = ({ items, className = '' }) => {
  const doubled = [...items, ...items];
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 w-14 bg-gradient-to-r from-[#08090a] to-transparent z-10"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 w-14 bg-gradient-to-l from-[#08090a] to-transparent z-10"
      />
      <div className="rb-marquee-track flex w-max items-center gap-4">
        {doubled.map((item, idx) => (
          <div
            key={`${item.label}-${idx}`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/[0.08] bg-white/[0.02] text-xs font-medium text-neutral-300 shrink-0"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[#18e299]" aria-hidden="true" />
            <span>{item.label}</span>
            {item.tag && (
              <span className="text-[10px] font-mono text-[#18e299] px-1.5 py-0.5 rounded bg-[#18e299]/10">
                {item.tag}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
