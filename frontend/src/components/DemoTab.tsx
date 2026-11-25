import React, { useState } from 'react';
import { Camera, Zap } from 'lucide-react';
import { HardwareActuatorState } from '../types';

interface DemoTabProps {
  hardware: HardwareActuatorState | null;
  onRefreshHardware?: () => void;
}

interface ComponentDossier {
  icon: string;
  title: string;
  subtitle: string;
  badge: string;
  badgeClass: string;
  desc: string;
  model: string;
  interface: string;
  inference: string;
  failover: string;
  pin: string;
}

const COMPONENT_DETAILS: Record<string, ComponentDossier> = {
  webcam: {
    icon: 'CAM',
    title: 'USB WEBCAM (AI VISION)',
    subtitle: 'Primary Optical Sensor Node',
    badge: 'PRIMARY',
    badgeClass: 'bg-emerald-950 text-emerald-400 border-emerald-700',
    desc: 'Captures live video for real-time person detection with Ultralytics YOLO11n and ByteTrack multi-object tracking. Runs on NVIDIA RTX 3050 CUDA GPU at ~17ms per frame.',
    model: 'UVC HD USB Camera (30/60 FPS)',
    interface: 'USB 2.0 / DirectShow / OpenCV',
    inference: '~17.2 ms (CUDA:0 GPU Acceleration)',
    failover: 'Monitored by 4.5s watchdog. If disconnected, automatically switches to Radar + ToF.',
    pin: 'Direct Host USB Port'
  },
  traffic_leds: {
    icon: 'LED',
    title: '3-LIGHT TRAFFIC SIGNAL (RGB)',
    subtitle: 'Visual Crowd Warning Actuator',
    badge: 'ACTUATOR',
    badgeClass: 'bg-cyan-950 text-cyan-400 border-cyan-700',
    desc: 'Provides immediate intuitive safety feedback to pedestrians. Controlled automatically: GREEN (<5 people, free movement), YELLOW (5-9 people, caution), RED (10+ people, gate lockdown).',
    model: '3-in-1 High-Luminosity RGB LED (Common Cathode/Anode)',
    interface: 'Hardware PWM (Channels 0, 1, 2 @ 5kHz)',
    inference: 'Zero Latency (< 1 ms)',
    failover: 'Continues operating in Failover Mode driven by 24GHz radar energy metrics.',
    pin: 'Red: GPIO 25 | Green: GPIO 26 | Blue: GPIO 27'
  },
  ld2410_radar: {
    icon: 'RADAR',
    title: 'HLK-LD2410 24GHz RADAR',
    subtitle: 'Millimeter-Wave Presence & Energy Sensor',
    badge: 'MVP SENSOR',
    badgeClass: 'bg-blue-950 text-blue-400 border-blue-700',
    desc: 'FMCW 24GHz millimeter-wave radar that detects stationary and moving human bodies up to 6 meters. Penetrates dust, smoke, and complete darkness without optical blinding.',
    model: 'Hi-Link HLK-LD2410C (24GHz Band)',
    interface: 'UART Serial (256000 baud) / GPIO',
    inference: '10 Hz Continuous FMCW Chirp',
    failover: 'MAIN MVP FALLBACK: Estimates crowd pressure from gate energy levels when camera fails.',
    pin: 'TX: GPIO 16 (RX2) | RX: GPIO 17 (TX2)'
  },
  tof_sensor: {
    icon: 'TOF',
    title: 'TOF200C / VL53L0X ToF SENSOR',
    subtitle: 'Laser Time-of-Flight Distance Meter',
    badge: 'PRECISION',
    badgeClass: 'bg-amber-950 text-amber-400 border-amber-700',
    desc: 'Emits 940nm VCSEL laser pulses to compute distance with sub-millimeter precision up to 2000mm. Detects bottleneck crowd compression at the gate entryway.',
    model: 'STMicroelectronics VL53L0X / TOF200C',
    interface: 'I2C Bus (Address 0x29)',
    inference: '30ms Range Profile Sample Rate',
    failover: 'Verifies physical crowd proximity when camera field of view is blocked.',
    pin: 'SDA: GPIO 21 | SCL: GPIO 22'
  },
  servo_gate: {
    icon: 'SERVO',
    title: 'SG90 MICRO SERVO GATE',
    subtitle: 'Physical Inflow Metering Actuator',
    badge: 'CRUSH SHIELD',
    badgeClass: 'bg-amber-950 text-amber-400 border-amber-700',
    desc: 'Rotates physical barrier arm across corridor. 90° = Unrestricted Passage, 45° = Metered Inflow (crowd regulation), 0° = Closed & Locked to eliminate crowd crush danger.',
    model: 'TowerPro SG90 9g Micro Servo',
    interface: '50Hz PWM Signal (LEDC Peripheral)',
    inference: '500-2500μs Pulse Width Control',
    failover: 'Automatically closes to 0° if severe crowd density is registered by radar.',
    pin: 'Signal PWM: GPIO 13'
  },
  ir_beam: {
    icon: 'IR',
    title: 'INFRARED BEAM TRIPWIRE',
    subtitle: 'Unidirectional Boundary Line Sensor',
    badge: 'HARDWARE LINE',
    badgeClass: 'bg-orange-950 text-orange-400 border-orange-700',
    desc: 'Active photo-electric beam crossing between Breadboard 2 (TX) and Breadboard 1 (RX). Increments physical passage count whenever pedestrian breaks the beam.',
    model: 'Through-Beam Infrared Phototransistor Pair',
    interface: 'GPIO Hardware Interrupt (FALLING edge)',
    inference: '< 5 ms Interrupt Response Time',
    failover: 'Provides ground-truth cumulative crossing counts independently of the camera.',
    pin: 'IR Receiver: GPIO 14 (Internal Pull-Up)'
  },
  breadboard_1: {
    icon: 'MCU',
    title: 'BREADBOARD 1 (MASTER CONTROLLER)',
    subtitle: 'Primary Physical Node (Right Side)',
    badge: 'ESP32 MASTER',
    badgeClass: 'bg-emerald-950 text-emerald-400 border-emerald-700',
    desc: 'Central controller housing ESP32 Master, Traffic Light LEDs, SG90 Servo Gate, LD2410 Radar, ToF sensor, and OLED display. Bridges to dashboard server via WiFi/Serial.',
    model: 'ESP32-WROOM-32D 38-Pin Module',
    interface: 'WiFi 802.11 b/g/n + USB Serial 115200',
    inference: 'FreeRTOS Dual Core 240MHz',
    failover: 'Autonomous internal state machine takes over control if laptop disconnects.',
    pin: 'Pins: GPIO 12, 13, 14, 16, 17, 21, 22, 25, 26, 27'
  },
  breadboard_2: {
    icon: 'NODE',
    title: 'BREADBOARD 2 (PERIMETER SLAVE)',
    subtitle: 'Remote Boundary Node (Left Side)',
    badge: 'ESP32 SLAVE',
    badgeClass: 'bg-rose-950 text-rose-400 border-rose-700',
    desc: 'Dedicated perimeter station across corridor. Reads IR beam interruptions and relays boundary events across corridor to Master using Ra-02 LoRa.',
    model: 'ESP32-WROOM-32D Dev Board',
    interface: 'SPI Bus (LoRa) + GPIO Interrupt',
    inference: 'Low-power battery / USB 5V',
    failover: 'Transmits packet bursts to Master; buffered offline if link fades.',
    pin: 'Pins: GPIO 5 (NSS), 18 (SCK), 19 (MISO), 23 (MOSI)'
  },
  lora_master: {
    icon: 'RF',
    title: 'Ra-02 LoRa MODULE (MASTER)',
    subtitle: 'Long-Range Wireless Transceiver',
    badge: 'LORA LINK',
    badgeClass: 'bg-cyan-950 text-cyan-400 border-cyan-700',
    desc: 'Semtech SX1278 transceiver on Breadboard 1. Receives perimeter beam triggers and sensor alerts without needing common WiFi routers or corridor cables.',
    model: 'Ai-Thinker Ra-02 (SX1278 433MHz)',
    interface: 'SPI Bus (up to 10 Mbps)',
    inference: 'Spread Spectrum Chirp (SF7 / BW 125kHz)',
    failover: 'Operates in emergency communications mode if WiFi router goes down.',
    pin: 'SPI: MOSI 23, MISO 19, SCK 18, CS 5, RST 4'
  },
  lora_slave: {
    icon: 'RF',
    title: 'Ra-02 LoRa MODULE (SLAVE)',
    subtitle: 'Remote Transmitter Node',
    badge: 'LORA LINK',
    badgeClass: 'bg-cyan-950 text-cyan-400 border-cyan-700',
    desc: 'Semtech SX1278 transmitter on Breadboard 2. Broadcasts instantaneous interrupt packets whenever pedestrians break the IR beam line across the corridor.',
    model: 'Ai-Thinker Ra-02 (SX1278 433MHz)',
    interface: 'SPI Bus (NSS: GPIO 5)',
    inference: '+20 dBm Output Power',
    failover: 'Guarantees reliable multi-hundred meter range even through walls and crowd bodies.',
    pin: 'SPI: MOSI 23, MISO 19, SCK 18, CS 5, RST 4'
  }
};

