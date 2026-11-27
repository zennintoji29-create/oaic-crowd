import React, { useEffect, useState } from 'react';
import { Save, Camera, ExternalLink, Sliders, Plus, Trash2, Bell, Send, Search } from 'lucide-react';
import { GateState, ZoneInfo } from '../types';
import {
  addGate,
  detectTelegramChat,
  fetchNotificationConfig,
  fetchSystemConfig,
  NotificationChannelConfig,
  removeGate,
  sendLiveTelegramReport,
  sendTestNotification,
  updateGateSettings,
  updateNotificationConfig,
  updateSystemConfig,
  updateZoneConfig
} from '../lib/api';
import { SpaceAiAdvisor } from './SpaceAiAdvisor';

interface SetupTabProps {
  zones: ZoneInfo[];
  gates?: GateState[];
  onZoneUpdated: (updated: ZoneInfo) => void;
  onGateUpdated?: (updated: GateState) => void;
  onGatesSynced?: (gates: GateState[]) => void;
  cameraStreamUrl?: string;
  onCameraUrlUpdated?: (url: string) => void;
}

export const SetupTab: React.FC<SetupTabProps> = ({
  zones,
  gates = [],
  onZoneUpdated,
  onGateUpdated,
  onGatesSynced,
  cameraStreamUrl: initialCameraUrl = '',
  onCameraUrlUpdated
}) => {
  const [selectedZoneId, setSelectedZoneId] = useState(zones[0]?.zoneId || 'zone-entry-a');
  const currentZone = zones.find(z => z.zoneId === selectedZoneId) || zones[0];

  const [formName, setFormName] = useState(currentZone?.name || '');
  const [formArea, setFormArea] = useState(currentZone?.areaSqM?.toString() || '24.0');
  const [formWidth, setFormWidth] = useState(currentZone?.corridorWidthM?.toString() || '4.0');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const [selectedGateId, setSelectedGateId] = useState(gates[0]?.id || 'gate-a');
  const currentGate = gates.find((g) => g.id === selectedGateId) || gates[0];
  const [gateNameInput, setGateNameInput] = useState(currentGate?.name || '');
  const [amberInput, setAmberInput] = useState(String(currentGate?.amberThreshold ?? 5));
  const [redInput, setRedInput] = useState(String(currentGate?.redThreshold ?? 10));
  const [gateCameraInput, setGateCameraInput] = useState(currentGate?.cameraStreamUrl || '');
  const [gateStatusMsg, setGateStatusMsg] = useState<string | null>(null);
  const [gateErrorMsg, setGateErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (currentGate) {
      setSelectedGateId(currentGate.id);
      setGateNameInput(currentGate.name || '');
      setAmberInput(String(currentGate.amberThreshold ?? 5));
      setRedInput(String(currentGate.redThreshold ?? 10));
      setGateCameraInput(currentGate.cameraStreamUrl || '');
    }
  }, [currentGate?.id]);

  const [cameraUrl, setCameraUrl] = useState(initialCameraUrl);
  const [cameraGateId, setCameraGateId] = useState(gates[0]?.id || '');
  const [cameraStatusMsg, setCameraStatusMsg] = useState<string | null>(null);
  const [cameraErrorMsg, setCameraErrorMsg] = useState<string | null>(null);
  const [testPreviewKey, setTestPreviewKey] = useState(0);
  const [showTestPreview, setShowTestPreview] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);

  useEffect(() => {
    setCameraUrl(initialCameraUrl);
  }, [initialCameraUrl]);

  useEffect(() => {
    fetchSystemConfig()
      .then(cfg => {
        if (cfg?.cameraStreamUrl !== undefined) {
          setCameraUrl(cfg.cameraStreamUrl || '');
        }
      })
      .catch(() => {});
  }, []);

  const [notifConfig, setNotifConfig] = useState<NotificationChannelConfig>({
    telegramEnabled: false,
    telegramBotToken: '',
    telegramChatId: '',
    whatsappEnabled: false,
    whatsappPhoneNumberId: '',
    whatsappAccessToken: '',
    whatsappRecipientPhone: '',
    notifyOnAmber: false,
    cooldownSeconds: 60
  });
  const [notifStatusMsg, setNotifStatusMsg] = useState<string | null>(null);
  const [notifErrorMsg, setNotifErrorMsg] = useState<string | null>(null);
  const [notifBusy, setNotifBusy] = useState(false);

  useEffect(() => {
    fetchNotificationConfig()
      .then((cfg) => {
        if (cfg) setNotifConfig(cfg);
      })
      .catch(() => {});
  }, []);

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
      {/* 0. AI Space & Crowd Capacity Advisor */}
      <SpaceAiAdvisor
        initialAreaSqM={currentZone?.areaSqM || 24}
        initialGateCount={gates.length || 2}
        onApplyRecommendation={async (rec) => {
          setFormArea(String(rec.areaSqM));
          setFormWidth(String(rec.corridorWidthM));
          setAmberInput(String(rec.amberThreshold));
          setRedInput(String(rec.redThreshold));
          try {
            if (currentZone) {
              const updatedZone = await updateZoneConfig(currentZone.zoneId, {
                areaSqM: rec.areaSqM,
                corridorWidthM: rec.corridorWidthM
              });
              onZoneUpdated(updatedZone);
            }
            if (currentGate) {
              const updatedGate = await updateGateSettings(currentGate.id, {
                amberThreshold: rec.amberThreshold,
                redThreshold: rec.redThreshold
              });
              onGateUpdated?.(updatedGate);
            }
            setGateStatusMsg('AI-recommended Green / Amber / Red limits applied.');
          } catch (err: any) {
            setGateErrorMsg(err?.message || 'Failed to apply AI limits');
          }
        }}
        applyButtonLabel="Apply AI Limits to Current Zone & Gate"
      />

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

      {/* 2. Camera Localhost / Stream Link */}
      <div className="flat-panel p-5">
        <div className="flex items-center gap-2 mb-1">
          <Camera className="w-4 h-4 text-[#18e299]" aria-hidden="true" />
          <h2 className="text-base font-semibold text-text-primary">
            USB Camera / Localhost Stream Link
          </h2>
        </div>
        <p className="text-xs text-text-secondary mb-4">
          Enter the local URL where your connected USB camera + YOLO service streams frames (no browser camera permission required).
        </p>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setCameraErrorMsg(null);
            setCameraStatusMsg(null);
            const trimmed = cameraUrl.trim();
            if (trimmed && !/^https?:\/\/.+/i.test(trimmed)) {
              setCameraErrorMsg('Camera link must start with http:// or https://');
              return;
            }
            try {
              const saved = await updateSystemConfig({ cameraStreamUrl: trimmed });
              const nextUrl = saved?.cameraStreamUrl ?? trimmed;
              setCameraUrl(nextUrl);
              onCameraUrlUpdated?.(nextUrl);
              // If a specific gate is selected, also save to that gate's stream URL
              if (cameraGateId && trimmed) {
                const updatedGate = await updateGateSettings(cameraGateId, { cameraStreamUrl: trimmed });
                onGateUpdated?.(updatedGate);
              }
              setCameraStatusMsg(`Camera stream link saved${cameraGateId ? ' & assigned to gate.' : '.'}`);
              setTimeout(() => setCameraStatusMsg(null), 3000);
            } catch (err: any) {
              setCameraErrorMsg(`Failed to save link: ${err.message}`);
            }
          }}
          className="space-y-3"
        >
          {/* Gate Assignment Dropdown */}
          {gates.length > 0 && (
            <div>
              <label htmlFor="setup-camera-gate" className="block text-xs font-medium text-text-primary mb-1">
                Assign camera feed to gate
              </label>
              <select
                id="setup-camera-gate"
                value={cameraGateId}
                onChange={e => setCameraGateId(e.target.value)}
                className="w-full sm:w-72 bg-surface-base border border-border-strong text-text-primary text-xs rounded px-2.5 py-1.5 focus-visible:outline"
              >
                <option value="">— Global (all gates) —</option>
                {gates.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
              <p className="text-[11px] text-text-muted mt-1">
                Telemetry from this camera will update the selected gate's people count.
                {cameraGateId && (
                  <span className="ml-1 text-[#18e299] font-mono">
                    Run: python stage1_tracker.py --zone {gates.find(g => g.id === cameraGateId)?.zoneId || cameraGateId}
                  </span>
                )}
              </p>
            </div>
          )}
          <div>
            <label htmlFor="setup-camera-url" className="block text-xs font-medium text-text-primary mb-1">
              Camera Localhost / Stream URL
            </label>
            <input
              id="setup-camera-url"
              type="url"
              value={cameraUrl}
              onChange={(e) => {
                setCameraUrl(e.target.value);
                setShowTestPreview(false);
                setPreviewFailed(false);
              }}
              placeholder="http://localhost:5000/video_feed"
              className="w-full px-3 py-1.5 text-xs bg-surface-base border border-border-strong rounded font-mono text-text-primary focus-visible:outline"
            />
            <p className="text-[11px] text-text-muted mt-1">
              Displayed inside the dashboard&apos;s Camera + YOLO panel with a direct open link.
            </p>
          </div>

          {cameraErrorMsg && (
            <p role="alert" className="text-xs text-rose-400">
              {cameraErrorMsg}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!cameraUrl.trim()}
              onClick={() => {
                setCameraErrorMsg(null);
                setPreviewFailed(false);
                setShowTestPreview(true);
                setTestPreviewKey((k) => k + 1);
              }}
              className="px-3 py-1.5 bg-surface-base hover:bg-surface-raised border border-border-strong disabled:opacity-40 text-text-primary rounded text-xs font-medium transition-colors"
            >
              Test Link Preview
            </button>
            {cameraUrl.trim() && /^https?:\/\/.+/i.test(cameraUrl.trim()) && (
              <a
                href={cameraUrl.trim()}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface-base hover:bg-surface-raised border border-border-strong text-[#18e299] rounded text-xs font-medium transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Open Camera Link</span>
              </a>
            )}
          </div>

          {showTestPreview && cameraUrl.trim() && (
            <div className="rounded-lg border border-border-subtle bg-black/50 overflow-hidden p-2">
              {!previewFailed ? (
                <img
                  key={testPreviewKey}
                  src={cameraUrl.trim()}
                  alt="Configured camera localhost stream"
                  onError={() => setPreviewFailed(true)}
                  className="w-full max-h-56 object-contain rounded"
                />
              ) : (
                <p className="text-xs text-amber-400 py-4 text-center">
                  Preview could not load inline (CORS or stream server offline). You can still save the URL and open it directly.
                </p>
              )}
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-border-subtle">
            <span className="text-xs font-mono text-status-clear-text">{cameraStatusMsg}</span>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-sunken hover:bg-surface-raised border border-border-strong text-text-primary rounded text-xs font-semibold transition-colors focus-visible:outline"
            >
              <Save className="w-3.5 h-3.5 text-text-secondary" aria-hidden="true" />
              <span>Save Camera Link</span>
            </button>
          </div>
        </form>
      </div>

      {/* 3. Post-Setup Gate Thresholds, Per-Gate Camera Links & Add/Remove Gate */}
      {gates.length > 0 && (
        <div className="flat-panel p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#18e299]" aria-hidden="true" />
                <h2 className="text-base font-semibold text-text-primary">
                  Gate Thresholds &amp; Per-Gate Camera Feeds
                </h2>
              </div>
              <p className="text-xs text-text-secondary mt-0.5">
                Tune Amber/Red thresholds, assign dedicated localhost camera links per gate, or add/remove gates (1–4).
              </p>
            </div>
            {gates.length < 4 && (
              <button
                type="button"
                onClick={async () => {
                  setGateErrorMsg(null);
                  setGateStatusMsg(null);
                  try {
                    const res = await addGate({
                      name: `Gate ${String.fromCharCode(65 + gates.length)}`,
                      amberThreshold: 5,
                      redThreshold: 10
                    });
                    onGatesSynced?.(res.gates);
                    setSelectedGateId(res.gate.id);
                    setGateNameInput(res.gate.name);
                    setAmberInput(String(res.gate.amberThreshold));
                    setRedInput(String(res.gate.redThreshold));
                    setGateCameraInput(res.gate.cameraStreamUrl || '');
                    setGateStatusMsg(`Added ${res.gate.name}.`);
                  } catch (err: any) {
                    setGateErrorMsg(err?.message || 'Could not add gate');
                  }
                }}
                className="min-h-[44px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#18e299]/10 border border-[#18e299]/35 text-[#18e299] text-xs font-semibold hover:bg-[#18e299]/20"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Add Gate</span>
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {gates.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => {
                  setSelectedGateId(g.id);
                  setGateNameInput(g.name);
                  setAmberInput(String(g.amberThreshold));
                  setRedInput(String(g.redThreshold));
                  setGateCameraInput(g.cameraStreamUrl || '');
                  setGateErrorMsg(null);
                  setGateStatusMsg(null);
                }}
                className={`min-h-[40px] px-3 py-1.5 rounded text-xs font-medium border transition-colors ${
                  selectedGateId === g.id
                    ? 'bg-[#18e299]/15 border-[#18e299] text-[#18e299]'
                    : 'bg-surface-base border-border-subtle text-text-secondary hover:text-white'
                }`}
              >
                {g.name}
              </button>
            ))}
          </div>

          {currentGate && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setGateErrorMsg(null);
                setGateStatusMsg(null);
                const amber = parseInt(amberInput, 10);
                const red = parseInt(redInput, 10);
                if (!Number.isInteger(amber) || amber < 1 || !Number.isInteger(red) || red <= amber || red > 200) {
                  setGateErrorMsg('Red threshold must be strictly greater than Amber threshold (max 200).');
                  return;
                }
                const cam = gateCameraInput.trim();
                if (cam && !/^https?:\/\/.+/.test(cam)) {
                  setGateErrorMsg('Per-gate camera URL must start with http:// or https://');
                  return;
                }
                try {
                  const updated = await updateGateSettings(currentGate.id, {
                    name: gateNameInput.trim() || currentGate.name,
                    amberThreshold: amber,
                    redThreshold: red,
                    cameraStreamUrl: cam
                  });
                  onGateUpdated?.(updated);
                  setGateStatusMsg('Gate thresholds and camera link saved.');
                  setTimeout(() => setGateStatusMsg(null), 3000);
                } catch (err: any) {
                  setGateErrorMsg(err?.message || 'Failed to save gate settings');
                }
              }}
              className="space-y-3"
            >
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label htmlFor="gate-edit-name" className="block text-xs font-medium text-text-primary mb-1">
                    Gate Name
                  </label>
                  <input
                    id="gate-edit-name"
                    type="text"
                    required
                    value={gateNameInput}
                    onChange={(e) => setGateNameInput(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-surface-base border border-border-strong rounded text-text-primary"
                  />
                </div>
                <div>
                  <label htmlFor="gate-edit-green" className="block text-xs font-medium text-emerald-300 mb-1">
                    Green Safe Max (&le;)
                  </label>
                  <input
                    id="gate-edit-green"
                    type="number"
                    min={0}
                    max={149}
                    value={Math.max(0, (parseInt(amberInput, 10) || 1) - 1)}
                    onChange={(e) => {
                      const gMax = Math.max(0, Math.min(149, parseInt(e.target.value, 10) || 0));
                      const nextAmber = gMax + 1;
                      setAmberInput(String(nextAmber));
                      if ((parseInt(redInput, 10) || 0) <= nextAmber) {
                        setRedInput(String(nextAmber + 2));
                      }
                    }}
                    className="w-full px-3 py-1.5 text-xs bg-surface-base border border-emerald-500/40 rounded font-mono text-emerald-300"
                  />
                </div>
                <div>
                  <label htmlFor="gate-edit-amber" className="block text-xs font-medium text-amber-300 mb-1">
                    Amber Threshold (count)
                  </label>
                  <input
                    id="gate-edit-amber"
                    type="number"
                    min={1}
                    max={150}
                    required
                    value={amberInput}
                    onChange={(e) => setAmberInput(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-surface-base border border-amber-500/40 rounded font-mono text-amber-300"
                  />
                </div>
                <div>
                  <label htmlFor="gate-edit-red" className="block text-xs font-medium text-rose-300 mb-1">
                    Red Lock Threshold (count)
                  </label>
                  <input
                    id="gate-edit-red"
                    type="number"
                    min={2}
                    max={200}
                    required
                    value={redInput}
                    onChange={(e) => setRedInput(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-surface-base border border-rose-500/40 rounded font-mono text-rose-300"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="gate-edit-camera" className="block text-xs font-medium text-text-primary mb-1">
                  Dedicated Gate Camera Stream URL (optional)
                </label>
                <input
                  id="gate-edit-camera"
                  type="url"
                  value={gateCameraInput}
                  onChange={(e) => setGateCameraInput(e.target.value)}
                  placeholder="http://localhost:5001/video_feed (falls back to global link if blank)"
                  className="w-full px-3 py-1.5 text-xs bg-surface-base border border-border-strong rounded font-mono text-text-primary"
                />
              </div>

              {gateErrorMsg && (
                <p role="alert" className="text-xs text-rose-400">
                  {gateErrorMsg}
                </p>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border-subtle">
                <span className="text-xs font-mono text-status-clear-text">{gateStatusMsg}</span>
                <div className="flex items-center gap-2">
                  {gates.length > 1 && (
                    <button
                      type="button"
                      onClick={async () => {
                        setGateErrorMsg(null);
                        try {
                          const nextGates = await removeGate(currentGate.id);
                          onGatesSynced?.(nextGates);
                          if (nextGates[0]) {
                            setSelectedGateId(nextGates[0].id);
                          }
                        } catch (err: any) {
                          setGateErrorMsg(err?.message || 'Failed to remove gate');
                        }
                      }}
                      className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-status-danger-border bg-status-danger-bg text-status-danger-text text-xs font-semibold"
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Remove Gate</span>
                    </button>
                  )}
                  <button
                    type="submit"
                    className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface-sunken hover:bg-surface-raised border border-border-strong text-text-primary rounded text-xs font-semibold transition-colors"
                  >
                    <Save className="w-3.5 h-3.5 text-text-secondary" aria-hidden="true" />
                    <span>Save Gate Settings</span>
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      )}

      {/* 4. Alert Notifications (Telegram Bot & Meta WhatsApp Cloud API) */}
      <div className="flat-panel p-5 space-y-4">
        <div>
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-[#18e299]" aria-hidden="true" />
            <h2 className="text-base font-semibold text-text-primary">
              Alert Notifications (Telegram &amp; WhatsApp)
            </h2>
          </div>
          <p className="text-xs text-text-secondary mt-0.5">
            Automatically send instant RED (and optional AMBER) crowd alerts to your phone with a 60s anti-spam cooldown.
          </p>
        </div>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setNotifErrorMsg(null);
            setNotifStatusMsg(null);
            setNotifBusy(true);
            try {
              const saved = await updateNotificationConfig(notifConfig);
              setNotifConfig(saved);
              setNotifStatusMsg('Notification settings saved.');
              setTimeout(() => setNotifStatusMsg(null), 3000);
            } catch (err: any) {
              setNotifErrorMsg(err?.message || 'Failed to save notification settings');
            } finally {
              setNotifBusy(false);
            }
          }}
          className="space-y-4"
        >
          {/* Telegram Bot Section */}
          <div className="p-3.5 rounded border border-border-subtle bg-surface-sunken/50 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-text-primary">Telegram Bot API (Free &amp; Unlimited)</span>
              <label className="inline-flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifConfig.telegramEnabled}
                  onChange={(e) => setNotifConfig((prev) => ({ ...prev, telegramEnabled: e.target.checked }))}
                  className="accent-[#18e299]"
                />
                <span>Enable Telegram</span>
              </label>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label htmlFor="notif-tg-token" className="block text-[11px] font-medium text-text-secondary mb-1">
                  Bot Token (from @BotFather)
                </label>
                <input
                  id="notif-tg-token"
                  type="password"
                  value={notifConfig.telegramBotToken}
                  onChange={(e) => setNotifConfig((prev) => ({ ...prev, telegramBotToken: e.target.value }))}
                  placeholder="1234567890:AA..."
                  className="w-full px-3 py-1.5 text-xs bg-surface-base border border-border-strong rounded font-mono text-text-primary"
                />
              </div>
              <div>
                <label htmlFor="notif-tg-chat" className="block text-[11px] font-medium text-text-secondary mb-1">
                  Chat ID (send &quot;hi&quot; to your bot, then click Detect)
                </label>
                <div className="flex gap-2">
                  <input
                    id="notif-tg-chat"
                    type="text"
                    value={notifConfig.telegramChatId}
                    onChange={(e) => setNotifConfig((prev) => ({ ...prev, telegramChatId: e.target.value }))}
                    placeholder="e.g. 987654321"
                    className="flex-1 px-3 py-1.5 text-xs bg-surface-base border border-border-strong rounded font-mono text-text-primary"
                  />
                  <button
                    type="button"
                    disabled={notifBusy || !notifConfig.telegramBotToken.trim()}
                    onClick={async () => {
                      setNotifErrorMsg(null);
                      setNotifStatusMsg(null);
                      setNotifBusy(true);
                      try {
                        const detected = await detectTelegramChat(notifConfig.telegramBotToken);
                        setNotifConfig((prev) => ({
                          ...prev,
                          telegramChatId: detected.chatId,
                          telegramEnabled: true
                        }));
                        setNotifStatusMsg(`Detected Chat ID ${detected.chatId} (${detected.label}).`);
                      } catch (err: any) {
                        setNotifErrorMsg(err?.message || 'Could not detect Chat ID');
                      } finally {
                        setNotifBusy(false);
                      }
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-border-strong bg-surface-base hover:bg-surface-raised text-xs font-medium text-[#18e299] disabled:opacity-40"
                  >
                    <Search className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Detect</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Meta WhatsApp Cloud API Section (Optional) */}
          <details className="p-3.5 rounded border border-border-subtle bg-surface-sunken/30">
            <summary className="flex items-center justify-between cursor-pointer text-xs font-semibold text-text-secondary">
              <span>Optional: Meta WhatsApp Cloud API (1,000 free msgs/mo)</span>
              <span className="text-[11px] font-normal text-text-muted">Click to expand</span>
            </summary>
            <div className="mt-3 space-y-3">
              <div className="flex items-center justify-end">
                <label className="inline-flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifConfig.whatsappEnabled}
                    onChange={(e) => setNotifConfig((prev) => ({ ...prev, whatsappEnabled: e.target.checked }))}
                    className="accent-[#18e299]"
                  />
                  <span>Enable WhatsApp</span>
                </label>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="notif-wa-phoneid" className="block text-[11px] font-medium text-text-secondary mb-1">
                    Phone Number ID
                  </label>
                  <input
                    id="notif-wa-phoneid"
                    type="text"
                    value={notifConfig.whatsappPhoneNumberId}
                    onChange={(e) => setNotifConfig((prev) => ({ ...prev, whatsappPhoneNumberId: e.target.value }))}
                    placeholder="Meta Phone Number ID"
                    className="w-full px-3 py-1.5 text-xs bg-surface-base border border-border-strong rounded font-mono text-text-primary"
                  />
                </div>
                <div>
                  <label htmlFor="notif-wa-token" className="block text-[11px] font-medium text-text-secondary mb-1">
                    Access Token
                  </label>
                  <input
                    id="notif-wa-token"
                    type="password"
                    value={notifConfig.whatsappAccessToken}
                    onChange={(e) => setNotifConfig((prev) => ({ ...prev, whatsappAccessToken: e.target.value }))}
                    placeholder="EAAG..."
                    className="w-full px-3 py-1.5 text-xs bg-surface-base border border-border-strong rounded font-mono text-text-primary"
                  />
                </div>
                <div>
                  <label htmlFor="notif-wa-to" className="block text-[11px] font-medium text-text-secondary mb-1">
                    Recipient WhatsApp (with country code)
                  </label>
                  <input
                    id="notif-wa-to"
                    type="text"
                    value={notifConfig.whatsappRecipientPhone}
                    onChange={(e) => setNotifConfig((prev) => ({ ...prev, whatsappRecipientPhone: e.target.value }))}
                    placeholder="919876543210"
                    className="w-full px-3 py-1.5 text-xs bg-surface-base border border-border-strong rounded font-mono text-text-primary"
                  />
                </div>
              </div>
            </div>
          </details>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="inline-flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
              <input
                type="checkbox"
                checked={notifConfig.notifyOnAmber}
                onChange={(e) => setNotifConfig((prev) => ({ ...prev, notifyOnAmber: e.target.checked }))}
                className="accent-[#18e299]"
              />
              <span>Also notify on AMBER warning (default: RED critical only)</span>
            </label>
          </div>

          {notifErrorMsg && (
            <p role="alert" className="text-xs text-rose-400">
              {notifErrorMsg}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border-subtle">
            <span className="text-xs font-mono text-status-clear-text">{notifStatusMsg}</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={notifBusy}
                onClick={async () => {
                  setNotifErrorMsg(null);
                  setNotifStatusMsg(null);
                  setNotifBusy(true);
                  try {
                    const res = await sendLiveTelegramReport(notifConfig);
                    const parts: string[] = [];
                    if (res.results?.telegram) {
                      parts.push(res.results.telegram.ok ? 'Live gate report sent to Telegram!' : `Telegram failed: ${res.results.telegram.error}`);
                    }
                    if (res.results?.whatsapp) {
                      parts.push(res.results.whatsapp.ok ? 'Live gate report sent to WhatsApp!' : `WhatsApp failed: ${res.results.whatsapp.error}`);
                    }
                    setNotifStatusMsg(parts.join(' | ') || 'Report sent.');
                  } catch (err: any) {
                    setNotifErrorMsg(err?.message || 'Failed to send live gate report');
                  } finally {
                    setNotifBusy(false);
                  }
                }}
                className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-border-strong bg-surface-base hover:bg-surface-raised text-text-primary text-xs font-semibold disabled:opacity-40"
              >
                <Send className="w-3.5 h-3.5 text-[#18e299]" aria-hidden="true" />
                <span>Send Live Gate Report</span>
              </button>
              <button
                type="button"
                disabled={notifBusy}
                onClick={async () => {
                  setNotifErrorMsg(null);
                  setNotifStatusMsg(null);
                  setNotifBusy(true);
                  try {
                    const res = await sendTestNotification(notifConfig);
                    const parts: string[] = [];
                    if (res.results?.telegram) {
                      parts.push(res.results.telegram.ok ? 'Telegram sent!' : `Telegram failed: ${res.results.telegram.error}`);
                    }
                    if (res.results?.whatsapp) {
                      parts.push(res.results.whatsapp.ok ? 'WhatsApp sent!' : `WhatsApp failed: ${res.results.whatsapp.error}`);
                    }
                    setNotifStatusMsg(parts.join(' | ') || 'Test completed.');
                  } catch (err: any) {
                    setNotifErrorMsg(err?.message || 'Failed to send test alert');
                  } finally {
                    setNotifBusy(false);
                  }
                }}
                className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-[#18e299]/40 bg-[#18e299]/10 hover:bg-[#18e299]/20 text-[#18e299] text-xs font-semibold disabled:opacity-40"
              >
                <Send className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Send Test Alert</span>
              </button>
              <button
                type="submit"
                disabled={notifBusy}
                className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface-sunken hover:bg-surface-raised border border-border-strong text-text-primary rounded text-xs font-semibold transition-colors disabled:opacity-40"
              >
                <Save className="w-3.5 h-3.5 text-text-secondary" aria-hidden="true" />
                <span>Save Alert Settings</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
