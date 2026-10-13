'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Radio,
  Server,
  Link as LinkIcon,
  Clipboard,
  Check,
  RefreshCw,
  Power,
  User,
  ShieldCheck,
  Wifi,
} from 'lucide-react';

interface GatewayModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: 'connecting' | 'connected' | 'disconnected';
  machineName: string;
  latencyMs: number;
  currentGatewayUrl: string;
  userName: string;
  onConnect: (gatewayInput: string) => void;
  onUpdateUserName?: (name: string) => void;
  onOpenLegal?: () => void;
}

export const GatewayModal: React.FC<GatewayModalProps> = ({
  isOpen,
  onClose,
  status,
  machineName,
  latencyMs,
  currentGatewayUrl,
  userName: initialUserName,
  onConnect,
  onUpdateUserName,
  onOpenLegal,
}) => {
  const [gatewayInput, setGatewayInput] = useState('');
  const [operatorName, setOperatorName] = useState(initialUserName);
  const [isCopied, setIsCopied] = useState(false);
  const [isPasting, setIsPasting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('antilink_gateway_url') || currentGatewayUrl || '';
        const token = localStorage.getItem('antilink_token') || '';
        if (stored && token) {
          setGatewayInput(`${stored}/?token=${token}`);
        } else if (stored) {
          setGatewayInput(stored);
        }
      }
      setOperatorName(initialUserName);
    }
  }, [isOpen, currentGatewayUrl, initialUserName]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (operatorName.trim() && onUpdateUserName) {
      onUpdateUserName(operatorName.trim());
    }
    if (gatewayInput.trim()) {
      onConnect(gatewayInput.trim());
      onClose();
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      setIsPasting(true);
      const text = await navigator.clipboard.readText();
      if (text) {
        setGatewayInput(text.trim());
      }
    } catch {
      // Fallback if clipboard API is restricted
    } finally {
      setTimeout(() => setIsPasting(false), 300);
    }
  };

  const handleClearGateway = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('antilink_gateway_url');
      localStorage.removeItem('antilink_token');
    }
    setGatewayInput('');
    onConnect('');
  };

  const isConnected = status === 'connected';
  const isConnecting = status === 'connecting';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs select-none font-mono">
      <div
        className="relative w-full max-w-lg bg-palenight-card border border-palenight-border rounded-lg shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="h-10 bg-palenight-dark border-b border-palenight-border px-3.5 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs font-bold text-palenight-bright">
            <img
              src="/icon-192.png"
              alt="Antilink"
              className="w-4 h-4 rounded-full object-cover ring-1 ring-palenight-green/40 shrink-0"
            />
            <span>Connect Antilink Mac Gateway</span>
          </div>
          <button
            onClick={onClose}
            className="text-palenight-muted hover:text-palenight-fg p-1 rounded hover:bg-palenight-card cursor-pointer transition-colors"
            title="Close (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Live Status Banner */}
        <div
          className={`px-4 py-2.5 border-b text-xs flex items-center justify-between ${
            isConnected
              ? 'bg-palenight-green/10 border-palenight-green/30 text-palenight-green'
              : isConnecting
              ? 'bg-palenight-yellow/10 border-palenight-yellow/30 text-palenight-yellow'
              : 'bg-palenight-red/10 border-palenight-red/30 text-palenight-red'
          }`}
        >
          <div className="flex items-center space-x-2 font-semibold">
            <span
              className={`w-2 h-2 rounded-full ${
                isConnected
                  ? 'bg-palenight-green shadow-[0_0_8px_rgba(195,232,141,0.6)]'
                  : isConnecting
                  ? 'bg-palenight-yellow animate-ping'
                  : 'bg-palenight-red'
              }`}
            />
            <span>
              {isConnected
                ? `Connected to ${machineName} (${latencyMs}ms)`
                : isConnecting
                ? 'Connecting to Antilink Gateway...'
                : 'Gateway Disconnected'}
            </span>
          </div>
          {currentGatewayUrl && (
            <span className="text-[10px] opacity-75 truncate max-w-[150px] sm:max-w-[200px]">
              {currentGatewayUrl}
            </span>
          )}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4 text-xs">
          {/* Operator Profile Name */}
          <div className="space-y-1.5">
            <label className="flex items-center space-x-1.5 text-palenight-blue font-bold text-[11px]">
              <User className="w-3.5 h-3.5" />
              <span>Operator Profile Name</span>
            </label>
            <input
              type="text"
              value={operatorName}
              onChange={(e) => setOperatorName(e.target.value)}
              placeholder="e.g. Shreeprasandh"
              className="w-full bg-palenight-dark border border-palenight-border rounded px-3 py-2 text-palenight-bright placeholder:text-palenight-muted/50 focus:outline-hidden focus:border-palenight-blue text-xs font-mono transition-colors"
            />
          </div>

          {/* Gateway Link Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="flex items-center space-x-1.5 text-palenight-mauve font-bold text-[11px]">
                <Server className="w-3.5 h-3.5" />
                <span>Mac Gateway URL or Tunnel Link</span>
              </label>
              <button
                type="button"
                onClick={handlePasteFromClipboard}
                className="flex items-center space-x-1 text-[11px] text-palenight-muted hover:text-palenight-bright px-1.5 py-0.5 rounded hover:bg-palenight-dark cursor-pointer transition-colors"
                title="Paste link from clipboard"
              >
                <Clipboard className="w-3 h-3" />
                <span>{isPasting ? 'Pasting...' : 'Paste'}</span>
              </button>
            </div>
            <div className="relative">
              <input
                type="text"
                value={gatewayInput}
                onChange={(e) => setGatewayInput(e.target.value)}
                placeholder="https://...trycloudflare.com/?token=... or http://192.168.1.12:4040/?token=..."
                className="w-full bg-palenight-dark border border-palenight-border rounded px-3 py-2 text-palenight-bright placeholder:text-palenight-muted/50 focus:outline-hidden focus:border-palenight-mauve text-xs font-mono transition-colors pr-8"
              />
              <LinkIcon className="w-3.5 h-3.5 text-palenight-muted absolute right-2.5 top-2.5 pointer-events-none" />
            </div>
            <p className="text-[10px] text-palenight-muted leading-relaxed">
              Paste the full link generated by <span className="text-palenight-bright font-semibold">antilink</span> in your Mac terminal. Tokens and host origin are automatically parsed and saved locally.
            </p>
          </div>

          {/* Quick Explanatory Guide */}
          <div className="bg-palenight-dark/60 border border-palenight-border/60 rounded p-3 space-y-2 text-[11px]">
            <div className="flex items-center space-x-1.5 text-palenight-bright font-semibold text-[11px]">
              <Wifi className="w-3.5 h-3.5 text-palenight-cyan" />
              <span>How Connection Works</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-palenight-muted text-[10px] leading-relaxed">
              <li>
                <span className="text-palenight-bright">Remote via Cloudflare:</span> Works anywhere in the world on mobile cellular or Wi-Fi.
              </li>
              <li>
                <span className="text-palenight-bright">Local Wi-Fi Network:</span> Enter your Mac LAN address (e.g. <span className="text-palenight-fg">http://192.168.1.12:4040/?token=...</span>) for zero-latency local pairing.
              </li>
              <li>
                <span className="text-palenight-bright">Auto-Reconnection:</span> Stored in your device browser storage so you stay paired seamlessly across sessions.
              </li>
            </ul>
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-between border-t border-palenight-border">
            {currentGatewayUrl ? (
              <button
                type="button"
                onClick={handleClearGateway}
                className="flex items-center space-x-1.5 text-palenight-red hover:text-palenight-red/80 px-2.5 py-1.5 rounded hover:bg-palenight-dark cursor-pointer text-xs transition-colors"
                title="Disconnect from current gateway"
              >
                <Power className="w-3.5 h-3.5" />
                <span>Disconnect</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 bg-palenight-dark hover:bg-palenight-dark/80 text-palenight-fg border border-palenight-border rounded cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex items-center space-x-1.5 px-4 py-1.5 bg-palenight-mauve hover:bg-palenight-mauve/90 text-palenight-dark font-bold rounded cursor-pointer shadow-sm transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Connect Gateway</span>
              </button>
            </div>
          </div>

          {onOpenLegal && (
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenLegal();
                }}
                className="text-[10px] text-palenight-muted hover:text-palenight-mauve underline underline-offset-2 transition-colors cursor-pointer"
              >
                Privacy Policy, Terms of Service & Copyright Attributions
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
