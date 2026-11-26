import React, { isValidElement, useEffect, useLayoutEffect, useRef, useState } from 'react';
import './BranchedMenu.css';

export interface BranchedMenuChild {
  value: string;
  label: string;
  icon?: React.ReactNode;
  badge?: number;
}

export interface BranchedMenuItem {
  value?: string;
  label: string;
  children?: BranchedMenuChild[];
}

interface BranchedMenuProps {
  items: BranchedMenuItem[];
  defaultOpen?: number | number[];
  activeValue?: string;
  defaultActive?: string;
  onSelect?: (value: string, item: BranchedMenuChild | BranchedMenuItem) => void;
  onToggle?: (index: number, isOpen: boolean) => void;
  color?: string;
  accentColor?: string;
  lineColor?: string;
  width?: number;
  rowHeight?: number;
  indent?: number;
  trunk?: number;
  radius?: number;
  lineWidth?: number;
  fontSize?: number;
  drawDuration?: number;
  foldDuration?: number;
  className?: string;
}

const PAD = 6;
const MARK = 16;

const renderIcon = (icon?: React.ReactNode) => (isValidElement(icon) ? icon : null);
const toSet = (open: number | number[]) => new Set(Array.isArray(open) ? open : open >= 0 ? [open] : []);

export const BranchedMenu: React.FC<BranchedMenuProps> = ({
  items,
  defaultOpen = [0, 1, 2],
  activeValue,
  defaultActive = '',
  onSelect,
  onToggle,
  color = '#f5f5f5',
  accentColor = '#18e299',
  lineColor = 'rgba(255, 255, 255, 0.14)',
  width = 216,
  rowHeight = 38,
  indent = 32,
  trunk = 10,
  radius = 9,
  lineWidth = 1.5,
  fontSize = 13,
  drawDuration = 380,
  foldDuration = 280,
  className = ''
}) => {
  const [open, setOpen] = useState<Set<number>>(() => toSet(defaultOpen));
  const [internalActive, setInternalActive] = useState<string>(() => {
    if (defaultActive) return defaultActive;
    const first = items.find((it, i) => it.children && toSet(defaultOpen).has(i));
    return first?.children?.[0]?.value ?? '';
  });

  const active = activeValue !== undefined ? activeValue : internalActive;

  // Auto-open the branch section containing an externally selected activeValue
  useEffect(() => {
    if (!activeValue) return;
    const idx = items.findIndex((it) => it.children?.some((kid) => kid.value === activeValue));
    if (idx >= 0) {
      setOpen((prev) => {
        if (prev.has(idx)) return prev;
        const next = new Set(prev);
        next.add(idx);
        return next;
      });
    }
  }, [activeValue, items]);

  const navRef = useRef<HTMLElement | null>(null);
  const heads = useRef<Array<HTMLButtonElement | null>>([]);
  const markerRef = useRef<HTMLSpanElement | null>(null);
  const latest = useRef<{
    onSelect?: BranchedMenuProps['onSelect'];
    onToggle?: BranchedMenuProps['onToggle'];
  }>({});
  latest.current = { onSelect, onToggle };

  const activeSection = items.findIndex((it) => it.children?.some((kid) => kid.value === active));
  const markerShown = activeSection >= 0 && open.has(activeSection);

  useLayoutEffect(() => {
    const place = (glide: boolean) => {
      const m = markerRef.current;
      const el = heads.current[activeSection];
      if (!m) return;
      const on = markerShown && Boolean(el);
      if (!glide) m.style.transition = 'none';
      if (on && el) m.style.top = `${el.offsetTop + (el.offsetHeight - MARK) / 2}px`;
      m.toggleAttribute('data-on', on);
      if (!glide) {
        void m.offsetHeight;
        m.style.transition = '';
      }
    };
    place(true);
    let first = true;
    const ro = new ResizeObserver(() => {
      if (first) {
        first = false;
        return;
      }
      place(false);
    });
    if (navRef.current) ro.observe(navRef.current);
    return () => ro.disconnect();
  }, [activeSection, markerShown, items, fontSize, rowHeight]);

  const select = (value: string, item: BranchedMenuChild | BranchedMenuItem) => {
    if (activeValue === undefined) setInternalActive(value);
    latest.current.onSelect?.(value, item);
  };

  const toggle = (i: number) => {
    setOpen((prev) => {
      const next = new Set(prev);
      const isOpen = !next.has(i);
      if (isOpen) next.add(i);
      else next.delete(i);
      latest.current.onToggle?.(i, isOpen);
      return next;
    });
  };

  const r = Math.min(radius, rowHeight / 2 - 2);
  const endX = indent - 8;
  const rowY = (k: number) => PAD + k * rowHeight + rowHeight / 2;
  const branch = (k: number) => `M ${trunk} ${rowY(k) - r} A ${r} ${r} 0 0 0 ${trunk + r} ${rowY(k)} H ${endX}`;
  const reach = (k: number) => `M ${trunk} 0 V ${rowY(k) - r} A ${r} ${r} 0 0 0 ${trunk + r} ${rowY(k)} H ${endX}`;
  const length = (k: number) => rowY(k) - r + (Math.PI * r) / 2 + (endX - trunk - r);

  return (
    <nav
      ref={navRef}
      aria-label="Branched navigation"
      className={`branched-menu${className ? ` ${className}` : ''}`}
      style={
        {
          '--bm-w': `${width}px`,
          '--bm-ink': color,
          '--bm-accent': accentColor,
          '--bm-line': lineColor,
          '--bm-font': `${fontSize}px`,
          '--bm-row': `${rowHeight}px`,
          '--bm-indent': `${indent}px`,
          '--bm-line-w': lineWidth,
          '--bm-draw': `${drawDuration}ms`,
          '--bm-fold': `${foldDuration}ms`
        } as React.CSSProperties
      }
    >
      <span ref={markerRef} className="branched-menu__marker" aria-hidden="true" />
      {items.map((item, i) => {
        const kids = item.children;
        const isOpen = kids ? open.has(i) : false;
        const leafValue = item.value ?? item.label;
        const leafActive = !kids && leafValue === active;
        const bodyH = kids ? PAD * 2 + kids.length * rowHeight : 0;
        return (
          <div key={item.value ?? item.label} className="branched-menu__section" data-open={isOpen ? '' : undefined}>
            <button
              ref={(el) => {
                heads.current[i] = el;
              }}
              type="button"
              className="branched-menu__head"
              aria-expanded={kids ? isOpen : undefined}
              aria-current={leafActive ? 'true' : undefined}
              data-active={leafActive ? '' : undefined}
              onClick={() => (kids ? toggle(i) : select(leafValue, item))}
            >
              <span>{item.label}</span>
            </button>
            {kids ? (
              <div className="branched-menu__body">
                <div className="branched-menu__fold">
                  <div className="branched-menu__tree" style={{ height: bodyH }}>
                    <svg className="branched-menu__lines" width={indent} height={bodyH} aria-hidden="true">
                      <path className="branched-menu__base" d={`M ${trunk} 0 V ${rowY(kids.length - 1) - r}`} />
                      {kids.map((kid, k) => (
                        <path key={kid.value} className="branched-menu__base" d={branch(k)} />
                      ))}
                      {kids.map((kid, k) => (
                        <path
                          key={kid.value}
                          className="branched-menu__reach"
                          d={reach(k)}
                          style={{
                            strokeDasharray: length(k),
                            strokeDashoffset: kid.value === active ? 0 : length(k)
                          }}
                        />
                      ))}
                    </svg>
                    {kids.map((kid) => (
                      <button
                        key={kid.value}
                        type="button"
                        className="branched-menu__item"
                        aria-current={kid.value === active ? 'true' : undefined}
                        data-active={kid.value === active ? '' : undefined}
                        tabIndex={isOpen ? 0 : -1}
                        onClick={() => select(kid.value, kid)}
                      >
                        <span className="branched-menu__item-main">
                          {kid.icon ? (
                            <span className="branched-menu__icon" aria-hidden="true">
                              {renderIcon(kid.icon)}
                            </span>
                          ) : null}
                          <span className="branched-menu__label">{kid.label}</span>
                        </span>
                        {typeof kid.badge === 'number' && kid.badge > 0 ? (
                          <span className="branched-menu__badge">{kid.badge}</span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
};
