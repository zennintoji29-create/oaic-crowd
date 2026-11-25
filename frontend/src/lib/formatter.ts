import { CrowdState } from '../types';

export interface MetricExplanation {
  label: string;
  unit: string;
  explanation: string;
}

export const METRIC_EXPLANATIONS: Record<string, MetricExplanation> = {
  density: {
    label: 'Crowd density: people per m²',
    unit: 'people/m²',
    explanation: 'Estimated number of people standing or moving in each square metre of the corridor zone.'
  },
  avgSpeed: {
    label: 'Average movement speed (m/s)',
    unit: 'm/s',
    explanation: 'Mean walking speed of detected people moving along the corridor. Normal pace is above 1.0 m/s.'
  },
  stopGoIndex: {
    label: 'Stop-and-go index: how uneven movement is',
    unit: 'σ (m/s)',
    explanation: 'Standard deviation of crowd speed over 20 seconds. Higher numbers indicate sudden halting and pushing shockwaves.'
  },
  score: {
    label: 'Crowd risk score (0–100)',
    unit: '/ 100',
    explanation: 'Calculated from crowd density (40%), slow movement (30%), stop-and-go turbulence (20%), and clustering (10%).'
  }
};

/**
 * Generates a plain-sentence description of the current zone state
 */
export function formatZoneStateSentence(zoneName: string, state: CrowdState, score: number): string {
  switch (state) {
    case 'GREEN':
      return `${zoneName} is clear with steady movement. Risk score is ${score.toFixed(0)} out of 100.`;
    case 'AMBER':
      return `${zoneName} is building up. Movement is slowing down and risk score has reached ${score.toFixed(0)} out of 100.`;
    case 'RED':
      return `${zoneName} is in danger. Movement has stalled and the barrier is closed. Risk score is ${score.toFixed(0)} out of 100.`;
    case 'OFFLINE':
    default:
      return `${zoneName} sensor is disconnected or waiting for radar data.`;
  }
}

/**
 * Generates a plain sentence for an alert transition
 */
export function formatAlertSentence(zoneName: string, fromState: string, toState: string, timeStr: string, score: number): string {
  const fromWord = fromState === 'GREEN' ? 'Clear' : fromState === 'AMBER' ? 'Building up' : fromState === 'RED' ? 'Danger' : fromState;
  const toWord = toState === 'GREEN' ? 'Clear' : toState === 'AMBER' ? 'Building up' : toState === 'RED' ? 'Danger, barrier closed' : toState;
  return `${zoneName} moved from ${fromWord} to ${toWord} at ${timeStr} with risk ${score.toFixed(0)}.`;
}

/**
 * Generates the "What the system is doing now" plain English list
 */
export function formatSystemActions(state: CrowdState, _score: number, barrierClosed: boolean, _buzzerActive: boolean): string[] {
  const actions: string[] = [];

  if (state === 'RED' || barrierClosed) {
    actions.push(`Physical gate barrier is closed at 0° to prevent more people entering.`);
    actions.push(`Warning buzzer is sounding a continuous alert at the gate entrance.`);
    actions.push(`Red warning indicator is flashing at 2 Hz beside the barrier.`);
  } else if (state === 'AMBER') {
    actions.push(`Yellow caution indicator is lit to advise gate marshals to slow incoming flow.`);
    actions.push(`Gate barrier remains open at 90° while queue conditions are observed.`);
    actions.push(`Buzzer sounded a single warning tone when entering Building up state.`);
  } else if (state === 'GREEN') {
    actions.push(`Green indicator is lit showing normal laminar queue progression.`);
    actions.push(`Gate barrier is fully open at 90° allowing unhindered passage.`);
    actions.push(`Audible buzzer is silent.`);
  } else {
    actions.push(`System is in standby awaiting telemetry connection from ESP32 node.`);
  }

  return actions;
}