export const DemoTab: React.FC<DemoTabProps> = () => {
  const [selectedInspector, setSelectedInspector] = useState<string>('webcam');
  const [selectedGateId, setSelectedGateId] = useState<string>('gate-a');
  const [gatePower, setGatePower] = useState<boolean>(true);
  const [amberThreshold, setAmberThreshold] = useState<number>(5);
  const [redThreshold, setRedThreshold] = useState<number>(10);
  const [sensitivityMode, setSensitivityMode] = useState<'LOW' | 'BALANCED' | 'HIGH'>('BALANCED');
  const [simulatedCount, setSimulatedCount] = useState<number>(0);
  const [isSimulatingCameraFail, setIsSimulatingCameraFail] = useState<boolean>(false);

  const activeDossier = COMPONENT_DETAILS[selectedInspector] || COMPONENT_DETAILS['webcam'];

  const handleSliderChange = (val: number) => {
    setSimulatedCount(val);
  };

  const handleScenarioClick = (val: number) => {
    setSimulatedCount(val);
  };

  const handleToggleFailover = () => {
    setIsSimulatingCameraFail((prev) => !prev);
  };

  const handleClearDemo = () => {
    setSimulatedCount(0);
    setIsSimulatingCameraFail(false);
    setGatePower(true);
    setAmberThreshold(5);
    setRedThreshold(10);
    setSensitivityMode('BALANCED');
  };

  // Compute dynamic visual representations purely from local sandbox state (never live data)
  const effectiveAmber = sensitivityMode === 'LOW' ? amberThreshold + 2 : (sensitivityMode === 'HIGH' ? amberThreshold - 1 : amberThreshold);
  const effectiveRed = sensitivityMode === 'LOW' ? redThreshold + 3 : (sensitivityMode === 'HIGH' ? redThreshold - 2 : redThreshold);

  const count = simulatedCount;
  const isFailover = isSimulatingCameraFail;
  const isRed = count >= effectiveRed;
  const isAmber = count >= effectiveAmber && count < effectiveRed;
  const isGreen = count < effectiveAmber;

  const servoAngle = !gatePower ? 0 : (isRed ? 0 : (isAmber ? 45 : 90));
  const servoText = !gatePower ? 'STANDBY (OFF)' : (isRed ? 'LOCKED (0°)' : (isAmber ? 'METERED (45°)' : 'OPEN (90°)'));

  // Render crowds inside the visual schematic
  const openCount = Math.min(4, Math.max(1, Math.round(count * 0.3) + 1));
  const closeCount = count;

  return (
    <div className="flex flex-col gap-4 p-3 md:p-5 max-w-7xl mx-auto w-full">
      
      {/* Top Interactive Sandbox Toolbar */}
      <section className="flat-panel p-4 flex flex-col gap-3">
        {/* Row 1: Gate Selection, Power Toggle, Sensitivity Modes & Threshold Fine-Tuning */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border-subtle">
          <div className="flex flex-wrap items-center gap-3">
            {/* Gate Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-mono text-text-muted uppercase">GATE:</span>
              <div className="flex bg-surface-sunken p-0.5 rounded-lg border border-border-strong text-xs font-bold">
                <button
                  onClick={() => setSelectedGateId('gate-a')}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    selectedGateId === 'gate-a' ? 'bg-cyan-950 text-cyan-300 border border-cyan-700' : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  Gate A (Temple)
                </button>
                <button
                  onClick={() => setSelectedGateId('gate-b')}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    selectedGateId === 'gate-b' ? 'bg-cyan-950 text-cyan-300 border border-cyan-700' : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  Gate B (Pavilion)
                </button>
              </div>
            </div>

            {/* Gate Power Toggle */}
            <button
              onClick={() => setGatePower(!gatePower)}
              className={`px-2.5 py-1 rounded text-xs font-mono font-bold border transition-colors flex items-center gap-1.5 ${
                gatePower
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-600'
                  : 'bg-rose-950 text-rose-300 border-rose-600'
              }`}
            >
              <span>{gatePower ? 'GATE POWER: ON' : 'GATE POWER: OFF (STANDBY)'}</span>
            </button>

            {/* Sensitivity Modes */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-mono text-text-muted uppercase">SENSITIVITY:</span>
              <div className="flex bg-surface-sunken p-0.5 rounded-lg border border-border-strong text-xs font-bold">
                <button
                  onClick={() => setSensitivityMode('LOW')}
                  className={`px-2 py-1 rounded transition-colors ${
                    sensitivityMode === 'LOW' ? 'bg-amber-950 text-amber-300 border border-amber-700' : 'text-text-secondary hover:text-text-primary'
                  }`}
                  title="Low sensitivity: requires higher crowd cluster to trigger alerts"
                >
                  Low Sensitivity
                </button>
                <button
                  onClick={() => setSensitivityMode('BALANCED')}
                  className={`px-2 py-1 rounded transition-colors ${
                    sensitivityMode === 'BALANCED' ? 'bg-cyan-950 text-cyan-300 border border-cyan-700' : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  Balanced
                </button>
                <button
                  onClick={() => setSensitivityMode('HIGH')}
                  className={`px-2 py-1 rounded transition-colors ${
                    sensitivityMode === 'HIGH' ? 'bg-rose-950 text-rose-300 border border-rose-700' : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  High
                </button>
              </div>
            </div>
          </div>

          {/* Threshold Inc / Dec Controls */}
          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="flex items-center gap-1.5">
              <span className="text-text-muted text-[11px]">Amber Thr:</span>
              <div className="flex items-center bg-surface-sunken border border-border-strong rounded px-1">
                <button
                  onClick={() => setAmberThreshold(prev => Math.max(2, prev - 1))}
                  className="px-1.5 py-0.5 text-text-muted hover:text-text-primary"
                >
                  -
                </button>
                <span className="px-1.5 font-bold text-amber-400">{amberThreshold}</span>
                <button
                  onClick={() => setAmberThreshold(prev => Math.min(redThreshold - 1, prev + 1))}
                  className="px-1.5 py-0.5 text-text-muted hover:text-text-primary"
                >
                  +
                </button>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-text-muted text-[11px]">Red Thr:</span>
              <div className="flex items-center bg-surface-sunken border border-border-strong rounded px-1">
                <button
                  onClick={() => setRedThreshold(prev => Math.max(amberThreshold + 1, prev - 1))}
                  className="px-1.5 py-0.5 text-text-muted hover:text-text-primary"
                >
                  -
                </button>
                <span className="px-1.5 font-bold text-rose-400">{redThreshold}</span>
                <button
                  onClick={() => setRedThreshold(prev => Math.min(30, prev + 1))}
                  className="px-1.5 py-0.5 text-text-muted hover:text-text-primary"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Row 2: Live Crowd Slider & Scenario Presets */}
        <div className="flex flex-col lg:flex-row items-center justify-between gap-4 pt-1">
          <div className="flex-1 w-full flex flex-col md:flex-row items-center gap-4">
            <div className="flex items-center gap-2 min-w-[220px]">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-text-muted">
                Live Crowd Slider:
              </span>
              <span className={`px-3 py-1 rounded-lg border text-sm font-mono font-black ${
                isRed 
                  ? 'bg-rose-950/80 text-rose-300 border-rose-700' 
                  : (isAmber ? 'bg-amber-950/80 text-amber-300 border-amber-700' : 'bg-emerald-950/80 text-emerald-300 border-emerald-700')
              }`}>
                {count} Persons
              </span>
            </div>
            <div className="flex-1 w-full flex items-center gap-3">
              <span className="text-xs font-mono text-text-muted">0</span>
              <input
                type="range"
                min={0}
                max={25}
                value={count}
                onChange={(e) => handleSliderChange(parseInt(e.target.value, 10))}
                className="w-full h-2.5 bg-surface-sunken rounded-lg appearance-none cursor-pointer accent-cyan-400 focus:outline-none"
              />
              <span className="text-xs font-mono text-text-muted">25</span>
            </div>
          </div>

          {/* Quick Presets, Failover Toggle & Clear */}
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-end">
            <span className="text-[11px] font-mono text-text-muted font-semibold mr-1">SCENARIOS:</span>
            <button
              onClick={() => handleScenarioClick(2)}
              className="px-3 py-1.5 rounded-lg bg-surface-sunken hover:bg-surface-base border border-border-subtle text-emerald-400 text-xs font-mono font-bold transition"
            >
              Normal (2)
            </button>
            <button
              onClick={() => handleScenarioClick(7)}
              className="px-3 py-1.5 rounded-lg bg-surface-sunken hover:bg-surface-base border border-border-subtle text-amber-400 text-xs font-mono font-bold transition"
            >
              Elevated (7)
            </button>
            <button
              onClick={() => handleScenarioClick(15)}
              className="px-3 py-1.5 rounded-lg bg-surface-sunken hover:bg-surface-base border border-border-subtle text-rose-400 text-xs font-mono font-bold transition"
            >
              Surge Alert (15)
            </button>
            <button
              type="button"
              onClick={handleToggleFailover}
              className={`min-h-[44px] px-3 py-1.5 rounded-lg border text-xs font-mono font-bold flex items-center gap-1.5 transition ${
                isFailover
                  ? 'bg-amber-500 text-slate-950 border-amber-300'
                  : 'bg-amber-950/80 hover:bg-amber-900 border-amber-600/70 text-amber-200'
              }`}
            >
              <Zap className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{isFailover ? 'Restore AI Camera' : 'Simulate Camera Failure'}</span>
            </button>
            <button
              onClick={handleClearDemo}
              className="px-3 py-1.5 rounded-lg bg-surface-sunken hover:bg-surface-base border border-border-strong text-slate-200 text-xs font-mono font-bold transition"
            >
              Clear
            </button>
          </div>
        </div>
      </section>

      {/* Main Digital Twin Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        
        {/* Left 8 Cols: Schematic Board Matching Diagram */}
        <div className="xl:col-span-8 bg-surface-base border-2 border-border-strong rounded-xl p-4 md:p-6 relative flex flex-col justify-between overflow-hidden min-h-[580px] shadow-sm">
          
          {/* Top Sensor Cluster */}
          <div className="relative z-10 w-full flex items-center justify-center pt-1">
            <div className="flex flex-wrap items-center justify-center gap-4 md:gap-7 bg-surface-raised p-3 rounded-xl border border-border-subtle shadow-sm">
              
              {/* Webcam */}
              <button
                type="button"
                onClick={() => setSelectedInspector('webcam')}
                className="flex flex-col items-center gap-1 group focus:outline-none"
                title="Click to inspect USB Webcam"
              >
                <div className={`relative w-12 h-10 rounded-xl bg-surface-sunken border-2 flex items-center justify-center transition-all ${
                  selectedInspector === 'webcam' ? 'border-cyan-400 ring-2 ring-cyan-400/40' : 'border-border-strong'
                }`}>
                  <Camera className="w-5 h-5 text-slate-200" aria-hidden="true" />
                  <span className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-surface-base ${
                    isFailover ? 'bg-rose-500' : 'bg-emerald-400'
                  }`} />
                </div>
                <span className="text-[10px] font-mono font-bold text-text-secondary group-hover:text-cyan-400">
                  WEBCAM AI
                </span>
              </button>

              {/* Traffic Light */}
              <button
                type="button"
                onClick={() => setSelectedInspector('traffic_leds')}
                className="flex flex-col items-center gap-1 group focus:outline-none"
                title="Click to inspect 3-Light Traffic Signal"
              >
                <div className={`h-10 px-3.5 rounded-full bg-surface-sunken border-2 flex items-center gap-3 transition-all ${
                  selectedInspector === 'traffic_leds' ? 'border-cyan-400 ring-2 ring-cyan-400/40' : 'border-border-strong'
                }`}>
                  <div className={`w-5 h-5 rounded-full transition-all duration-300 ${
                    isRed ? 'bg-rose-500 border border-rose-300' : 'bg-rose-950/70 border border-rose-900'
                  }`} />
                  <div className={`w-5 h-5 rounded-full transition-all duration-300 ${
                    isAmber ? 'bg-amber-400 border border-amber-200' : 'bg-amber-950/70 border border-amber-900'
                  }`} />
                  <div className={`w-5 h-5 rounded-full transition-all duration-300 ${
                    isGreen ? 'bg-emerald-500 border border-emerald-300' : 'bg-emerald-950/70 border border-emerald-900'
                  }`} />
                </div>
                <span className="text-[10px] font-mono font-bold text-text-secondary group-hover:text-cyan-400">
                  TRAFFIC LIGHT
                </span>
              </button>

              {/* ToF Sensor */}
              <button
                type="button"
                onClick={() => setSelectedInspector('tof_sensor')}
                className="flex flex-col items-center gap-1 group focus:outline-none"
                title="Click to inspect VL53L0X Time-of-Flight Sensor"
              >
                <div className={`w-12 h-10 rounded-xl bg-surface-sunken border-2 flex items-center justify-center transition-all ${
                  selectedInspector === 'tof_sensor' ? 'border-amber-400 ring-2 ring-amber-400/40' : 'border-border-strong'
                }`}>
                  <span className="text-sm font-bold text-amber-400 font-mono">ToF</span>
                </div>
                <span className="text-[10px] font-mono font-bold text-text-secondary group-hover:text-amber-400">
                  TOF200C
                </span>
              </button>

              {/* 24GHz Radar */}
              <button
                type="button"
                onClick={() => setSelectedInspector('ld2410_radar')}
                className="flex flex-col items-center gap-1 group focus:outline-none"
                title="Click to inspect HLK-LD2410 24GHz Radar"
              >
                <div className={`w-12 h-10 rounded-xl bg-blue-950/80 border-2 flex items-center justify-center transition-all relative overflow-hidden ${
                  selectedInspector === 'ld2410_radar' ? 'border-blue-400 ring-2 ring-blue-400/40' : 'border-blue-700/60'
                }`}>
                  <span className="text-xs font-black text-cyan-300 font-mono">24GHz</span>
                </div>
                <span className="text-[10px] font-mono font-bold text-text-secondary group-hover:text-blue-400">
                  LD2410 RADAR
                </span>
              </button>

            </div>
          </div>

          {/* Center Multi-Corridor Flow Area */}
          <div className="relative z-0 flex-1 my-3 grid grid-cols-12 gap-2 md:gap-4 items-stretch">
            
            {/* Breadboard 2 (Left) */}
            <div
              onClick={() => setSelectedInspector('breadboard_2')}
              className={`col-span-3 lg:col-span-2 rounded-xl border-2 border-rose-500/60 bg-rose-950/20 p-2.5 flex flex-col justify-between cursor-pointer transition-colors ${
                selectedInspector === 'breadboard_2' ? 'ring-2 ring-rose-400' : ''
              }`}
            >
              <div className="flex items-center justify-between border-b border-rose-900/60 pb-1">
                <span className="text-rose-300 text-xs md:text-sm font-bold tracking-wide">breadboard 2</span>
                <span className="text-[9px] px-1 rounded bg-rose-950 text-rose-300 font-mono">SLAVE</span>
              </div>

              <div
                onClick={(e) => { e.stopPropagation(); setSelectedInspector('lora_slave'); }}
                className="bg-blue-950/80 border border-blue-500/70 rounded-lg p-2 text-center hover:border-cyan-400 shadow-sm transition"
              >
                <div className="flex items-center justify-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  <span className="text-[11px] font-mono font-bold text-cyan-300">Ra-02 LoRa</span>
                </div>
                <span className="text-[9px] font-mono text-text-muted block mt-0.5">433MHz Slave</span>
              </div>

              <div className="py-1 text-center opacity-40 text-amber-500 text-xs font-bold font-mono">
                SPI Link
              </div>

              <div
                onClick={(e) => { e.stopPropagation(); setSelectedInspector('breadboard_2'); }}
                className="bg-surface-sunken border border-border-strong rounded-lg p-2 text-center hover:border-emerald-400 shadow-sm transition"
              >
                <div className="flex items-center justify-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span className="text-[11px] font-mono font-black text-text-primary">ESP32 Node</span>
                </div>
                <span className="text-[9px] font-mono text-text-muted block mt-0.5">IR & LoRa Driver</span>
              </div>

              <div className="text-[9px] font-mono text-center text-text-muted mt-1">[INSPECT]</div>
            </div>

            {/* Corridors: Left (OPEN) vs Right (CLOSE) */}
            <div className="col-span-6 lg:col-span-8 rounded-xl border border-border-strong bg-black/60 relative overflow-hidden flex flex-col justify-between p-3">
              
              {/* Corridor Labels */}
              <div className="grid grid-cols-2 text-center border-b border-border-subtle pb-2">
                <div>
                  <span className="text-2xl md:text-3xl font-extrabold text-text-primary tracking-wider">OPEN</span>
                  <span className="block text-[10px] font-mono text-text-muted">Fluid Inflow Corridor</span>
                </div>
                <div className="border-l border-emerald-500/70">
                  <span className="text-2xl md:text-3xl font-extrabold text-text-primary tracking-wider">CLOSE</span>
                  <span className="block text-[10px] font-mono text-text-muted">Safety Restricted Corridor</span>
                </div>
              </div>

              {/* Dynamic Pedestrian Crowd Area */}
              <div className="grid grid-cols-2 flex-1 relative py-4 items-center">
                {/* Left Corridor Silhouettes */}
                <div className="flex flex-wrap gap-2.5 items-center justify-center px-3">
                  {Array.from({ length: openCount }).map((_, i) => (
                    <div key={i} className="flex flex-col items-center">
                      <svg className="w-6 h-9 text-slate-200" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <circle cx="12" cy="4" r="3"/>
                        <path d="M12 8c-3.3 0-6 2.7-6 6v7h3v-7h1v7h4v-7h1v7h3v-7c0-3.3-2.7-6-6-6z"/>
                      </svg>
                    </div>
                  ))}
                </div>

                {/* Center Green Dividing Line */}
                <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-emerald-500" />

                {/* Right Corridor Silhouettes */}
                <div className="flex flex-wrap gap-1.5 items-center justify-center px-3">
                  {closeCount > 0 ? (
                    Array.from({ length: closeCount }).map((_, i) => (
                      <div key={i} className="flex flex-col items-center">
                        <svg className={`w-5 h-8 ${isRed ? 'text-rose-300' : (isAmber ? 'text-amber-200' : 'text-slate-100')}`} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                          <circle cx="12" cy="4" r="3"/>
                          <path d="M12 8c-3.3 0-6 2.7-6 6v7h3v-7h1v7h4v-7h1v7h3v-7c0-3.3-2.7-6-6-6z"/>
                        </svg>
                      </div>
                    ))
                  ) : (
                    <span className="text-xs font-mono text-text-muted py-6">Corridor Empty</span>
                  )}
                </div>
              </div>

              {/* Center Gate Actuator & IR Tripwire Boundary */}
              <div className="relative pt-4 pb-2 border-t border-border-subtle flex items-center justify-between">
                
                {/* IR Transmitter */}
                <button
                  type="button"
                  onClick={() => setSelectedInspector('ir_beam')}
                  className="flex items-center gap-1.5 focus:outline-none"
                  title="Click to inspect IR Beam Transmitter"
                >
                  <div className="w-6 h-8 rounded-full bg-surface-sunken border-2 border-amber-500/80 flex items-center justify-center shadow-sm">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                  </div>
                  <span className="text-[9px] font-mono text-amber-400 font-bold hidden sm:inline">IR TX</span>
                </button>

                {/* Center Diamond Pivot & Physical Servo Gate Arm */}
                <button
                  type="button"
                  onClick={() => setSelectedInspector('servo_gate')}
                  className="flex flex-col items-center gap-1 group relative -top-3 focus:outline-none"
                  title="Click to inspect SG90 Servo Gate"
                >
                  <div className="relative w-10 h-10 bg-surface-sunken border-2 border-emerald-400 rotate-45 flex items-center justify-center shadow-sm group-hover:border-cyan-300 transition">
                    <div className="w-3 h-3 bg-emerald-400 rounded-full -rotate-45" />
                  </div>
                  
                  {/* Rotating Gate Arm */}
                  <div className="absolute top-5 left-1/2 w-36 h-2 pointer-events-none">
                    <div
                      className={`h-2 rounded-full origin-left transition-transform duration-500 ${
                        isRed
                          ? 'bg-rose-500'
                          : (isAmber ? 'bg-amber-400' : 'bg-emerald-500')
                      }`}
                      style={{ width: '130px', transform: `rotate(${servoAngle === 0 ? 0 : (servoAngle === 45 ? 45 : 90)}deg)` }}
                    />
                  </div>

                  <span className="text-[10px] font-mono font-bold text-emerald-400 mt-2 bg-surface-base px-2 py-0.5 rounded border border-emerald-800">
                    SG90 SERVO GATE
                  </span>
                </button>

                {/* IR Beam Line */}
                <div className="absolute left-8 right-8 bottom-5 h-0.5 bg-amber-500 pointer-events-none opacity-80" />

                {/* IR Receiver */}
                <button
                  type="button"
                  onClick={() => setSelectedInspector('ir_beam')}
                  className="flex items-center gap-1.5 focus:outline-none"
                  title="Click to inspect IR Beam Receiver"
                >
                  <span className="text-[9px] font-mono text-amber-400 font-bold hidden sm:inline">IR RX</span>
                  <div className="w-6 h-8 rounded-full bg-surface-sunken border-2 border-amber-500/80 flex items-center justify-center shadow-sm">
                    <span className="w-2 h-2 rounded-full bg-orange-500" />
                  </div>
                </button>

              </div>

              {/* Bottom Corridor State Label */}
              <div className="flex justify-between items-center text-[10px] font-mono text-text-muted px-2 pt-1">
                <span>INGRESS TRIPWIRE</span>
                <span className={`font-bold ${isRed ? 'text-rose-400' : (isAmber ? 'text-amber-400' : 'text-emerald-400')}`}>
                  ARM: {servoText}
                </span>
                <span>EGRESS FLOW</span>
              </div>

            </div>

            {/* Breadboard 1 (Right) */}
            <div
              onClick={() => setSelectedInspector('breadboard_1')}
              className={`col-span-3 lg:col-span-2 rounded-xl border-2 border-rose-500/60 bg-rose-950/20 p-2.5 flex flex-col justify-between cursor-pointer transition-colors ${
                selectedInspector === 'breadboard_1' ? 'ring-2 ring-rose-400' : ''
              }`}
            >
              <div className="flex items-center justify-between border-b border-rose-900/60 pb-1">
                <span className="text-rose-300 text-xs md:text-sm font-bold tracking-wide">breadboard 1</span>
                <span className="text-[9px] px-1 rounded bg-rose-950 text-rose-300 font-mono">MASTER</span>
              </div>

              <div
                onClick={(e) => { e.stopPropagation(); setSelectedInspector('lora_master'); }}
                className="bg-blue-950/80 border border-blue-500/70 rounded-lg p-2 text-center hover:border-cyan-400 shadow-sm transition"
              >
                <div className="flex items-center justify-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  <span className="text-[11px] font-mono font-bold text-cyan-300">Ra-02 LoRa</span>
                </div>
                <span className="text-[9px] font-mono text-text-muted block mt-0.5">433MHz Master</span>
              </div>

              <div className="py-1 text-center opacity-40 text-amber-500 text-xs font-bold font-mono">
                I2C / PWM
              </div>

              <div
                onClick={(e) => { e.stopPropagation(); setSelectedInspector('breadboard_1'); }}
                className="bg-surface-sunken border border-border-strong rounded-lg p-2 text-center hover:border-emerald-400 shadow-sm transition"
              >
                <div className="flex items-center justify-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span className="text-[11px] font-mono font-black text-text-primary">ESP32 Master</span>
                </div>
                <span className="text-[9px] font-mono text-text-muted block mt-0.5">OLED, RGB & Gate</span>
              </div>

              <div className="text-[9px] font-mono text-center text-text-muted mt-1">[INSPECT]</div>
            </div>

          </div>

          <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between text-xs font-mono text-text-muted bg-surface-raised px-4 py-2 rounded-xl border border-border-subtle gap-2">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              <span>Click on any component on the board to view specifications, pinouts & failover logic.</span>
            </span>
            <span className="text-[11px] text-cyan-400 font-bold">DIGITAL TWIN ARCHITECTURE</span>
          </div>

        </div>

        {/* Right 4 Cols: Component Dossier & OLED Twin Screen */}
        <div className="xl:col-span-4 flex flex-col gap-4">
          
          {/* OLED Screen Twin */}
          <div className="flat-panel p-4">
            <div className="flex items-center justify-between text-xs font-mono font-bold text-text-secondary mb-2">
              <span>PHYSICAL ESP32 OLED TWIN</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-950 text-blue-400 border border-blue-800">
                I2C 0x3C
              </span>
            </div>
            <div className="bg-black border-2 border-slate-700 rounded-xl p-3 font-mono text-cyan-400 text-xs shadow-inner flex flex-col justify-around h-28 tracking-wider">
              <div className="font-bold text-amber-400">
                {isFailover ? 'FAILOVER: RADAR' : 'CPR SANDBOX DEMO'}
              </div>
              <div className="font-extrabold text-white text-base">
                {`COUNT: ${count} PPL`}
              </div>
              <div className={isRed ? 'text-rose-400' : (isAmber ? 'text-amber-400' : 'text-emerald-400')}>
                {isRed ? 'STATUS: CRITICAL' : (isAmber ? 'STATUS: ELEVATED' : 'STATUS: NORMAL')}
              </div>
              <div className="text-slate-400 text-[11px]">
                {`GATE: ${servoText}`}
              </div>
            </div>
          </div>

          {/* Component Inspector Card */}
          <div className="flat-panel p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{activeDossier.icon}</span>
                  <div>
                    <h3 className="text-sm font-bold text-text-primary font-mono">{activeDossier.title}</h3>
                    <span className="text-[11px] text-cyan-400 font-mono">{activeDossier.subtitle}</span>
                  </div>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold font-mono ${activeDossier.badgeClass}`}>
                  {activeDossier.badge}
                </span>
              </div>

              <p className="text-xs text-text-secondary mt-3 leading-relaxed">
                {activeDossier.desc}
              </p>

              <div className="mt-4 space-y-2 text-xs font-mono">
                <div className="flex justify-between py-1 border-b border-border-subtle">
                  <span className="text-text-muted">MODEL:</span>
                  <span className="font-bold text-text-primary">{activeDossier.model}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border-subtle">
                  <span className="text-text-muted">INTERFACE:</span>
                  <span className="font-bold text-cyan-400">{activeDossier.interface}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border-subtle">
                  <span className="text-text-muted">INFERENCE:</span>
                  <span className="font-bold text-emerald-400">{activeDossier.inference}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border-subtle">
                  <span className="text-text-muted">FAILOVER ROLE:</span>
                  <span className="font-bold text-amber-300">{activeDossier.failover}</span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-border-subtle flex justify-between items-center text-[11px] font-mono text-text-muted">
              <span>PIN ASSIGNMENT:</span>
              <span className="text-text-primary font-bold">{activeDossier.pin}</span>
            </div>
          </div>

          {/* Quick Actuator Status Pill Box */}
          <div className="flat-panel p-3.5 grid grid-cols-2 gap-2 text-xs font-mono">
            <div className="p-2 rounded-xl bg-surface-sunken border border-border-subtle">
              <span className="text-text-muted text-[10px] block">RADAR ENERGY</span>
              <span className="font-bold text-cyan-400 text-sm">{Math.min(100, count * 7 + 12)}% (Active)</span>
            </div>
            <div className="p-2 rounded-xl bg-surface-sunken border border-border-subtle">
              <span className="text-text-muted text-[10px] block">ToF DISTANCE</span>
              <span className="font-bold text-amber-400 text-sm">{Math.max(280, 2000 - count * 95)} mm</span>
            </div>
            <div className="p-2 rounded-xl bg-surface-sunken border border-border-subtle">
              <span className="text-text-muted text-[10px] block">LoRa RSSI</span>
              <span className="font-bold text-emerald-400 text-sm">-68 dBm</span>
            </div>
            <div className="p-2 rounded-xl bg-surface-sunken border border-border-subtle">
              <span className="text-text-muted text-[10px] block">GATE ARM</span>
              <span className={`font-bold text-sm ${isRed ? 'text-rose-400' : (isAmber ? 'text-amber-400' : 'text-emerald-400')}`}>
                {servoText}
              </span>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
