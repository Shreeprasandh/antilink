'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send,
  Check,
  X,
  Code,
  Terminal,
  Bot,
  User,
  ChevronDown,
  ChevronRight,
  Copy,
  Maximize2,
  Minimize2,
  HelpCircle,
  Sparkles,
} from 'lucide-react';
import type { AgentStep, ToolConfirmationPayload } from '@antilink/shared';
import { MarkdownRenderer } from './MarkdownRenderer';

interface AgentStreamProps {
  steps: AgentStep[];
  activeConfirmation: ToolConfirmationPayload | null;
  activeConversationTitle?: string;
  onConfirmTool: (stepIdx: number, approved: boolean) => void;
  onSendPrompt: (prompt: string) => void;
  onExecCommand: (cmd: string) => void;
  onOpenShortcuts?: () => void;
}

export const AgentStream: React.FC<AgentStreamProps> = ({
  steps,
  activeConfirmation,
  activeConversationTitle,
  onConfirmTool,
  onSendPrompt,
  onExecCommand,
  onOpenShortcuts,
}) => {
  const [inputPrompt, setInputPrompt] = useState('');
  const [expandedThoughts, setExpandedThoughts] = useState<Record<number, boolean>>({});
  const [expandedTools, setExpandedTools] = useState<Record<string, boolean>>({});
  const [allToolsExpanded, setAllToolsExpanded] = useState<boolean>(false);
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);
  const [showSlashMenu, setShowSlashMenu] = useState<boolean>(false);
  const [selectedSlashIndex, setSelectedSlashIndex] = useState<number>(0);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isAutoScrollRef = useRef<boolean>(true);
  const inputRef = useRef<HTMLInputElement>(null);

  // Available Slash Commands & Custom Protocols
  const slashCommands = [
    {
      cmd: '/arise shadows',
      title: 'The Seven Shadows Audit',
      desc: 'Full-spectrum automated security & database parity audit',
      category: 'PROTOCOL',
    },
    {
      cmd: '/audit db',
      title: 'Database Parity Audit',
      desc: 'Run 100% database schema parity & RLS policy audit',
      category: 'PROTOCOL',
    },
    {
      cmd: '/convene the five monks',
      title: 'The Five Monks Council',
      desc: 'Summon strategic advisory council (Contrarian, Advisor, Expansionist, Outsider, Executor)',
      category: 'PROTOCOL',
    },
    {
      cmd: '/summon the alchemists',
      title: 'The Alchemists Team',
      desc: 'Mobilize 10-member research & data reconnaissance team',
      category: 'PROTOCOL',
    },
    {
      cmd: '/ask elders',
      title: 'The Elders Substrate',
      desc: 'Query calibrated System One decision substrate (Choice, Noul, Score)',
      category: 'PROTOCOL',
    },
    {
      cmd: '/refer the dumb',
      title: 'The Dumb Notebook',
      desc: 'Consult the living Master Study Notebook architecture record',
      category: 'PROTOCOL',
    },
    {
      cmd: '/plan',
      title: 'Architectural Plan',
      desc: 'Generate rigorous step-by-step engineering plan before execution',
      category: 'STANDARD',
    },
    {
      cmd: '/boost',
      title: 'Deep Reasoning Mode',
      desc: 'Engage multi-perspective strategic planning and deep verification',
      category: 'STANDARD',
    },
    {
      cmd: '/help',
      title: 'Antigravity Help',
      desc: 'Display available CLI slash commands, flags, and options',
      category: 'STANDARD',
    },
    {
      cmd: '/goal',
      title: 'Overnight Goal Mode',
      desc: 'Run autonomous long-running task until goal is fully achieved',
      category: 'STANDARD',
    },
    {
      cmd: '/schedule',
      title: 'Background Scheduler',
      desc: 'Schedule recurring cron job or one-time notification timer',
      category: 'STANDARD',
    },
    {
      cmd: '/browser',
      title: 'Puppeteer Browser',
      desc: 'Automate web browsing, search, and page interactions',
      category: 'STANDARD',
    },
  ];

  // Filter slash commands based on prompt
  const filteredCommands = inputPrompt.startsWith('/')
    ? slashCommands.filter((s) => s.cmd.toLowerCase().includes(inputPrompt.toLowerCase()))
    : [];

  // Toggle all tools expanded / collapsed (Ctrl+O parity)
  const toggleAllTools = useCallback(() => {
    setAllToolsExpanded((prev) => {
      const next = !prev;
      const updated: Record<string, boolean> = {};
      steps.forEach((s) => {
        if (s.toolCalls) {
          s.toolCalls.forEach((_, tIdx) => {
            updated[`${s.stepIndex}-${tIdx}`] = next;
          });
        }
      });
      setExpandedTools(updated);
      return next;
    });
  }, [steps]);

  // Global Ctrl+O keyboard listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        toggleAllTools();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleAllTools]);

  // Auto-scroll on new steps
  useEffect(() => {
    if (isAutoScrollRef.current && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [steps, activeConfirmation]);

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    isAutoScrollRef.current = scrollHeight - scrollTop - clientHeight < 100;
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputPrompt.trim()) return;
    onSendPrompt(inputPrompt.trim());
    setInputPrompt('');
    setShowSlashMenu(false);
    isAutoScrollRef.current = true;
  };

  const toggleThought = (idx: number) => {
    setExpandedThoughts((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const toggleTool = (toolKey: string) => {
    setExpandedTools((prev) => ({ ...prev, [toolKey]: !prev[toolKey] }));
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(id);
    setTimeout(() => setCopiedIndex(null), 1500);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputPrompt(val);
    if (val.startsWith('/')) {
      setShowSlashMenu(true);
      setSelectedSlashIndex(0);
    } else {
      setShowSlashMenu(false);
    }
  };

  const selectCommand = (cmd: string) => {
    setInputPrompt(cmd + ' ');
    setShowSlashMenu(false);
    inputRef.current?.focus();
  };

  // Quick chips featuring custom protocols
  const quickChips = [
    { label: '/arise shadows', cmd: '/arise shadows' },
    { label: '/audit db', cmd: '/audit db' },
    { label: '/convene the five monks', cmd: '/convene the five monks' },
    { label: '/summon the alchemists', cmd: '/summon the alchemists' },
    { label: '/ask elders', cmd: '/ask elders' },
    { label: '/refer the dumb', cmd: '/refer the dumb' },
    { label: '/plan', cmd: '/plan' },
  ];

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-palenight-bg font-mono select-none">
      {/* Top Banner & Control Strip */}
      <div className="h-8 bg-palenight-dark border-b border-palenight-border px-3 flex items-center justify-between text-[11px] text-palenight-muted shrink-0 select-none">
        <span className="flex items-center space-x-1.5 truncate max-w-[60%]">
          <Terminal className="w-3.5 h-3.5 text-palenight-mauve shrink-0" />
          <span className="text-palenight-bright font-semibold truncate">
            {activeConversationTitle || 'TERMINAL & STREAM'}
          </span>
        </span>

        <div className="flex items-center space-x-2 text-[10px]">
          {/* Ctrl+O Tools Toggle Button */}
          <button
            onClick={toggleAllTools}
            className="flex items-center space-x-1 text-palenight-muted hover:text-palenight-bright bg-palenight-card border border-palenight-border px-1.5 py-0.5 rounded cursor-pointer touch-manipulation transition-colors"
            title="Press Ctrl+O to expand or collapse all tool outputs"
          >
            {allToolsExpanded ? (
              <>
                <Minimize2 className="w-3 h-3 text-palenight-mauve" />
                <span className="hidden sm:inline">Ctrl+O Collapse</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3 h-3 text-palenight-mauve" />
                <span className="hidden sm:inline">Ctrl+O Expand</span>
              </>
            )}
          </button>

          {/* Shortcuts Help Button */}
          {onOpenShortcuts && (
            <button
              onClick={onOpenShortcuts}
              className="text-palenight-muted hover:text-palenight-fg p-0.5 cursor-pointer"
              title="Keyboard Shortcuts (?)"
            >
              <HelpCircle className="w-3.5 h-3.5" />
            </button>
          )}

          <span className="text-palenight-muted hidden xs:inline">{steps.length} turns</span>
        </div>
      </div>

      {/* Steps Transcript Scroll Container */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 font-mono text-xs overscroll-contain"
      >
        {steps.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-palenight-muted space-y-2 p-6 text-center select-none">
            <Bot className="w-8 h-8 text-palenight-border" />
            <p className="text-palenight-fg font-medium">Waiting for active agent session...</p>
            <p className="text-[11px] text-palenight-muted max-w-xs leading-relaxed">
              Agent responses, reasoning traces, and tool approvals will stream here in real time.
            </p>
          </div>
        )}

        {steps.map((step) => {
          const isUser = step.source === 'USER_EXPLICIT' || step.type === 'USER_INPUT';
          const hasThought = Boolean(step.thinking);
          const isThoughtExpanded = Boolean(expandedThoughts[step.stepIndex]);

          return (
            <div
              key={step.stepIndex}
              className={`rounded-lg border p-3 transition-colors ${
                isUser
                  ? 'bg-palenight-card border-palenight-blue/40 ml-4 sm:ml-8'
                  : 'bg-palenight-card/70 border-palenight-border mr-2 sm:mr-4'
              }`}
            >
              {/* Step Header */}
              <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-palenight-border/40 text-[10px]">
                <div className="flex items-center space-x-1.5">
                  {isUser ? (
                    <User className="w-3.5 h-3.5 text-palenight-blue" />
                  ) : (
                    <Bot className="w-3.5 h-3.5 text-palenight-mauve" />
                  )}
                  <span className={isUser ? 'text-palenight-blue font-bold' : 'text-palenight-mauve font-bold'}>
                    {isUser ? 'USER' : 'LUNA'}
                  </span>
                  <span className="text-palenight-muted font-mono">#{step.stepIndex}</span>
                </div>
                <span className="text-palenight-muted font-mono">
                  {new Date(step.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>

              {/* Collapsible Thinking Block */}
              {hasThought && (
                <div className="mb-2 bg-palenight-dark/80 rounded border border-palenight-border/50 p-2 text-[11px]">
                  <button
                    onClick={() => toggleThought(step.stepIndex)}
                    className="flex items-center space-x-1 text-palenight-muted hover:text-palenight-fg w-full text-left touch-manipulation cursor-pointer"
                  >
                    {isThoughtExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5 text-palenight-mauve" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-palenight-mauve" />
                    )}
                    <span className="italic text-[10px] text-palenight-mauve">Internal Reasoning Trace</span>
                  </button>
                  {isThoughtExpanded && (
                    <div className="mt-1.5 text-palenight-muted whitespace-pre-wrap pl-3.5 border-l-2 border-palenight-mauve/40 text-[10px] leading-relaxed">
                      {step.thinking}
                    </div>
                  )}
                </div>
              )}

              {/* Message Content with Palenight MarkdownRenderer */}
              {step.content && (
                <div className="text-palenight-bright select-text">
                  <MarkdownRenderer content={step.content} />
                </div>
              )}

              {/* Tool Calls Execution (Minimized by Default, Toggle via Ctrl+O or Click) */}
              {step.toolCalls && step.toolCalls.length > 0 && (
                <div className="mt-2.5 space-y-1.5">
                  {step.toolCalls.map((tool, tIdx) => {
                    const toolKey = `${step.stepIndex}-${tIdx}`;
                    const isExpanded = Boolean(expandedTools[toolKey]);
                    const isCopied = copiedIndex === toolKey;

                    // Compute concise target description
                    const targetSummary =
                      (tool.args.TargetFile as string) ||
                      (tool.args.CommandLine as string) ||
                      (tool.args.query as string) ||
                      (tool.args.AbsolutePath as string) ||
                      (tool.args.toolSummary as string) ||
                      '';

                    return (
                      <div
                        key={tIdx}
                        className="bg-palenight-dark border border-palenight-border rounded overflow-hidden text-[11px]"
                      >
                        {/* Compact Single-Line Bar (Minimized Default) */}
                        <div
                          onClick={() => toggleTool(toolKey)}
                          className="flex items-center justify-between px-2.5 py-1.5 cursor-pointer hover:bg-palenight-card/60 transition-colors select-none"
                        >
                          <div className="flex items-center space-x-2 truncate mr-2">
                            {isExpanded ? (
                              <ChevronDown className="w-3.5 h-3.5 text-palenight-mauve shrink-0" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5 text-palenight-mauve shrink-0" />
                            )}
                            <Code className="w-3 h-3 text-palenight-cyan shrink-0" />
                            <span className="text-palenight-cyan font-bold">{tool.name}</span>
                            {targetSummary && (
                              <span className="text-palenight-muted truncate text-[10px]">
                                {targetSummary.slice(0, 48)}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center space-x-1.5 shrink-0 text-[10px]">
                            {tool.output && (
                              <span className="text-palenight-green bg-palenight-card px-1.5 py-0.2 rounded border border-palenight-border font-mono">
                                completed
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Expanded Details & Output */}
                        {isExpanded && (
                          <div className="p-2.5 border-t border-palenight-border/60 bg-[#1B1E2B] space-y-2">
                            <div className="flex items-center justify-between text-[10px] text-palenight-muted">
                              <span>Arguments</span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  copyToClipboard(JSON.stringify(tool.args, null, 2), toolKey);
                                }}
                                className="hover:text-palenight-fg flex items-center space-x-1 p-0.5 cursor-pointer"
                                title="Copy arguments"
                              >
                                {isCopied ? (
                                  <Check className="w-3 h-3 text-palenight-green" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                                <span>{isCopied ? 'copied' : 'copy'}</span>
                              </button>
                            </div>

                            <pre className="text-palenight-fg text-[10px] bg-palenight-bg/90 p-2 rounded border border-palenight-border/60 overflow-x-auto leading-tight">
                              {JSON.stringify(tool.args, null, 2)}
                            </pre>

                            {tool.output && (
                              <div className="border-t border-palenight-border/40 pt-1.5">
                                <div className="text-[10px] text-palenight-muted mb-1">Output:</div>
                                <pre className="text-palenight-muted text-[10px] bg-palenight-bg/60 p-2 rounded max-h-36 overflow-y-auto leading-snug whitespace-pre-wrap">
                                  {tool.output}
                                </pre>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Floating Tool Confirmation Prompt */}
        {activeConfirmation && (
          <div className="rounded-lg border border-palenight-yellow bg-palenight-card p-3.5 shadow-xl transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-palenight-yellow font-bold text-xs uppercase tracking-wider font-mono">
                Confirmation Required
              </span>
              <span className="text-palenight-muted text-[10px] font-mono">
                Step #{activeConfirmation.stepIdx}
              </span>
            </div>

            <div className="text-palenight-bright text-xs mb-1.5 font-mono">
              Tool: <span className="text-palenight-cyan font-bold">{activeConfirmation.toolName}</span>
            </div>

            {activeConfirmation.commandLine && (
              <pre className="bg-palenight-dark p-2.5 rounded border border-palenight-border text-palenight-fg text-[11px] mb-3 overflow-x-auto font-mono">
                {activeConfirmation.commandLine}
              </pre>
            )}

            {activeConfirmation.targetFile && (
              <div className="text-palenight-fg text-[11px] mb-3 font-mono">
                Target: <span className="text-palenight-cyan">{activeConfirmation.targetFile}</span>
              </div>
            )}

            <div className="flex space-x-2">
              <button
                onClick={() => onConfirmTool(activeConfirmation.stepIdx, true)}
                className="flex-1 bg-palenight-green text-palenight-dark font-bold py-2 px-3 rounded-md flex items-center justify-center space-x-1.5 active:scale-98 transition-transform font-mono text-xs touch-manipulation cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Allow</span>
              </button>
              <button
                onClick={() => onConfirmTool(activeConfirmation.stepIdx, false)}
                className="flex-1 bg-palenight-red text-palenight-bright font-bold py-2 px-3 rounded-md flex items-center justify-center space-x-1.5 active:scale-98 transition-transform font-mono text-xs touch-manipulation cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Deny</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Floating Slash Commands Autocomplete Menu */}
      {showSlashMenu && filteredCommands.length > 0 && (
        <div className="mx-2 mb-1 bg-palenight-dark border border-palenight-border rounded-lg shadow-2xl overflow-hidden font-mono text-xs max-h-56 overflow-y-auto z-20 animate-in slide-in-from-bottom-2 duration-150">
          <div className="px-3 py-1.5 bg-palenight-card border-b border-palenight-border text-[10px] text-palenight-muted flex items-center justify-between select-none">
            <span className="flex items-center space-x-1 text-palenight-mauve font-bold">
              <Sparkles className="w-3 h-3" />
              <span>COMMANDS & PROTOCOLS</span>
            </span>
            <span>Tab or click to select</span>
          </div>

          <div className="p-1 space-y-0.5">
            {filteredCommands.map((item, idx) => {
              const isSelected = idx === selectedSlashIndex;
              return (
                <button
                  key={item.cmd}
                  onClick={() => selectCommand(item.cmd)}
                  className={`w-full text-left px-2.5 py-1.5 rounded flex items-center justify-between transition-colors cursor-pointer ${
                    isSelected ? 'bg-palenight-card text-palenight-bright' : 'text-palenight-fg hover:bg-palenight-card/50'
                  }`}
                >
                  <div className="flex flex-col truncate mr-2">
                    <span className="font-bold text-palenight-mauve text-xs">{item.cmd}</span>
                    <span className="text-[10px] text-palenight-muted truncate">{item.desc}</span>
                  </div>
                  <span className="text-[9px] uppercase px-1.5 py-0.2 rounded border border-palenight-border/60 text-palenight-cyan shrink-0">
                    {item.category}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick Action Chips (Our Custom Protocols) */}
      <div className="px-3 py-1.5 bg-palenight-dark border-t border-palenight-border/60 flex space-x-1.5 overflow-x-auto no-scrollbar shrink-0 select-none">
        {quickChips.map((chip, i) => (
          <button
            key={i}
            onClick={() => {
              onSendPrompt(chip.cmd);
            }}
            className="text-[10px] font-mono bg-palenight-card border border-palenight-border text-palenight-fg hover:text-palenight-bright hover:border-palenight-mauve px-2.5 py-1 rounded-md whitespace-nowrap active:bg-palenight-active transition-colors touch-manipulation cursor-pointer"
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Prompt Input Form */}
      <form
        onSubmit={handleSend}
        className="p-2.5 bg-palenight-dark border-t border-palenight-border shrink-0 flex items-center space-x-2"
      >
        <input
          ref={inputRef}
          type="text"
          value={inputPrompt}
          onChange={handleInputChange}
          placeholder="Type a message or / for commands..."
          className="flex-1 bg-palenight-bg border border-palenight-border text-palenight-bright px-3 py-2 rounded-md text-xs sm:text-xs focus:outline-none focus:border-palenight-mauve placeholder-palenight-muted font-mono transition-colors"
        />
        <button
          type="submit"
          disabled={!inputPrompt.trim()}
          className="bg-palenight-mauve text-palenight-dark font-bold p-2.5 rounded-md disabled:opacity-30 active:scale-95 transition-all touch-manipulation shrink-0 cursor-pointer"
          title="Send message to Luna"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
