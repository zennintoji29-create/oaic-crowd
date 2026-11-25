import React from 'react';
import { AlertOctagon } from 'lucide-react';

export const AboutTab: React.FC = () => {
  return (
    <div className="space-y-6 max-w-3xl">
      {/* 1. Mandatory Research Disclaimer */}
      <div className="border border-status-danger-border bg-status-danger-bg p-4 rounded text-status-danger-text">
        <div className="flex items-start gap-2.5">
          <AlertOctagon className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-1">
            <h2 className="text-sm font-bold">
              Research Prototype Notice: Not Certified for Crowd-Safety Decisions
            </h2>
            <p className="text-xs leading-relaxed">
              This system is an engineering demonstration and educational platform. It estimates crowd congestion proxy indicators from anonymous radar reflections. It has not been validated or certified for life-critical safety, emergency egress, or panic suppression. It must not be used as the primary basis for crowd containment or emergency decisions.
            </p>
          </div>
        </div>
      </div>

      {/* 2. What the Sensor Measures */}
      <div className="flat-panel p-5">
        <h2 className="text-base font-semibold text-text-primary mb-1">
          What the sensor measures
        </h2>
        <p className="text-xs text-text-secondary mb-3 leading-relaxed">
          The system uses a 24 GHz mmWave radar sensor (HLK-LD2410) and two infrared break-beams at the corridor boundaries.
        </p>

        <ul className="space-y-1.5 text-xs text-text-primary list-disc list-inside">
          <li><strong>Relative position:</strong> X and Y coordinates (millimetres) of up to 3 moving targets within a 6-metre radius.</li>
          <li><strong>Movement speed:</strong> Radial walking velocity (centimetres per second) toward or away from the sensor.</li>
          <li><strong>Entrance and exit counts:</strong> Infrared break-beams detect people crossing the corridor threshold to balance net headcount.</li>
          <li><strong>Speed variance:</strong> Standard deviation of speed over a 20-second sliding window to detect stop-and-go surges.</li>
        </ul>
      </div>

      {/* 3. What It Does NOT Measure */}
      <div className="flat-panel p-5">
        <h2 className="text-base font-semibold text-text-primary mb-1">
          What it does not measure (privacy and physical boundaries)
        </h2>
        <p className="text-xs text-text-secondary mb-3 leading-relaxed">
          The system is designed from first principles to be completely anonymous and contactless.
        </p>

        <ul className="space-y-1.5 text-xs text-text-primary list-disc list-inside">
          <li><strong>No photos or video:</strong> There are no optical cameras, lenses, or visual framebuffers. Nothing can be viewed or saved as an image.</li>
          <li><strong>No personal identities:</strong> The radar detects radio reflections from bodies. It cannot recognize faces, clothing, age, or biometric identity.</li>
          <li><strong>No physical force:</strong> The system measures movement speed and density. It does not measure physical pressure, Newtons of force, or compressive chest stress between bodies.</li>
        </ul>
      </div>

      {/* 4. How the Risk Score is Calculated */}
      <div className="flat-panel p-5">
        <h2 className="text-base font-semibold text-text-primary mb-1">
          How the crowd risk score (0–100) is calculated
        </h2>
        <p className="text-xs text-text-secondary mb-3 leading-relaxed">
          The firmware combines 4 weighted proxy indicators into a single score from 0 to 100:
        </p>

        <div className="overflow-x-auto mb-4 border border-border-subtle rounded">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-sunken border-b border-border-subtle text-text-secondary uppercase text-[11px] font-mono">
              <tr>
                <th className="py-2 px-3">Indicator</th>
                <th className="py-2 px-3">Weight</th>
                <th className="py-2 px-3">What triggers high risk</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle text-text-primary">
              <tr>
                <td className="py-2 px-3 font-medium">Crowd density</td>
                <td className="py-2 px-3 font-mono">40%</td>
                <td className="py-2 px-3 text-text-secondary">Density approaching or exceeding 4.0 people per m²</td>
              </tr>
              <tr>
                <td className="py-2 px-3 font-medium">Low movement speed (stall)</td>
                <td className="py-2 px-3 font-mono">30%</td>
                <td className="py-2 px-3 text-text-secondary">Average speed dropping below 0.15 m/s while people push behind</td>
              </tr>
              <tr>
                <td className="py-2 px-3 font-medium">Stop-and-go turbulence</td>
                <td className="py-2 px-3 font-mono">20%</td>
                <td className="py-2 px-3 text-text-secondary">High speed variance (uneven halting and lurching shockwaves)</td>
              </tr>
              <tr>
                <td className="py-2 px-3 font-medium">Proximity clustering</td>
                <td className="py-2 px-3 font-mono">10%</td>
                <td className="py-2 px-3 text-text-secondary">Pairs of targets detected closer than 0.5 metres apart</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="text-xs text-text-secondary">
          <strong>State thresholds:</strong> Moves to <strong>Building up (Amber)</strong> when score &ge; 50 for 5 seconds. Moves to <strong>Danger, barrier closed (Red)</strong> when score &ge; 75 for 3 seconds. The servo barrier automatically closes to 0° in Red, and only re-opens (90°) after remaining continuously Clear for 30 seconds.
        </p>
      </div>

      {/* 5. Known Limits */}
      <div className="flat-panel p-5">
        <h2 className="text-base font-semibold text-text-primary mb-1">
          Known limits
        </h2>
        <ul className="space-y-1.5 text-xs text-text-primary list-disc list-inside leading-relaxed">
          <li><strong>Sensor target limit:</strong> The HLK-LD2410 hardware tracks up to 3 individual moving targets per frame. Higher density is estimated using reflection spatial spread and break-beam counts.</li>
          <li><strong>Corner shadowing:</strong> Solid pillars, barricades, or walls within the corridor can cast radar shadows where movement cannot be tracked.</li>
          <li><strong>Slow walking vs stall:</strong> Very slow deliberate walking (e.g. ceremonial processions) can read as low speed, requiring calibrated threshold tuning.</li>
        </ul>
      </div>

      {/* 6. What This Prototype Must NOT Be Used For */}
      <div className="flat-panel p-5">
        <h2 className="text-base font-semibold text-text-primary mb-1">
          What this prototype must not be used for
        </h2>
        <ul className="space-y-1.5 text-xs text-text-primary list-disc list-inside leading-relaxed">
          <li>Do not use as an autonomous life-safety control mechanism without human oversight.</li>
          <li>Do not use to replace trained crowd safety officers, human stewards, and wide emergency egress routes.</li>
          <li>Do not present this prototype to the public or authorities as a certified crowd crush safety device.</li>
        </ul>
      </div>
    </div>
  );
};
