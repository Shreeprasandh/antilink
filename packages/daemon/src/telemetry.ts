import * as os from 'node:os';
import { exec } from 'node:child_process';
import type { SystemTelemetry } from '@antilink/shared';

export class TelemetryCollector {
  private cachedBattery: number | null = null;
  private cachedCharging: boolean | null = null;

  constructor() {
    this.refreshBattery();
    setInterval(() => this.refreshBattery(), 15000);
  }

  private refreshBattery(): void {
    if (process.platform !== 'darwin') return;

    exec('pmset -g batt', (err, stdout) => {
      if (err || !stdout) return;

      // Output sample:
      // "Now drawing from 'Battery Power'"
      // " -InternalBattery-0 (id=...)	82%; discharging; 4:12 remaining present: true"
      const percentMatch = stdout.match(/(\d+)%/);
      if (percentMatch) {
        this.cachedBattery = parseInt(percentMatch[1], 10);
      }

      this.cachedCharging = stdout.includes('charging') || stdout.includes('AC Power');
    });
  }

  public getTelemetry(caffeinateActive: boolean): SystemTelemetry {
    const loads = os.loadavg();
    return {
      platform: os.platform(),
      hostname: os.hostname(),
      batteryPercent: this.cachedBattery,
      isCharging: this.cachedCharging,
      caffeinateActive,
      cpuLoad: Math.round(loads[0] * 10) / 10,
      uptimeSeconds: Math.round(os.uptime()),
    };
  }
}
