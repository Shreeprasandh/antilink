'use client';

import React from 'react';
import { X, Keyboard } from 'lucide-react';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const categories = [
    {
      name: 'Navigation & Viewports',
      shortcuts: [
        { key: '1', desc: 'Switch to Stream / Chat' },
        { key: '2', desc: 'Switch to Dev Preview Matrix' },
        { key: '3', desc: 'Switch to Source Control' },
        { key: '4', desc: 'Switch to System Cockpit' },
        { key: 'Cmd/Ctrl + K', desc: 'Toggle Session History Drawer' },
        { key: 'Cmd/Ctrl + B', desc: 'Toggle Auxiliary Panels Drawer' },
        { key: 'Esc', desc: 'Close any active modal or drawer' },
      ],
    },
    {
      name: 'Agent & Tool Inspection',
      shortcuts: [
        { key: 'Ctrl + O', desc: 'Expand / Collapse All Tool Call Outputs' },
        { key: '/', desc: 'Trigger Slash Commands & Skills Autocomplete' },
        { key: '?', desc: 'Toggle this Keyboard Shortcuts Dialog' },
        { key: 'Enter', desc: 'Submit prompt to agent' },
      ],
    },
    {
      name: 'System & Remote Control',
      shortcuts: [
        { key: 'Ctrl + C', desc: 'Abort running task / command' },
        { key: 'Shift + Click Tool', desc: 'Copy tool arguments to clipboard' },
      ],
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-md bg-palenight-dark border border-palenight-border rounded-lg shadow-2xl z-10 font-mono text-xs overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="h-11 px-4 border-b border-palenight-border flex items-center justify-between bg-palenight-card/80 select-none">
          <div className="flex items-center space-x-2 text-palenight-bright font-bold">
            <Keyboard className="w-4 h-4 text-palenight-mauve" />
            <span>KEYBOARD SHORTCUTS</span>
          </div>
          <button
            onClick={onClose}
            className="text-palenight-muted hover:text-palenight-fg p-1 rounded active:scale-95 transition-transform cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 space-y-4 max-h-[75vh] overflow-y-auto overscroll-contain">
          {categories.map((cat, idx) => (
            <div key={idx} className="space-y-2">
              <div className="text-[10px] uppercase font-bold text-palenight-mauve tracking-wider pb-1 border-b border-palenight-border/50">
                {cat.name}
              </div>
              <div className="space-y-1.5">
                {cat.shortcuts.map((s, sIdx) => (
                  <div key={sIdx} className="flex items-center justify-between py-1">
                    <span className="text-palenight-fg text-[11px]">{s.desc}</span>
                    <kbd className="bg-palenight-card border border-palenight-border text-palenight-bright px-2 py-0.5 rounded text-[10px] font-bold shadow-xs">
                      {s.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 bg-palenight-card/60 border-t border-palenight-border flex items-center justify-between text-[10px] text-palenight-muted select-none">
          <span>Press <kbd className="text-palenight-fg">Esc</kbd> or <kbd className="text-palenight-fg">?</kbd> to dismiss</span>
          <span className="text-palenight-cyan">Antilink Cockpit</span>
        </div>
      </div>
    </div>
  );
};
