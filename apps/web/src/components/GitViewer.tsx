'use client';

import React, { useState, useEffect } from 'react';
import {
  GitBranch,
  RefreshCw,
  FileText,
  User,
  GitCommit as GitCommitIcon,
  ExternalLink,
  Plus,
  RotateCcw,
  Check,
  FolderGit2,
} from 'lucide-react';

interface GitViewerProps {
  onExecCommand: (cmd: string) => void;
  commandOutput: { output: string; exitCode?: number } | null;
  gitRepo?: string;
  gitBranch?: string;
  userEmail?: string;
  userName?: string;
}

export const GitViewer: React.FC<GitViewerProps> = ({
  onExecCommand,
  commandOutput,
  gitRepo = 'Shreeprasandh/antilink',
  gitBranch = 'main',
  userEmail = 'shreeprasandh@gmail.com',
  userName = 'Shreeprasandh',
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'status' | 'diff' | 'commits'>('status');

  useEffect(() => {
    onExecCommand('git status -s');
  }, [onExecCommand]);

  const handleSubTab = (tab: 'status' | 'diff' | 'commits') => {
    setActiveSubTab(tab);
    if (tab === 'status') {
      onExecCommand('git status -s');
    } else if (tab === 'diff') {
      onExecCommand('git diff');
    } else if (tab === 'commits') {
      onExecCommand('git log -n 10 --format="%h|%an|%ar|%s"');
    }
  };

  const handleRefresh = () => {
    handleSubTab(activeSubTab);
  };

  const handleStageAll = () => {
    onExecCommand('git add -A && git status -s');
  };

  const handleUnstageAll = () => {
    onExecCommand('git reset && git status -s');
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-palenight-bg font-mono text-xs select-none">
      {/* Top Bar */}
      <div className="h-10 bg-palenight-dark border-b border-palenight-border px-3 flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center space-x-2">
          <FolderGit2 className="w-4 h-4 text-palenight-mauve" />
          <span className="text-palenight-bright font-bold">SOURCE CONTROL</span>
        </div>

        <button
          onClick={handleRefresh}
          className="text-palenight-muted hover:text-palenight-fg p-1 rounded cursor-pointer touch-manipulation active:scale-95 transition-transform"
          title="Refresh Git status"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Repository & Account Information Card */}
      <div className="p-3 bg-palenight-card border-b border-palenight-border text-[11px] space-y-1.5 shrink-0 select-text">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1.5 truncate">
            <GitBranch className="w-3.5 h-3.5 text-palenight-mauve shrink-0" />
            <span className="font-bold text-palenight-bright truncate">{gitRepo}</span>
            <span className="text-palenight-cyan bg-palenight-dark px-1.5 py-0.2 rounded border border-palenight-border text-[10px]">
              {gitBranch}
            </span>
          </div>

          <a
            href={`https://github.com/${gitRepo}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-palenight-muted hover:text-palenight-cyan flex items-center space-x-1 text-[10px] shrink-0"
            title="Open on GitHub"
          >
            <span>GitHub</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        <div className="flex items-center space-x-2 text-[10px] text-palenight-muted truncate pt-0.5 border-t border-palenight-border/50">
          <User className="w-3 h-3 text-palenight-blue shrink-0" />
          <span className="text-palenight-fg truncate">{userName}</span>
          <span className="text-palenight-muted truncate">({userEmail})</span>
        </div>
      </div>

      {/* Action Strip */}
      <div className="px-3 py-1.5 bg-palenight-dark border-b border-palenight-border flex items-center justify-between text-[10px] shrink-0 select-none">
        <div className="flex items-center space-x-1.5">
          <button
            onClick={handleStageAll}
            className="flex items-center space-x-1 bg-palenight-card hover:bg-palenight-card/80 border border-palenight-border text-palenight-fg hover:text-palenight-bright px-2 py-0.5 rounded cursor-pointer transition-colors"
            title="Stage all modified and untracked files (git add -A)"
          >
            <Plus className="w-3 h-3 text-palenight-green" />
            <span>Stage All</span>
          </button>
          <button
            onClick={handleUnstageAll}
            className="flex items-center space-x-1 bg-palenight-card hover:bg-palenight-card/80 border border-palenight-border text-palenight-fg hover:text-palenight-bright px-2 py-0.5 rounded cursor-pointer transition-colors"
            title="Unstage all staged files (git reset)"
          >
            <RotateCcw className="w-3 h-3 text-palenight-yellow" />
            <span>Unstage</span>
          </button>
        </div>
      </div>

      {/* Sub Tabs */}
      <div className="flex border-b border-palenight-border bg-palenight-card text-xs shrink-0 select-none">
        <button
          onClick={() => handleSubTab('status')}
          className={`flex-1 py-1.5 text-center font-medium border-b-2 transition-colors cursor-pointer ${
            activeSubTab === 'status'
              ? 'border-palenight-mauve text-palenight-bright'
              : 'border-transparent text-palenight-muted hover:text-palenight-fg'
          }`}
        >
          Status
        </button>
        <button
          onClick={() => handleSubTab('diff')}
          className={`flex-1 py-1.5 text-center font-medium border-b-2 transition-colors cursor-pointer ${
            activeSubTab === 'diff'
              ? 'border-palenight-mauve text-palenight-bright'
              : 'border-transparent text-palenight-muted hover:text-palenight-fg'
          }`}
        >
          Diff
        </button>
        <button
          onClick={() => handleSubTab('commits')}
          className={`flex-1 py-1.5 text-center font-medium border-b-2 transition-colors cursor-pointer ${
            activeSubTab === 'commits'
              ? 'border-palenight-mauve text-palenight-bright'
              : 'border-transparent text-palenight-muted hover:text-palenight-fg'
          }`}
        >
          Commits
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-3 overscroll-contain">
        {commandOutput ? (
          <div className="bg-palenight-card border border-palenight-border rounded p-3 select-text">
            {activeSubTab === 'commits' ? (
              <div className="space-y-2">
                <div className="text-[10px] text-palenight-muted mb-2 pb-1 border-b border-palenight-border/60 flex items-center space-x-1">
                  <GitCommitIcon className="w-3 h-3 text-palenight-mauve" />
                  <span>Recent Commit History (10 commits)</span>
                </div>
                {commandOutput.output.split('\n').filter(Boolean).map((line, idx) => {
                  const parts = line.split('|');
                  if (parts.length >= 4) {
                    const [hash, author, date, message] = parts;
                    return (
                      <div key={idx} className="flex flex-col py-1.5 border-b border-palenight-border/40 last:border-b-0 space-y-0.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-palenight-bright">{message}</span>
                          <span className="font-mono text-palenight-cyan text-[10px] bg-palenight-dark px-1.5 py-0.2 rounded border border-palenight-border">
                            {hash}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-palenight-muted">
                          <span>{author}</span>
                          <span>{date}</span>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div key={idx} className="text-palenight-fg text-[11px]">
                      {line}
                    </div>
                  );
                })}
              </div>
            ) : activeSubTab === 'diff' ? (
              <div className="space-y-2">
                <div className="text-[10px] text-palenight-muted mb-2 pb-1 border-b border-palenight-border/60 flex items-center space-x-1">
                  <FileText className="w-3 h-3 text-palenight-cyan" />
                  <span>Working Tree Color Diff</span>
                </div>
                <div className="font-mono text-[11px] leading-relaxed overflow-x-auto bg-[#1B1E2B] p-2.5 rounded border border-palenight-border">
                  {commandOutput.output ? (
                    commandOutput.output.split('\n').map((line, lIdx) => {
                      if (line.startsWith('+') && !line.startsWith('+++')) {
                        return <div key={lIdx} className="text-palenight-green bg-palenight-green/10 px-1">{line}</div>;
                      }
                      if (line.startsWith('-') && !line.startsWith('---')) {
                        return <div key={lIdx} className="text-palenight-red bg-palenight-red/10 px-1">{line}</div>;
                      }
                      if (line.startsWith('@@')) {
                        return <div key={lIdx} className="text-palenight-cyan font-bold opacity-80">{line}</div>;
                      }
                      return <div key={lIdx} className="text-palenight-fg">{line}</div>;
                    })
                  ) : (
                    <div className="text-palenight-muted">No unstaged diffs found in working tree.</div>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <div className="text-[10px] text-palenight-muted mb-2 pb-1 border-b border-palenight-border/60 flex items-center space-x-1">
                  <FileText className="w-3 h-3 text-palenight-cyan" />
                  <span>Changed Files (git status -s)</span>
                </div>
                <pre className="text-palenight-bright whitespace-pre-wrap leading-relaxed text-[11px] overflow-x-auto">
                  {commandOutput.output || 'Working tree clean. No uncommitted modifications.'}
                </pre>
              </div>
            )}
          </div>
        ) : (
          <div className="text-palenight-muted text-center py-8">Querying workspace git status...</div>
        )}
      </div>
    </div>
  );
};
