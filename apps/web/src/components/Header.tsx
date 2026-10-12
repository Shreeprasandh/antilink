'use client';

import React from 'react';
import {
  Menu,
  PanelRight,
  Battery,
  BatteryCharging,
  Zap,
  ExternalLink,
  Keyboard,
  User,
  Settings,
} from 'lucide-react';
import type { SystemTelemetry } from '@antilink/shared';

interface HeaderProps {
  status: 'connecting' | 'connected' | 'disconnected';
  latencyMs: number;
  machineName: string;
  activeConversationTitle?: string;
  tunnelUrl: string | null;
  telemetry: SystemTelemetry | null;
  userEmail?: string;
  remoteControlUrl?: string;
  onOpenGatewayModal?: () => void;
  onOpenConversations?: () => void;
  onOpenAuxiliary?: () => void;
  onToggleCaffeinate?: (enable: boolean) => void;
  onOpenShortcuts?: () => void;
  onOpenSettings?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  status,
  latencyMs,
  machineName,
  activeConversationTitle,
  tunnelUrl,
  telemetry,
  userEmail = 'shreeprasandh@gmail.com',
  remoteControlUrl = 'https://antigravity.google.com/r/fe05edc8-4845-4227-8a3a-6f6eb60335d4-v2?p=c%2Fd933eaf8-272e-4559-89bc-a9c284a5eed0%3Fsection%3Ddefault-cli-project',
  onOpenGatewayModal,
  onOpenConversations,
  onOpenAuxiliary,
  onToggleCaffeinate,
  onOpenShortcuts,
  onOpenSettings,
}) => {
  const isConnected = status === 'connected';
  const isCaffeinateOn = Boolean(telemetry?.caffeinateActive);

  return (
    <header
      className="bg-palenight-dark border-b border-palenight-border px-2.5 sm:px-3.5 flex items-center justify-between select-none shrink-0 text-xs transition-colors"
      style={{
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 6px)',
        paddingBottom: '6px',
        minHeight: 'calc(env(safe-area-inset-top, 0px) + 42px)',
      }}
    >
      {/* Left: Sessions Drawer Button, Brand, & Active Chat Title */}
      <div className="flex items-center space-x-1.5 sm:space-x-2">
        {onOpenConversations && (
          <button
            onClick={onOpenConversations}
            className="text-palenight-muted hover:text-palenight-fg p-1 rounded hover:bg-palenight-card active:scale-95 transition-transform touch-manipulation cursor-pointer"
            title="Open Sessions History (Cmd+K)"
          >
            <Menu className="w-4 h-4" />
          </button>
        )}

        <div className="flex items-center space-x-1.5">
          <span className="font-bold tracking-wider text-palenight-bright text-xs sm:text-sm font-mono">
            ANTILINK
          </span>
          <span className="text-[10px] text-palenight-mauve bg-palenight-card border border-palenight-border px-1 py-0.2 rounded font-mono hidden md:inline">
            PRO
          </span>
        </div>

        <div className="h-3 w-[1px] bg-palenight-border mx-0.5" />

        {/* Active Chat Name Pill Button */}
        <button
          onClick={onOpenConversations}
          className="flex items-center space-x-1.5 text-palenight-bright hover:text-palenight-mauve bg-palenight-card hover:bg-palenight-card/80 border border-palenight-border px-2 py-0.5 rounded font-mono text-[11px] max-w-[120px] sm:max-w-[200px] truncate transition-colors touch-manipulation cursor-pointer"
          title={`Active Session: ${activeConversationTitle || 'Antilink'} (Click to switch session)`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-palenight-mauve shrink-0" />
          <span className="truncate font-semibold">{activeConversationTitle || 'Antilink'}</span>
        </button>

        <div className="h-3 w-[1px] bg-palenight-border mx-0.5 hidden xs:block" />

        {/* Host Machine & Latency (Clickable to switch or enter Gateway) */}
        <button
          onClick={onOpenGatewayModal}
          className="flex items-center space-x-1.5 bg-palenight-card/80 hover:bg-palenight-card border border-palenight-border px-2 py-0.5 rounded cursor-pointer touch-manipulation transition-colors"
          title="Click to view or switch Antilink Gateway connection"
        >
          <span
            className={`w-2 h-2 rounded-full transition-colors ${
              isConnected
                ? 'bg-palenight-green shadow-[0_0_6px_rgba(195,232,141,0.4)]'
                : 'bg-palenight-red'
            }`}
          />
          <span className="text-palenight-fg truncate max-w-[70px] sm:max-w-[110px] font-mono text-[11px] hidden xs:inline">
            {isConnected ? machineName : 'Connect Mac'}
          </span>
          {isConnected && (
            <span className="text-palenight-muted text-[10px] hidden sm:inline font-mono">
              {latencyMs}ms
            </span>
          )}
        </button>
      </div>

      {/* Right: Remote Control Link, Wake Lock, Battery & Auxiliary Drawer */}
      <div className="flex items-center space-x-1.5 sm:space-x-2 text-[11px] font-mono">
        {/* Official Google Remote Control Direct Link Button */}
        {remoteControlUrl && (
          <a
            href={remoteControlUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-1 text-palenight-dark bg-palenight-mauve hover:bg-palenight-mauve/90 px-2 py-0.5 rounded font-bold text-[10px] sm:text-[11px] transition-all touch-manipulation cursor-pointer shadow-xs active:scale-95"
            title="Open Live Google Remote Control in dedicated browser window"
          >
            <span>Remote</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        )}

        {/* Caffeinate Wake-Lock Interactive Toggle */}
        <button
          onClick={() => onToggleCaffeinate && onToggleCaffeinate(!isCaffeinateOn)}
          className={`flex items-center space-x-1 px-1.5 py-0.5 rounded border text-[10px] cursor-pointer touch-manipulation transition-all active:scale-95 ${
            isCaffeinateOn
              ? 'text-palenight-mauve bg-palenight-card border-palenight-mauve/60 shadow-[0_0_8px_rgba(199,146,234,0.15)]'
              : 'text-palenight-muted bg-palenight-dark/60 border-palenight-border/60 hover:text-palenight-fg'
          }`}
          title={
            isCaffeinateOn
              ? 'macOS Sleep Prevention (Caffeinate): Active. Keeps Mac awake while running builds & tunnel. Click to toggle.'
              : 'macOS Sleep Prevention: Inactive. Click to prevent Mac sleep.'
          }
        >
          <Zap className={`w-3 h-3 ${isCaffeinateOn ? 'fill-palenight-mauve text-palenight-mauve' : ''}`} />
          <span className="hidden xs:inline">{isCaffeinateOn ? 'WAKE' : 'SLEEP'}</span>
        </button>

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

        {/* Shortcuts Cheat Sheet Button */}
        {onOpenShortcuts && (
          <button
            onClick={onOpenShortcuts}
            className="text-palenight-muted hover:text-palenight-bright p-1 rounded hover:bg-palenight-card active:scale-95 transition-transform touch-manipulation cursor-pointer hidden sm:block"
            title="Keyboard Shortcuts (?)"
          >
            <Keyboard className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Auxiliary Panels Drawer Button */}
        {onOpenAuxiliary && (
          <button
            onClick={onOpenAuxiliary}
            className="text-palenight-muted hover:text-palenight-mauve p-1 rounded hover:bg-palenight-card active:scale-95 transition-transform touch-manipulation cursor-pointer"
            title="Open Auxiliary Panels (Cmd+B)"
          >
            <PanelRight className="w-4 h-4" />
          </button>
        )}

        {/* Identity & Preferences Settings Button */}
        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className="text-palenight-muted hover:text-palenight-bright p-1 rounded hover:bg-palenight-card active:scale-95 transition-transform touch-manipulation cursor-pointer"
            title="Settings & Identity (Name, Assistant, Account)"
          >
            <Settings className="w-4 h-4" />
          </button>
        )}
      </div>
    </header>
  );
};
