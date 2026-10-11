'use client';

import React from 'react';
import { Terminal, Globe, GitBranch, Cpu } from 'lucide-react';

export type ActiveTab = 'stream' | 'preview' | 'git' | 'cockpit';

interface ActivityBarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  openPortCount: number;
  hasPendingApproval: boolean;
}

export const ActivityBar: React.FC<ActivityBarProps> = ({
  activeTab,
  onTabChange,
  openPortCount,
  hasPendingApproval,
}) => {
  const tabs: { id: ActiveTab; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'stream', label: 'Agent', icon: Terminal },
    { id: 'preview', label: 'Preview', icon: Globe },
    { id: 'git', label: 'Git', icon: GitBranch },
    { id: 'cockpit', label: 'Cockpit', icon: Cpu },
  ];

  return (
    <nav
      className="bg-palenight-dark border-t border-palenight-border flex items-center justify-around select-none shrink-0 md:h-full md:w-14 md:flex-col md:justify-start md:border-t-0 md:border-r md:py-3 transition-all"
      style={{
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 6px)',
        paddingTop: '6px',
      }}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex flex-col items-center justify-center flex-1 md:flex-initial md:w-10 md:h-10 md:my-1.5 rounded-md relative transition-all duration-150 active:scale-95 touch-manipulation ${
              isActive
                ? 'text-palenight-mauve md:bg-palenight-card shadow-sm'
                : 'text-palenight-muted hover:text-palenight-fg'
            }`}
          >
            <Icon className="w-5 h-5 transition-transform" />
            <span
              className={`text-[10px] mt-0.5 tracking-tight font-medium md:hidden font-mono ${
                isActive ? 'text-palenight-bright font-semibold' : 'text-palenight-muted'
              }`}
            >
              {tab.label}
            </span>

            {/* Notification Badges */}
            {tab.id === 'stream' && hasPendingApproval && (
              <span className="absolute top-1 right-5 md:top-1 md:right-1 w-2 h-2 rounded-full bg-palenight-yellow animate-ping" />
            )}

            {tab.id === 'preview' && openPortCount > 0 && (
              <span className="absolute top-0.5 right-4 md:top-0.5 md:right-0.5 text-[9px] px-1 rounded-full bg-palenight-cyan text-palenight-dark font-bold font-mono">
                {openPortCount}
              </span>
            )}

            {/* Desktop Active Left Indicator */}
            {isActive && (
              <span className="hidden md:block absolute left-0 top-2 bottom-2 w-0.5 bg-palenight-mauve rounded-r" />
            )}
          </button>
        );
      })}
    </nav>
  );
};
