'use client';

import React, { useState } from 'react';
import { X, User, Bot, Mail, ShieldCheck, Check, RotateCcw } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userName: string;
  assistantName: string;
  userEmail: string;
  onSave: (settings: { userName: string; assistantName: string; userEmail: string }) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  userName: initialUserName,
  assistantName: initialAssistantName,
  userEmail: initialUserEmail,
  onSave,
}) => {
  const [userName, setUserName] = useState(initialUserName);
  const [assistantName, setAssistantName] = useState(initialAssistantName);
  const [userEmail, setUserEmail] = useState(initialUserEmail);
  const [isSaved, setIsSaved] = useState(false);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      userName: userName.trim() || 'Shreeprasandh',
      assistantName: assistantName.trim() || 'Luna',
      userEmail: userEmail.trim() || 'shreeprasandh@gmail.com',
    });
    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
      onClose();
    }, 600);
  };

  const handleReset = () => {
    setUserName('Shreeprasandh');
    setAssistantName('Luna');
    setUserEmail('shreeprasandh@gmail.com');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs select-none font-mono">
      <div
        className="relative w-full max-w-md bg-palenight-card border border-palenight-border rounded-lg shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="h-10 bg-palenight-dark border-b border-palenight-border px-3.5 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs font-bold text-palenight-bright">
            <span className="w-2 h-2 rounded-full bg-palenight-mauve" />
            <span>Antilink Settings & Identity</span>
          </div>
          <button
            onClick={onClose}
            className="text-palenight-muted hover:text-palenight-fg p-1 rounded hover:bg-palenight-card cursor-pointer transition-colors"
            title="Close (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-4 space-y-4 text-xs">
          {/* User Name */}
          <div className="space-y-1.5">
            <label className="flex items-center space-x-1.5 text-palenight-blue font-bold text-[11px]">
              <User className="w-3.5 h-3.5" />
              <span>User Identity Name</span>
            </label>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="e.g. Shreeprasandh"
              className="w-full bg-palenight-dark border border-palenight-border rounded px-3 py-2 text-palenight-bright placeholder:text-palenight-muted/50 focus:outline-hidden focus:border-palenight-blue text-xs font-mono transition-colors"
            />
            <p className="text-[10px] text-palenight-muted">
              Displayed as your chat bubble header across all session transcripts.
            </p>
          </div>

          {/* Assistant Name */}
          <div className="space-y-1.5">
            <label className="flex items-center space-x-1.5 text-palenight-mauve font-bold text-[11px]">
              <Bot className="w-3.5 h-3.5" />
              <span>AI Assistant Persona Name</span>
            </label>
            <input
              type="text"
              value={assistantName}
              onChange={(e) => setAssistantName(e.target.value)}
              placeholder="e.g. Luna"
              className="w-full bg-palenight-dark border border-palenight-border rounded px-3 py-2 text-palenight-bright placeholder:text-palenight-muted/50 focus:outline-hidden focus:border-palenight-mauve text-xs font-mono transition-colors"
            />
            <p className="text-[10px] text-palenight-muted">
              Displayed as the assistant response badge and stream identifier.
            </p>
          </div>

          {/* User Email */}
          <div className="space-y-1.5">
            <label className="flex items-center space-x-1.5 text-palenight-cyan font-bold text-[11px]">
              <Mail className="w-3.5 h-3.5" />
              <span>Connected Account Email</span>
            </label>
            <input
              type="email"
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              placeholder="e.g. shreeprasandh@gmail.com"
              className="w-full bg-palenight-dark border border-palenight-border rounded px-3 py-2 text-palenight-bright placeholder:text-palenight-muted/50 focus:outline-hidden focus:border-palenight-cyan text-xs font-mono transition-colors"
            />
          </div>

          {/* Whitelist Guard Note */}
          <div className="bg-palenight-dark/80 rounded p-2.5 border border-palenight-border/60 text-[10px] text-palenight-muted space-y-1">
            <div className="flex items-center space-x-1.5 text-palenight-green font-bold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Tool Permissions Engine</span>
            </div>
            <p>
              Pre-approved command rules from Option 3 are automatically persisted to{' '}
              <code className="text-palenight-bright">~/.gemini/antigravity-cli/settings.json</code>.
            </p>
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-between pt-2 border-t border-palenight-border/60">
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center space-x-1 text-palenight-muted hover:text-palenight-fg px-2.5 py-1.5 rounded border border-palenight-border/40 hover:bg-palenight-dark transition-colors cursor-pointer text-[11px]"
              title="Reset to defaults"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Defaults</span>
            </button>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-palenight-muted hover:text-palenight-fg text-[11px] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-palenight-mauve hover:bg-palenight-mauve/90 text-palenight-dark font-bold px-4 py-1.5 rounded flex items-center space-x-1.5 transition-all cursor-pointer shadow-xs active:scale-95 text-[11px]"
              >
                {isSaved ? <Check className="w-3.5 h-3.5" /> : null}
                <span>{isSaved ? 'Saved!' : 'Save Changes'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
