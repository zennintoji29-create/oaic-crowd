import React, { useEffect, useRef, useState } from 'react';

interface BlurTextProps {
  text: string;
  className?: string;
  delay?: number;
  stepDelay?: number;
  as?: 'h1' | 'h2' | 'h3' | 'p' | 'span';
}

export const BlurText: React.FC<BlurTextProps> = ({
  text,
  className = '',
  delay = 40,
  stepDelay = 45,
  as: Tag = 'p'
}) => {
  const containerRef = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (visible) return;
    const node = containerRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [visible]);

  const words = text.split(' ');

  return (
    <Tag ref={containerRef as any} className={className}>
      {words.map((word, idx) => (
        <span
          key={`${word}-${idx}`}
          className="inline-block will-change-transform transition-all duration-500 ease-out"
          style={{
            transitionDelay: `${delay + idx * stepDelay}ms`,
            opacity: visible ? 1 : 0,
            filter: visible ? 'blur(0px)' : 'blur(8px)',
            transform: visible ? 'translate3d(0, 0, 0)' : 'translate3d(0, 10px, 0)'
          }}
        >
          {word}
          {idx < words.length - 1 ? '\u00A0' : ''}
        </span>
      ))}
    </Tag>
  );
};
