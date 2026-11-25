import React, { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { OperatorCommand } from '../types';

interface ConfirmModalProps {
  isOpen: boolean;
  command: OperatorCommand | null;
  zoneName: string;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  command,
  zoneName,
  onConfirm,
  onClose
}) => {
  const [reason, setReason] = useState('');

  if (!isOpen || !command) return null;

  const getDetails = () => {
    switch (command) {
      case 'MANUAL_GATE_CLOSE':
        return {
          title: 'Confirm: Close Barrier',
          warning: 'This will rotate the barrier to 0° and physically block incoming people from entering this corridor.',
          actionLabel: 'Close barrier now'
        };
      case 'MANUAL_GATE_OPEN':
        return {
          title: 'Confirm: Open Barrier',
          warning: 'This will rotate the barrier to 90° and allow people to enter the corridor.',
          actionLabel: 'Open barrier now'
        };
      case 'RESET_ZONE':
        return {
          title: 'Confirm: Reset This Sensor',
          warning: 'This will reset the risk state machine to Clear, reset the entrance and exit counts, and clear speed history.',
          actionLabel: 'Reset this sensor now'
        };
      case 'SILENCE_BUZZER':
        return {
          title: 'Confirm: Silence Buzzer',
          warning: 'This will silence the audible alert buzzer on the sensor node. Status indicator lights remain active.',
          actionLabel: 'Silence buzzer now'
        };
      default:
        return {
          title: 'Confirm Action',
          warning: 'This will send a command directly to the corridor sensor node.',
          actionLabel: 'Confirm command'
        };
    }
  };

  const details = getDetails();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(reason.trim() || 'Manual operator action via dashboard');
    setReason('');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div className="relative w-full max-w-md bg-surface-raised border border-border-strong rounded p-5 text-text-primary">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-text-secondary hover:text-text-primary p-1 rounded focus-visible:outline"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-start gap-3 mb-3">
          <div className="p-2 border border-border-strong rounded bg-surface-sunken text-status-building-text shrink-0">
            <AlertTriangle className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h3 id="confirm-modal-title" className="text-base font-bold text-text-primary">
              {details.title}
            </h3>
            <p className="text-xs text-text-secondary font-mono mt-0.5">Target: {zoneName}</p>
          </div>
        </div>

        <div className="p-3 bg-surface-sunken border border-border-subtle rounded text-xs text-text-primary mb-4 leading-relaxed">
          {details.warning}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label htmlFor="command-reason" className="block text-xs font-medium text-text-secondary mb-1">
              Reason for this action (required for audit log)
            </label>
            <input
              id="command-reason"
              type="text"
              required
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="e.g. Corridor cleared by ground marshal / routine queue rotation"
              className="w-full px-3 py-2 text-xs bg-surface-base border border-border-strong rounded text-text-primary placeholder:text-text-muted focus-visible:outline"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-subtle">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary bg-surface-sunken border border-border-subtle rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3.5 py-1.5 text-xs font-semibold text-text-primary bg-surface-sunken hover:bg-surface-raised border border-border-strong rounded"
            >
              {details.actionLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
