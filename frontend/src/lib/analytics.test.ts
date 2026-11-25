import { describe, it, expect } from 'vitest';
import { STATE_DESIGN, calculateFrontendRiskScore } from './tokens';
import {
  formatZoneStateSentence,
  formatAlertSentence,
  formatSystemActions,
  METRIC_EXPLANATIONS
} from './formatter';

describe('Design Tokens & Quad-Coded State Mapping (Color + Icon + Word + Shape)', () => {
  it('maps all states with plain English words and accessible colors', () => {
    expect(STATE_DESIGN.GREEN.label).toBe('Clear');
    expect(STATE_DESIGN.AMBER.label).toBe('Building up');
    expect(STATE_DESIGN.RED.label).toBe('Danger, barrier closed');
    expect(STATE_DESIGN.OFFLINE.label).toBe('Offline / Disconnected');
  });

  it('guarantees each state has a dedicated distinct icon to avoid color-only indicators', () => {
    expect(STATE_DESIGN.GREEN.iconName).toBe('Check');
    expect(STATE_DESIGN.AMBER.iconName).toBe('AlertTriangle');
    expect(STATE_DESIGN.RED.iconName).toBe('AlertOctagon');
    expect(STATE_DESIGN.OFFLINE.iconName).toBe('WifiOff');
  });

  it('guarantees distinct shape attributes for non-color identification', () => {
    expect(STATE_DESIGN.GREEN.shape).toBe('circle');
    expect(STATE_DESIGN.AMBER.shape).toBe('triangle');
    expect(STATE_DESIGN.RED.shape).toBe('octagon');
    expect(STATE_DESIGN.OFFLINE.shape).toBe('square');
  });
});

describe('Risk Score Calculation & Threshold Logic', () => {
  it('computes low risk score for normal flowing crowd (< 50, Clear threshold)', () => {
    const score = calculateFrontendRiskScore(0.2, 1.35, 0.05, 0);
    expect(score).toBeLessThan(50);
  });

  it('computes intermediate score (50 <= score < 75, Building up threshold)', () => {
    const score = calculateFrontendRiskScore(1.8, 0.65, 0.35, 1);
    expect(score).toBeGreaterThanOrEqual(50);
    expect(score).toBeLessThan(75);
  });

  it('computes critical score (>= 75, Danger threshold) for stalled crowded queue', () => {
    const score = calculateFrontendRiskScore(3.6, 0.08, 0.55, 2);
    expect(score).toBeGreaterThanOrEqual(75);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('clamps scores strictly between 0 and 100', () => {
    expect(calculateFrontendRiskScore(0, 2.0, 0, 0)).toBe(0);
    expect(calculateFrontendRiskScore(10.0, 0.0, 2.0, 10)).toBe(100);
  });
});

describe('Plain-Language Formatters', () => {
  it('formats zone state sentences clearly without jargon', () => {
    const clearSentence = formatZoneStateSentence('Gate A', 'GREEN', 24);
    expect(clearSentence).toContain('Gate A is clear with steady movement');
    expect(clearSentence).toContain('24 out of 100');

    const amberSentence = formatZoneStateSentence('Gate A', 'AMBER', 58);
    expect(amberSentence).toContain('Gate A is building up');
    expect(amberSentence).toContain('58 out of 100');

    const dangerSentence = formatZoneStateSentence('Gate A', 'RED', 82);
    expect(dangerSentence).toContain('Gate A is in danger. Movement has stalled and the barrier is closed');
    expect(dangerSentence).toContain('82 out of 100');
  });

  it('formats alert transitions into plain English sentences', () => {
    const sentence = formatAlertSentence('North Pavilion', 'GREEN', 'AMBER', '14:02:15', 52);
    expect(sentence).toBe('North Pavilion moved from Clear to Building up at 14:02:15 with risk 52.');
  });

  it('generates system actions list reflecting state and barrier', () => {
    const dangerActions = formatSystemActions('RED', 80, true, true);
    expect(dangerActions.some(a => a.includes('Physical gate barrier is closed at 0°'))).toBe(true);
    expect(dangerActions.some(a => a.includes('buzzer is sounding a continuous alert'))).toBe(true);

    const clearActions = formatSystemActions('GREEN', 20, false, false);
    expect(clearActions.some(a => a.includes('Gate barrier is fully open at 90°'))).toBe(true);
    expect(clearActions.some(a => a.includes('buzzer is silent'))).toBe(true);
  });

  it('provides plain explanations and units for every metric', () => {
    expect(METRIC_EXPLANATIONS.density.label).toBe('Crowd density: people per m²');
    expect(METRIC_EXPLANATIONS.density.unit).toBe('people/m²');

    expect(METRIC_EXPLANATIONS.avgSpeed.label).toBe('Average movement speed (m/s)');
    expect(METRIC_EXPLANATIONS.avgSpeed.unit).toBe('m/s');

    expect(METRIC_EXPLANATIONS.stopGoIndex.label).toBe('Stop-and-go index: how uneven movement is');
    expect(METRIC_EXPLANATIONS.score.label).toBe('Crowd risk score (0–100)');
  });
});
