'use client';

import React, { useState } from 'react';
import { X, ShieldCheck, FileText, Scale, ExternalLink, User } from 'lucide-react';

interface LegalModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'privacy' | 'terms' | 'copyright';
}

export const LegalModal: React.FC<LegalModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'privacy',
}) => {
  const [activeTab, setActiveTab] = useState<'privacy' | 'terms' | 'copyright'>(initialTab);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs select-none font-mono">
      <div
        className="relative w-full max-w-2xl bg-palenight-card border border-palenight-border rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="h-12 bg-palenight-dark border-b border-palenight-border px-4 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5">
            <img
              src="/icon-192.png"
              alt="Antilink Logo"
              className="w-5 h-5 rounded-full object-cover ring-1 ring-palenight-mauve/40 shadow-xs"
            />
            <span className="font-bold text-palenight-bright text-xs sm:text-sm tracking-wide">
              Antilink Legal & Compliance
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-palenight-muted hover:text-palenight-fg p-1 rounded hover:bg-palenight-card cursor-pointer transition-colors"
            title="Close (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center border-b border-palenight-border/70 bg-palenight-dark/40 px-3 text-xs shrink-0 overflow-x-auto">
          <button
            onClick={() => setActiveTab('privacy')}
            className={`flex items-center space-x-1.5 py-2.5 px-3 border-b-2 font-semibold transition-colors cursor-pointer text-[11px] whitespace-nowrap ${
              activeTab === 'privacy'
                ? 'border-palenight-green text-palenight-green'
                : 'border-transparent text-palenight-muted hover:text-palenight-fg'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Privacy Policy</span>
          </button>
          <button
            onClick={() => setActiveTab('terms')}
            className={`flex items-center space-x-1.5 py-2.5 px-3 border-b-2 font-semibold transition-colors cursor-pointer text-[11px] whitespace-nowrap ${
              activeTab === 'terms'
                ? 'border-palenight-blue text-palenight-blue'
                : 'border-transparent text-palenight-muted hover:text-palenight-fg'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Terms & Conditions</span>
          </button>
          <button
            onClick={() => setActiveTab('copyright')}
            className={`flex items-center space-x-1.5 py-2.5 px-3 border-b-2 font-semibold transition-colors cursor-pointer text-[11px] whitespace-nowrap ${
              activeTab === 'copyright'
                ? 'border-palenight-mauve text-palenight-mauve'
                : 'border-transparent text-palenight-muted hover:text-palenight-fg'
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            <span>Copyright & Attributions</span>
          </button>
        </div>

        {/* Scrollable Document Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 text-xs text-palenight-fg space-y-4 leading-relaxed font-sans">
          {activeTab === 'privacy' && (
            <div className="space-y-4">
              <div className="border-b border-palenight-border/60 pb-2">
                <h2 className="text-sm font-bold text-palenight-bright font-mono">
                  Privacy Policy for Antilink Cockpit
                </h2>
                <p className="text-[11px] text-palenight-muted mt-0.5">
                  Effective Date: October 2026 | Architecture: Zero-Knowledge Local Peer Bridge
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="font-bold text-palenight-green text-xs font-mono">
                  1. Local Data Sovereignty & Zero Cloud Tracking
                </h3>
                <p className="text-palenight-muted text-[11px]">
                  Antilink is engineered with a strict local-first architecture. All conversation transcripts,
                  prompt histories, agent tool steps, and workspace files remain strictly on your host machine
                  under <code className="text-palenight-fg bg-palenight-dark px-1 py-0.5 rounded font-mono">~/.gemini/antigravity-cli/</code>.
                  Antilink does not collect, record, harvest, or transmit your code, prompts, or personal data to external databases or third-party tracking services.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="font-bold text-palenight-green text-xs font-mono">
                  2. Two-Tier Hardware Security & Whitelist Storage
                </h3>
                <p className="text-palenight-muted text-[11px]">
                  Hardware device pairings are governed exclusively by your host machine. Trusted client device identifiers
                  are persisted locally in <code className="text-palenight-fg bg-palenight-dark px-1 py-0.5 rounded font-mono">~/.gemini/antilink_devices.json</code>.
                  Your Master Security PIN is verified on the host via constant-time cryptographic comparisons and is never stored in unencrypted third-party logs.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="font-bold text-palenight-green text-xs font-mono">
                  3. Encrypted Tunneling & Transport Security
                </h3>
                <p className="text-palenight-muted text-[11px]">
                  When remote connections are provisioned via Cloudflare Quick Tunnels, end-to-end TLS encryption
                  protects the data in transit. Tunnels are ephemeral and automatically terminated when the host
                  daemon shuts down. No conversational payload is inspected or stored by intermediary relays.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="font-bold text-palenight-green text-xs font-mono">
                  4. Browser Storage Utilization
                </h3>
                <p className="text-palenight-muted text-[11px]">
                  The web client uses browser <code className="text-palenight-fg bg-palenight-dark px-1 py-0.5 rounded font-mono">localStorage</code> solely
                  to persist your active gateway URL, session tokens, device UUID, and user preferences locally on your device.
                  No advertising cookies or cross-site tracking technologies are utilized.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'terms' && (
            <div className="space-y-4">
              <div className="border-b border-palenight-border/60 pb-2">
                <h2 className="text-sm font-bold text-palenight-bright font-mono">
                  Terms and Conditions of Use
                </h2>
                <p className="text-[11px] text-palenight-muted mt-0.5">
                  Last Updated: October 2026 | License: MIT Open-Source Permissive
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="font-bold text-palenight-blue text-xs font-mono">
                  1. Authorized Developer Usage
                </h3>
                <p className="text-palenight-muted text-[11px]">
                  Antilink provides remote pairing, real-time agent output streaming, and dev server reverse-proxying
                  for Google Antigravity environments. You agree to use Antilink exclusively on machines, networks,
                  and software repositories where you possess full administrative authorization.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="font-bold text-palenight-blue text-xs font-mono">
                  2. Remote Command & Tool Approval Responsibility
                </h3>
                <p className="text-palenight-muted text-[11px]">
                  Terminal commands, shell scripts, and tool executions initiated or approved via the Antilink interface
                  execute with the exact system privileges of your local user account on the host machine. You bear
                  full responsibility for reviewing actions and commands before approving them.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="font-bold text-palenight-blue text-xs font-mono">
                  3. Disclaimer of Warranty
                </h3>
                <p className="text-palenight-muted text-[11px]">
                  Antilink is provided &ldquo;as is&rdquo;, without warranty of any kind, express or implied, including
                  but not limited to the warranties of merchantability, fitness for a particular purpose, and non-infringement.
                  In no event shall the authors or copyright holders be liable for any claim, damages, or other liability.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'copyright' && (
            <div className="space-y-4">
              <div className="border-b border-palenight-border/60 pb-2">
                <h2 className="text-sm font-bold text-palenight-bright font-mono">
                  Copyright & Intellectual Property Notice
                </h2>
                <p className="text-[11px] text-palenight-muted mt-0.5">
                  Official Author & Origin: Shreeprasandh
                </p>
              </div>

              <div className="bg-palenight-dark/60 rounded-lg p-3.5 border border-palenight-border/60 space-y-2">
                <div className="flex items-center space-x-2 text-palenight-bright font-bold text-xs font-mono">
                  <User className="w-4 h-4 text-palenight-mauve" />
                  <span>Copyright &copy; 2026 Antilink. All Rights Reserved.</span>
                </div>
                <p className="text-[11px] text-palenight-muted leading-relaxed">
                  The Antilink brand, brush emblem logo, remote cockpit architecture, and companion interface
                  were created and designed by <span className="text-palenight-fg font-semibold">Shreeprasandh</span>.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="font-bold text-palenight-mauve text-xs font-mono">
                  Open Source Libraries & Attributions
                </h3>
                <p className="text-[11px] text-palenight-muted">
                  Antilink gratefully utilizes the following gold-standard open source technologies:
                </p>
                <ul className="list-disc list-inside text-[11px] text-palenight-muted space-y-1">
                  <li><span className="text-palenight-fg">Next.js & React:</span> Vercel & Meta Open Source (MIT License)</li>
                  <li><span className="text-palenight-fg">Tailwind CSS:</span> Tailwind Labs (MIT License)</li>
                  <li><span className="text-palenight-fg">Lucide Icons:</span> Lucide Community (ISC License)</li>
                  <li><span className="text-palenight-fg">VS Code Material Theme:</span> Palenight Palette by Mattia Astorino</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="h-11 bg-palenight-dark border-t border-palenight-border px-4 flex items-center justify-between shrink-0 text-[11px] text-palenight-muted font-mono">
          <span>&copy; 2026 Antilink by Shreeprasandh</span>
          <button
            onClick={onClose}
            className="px-3 py-1 bg-palenight-card hover:bg-palenight-card/80 text-palenight-fg border border-palenight-border rounded cursor-pointer transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
