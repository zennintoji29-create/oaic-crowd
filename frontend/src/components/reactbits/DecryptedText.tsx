import React, { useEffect, useState } from 'react';

interface DecryptedTextProps {
  text: string;
  className?: string;
  speedMs?: number;
}

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%*';

export const DecryptedText: React.FC<DecryptedTextProps> = ({
  text,
  className = '',
  speedMs = 28
}) => {
  const [display, setDisplay] = useState<string>(text);

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setDisplay(text);
      return;
    }

    let revealed = 0;
    const total = text.length;
    const interval = setInterval(() => {
      revealed += 1;
      const next = text
        .split('')
        .map((char, idx) => {
          if (char === ' ' || idx < revealed) return char;
          return GLYPHS[(idx + revealed * 3) % GLYPHS.length];
        })
        .join('');
      setDisplay(next);
      if (revealed >= total) {
        clearInterval(interval);
        setDisplay(text);
      }
    }, speedMs);

    return () => clearInterval(interval);
  }, [text, speedMs]);

  return <span className={className}>{display}</span>;
};
