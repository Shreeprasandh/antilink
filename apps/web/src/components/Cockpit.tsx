'use client';

import React, { useState } from 'react';
import { Cpu, Zap, Battery, BatteryCharging, Shield, Copy, Check, Terminal, Play, Trash2 } from 'lucide-react';
import type { SystemTelemetry } from '@antilink/shared';

interface CockpitProps {
  telemetry: SystemTelemetry | null;
  tunnelUrl: string | null;
  commandOutput: { output: string; exitCode?: number } | null;
  onToggleCaffeinate: (enable: boolean) => void;
  onExecCommand: (cmd: string) => void;
}

export const Cockpit: React.FC<CockpitProps> = ({
  telemetry,
  tunnelUrl,
  commandOutput,
  onToggleCaffeinate,
  onExecCommand,
}) => {
  const [copiedTunnel, setCopiedTunnel] = useState(false);
  const [copiedOutput, setCopiedOutput] = useState(false);
  const [customCmd, setCustomCmd] = useState('');

  const handleCopyTunnel = () => {
    if (!tunnelUrl) return;
    navigator.clipboard.writeText(tunnelUrl);
    setCopiedTunnel(true);
    setTimeout(() => setCopiedTunnel(false), 1500);
  };

  const handleCopyOutput = () => {
    if (!commandOutput) return;
    navigator.clipboard.writeText(commandOutput.output);
    setCopiedOutput(true);
    setTimeout(() => setCopiedOutput(false), 1500);
  };

  const handleRunCommand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customCmd.trim()) return;
    onExecCommand(customCmd.trim());
    setCustomCmd('');
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-palenight-bg p-3 sm:p-4 space-y-3 font-mono text-xs overscroll-contain">
      {/* Top Title */}
      <div className="flex items-center space-x-1.5 text-palenight-muted pb-1.5 border-b border-palenight-border select-none">
        <Cpu className="w-3.5 h-3.5 text-palenight-mauve" />
        <span className="text-palenight-bright font-bold">SYSTEM & POWER COCKPIT</span>
      </div>

      {/* Cloudflare Tunnel Card */}
      <div className="bg-palenight-card border border-palenight-border rounded-lg p-3 sm:p-3.5">
        <div className="flex items-center justify-between mb-2 select-none">
          <div className="flex items-center space-x-1.5 text-palenight-cyan font-bold">
            <Shield className="w-4 h-4" />
            <span>CLOUDFLARE PUBLIC TUNNEL</span>
          </div>
          <span className="text-[10px] text-palenight-green bg-palenight-dark px-2 py-0.5 rounded border border-palenight-border font-bold">
            ENCRYPTED
          </span>
        </div>

        {tunnelUrl ? (
          <div className="flex items-center justify-between bg-palenight-dark p-2 sm:p-2.5 rounded-md border border-palenight-border">
            <span className="text-palenight-bright text-[11px] truncate mr-2 font-mono select-all">
              {tunnelUrl}
            </span>
            <button
              onClick={handleCopyTunnel}
              className="text-palenight-muted hover:text-palenight-fg p-1 rounded-md active:scale-95 transition-transform shrink-0"
              title="Copy URL"
            >
              {copiedTunnel ? (
                <Check className="w-3.5 h-3.5 text-palenight-green" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        ) : (
          <div className="text-palenight-muted text-[11px]">
            Tunnel running on local network. Connect via Wi-Fi URL.
          </div>
        )}
      </div>

      {/* Mac Power & Wake-Lock Card */}
      <div className="bg-palenight-card border border-palenight-border rounded-lg p-3 sm:p-3.5">
        <div className="flex items-center justify-between mb-2.5 select-none">
          <div className="flex items-center space-x-1.5 text-palenight-mauve font-bold">
            <Zap className="w-4 h-4" />
            <span>MACOS CAFFEINATE WAKE-LOCK</span>
          </div>

          {/* Smooth Toggle Switch */}
          <button
            onClick={() => onToggleCaffeinate(!telemetry?.caffeinateActive)}
            className={`w-11 h-6 rounded-full p-0.5 transition-colors relative active:scale-95 touch-manipulation ${
              telemetry?.caffeinateActive ? 'bg-palenight-green' : 'bg-palenight-dark border border-palenight-border'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-palenight-bright shadow-md transform transition-transform ${
                telemetry?.caffeinateActive ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        <p className="text-[11px] text-palenight-muted leading-relaxed">
          Prevents macOS from suspending execution when the laptop lid closes, preserving active agent turns and dev servers.
        </p>

        {/* Telemetry Hardware Grid */}
        <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-palenight-border text-[11px] select-none">
          <div className="bg-palenight-dark p-2.5 rounded-md border border-palenight-border">
            <div className="text-palenight-muted mb-1 flex items-center space-x-1">
              {telemetry?.isCharging ? (
                <BatteryCharging className="w-3.5 h-3.5 text-palenight-yellow" />
              ) : (
                <Battery className="w-3.5 h-3.5 text-palenight-fg" />
              )}
              <span>Battery Level</span>
            </div>
            <div className="text-palenight-bright font-bold text-sm">
              {telemetry?.batteryPercent !== null && telemetry?.batteryPercent !== undefined
                ? `${telemetry.batteryPercent}%`
                : 'AC Connected'}
            </div>
          </div>

          <div className="bg-palenight-dark p-2.5 rounded-md border border-palenight-border">
            <div className="text-palenight-muted mb-1 flex items-center space-x-1">
              <Cpu className="w-3.5 h-3.5 text-palenight-cyan" />
              <span>CPU 1m Load</span>
            </div>
            <div className="text-palenight-bright font-bold text-sm">
              {telemetry?.cpuLoad !== undefined ? `${telemetry.cpuLoad}` : 'N/A'}
            </div>
          </div>
        </div>
      </div>

      {/* Remote Shell Execution Card */}
      <div className="bg-palenight-card border border-palenight-border rounded-lg p-3 sm:p-3.5 flex-1 flex flex-col">
        <div className="flex items-center space-x-1.5 text-palenight-yellow font-bold mb-2.5 select-none">
          <Terminal className="w-4 h-4" />
          <span>REMOTE MAC SHELL RUNNER</span>
        </div>

        <form onSubmit={handleRunCommand} className="flex items-center space-x-2 mb-2.5">
          <input
            type="text"
            value={customCmd}
            onChange={(e) => setCustomCmd(e.target.value)}
            placeholder="e.g. git status, npm test, pmset -g"
            className="flex-1 bg-palenight-dark border border-palenight-border text-palenight-bright px-3 py-2 rounded-md text-xs sm:text-xs focus:outline-none focus:border-palenight-mauve placeholder-palenight-muted font-mono"
          />
          <button
            type="submit"
            className="bg-palenight-blue text-palenight-dark px-3 py-2 rounded-md font-bold active:scale-95 transition-transform touch-manipulation flex items-center space-x-1 shrink-0"
          >
            <Play className="w-3.5 h-3.5 fill-palenight-dark" />
            <span className="hidden sm:inline">Run</span>
          </button>
        </form>

        {commandOutput && (
          <div className="mt-1 flex-1 bg-palenight-dark border border-palenight-border rounded-md p-2.5 overflow-hidden flex flex-col">
            <div className="text-[10px] text-palenight-muted mb-1.5 pb-1 border-b border-palenight-border/50 flex items-center justify-between select-none">
              <span>Exit Code: {commandOutput.exitCode ?? 0}</span>
              <button
                onClick={handleCopyOutput}
                className="text-palenight-muted hover:text-palenight-fg p-0.5"
                title="Copy output"
              >
                {copiedOutput ? (
                  <Check className="w-3 h-3 text-palenight-green" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </button>
            </div>
            <pre className="text-palenight-fg whitespace-pre-wrap text-[11px] overflow-y-auto flex-1 font-mono leading-relaxed">
              {commandOutput.output}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
