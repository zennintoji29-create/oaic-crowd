import React, { useState } from 'react';
import { Save } from 'lucide-react';
import { ZoneInfo } from '../types';
import { updateZoneConfig } from '../lib/api';

interface SetupTabProps {
  zones: ZoneInfo[];
  onZoneUpdated: (updated: ZoneInfo) => void;
}

export const SetupTab: React.FC<SetupTabProps> = ({ zones, onZoneUpdated }) => {
  const [selectedZoneId, setSelectedZoneId] = useState(zones[0]?.zoneId || 'zone-entry-a');
  const currentZone = zones.find(z => z.zoneId === selectedZoneId) || zones[0];

  const [formName, setFormName] = useState(currentZone?.name || '');
  const [formArea, setFormArea] = useState(currentZone?.areaSqM?.toString() || '24.0');
  const [formWidth, setFormWidth] = useState(currentZone?.corridorWidthM?.toString() || '4.0');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const handleZoneChange = (zoneId: string) => {
    setSelectedZoneId(zoneId);
    const z = zones.find(item => item.zoneId === zoneId);
    if (z) {
      setFormName(z.name);
      setFormArea(z.areaSqM.toString());
      setFormWidth(z.corridorWidthM.toString());
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentZone) return;

    try {
      const area = parseFloat(formArea);
      const width = parseFloat(formWidth);
      if (isNaN(area) || area <= 0 || isNaN(width) || width <= 0) {
        setStatusMsg('Area and corridor width must be positive numbers.');
        return;
      }

      const updated = await updateZoneConfig(currentZone.zoneId, {
        name: formName,
        areaSqM: area,
        corridorWidthM: width
      });

      onZoneUpdated(updated);
      setStatusMsg('Zone parameters saved successfully.');
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (err: any) {
      setStatusMsg(`Failed to save: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* 1. Zone Dimensions & Geometry Form */}
      <div className="flat-panel p-5">
        <h2 className="text-base font-semibold text-text-primary mb-1">
          Zone Dimensions and Geometry
        </h2>
        <p className="text-xs text-text-secondary mb-4">
          Configure the physical surface area and barricade width used by the firmware to calculate crowd density.
        </p>

        {/* Zone Selector */}
        <div className="mb-4">
          <label htmlFor="setup-zone-select" className="block text-xs font-medium text-text-secondary mb-1">
            Select zone to configure:
          </label>
          <select
            id="setup-zone-select"
            value={selectedZoneId}
            onChange={e => handleZoneChange(e.target.value)}
            className="w-full sm:w-64 bg-surface-raised border border-border-strong text-text-primary text-xs rounded px-2.5 py-1.5 focus-visible:outline"
            style={{ backgroundColor: 'var(--surface-raised)', color: 'var(--text-primary)' }}
          >
            {zones.map(z => (
              <option key={z.zoneId} value={z.zoneId}>
                {z.name}
              </option>
            ))}
          </select>
        </div>

        <form onSubmit={handleSave} className="space-y-3">
          <div>
            <label htmlFor="form-zone-name" className="block text-xs font-medium text-text-primary mb-0.5">
              Zone name
            </label>
            <input
              id="form-zone-name"
              type="text"
              required
              value={formName}
              onChange={e => setFormName(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-surface-base border border-border-strong rounded text-text-primary focus-visible:outline"
            />
            <p className="text-[11px] text-text-muted mt-1">
              Descriptive location shown on the dashboard and alerts, e.g. &quot;Main Temple Gate A&quot;.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="form-zone-area" className="block text-xs font-medium text-text-primary mb-0.5">
                Area in m²
              </label>
              <input
                id="form-zone-area"
                type="number"
                step="0.5"
                min="1"
                required
                value={formArea}
                onChange={e => setFormArea(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-surface-base border border-border-strong rounded font-mono text-text-primary focus-visible:outline"
              />
              <p className="text-[11px] text-text-muted mt-1">
                Total ground area monitored by radar. Used to calculate people per m².
              </p>
            </div>

            <div>
              <label htmlFor="form-zone-width" className="block text-xs font-medium text-text-primary mb-0.5">
                Corridor width in m
              </label>
              <input
                id="form-zone-width"
                type="number"
                step="0.1"
                min="0.5"
                required
                value={formWidth}
                onChange={e => setFormWidth(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-surface-base border border-border-strong rounded font-mono text-text-primary focus-visible:outline"
              />
              <p className="text-[11px] text-text-muted mt-1">
                Distance between queue barricades. Defines corridor lateral boundaries.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border-subtle">
            <span className="text-xs font-mono text-status-clear-text">{statusMsg}</span>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-sunken hover:bg-surface-raised border border-border-strong text-text-primary rounded text-xs font-semibold transition-colors focus-visible:outline"
            >
              <Save className="w-3.5 h-3.5 text-text-secondary" aria-hidden="true" />
              <span>Save settings</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
