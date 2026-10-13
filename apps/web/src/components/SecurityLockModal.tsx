'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ShieldAlert, Lock, Delete, Power, Check, KeyRound, Terminal } from 'lucide-react';

interface SecurityLockModalProps {
  isOpen: boolean;
  mode: 'pairing' | 'pin';
  pairingMessage?: string;
  pinError?: string;
  onSubmitPairingCode: (code: string) => void;
  onSubmitPin: (pin: string) => void;
  onDisconnect?: () => void;
  onOpenLegal?: () => void;
}

export const SecurityLockModal: React.FC<SecurityLockModalProps> = ({
  isOpen,
  mode,
  pairingMessage,
  pinError,
  onSubmitPairingCode,
  onSubmitPin,
  onDisconnect,
  onOpenLegal,
}) => {
  const [pairingCodeInput, setPairingCodeInput] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [isShaking, setIsShaking] = useState(false);
  const codeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (mode === 'pairing') {
        setPairingCodeInput('');
        setTimeout(() => codeInputRef.current?.focus(), 100);
      } else {
        setPinInput('');
      }
    }
  }, [isOpen, mode]);

  useEffect(() => {
    if (pinError) {
      setIsShaking(true);
      setPinInput('');
      const t = setTimeout(() => setIsShaking(false), 500);
      return () => clearTimeout(t);
    }
  }, [pinError]);

  if (!isOpen) return null;

  const handlePairingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pairingCodeInput.trim().length === 6) {
      onSubmitPairingCode(pairingCodeInput.trim());
    }
  };

  const handlePinDigit = (digit: string) => {
    if (pinInput.length < 6) {
      const next = pinInput + digit;
      setPinInput(next);
      if (next.length === 6) {
        onSubmitPin(next);
      }
    }
  };

  const handlePinBackspace = () => {
    setPinInput((prev) => prev.slice(0, -1));
  };

  const handlePinFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput.length === 6) {
      onSubmitPin(pinInput);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md select-none font-mono">
      <div
        className={`relative w-full max-w-sm bg-palenight-card border border-palenight-border rounded-xl shadow-2xl overflow-hidden flex flex-col ${
          isShaking ? 'animate-bounce' : 'animate-in fade-in zoom-in-95 duration-150'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="h-11 bg-palenight-dark border-b border-palenight-border px-4 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs font-bold text-palenight-bright">
            {mode === 'pairing' ? (
              <>
                <ShieldAlert className="w-4 h-4 text-palenight-yellow animate-pulse" />
                <span>Hardware Pairing Required</span>
              </>
            ) : (
              <>
                <Lock className="w-4 h-4 text-palenight-mauve" />
                <span>Master Security PIN</span>
              </>
            )}
          </div>
          {onDisconnect && (
            <button
              onClick={onDisconnect}
              className="text-palenight-muted hover:text-palenight-red p-1 rounded hover:bg-palenight-card cursor-pointer transition-colors"
              title="Disconnect"
            >
              <Power className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Content Body */}
        {mode === 'pairing' ? (
          <form onSubmit={handlePairingSubmit} className="p-5 space-y-4 text-xs">
            <div className="text-center space-y-2">
              <div className="relative w-14 h-14 mx-auto">
                <img
                  src="/icon-192.png"
                  alt="Antilink Emblem"
                  className="w-14 h-14 rounded-full object-cover ring-2 ring-palenight-yellow/50 shadow-lg"
                />
                <div className="absolute -bottom-1 -right-1 bg-palenight-dark rounded-full p-1 border border-palenight-border">
                  <Terminal className="w-3.5 h-3.5 text-palenight-yellow" />
                </div>
              </div>
              <h3 className="font-bold text-palenight-bright text-sm">Physical Mac Authorization</h3>
              <p className="text-[11px] text-palenight-muted leading-relaxed">
                {pairingMessage ||
                  "A 6-digit pairing code is displayed on your physical Mac terminal screen. Either press 'y' on your Mac keyboard or enter the code below:"}
              </p>
            </div>

            <div className="space-y-1.5 pt-1">
              <label className="text-[11px] font-bold text-palenight-blue flex items-center justify-center space-x-1">
                <KeyRound className="w-3 h-3" />
                <span>Terminal Pairing Code</span>
              </label>
              <input
                ref={codeInputRef}
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={pairingCodeInput}
                onChange={(e) => setPairingCodeInput(e.target.value.replace(/\D/g, ''))}
                placeholder="6 Digits"
                className="w-full text-center tracking-[0.5em] text-lg font-bold bg-palenight-dark border border-palenight-border rounded-lg px-3 py-2.5 text-palenight-green placeholder:tracking-normal placeholder:text-palenight-muted/40 focus:outline-hidden focus:border-palenight-yellow transition-colors font-mono"
              />
            </div>

            <div className="pt-2 flex items-center space-x-2">
              {onDisconnect && (
                <button
                  type="button"
                  onClick={onDisconnect}
                  className="w-1/3 py-2 bg-palenight-dark hover:bg-palenight-dark/80 text-palenight-muted border border-palenight-border rounded cursor-pointer transition-colors text-xs font-semibold"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={pairingCodeInput.length !== 6}
                className="flex-1 py-2 bg-palenight-yellow hover:bg-palenight-yellow/90 disabled:opacity-50 text-palenight-dark font-bold rounded cursor-pointer transition-colors text-xs flex items-center justify-center space-x-1.5 shadow-sm"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Authorize Device</span>
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handlePinFormSubmit} className="p-5 space-y-4 text-xs">
            <div className="text-center space-y-2">
              <div className="relative w-14 h-14 mx-auto">
                <img
                  src="/icon-192.png"
                  alt="Antilink Emblem"
                  className="w-14 h-14 rounded-full object-cover ring-2 ring-palenight-mauve/50 shadow-lg"
                />
                <div className="absolute -bottom-1 -right-1 bg-palenight-dark rounded-full p-1 border border-palenight-border">
                  <Lock className="w-3.5 h-3.5 text-palenight-mauve" />
                </div>
              </div>
              <h3 className="font-bold text-palenight-bright text-sm">Security PIN Lock</h3>
              <p className="text-[11px] text-palenight-muted">
                {pinError || 'Enter your 6-digit Master PIN to unlock remote controls.'}
              </p>
            </div>

            {/* Masked PIN Indicators */}
            <div className="flex items-center justify-center space-x-3 py-2">
              {[0, 1, 2, 3, 4, 5].map((idx) => {
                const filled = pinInput.length > idx;
                return (
                  <span
                    key={idx}
                    className={`w-3.5 h-3.5 rounded-full border transition-all ${
                      filled
                        ? 'bg-palenight-mauve border-palenight-mauve shadow-[0_0_8px_rgba(199,146,234,0.7)] scale-110'
                        : 'bg-palenight-dark border-palenight-border'
                    }`}
                  />
                );
              })}
            </div>

            {/* Mobile Touch Keypad */}
            <div className="grid grid-cols-3 gap-2 pt-1 max-w-[240px] mx-auto">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => handlePinDigit(digit)}
                  className="h-11 bg-palenight-dark hover:bg-palenight-card border border-palenight-border/70 rounded-lg text-sm font-bold text-palenight-bright flex items-center justify-center cursor-pointer active:scale-95 transition-transform touch-manipulation"
                >
                  {digit}
                </button>
              ))}
              <div />
              <button
                type="button"
                onClick={() => handlePinDigit('0')}
                className="h-11 bg-palenight-dark hover:bg-palenight-card border border-palenight-border/70 rounded-lg text-sm font-bold text-palenight-bright flex items-center justify-center cursor-pointer active:scale-95 transition-transform touch-manipulation"
              >
                0
              </button>
              <button
                type="button"
                onClick={handlePinBackspace}
                className="h-11 bg-palenight-dark hover:bg-palenight-card border border-palenight-border/70 rounded-lg text-palenight-muted hover:text-palenight-fg flex items-center justify-center cursor-pointer active:scale-95 transition-transform touch-manipulation"
                title="Backspace"
              >
                <Delete className="w-4 h-4" />
              </button>
            </div>
          </form>
        )}

        {onOpenLegal && (
          <div className="text-center pb-3 pt-1 border-t border-palenight-border/40">
            <button
              type="button"
              onClick={onOpenLegal}
              className="text-[10px] text-palenight-muted hover:text-palenight-mauve underline underline-offset-2 transition-colors cursor-pointer"
            >
              Privacy Policy, Terms of Service & Copyright Attributions
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
