'use client';

import React, { useState } from 'react';
import { Users, ListTodo, FileCode, GitCommit, Terminal, X, Play, Trash2, CheckCircle2 } from 'lucide-react';
import type { SubagentInfo, BackgroundTaskInfo, ArtifactInfo } from '@antilink/shared';

export type AuxTab = 'subagents' | 'tasks' | 'artifacts' | 'terminal';

interface AuxiliaryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  subagents: SubagentInfo[];
  tasks: BackgroundTaskInfo[];
  artifacts: ArtifactInfo[];
  commandOutput: { output: string; exitCode?: number } | null;
  onExecCommand: (cmd: string) => void;
  onKillTask: (id: string) => void;
}

export const AuxiliaryDrawer: React.FC<AuxiliaryDrawerProps> = ({
  isOpen,
  onClose,
  subagents,
  tasks,
  artifacts,
  commandOutput,
  onExecCommand,
  onKillTask,
}) => {
  const [activeAuxTab, setActiveAuxTab] = useState<AuxTab>('artifacts');
  const [cmdInput, setCmdInput] = useState('');

  if (!isOpen) return null;

  const tabs: { id: AuxTab; label: string; icon: React.FC<{ className?: string }>; count?: number }[] = [
    { id: 'artifacts', label: 'Artifacts', icon: FileCode, count: artifacts.length },
    { id: 'tasks', label: 'Tasks', icon: ListTodo, count: tasks.length },
    { id: 'subagents', label: 'Subagents', icon: Users, count: subagents.length },
    { id: 'terminal', label: 'Terminal', icon: Terminal },
  ];

  const handleRun = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cmdInput.trim()) return;
    onExecCommand(cmdInput.trim());
    setCmdInput('');
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Body */}
      <div className="relative w-96 max-w-[90vw] h-full bg-palenight-dark border-l border-palenight-border flex flex-col font-mono text-xs shadow-2xl z-10 animate-in slide-in-from-right duration-200">
        {/* Top Header */}
        <div className="h-12 border-b border-palenight-border px-3.5 flex items-center justify-between select-none shrink-0">
          <span className="font-bold text-palenight-bright text-xs">AUXILIARY PANELS</span>
          <button
            onClick={onClose}
            className="text-palenight-muted hover:text-palenight-fg p-1 rounded active:scale-95 transition-transform"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Strip */}
        <div className="flex border-b border-palenight-border bg-palenight-card shrink-0 select-none overflow-x-auto no-scrollbar">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeAuxTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveAuxTab(tab.id)}
                className={`flex-1 py-2 px-2.5 flex items-center justify-center space-x-1.5 border-b-2 text-[11px] whitespace-nowrap transition-colors touch-manipulation ${
                  isActive
                    ? 'border-palenight-mauve text-palenight-bright font-bold bg-palenight-dark/40'
                    : 'border-transparent text-palenight-muted hover:text-palenight-fg'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span className="text-[9px] px-1 rounded-full bg-palenight-border text-palenight-fg">
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Panel Content Body */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 overscroll-contain">
          {/* TAB 1: ARTIFACTS */}
          {activeAuxTab === 'artifacts' && (
            <div className="space-y-2.5">
              {artifacts.length === 0 ? (
                <div className="text-palenight-muted text-center py-8 text-[11px]">
                  No artifacts generated in this turn yet.
                </div>
              ) : (
                artifacts.map((art, idx) => (
                  <div key={idx} className="bg-palenight-card border border-palenight-border rounded-lg p-3 space-y-1.5">
                    <div className="flex items-center justify-between text-palenight-cyan font-bold text-xs">
                      <span>{art.title}</span>
                      <span className="text-[10px] text-palenight-muted">Turn #{art.stepIndex}</span>
                    </div>
                    <p className="text-[11px] text-palenight-fg leading-relaxed">{art.summary}</p>
                    {art.targetFile && (
                      <div className="text-[10px] text-palenight-muted font-mono truncate">
                        Target: <span className="text-palenight-bright">{art.targetFile}</span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 2: TASKS */}
          {activeAuxTab === 'tasks' && (
            <div className="space-y-2.5">
              {tasks.length === 0 ? (
                <div className="text-palenight-muted text-center py-8 text-[11px]">
                  No background processes active.
                </div>
              ) : (
                tasks.map((task) => (
                  <div key={task.id} className="bg-palenight-card border border-palenight-border rounded-lg p-3 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-palenight-bright font-bold">{task.id}</span>
                      <span className="text-[10px] text-palenight-green bg-palenight-dark px-1.5 py-0.5 rounded border border-palenight-border">
                        {task.status}
                      </span>
                    </div>
                    <div className="text-[10px] text-palenight-muted truncate">{task.logPath}</div>
                    <button
                      onClick={() => onKillTask(task.id)}
                      className="mt-1 text-[10px] text-palenight-red hover:bg-palenight-dark px-2 py-0.5 rounded border border-palenight-border/60 flex items-center space-x-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Terminate Process</span>
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 3: SUBAGENTS */}
          {activeAuxTab === 'subagents' && (
            <div className="space-y-2.5">
              {subagents.length === 0 ? (
                <div className="text-palenight-muted text-center py-8 text-[11px]">
                  No parallel subagents invoked in current session.
                </div>
              ) : (
                subagents.map((sub) => (
                  <div key={sub.id} className="bg-palenight-card border border-palenight-border rounded-lg p-3 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-palenight-mauve font-bold">{sub.role}</span>
                      <span className="text-[10px] text-palenight-cyan bg-palenight-dark px-1.5 py-0.5 rounded border border-palenight-border">
                        {sub.state}
                      </span>
                    </div>
                    <div className="text-[10px] text-palenight-muted font-mono">{sub.typeName} • {sub.id}</div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 4: TERMINAL */}
          {activeAuxTab === 'terminal' && (
            <div className="flex flex-col h-full space-y-2">
              <form onSubmit={handleRun} className="flex space-x-1.5 shrink-0">
                <input
                  type="text"
                  value={cmdInput}
                  onChange={(e) => setCmdInput(e.target.value)}
                  placeholder="Run shell command on Mac..."
                  className="flex-1 bg-palenight-card border border-palenight-border text-palenight-bright px-2.5 py-1.5 rounded text-xs focus:outline-none focus:border-palenight-mauve"
                />
                <button type="submit" className="bg-palenight-blue text-palenight-dark p-2 rounded font-bold">
                  <Play className="w-3.5 h-3.5 fill-palenight-dark" />
                </button>
              </form>

              {commandOutput && (
                <div className="bg-palenight-card border border-palenight-border rounded-md p-2 text-[11px] overflow-y-auto max-h-64">
                  <pre className="text-palenight-fg whitespace-pre-wrap">{commandOutput.output}</pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
