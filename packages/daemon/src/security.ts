import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

export interface PairedDevice {
  deviceId: string;
  deviceName: string;
  pairedAt: string;
  lastSeenAt: string;
  ip: string;
}

interface PendingChallenge {
  deviceId: string;
  deviceName: string;
  ip: string;
  code: string;
  createdAt: number;
  onApproved: () => void;
}

export class DeviceSecurityManager {
  private configPath: string;
  private pairedDevices: Map<string, PairedDevice> = new Map();
  private pendingChallenges: Map<string, PendingChallenge> = new Map();
  private latestPendingDeviceId: string | null = null;
  private masterPin: string;
  private failedAttempts: Map<string, { count: number; lockedUntil: number }> = new Map();

  constructor() {
    const configDir = path.join(os.homedir(), '.gemini');
    if (!fs.existsSync(configDir)) {
      try {
        fs.mkdirSync(configDir, { recursive: true });
      } catch {
        // ignore
      }
    }
    this.configPath = path.join(configDir, 'antilink_devices.json');
    this.masterPin = (process.env.ANTILINK_PIN || '100307').trim();
    this.loadDevices();
  }

  private loadDevices(): void {
    try {
      if (fs.existsSync(this.configPath)) {
        const raw = fs.readFileSync(this.configPath, 'utf8');
        const data = JSON.parse(raw);
        if (Array.isArray(data.pairedDevices)) {
          for (const dev of data.pairedDevices) {
            if (dev && dev.deviceId) {
              this.pairedDevices.set(dev.deviceId, dev);
            }
          }
        }
      }
    } catch {
      this.pairedDevices.clear();
    }
  }

  private saveDevices(): void {
    try {
      const data = {
        updatedAt: new Date().toISOString(),
        pairedDevices: Array.from(this.pairedDevices.values()),
      };
      fs.writeFileSync(this.configPath, JSON.stringify(data, null, 2), 'utf8');
    } catch {
      // ignore write error
    }
  }

  public isRateLimited(ip: string): boolean {
    const record = this.failedAttempts.get(ip);
    if (!record) return false;
    if (Date.now() < record.lockedUntil) {
      return true;
    }
    if (Date.now() > record.lockedUntil) {
      this.failedAttempts.delete(ip);
    }
    return false;
  }

  public recordFailedAttempt(ip: string): void {
    const record = this.failedAttempts.get(ip) || { count: 0, lockedUntil: 0 };
    record.count += 1;
    if (record.count >= 5) {
      // Lock out IP for 15 minutes
      record.lockedUntil = Date.now() + 15 * 60 * 1000;
      console.log(`\x1b[38;2;255;83;112m[SECURITY WARNING] IP ${ip} temporarily locked out for 15 minutes due to 5 failed attempts.\x1b[0m`);
    }
    this.failedAttempts.set(ip, record);
  }

  public resetFailedAttempts(ip: string): void {
    this.failedAttempts.delete(ip);
  }

  public isDevicePaired(deviceId: string): boolean {
    if (!deviceId) return false;
    return this.pairedDevices.has(deviceId);
  }

  public touchDevice(deviceId: string, ip: string): void {
    const dev = this.pairedDevices.get(deviceId);
    if (dev) {
      dev.lastSeenAt = new Date().toISOString();
      dev.ip = ip;
      this.saveDevices();
    }
  }

  public verifyPin(candidatePin: string): boolean {
    if (!candidatePin) return false;
    const cleanCand = candidatePin.trim();
    const cleanMaster = this.masterPin.trim();
    if (cleanCand.length !== cleanMaster.length) return false;
    return crypto.timingSafeEqual(Buffer.from(cleanCand), Buffer.from(cleanMaster));
  }

  public createPairingChallenge(
    deviceId: string,
    deviceName: string,
    ip: string,
    onApproved: () => void
  ): string {
    // Generate 6-digit numeric pairing code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const challenge: PendingChallenge = {
      deviceId,
      deviceName: deviceName || 'Unknown Device',
      ip,
      code,
      createdAt: Date.now(),
      onApproved,
    };

    this.pendingChallenges.set(deviceId, challenge);
    this.latestPendingDeviceId = deviceId;

    // Emitting audible terminal bell + security banner
    process.stdout.write('\x07');
    console.log('\n==============================================================');
    console.log(`\x1b[38;2;255;203;107m[SECURITY CHALLENGE]\x1b[0m New Device Requesting Pairing:`);
    console.log(`Device: \x1b[1m${challenge.deviceName}\x1b[0m | IP: \x1b[1m${ip}\x1b[0m`);
    console.log(`One-Time Pairing Code: \x1b[38;2;195;232;141m\x1b[1m[ ${code.split('').join(' ')} ]\x1b[0m`);
    console.log(`\x1b[38;2;137;221;255mPress 'y' in this terminal to approve, or enter code on device.\x1b[0m`);
    console.log('==============================================================\n');

    return code;
  }

  public verifyPairingCode(deviceId: string, candidateCode: string, ip: string): boolean {
    const challenge = this.pendingChallenges.get(deviceId);
    if (!challenge) {
      this.recordFailedAttempt(ip);
      return false;
    }

    // 5-minute expiry
    if (Date.now() - challenge.createdAt > 5 * 60 * 1000) {
      this.pendingChallenges.delete(deviceId);
      return false;
    }

    if (challenge.code === candidateCode.trim()) {
      this.approveDevice(challenge);
      return true;
    }

    this.recordFailedAttempt(ip);
    return false;
  }

  public approveLatestPending(fromTerminal = true): boolean {
    if (!this.latestPendingDeviceId) return false;
    const challenge = this.pendingChallenges.get(this.latestPendingDeviceId);
    if (!challenge) return false;

    this.approveDevice(challenge);
    if (fromTerminal) {
      console.log(`\x1b[38;2;195;232;141m[SECURITY APPROVED]\x1b[0m Device "${challenge.deviceName}" successfully paired via Mac terminal.\n`);
    }
    return true;
  }

  private approveDevice(challenge: PendingChallenge): void {
    const now = new Date().toISOString();
    const paired: PairedDevice = {
      deviceId: challenge.deviceId,
      deviceName: challenge.deviceName,
      pairedAt: now,
      lastSeenAt: now,
      ip: challenge.ip,
    };

    this.pairedDevices.set(challenge.deviceId, paired);
    this.saveDevices();
    this.pendingChallenges.delete(challenge.deviceId);
    if (this.latestPendingDeviceId === challenge.deviceId) {
      this.latestPendingDeviceId = null;
    }

    try {
      challenge.onApproved();
    } catch {
      // ignore
    }
  }

  public getPairedDevices(): PairedDevice[] {
    return Array.from(this.pairedDevices.values());
  }

  public removeDevice(deviceId: string): boolean {
    const removed = this.pairedDevices.delete(deviceId);
    if (removed) {
      this.saveDevices();
    }
    return removed;
  }
}
