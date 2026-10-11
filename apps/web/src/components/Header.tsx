'use client';

import React from 'react';
import { Wifi, WifiOff, Battery, BatteryCharging, Zap, ShieldCheck } from 'lucide-react';
import type { SystemTelemetry } from '@antilink/shared';

interface HeaderProps {
  status: 'connecting' | 'connected' | 'disconnected';
  latencyMs: number;
  machineName: string;
  tunnelUrl: string | null;
  telemetry: SystemTelemetry | null;
}

export const Header: React.FC<HeaderProps> = ({
  status,
  latencyMs,
  machineName,
  tunnelUrl,
  telemetry,
}) => {
  const isConnected = status === 'connected';

  return (
    <header
      className="bg-palenight-dark border-b border-palenight-border px-3.5 flex items-center justify-between select-none shrink-0 text-xs transition-colors"
      style={{
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 6px)',
        paddingBottom: '6px',
        minHeight: 'calc(env(safe-area-inset-top, 0px) + 42px)',
      }}
    >
      {/* Brand & Connection Status */}
      <div className="flex items-center space-x-2.5">
        <div className="flex items-center space-x-1.5">
          <span className="font-bold tracking-wider text-palenight-bright text-xs sm:text-sm font-mono">
            ANTILINK
          </span>
          <span className="text-[10px] text-palenight-mauve bg-palenight-card border border-palenight-border px-1 py-0.2 rounded font-mono hidden sm:inline">
            PRO
          </span>
        </div>

        <div className="h-3 w-[1px] bg-palenight-border" />

        <div className="flex items-center space-x-1.5">
          <span
            className={`w-2 h-2 rounded-full transition-colors ${
              isConnected
                ? 'bg-palenight-green shadow-[0_0_6px_rgba(195,232,141,0.4)]'
                : 'bg-palenight-red'
            }`}
          />
          <span className="text-palenight-fg truncate max-w-[100px] sm:max-w-[140px] font-mono text-[11px]">
            {machineName}
          </span>
          {isConnected && (
            <span className="text-palenight-muted text-[10px] hidden sm:inline">
              {latencyMs}ms
            </span>
          )}
        </div>
      </div>

      {/* Hardware / Power Telemetry */}
      <div className="flex items-center space-x-2 text-[11px] font-mono">
        {/* Caffeinate Wake-Lock Indicator */}
        {telemetry?.caffeinateActive && (
          <div className="flex items-center space-x-1 text-palenight-mauve bg-palenight-card px-2 py-0.5 rounded border border-palenight-border text-[10px] sm:text-[11px]">
            <Zap className="w-3 h-3 text-palenight-mauve fill-palenight-mauve" />
            <span className="hidden xs:inline">WAKE</span>
          </div>
        )}

        {/* Battery Indicator */}
        {telemetry?.batteryPercent !== null && telemetry?.batteryPercent !== undefined && (
          <div className="flex items-center space-x-1 text-palenight-fg bg-palenight-card/60 px-1.5 py-0.5 rounded border border-palenight-border/60">
            {telemetry.isCharging ? (
              <BatteryCharging className="w-3.5 h-3.5 text-palenight-yellow" />
            ) : (
              <Battery className="w-3.5 h-3.5 text-palenight-fg" />
            )}
            <span className="text-[10px] sm:text-[11px]">{telemetry.batteryPercent}%</span>
          </div>
        )}

        {/* Tunnel Badge */}
        {tunnelUrl && (
          <div className="flex items-center space-x-1 text-palenight-cyan bg-palenight-card px-2 py-0.5 rounded border border-palenight-border text-[10px]">
            <ShieldCheck className="w-3 h-3 text-palenight-cyan" />
            <span className="hidden sm:inline">HTTPS</span>
          </div>
        )}
      </div>
    </header>
  );
};
