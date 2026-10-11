'use client';

import React, { useState, useEffect } from 'react';
import { RotateCw, ExternalLink, Smartphone, Tablet, Monitor, Globe, RefreshCw, Copy, Check } from 'lucide-react';
import type { DiscoveredPort } from '@antilink/shared';

interface PreviewMatrixProps {
  ports: DiscoveredPort[];
  onScanPorts: () => void;
}

export const PreviewMatrix: React.FC<PreviewMatrixProps> = ({ ports, onScanPorts }) => {
  const [selectedPort, setSelectedPort] = useState<number | null>(null);
  const [viewportMode, setViewportMode] = useState<'responsive' | 'tablet' | 'mobile'>('responsive');
  const [iframeKey, setIframeKey] = useState<number>(0);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (ports.length > 0 && (selectedPort === null || !ports.some((p) => p.port === selectedPort))) {
      setSelectedPort(ports[0].port);
    }
  }, [ports, selectedPort]);

  const activePort = ports.find((p) => p.port === selectedPort);
  const previewUrl = selectedPort ? `/preview/${selectedPort}/` : '';

  const handleReload = () => {
    setIframeKey((prev) => prev + 1);
  };

  const handleCopyUrl = () => {
    if (!previewUrl) return;
    const fullUrl = `${window.location.origin}${previewUrl}`;
    navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-palenight-bg">
      {/* Top Ports Matrix Bar */}
      <div className="h-10 bg-palenight-dark border-b border-palenight-border px-2.5 flex items-center justify-between shrink-0 overflow-x-auto text-xs select-none">
        <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar py-1">
          {ports.map((port) => {
            const isSelected = selectedPort === port.port;
            return (
              <button
                key={port.port}
                onClick={() => setSelectedPort(port.port)}
                className={`px-2.5 py-1 rounded-md text-xs font-mono font-medium whitespace-nowrap transition-all duration-150 active:scale-95 touch-manipulation ${
                  isSelected
                    ? 'bg-palenight-mauve text-palenight-dark font-bold shadow-sm'
                    : 'bg-palenight-card text-palenight-fg hover:text-palenight-bright border border-palenight-border'
                }`}
              >
                :{port.port} <span className="opacity-70 text-[10px]">({port.serviceType})</span>
              </button>
            );
          })}

          {ports.length === 0 && (
            <span className="text-palenight-muted text-[11px] px-1 font-mono">No active dev servers</span>
          )}
        </div>

        <button
          onClick={onScanPorts}
          className="text-palenight-muted hover:text-palenight-fg p-1.5 rounded-md hover:bg-palenight-card shrink-0 active:scale-95 transition-transform touch-manipulation"
          title="Rescan open ports"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Browser Controls Toolbar */}
      {selectedPort && (
        <div className="h-9 bg-palenight-card border-b border-palenight-border px-2.5 flex items-center justify-between text-xs shrink-0 select-none">
          <div className="flex items-center space-x-2 flex-1 mr-2 min-w-0">
            <button
              onClick={handleReload}
              className="text-palenight-fg hover:text-palenight-bright p-1 rounded-md active:scale-95 transition-transform"
              title="Reload preview"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>

            <div className="flex-1 bg-palenight-dark border border-palenight-border rounded px-2.5 py-1 text-[11px] text-palenight-bright font-mono truncate flex items-center justify-between">
              <span className="truncate mr-2">
                {activePort?.name || `Port ${selectedPort}`} ({previewUrl})
              </span>
              <button
                onClick={handleCopyUrl}
                className="text-palenight-muted hover:text-palenight-fg shrink-0"
                title="Copy preview path"
              >
                {copied ? <Check className="w-3 h-3 text-palenight-green" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          </div>

          <div className="flex items-center space-x-1 shrink-0">
            {/* Viewport Width Toggles (Desktop/Tablet) */}
            <div className="hidden sm:flex items-center space-x-1 border-r border-palenight-border pr-1 mr-1">
              <button
                onClick={() => setViewportMode('mobile')}
                className={`p-1 rounded ${
                  viewportMode === 'mobile'
                    ? 'text-palenight-cyan bg-palenight-dark border border-palenight-border'
                    : 'text-palenight-muted hover:text-palenight-fg'
                }`}
                title="Mobile (390px)"
              >
                <Smartphone className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewportMode('tablet')}
                className={`p-1 rounded ${
                  viewportMode === 'tablet'
                    ? 'text-palenight-cyan bg-palenight-dark border border-palenight-border'
                    : 'text-palenight-muted hover:text-palenight-fg'
                }`}
                title="Tablet (768px)"
              >
                <Tablet className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewportMode('responsive')}
                className={`p-1 rounded ${
                  viewportMode === 'responsive'
                    ? 'text-palenight-cyan bg-palenight-dark border border-palenight-border'
                    : 'text-palenight-muted hover:text-palenight-fg'
                }`}
                title="Full Responsive"
              >
                <Monitor className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* External Tab Opener */}
            <a
              href={previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-palenight-muted hover:text-palenight-fg p-1 rounded active:scale-95 transition-transform"
              title="Open full window in browser"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      )}

      {/* Preview Viewport Canvas */}
      <div className="flex-1 bg-palenight-bg overflow-hidden flex items-center justify-center p-0">
        {selectedPort ? (
          <div
            className={`h-full transition-all duration-200 bg-white ${
              viewportMode === 'mobile'
                ? 'w-full max-w-[390px] border-x border-palenight-border shadow-2xl'
                : viewportMode === 'tablet'
                ? 'w-full max-w-[768px] border-x border-palenight-border shadow-2xl'
                : 'w-full'
            }`}
          >
            <iframe
              key={iframeKey}
              src={previewUrl}
              className="w-full h-full border-0"
              title={`Live Preview Port ${selectedPort}`}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-palenight-muted p-6 text-center space-y-3 font-mono">
            <Globe className="w-10 h-10 text-palenight-border" />
            <div>
              <p className="text-palenight-bright font-medium text-sm">No Active Local Dev Servers</p>
              <p className="text-xs text-palenight-muted mt-1 max-w-xs leading-relaxed">
                Start your Next.js, Vite, or backend server on your Mac. Antilink will discover it and tunnel the preview here automatically.
              </p>
            </div>
            <button
              onClick={onScanPorts}
              className="mt-2 bg-palenight-card border border-palenight-border text-palenight-mauve px-3.5 py-1.5 rounded-md text-xs font-medium hover:border-palenight-mauve active:scale-95 transition-all touch-manipulation"
            >
              Scan Local Ports
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
