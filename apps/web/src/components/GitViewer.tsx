'use client';

import React, { useState, useEffect } from 'react';
import { GitBranch, RefreshCw, FileText } from 'lucide-react';

interface GitViewerProps {
  onExecCommand: (cmd: string) => void;
  commandOutput: { output: string; exitCode?: number } | null;
}

export const GitViewer: React.FC<GitViewerProps> = ({ onExecCommand, commandOutput }) => {
  const [activeSubTab, setActiveSubTab] = useState<'status' | 'diff'>('status');

  useEffect(() => {
    onExecCommand('git status -s');
  }, [onExecCommand]);

  const handleRefresh = () => {
    if (activeSubTab === 'status') {
      onExecCommand('git status -s');
    } else {
      onExecCommand('git diff --stat');
    }
  };

  const handleSubTab = (tab: 'status' | 'diff') => {
    setActiveSubTab(tab);
    if (tab === 'status') {
      onExecCommand('git status -s');
    } else {
      onExecCommand('git diff --stat');
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-palenight-bg font-mono text-xs">
      {/* Top Bar */}
      <div className="h-10 bg-palenight-dark border-b border-palenight-border px-3 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-2">
          <GitBranch className="w-4 h-4 text-palenight-mauve" />
          <span className="text-palenight-bright font-bold">SOURCE CONTROL</span>
        </div>

        <button
          onClick={handleRefresh}
          className="text-palenight-muted hover:text-palenight-fg p-1 rounded"
          title="Refresh Git status"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Sub Tabs */}
      <div className="flex border-b border-palenight-border bg-palenight-card text-xs">
        <button
          onClick={() => handleSubTab('status')}
          className={`flex-1 py-1.5 text-center font-medium border-b-2 transition-colors ${
            activeSubTab === 'status'
              ? 'border-palenight-mauve text-palenight-bright'
              : 'border-transparent text-palenight-muted hover:text-palenight-fg'
          }`}
        >
          Status
        </button>
        <button
          onClick={() => handleSubTab('diff')}
          className={`flex-1 py-1.5 text-center font-medium border-b-2 transition-colors ${
            activeSubTab === 'diff'
              ? 'border-palenight-mauve text-palenight-bright'
              : 'border-transparent text-palenight-muted hover:text-palenight-fg'
          }`}
        >
          Diff Stats
        </button>
      </div>

      {/* Git Content View */}
      <div className="flex-1 overflow-y-auto p-3">
        {commandOutput ? (
          <div className="bg-palenight-card border border-palenight-border rounded p-3">
            <div className="text-[10px] text-palenight-muted mb-2 pb-1 border-b border-palenight-border/60 flex items-center space-x-1">
              <FileText className="w-3 h-3 text-palenight-cyan" />
              <span>Workspace Changes</span>
            </div>
            <pre className="text-palenight-bright whitespace-pre-wrap leading-relaxed text-[11px] overflow-x-auto">
              {commandOutput.output || 'Working tree clean. No uncommitted modifications.'}
            </pre>
          </div>
        ) : (
          <div className="text-palenight-muted text-center py-8">Querying workspace git status...</div>
        )}
      </div>
    </div>
  );
};
