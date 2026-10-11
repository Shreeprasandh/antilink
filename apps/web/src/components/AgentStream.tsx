'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Check, X, Code, Terminal, Bot, User, ChevronDown, ChevronRight, Copy } from 'lucide-react';
import type { AgentStep, ToolConfirmationPayload } from '@antilink/shared';

interface AgentStreamProps {
  steps: AgentStep[];
  activeConfirmation: ToolConfirmationPayload | null;
  onConfirmTool: (stepIdx: number, approved: boolean) => void;
  onSendPrompt: (prompt: string) => void;
  onExecCommand: (cmd: string) => void;
}

export const AgentStream: React.FC<AgentStreamProps> = ({
  steps,
  activeConfirmation,
  onConfirmTool,
  onSendPrompt,
  onExecCommand,
}) => {
  const [inputPrompt, setInputPrompt] = useState('');
  const [expandedThoughts, setExpandedThoughts] = useState<Record<number, boolean>>({});
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isAutoScrollRef = useRef<boolean>(true);

  // Auto-scroll only if user is near bottom
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
    isAutoScrollRef.current = true;
  };

  const toggleThought = (idx: number) => {
    setExpandedThoughts((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(id);
    setTimeout(() => setCopiedIndex(null), 1500);
  };

  const quickChips = [
    { label: '/audit db', cmd: 'npm run lint' },
    { label: '/test', cmd: 'npm test' },
    { label: '/build', cmd: 'npm run build' },
    { label: 'git status', cmd: 'git status -s' },
  ];

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-palenight-bg">
      {/* Top Banner / Breadcrumb */}
      <div className="h-8 bg-palenight-dark/60 border-b border-palenight-border px-3.5 flex items-center justify-between text-[11px] text-palenight-muted select-none shrink-0 font-mono">
        <span className="flex items-center space-x-1.5">
          <Terminal className="w-3.5 h-3.5 text-palenight-mauve" />
          <span className="text-palenight-bright font-medium">TERMINAL & STREAM</span>
        </span>
        <span className="text-[10px] text-palenight-muted">{steps.length} turns recorded</span>
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
            <p className="text-[11px] text-palenight-muted max-w-xs">
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
                  ? 'bg-palenight-card border-palenight-blue/30 ml-4 sm:ml-8'
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
                <div className="mb-2.5 bg-palenight-dark/70 rounded border border-palenight-border/50 p-2 text-[11px]">
                  <button
                    onClick={() => toggleThought(step.stepIndex)}
                    className="flex items-center space-x-1 text-palenight-muted hover:text-palenight-fg w-full text-left touch-manipulation"
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

              {/* Message Content */}
              {step.content && (
                <div className="text-palenight-bright whitespace-pre-wrap leading-relaxed text-[11px] sm:text-xs">
                  {step.content}
                </div>
              )}

              {/* Tool Calls Execution Cards */}
              {step.toolCalls && step.toolCalls.length > 0 && (
                <div className="mt-2.5 space-y-2">
                  {step.toolCalls.map((tool, tIdx) => {
                    const toolCopyId = `tool-${step.stepIndex}-${tIdx}`;
                    const isCopied = copiedIndex === toolCopyId;

                    return (
                      <div
                        key={tIdx}
                        className="bg-palenight-dark/90 rounded border border-palenight-border p-2.5 text-[11px]"
                      >
                        <div className="flex items-center justify-between text-palenight-cyan font-bold mb-1.5">
                          <span className="flex items-center space-x-1.5">
                            <Code className="w-3.5 h-3.5 text-palenight-cyan" />
                            <span>{tool.name}</span>
                          </span>
                          <div className="flex items-center space-x-2">
                            {tool.output && (
                              <span className="text-palenight-green text-[10px] bg-palenight-card px-1.5 py-0.2 rounded border border-palenight-border font-normal">
                                executed
                              </span>
                            )}
                            <button
                              onClick={() => copyToClipboard(JSON.stringify(tool.args, null, 2), toolCopyId)}
                              className="text-palenight-muted hover:text-palenight-fg p-0.5"
                              title="Copy arguments"
                            >
                              {isCopied ? (
                                <Check className="w-3 h-3 text-palenight-green" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </div>

                        {tool.args && (
                          <pre className="text-palenight-fg text-[10px] bg-palenight-bg/80 p-2 rounded border border-palenight-border/60 overflow-x-auto leading-tight">
                            {JSON.stringify(tool.args, null, 2)}
                          </pre>
                        )}

                        {tool.output && (
                          <div className="mt-2 text-palenight-muted text-[10px] border-t border-palenight-border/40 pt-1.5">
                            <div className="truncate max-h-20 overflow-y-auto leading-snug">
                              {tool.output}
                            </div>
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
                className="flex-1 bg-palenight-green text-palenight-dark font-bold py-2 px-3 rounded-md flex items-center justify-center space-x-1.5 active:scale-98 transition-transform font-mono text-xs touch-manipulation"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Allow</span>
              </button>
              <button
                onClick={() => onConfirmTool(activeConfirmation.stepIdx, false)}
                className="flex-1 bg-palenight-red text-palenight-bright font-bold py-2 px-3 rounded-md flex items-center justify-center space-x-1.5 active:scale-98 transition-transform font-mono text-xs touch-manipulation"
              >
                <X className="w-3.5 h-3.5" />
                <span>Deny</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Quick Action Chips */}
      <div className="px-3 py-1.5 bg-palenight-dark/60 border-t border-palenight-border/60 flex space-x-1.5 overflow-x-auto no-scrollbar shrink-0 select-none">
        {quickChips.map((chip, i) => (
          <button
            key={i}
            onClick={() => onExecCommand(chip.cmd)}
            className="text-[10px] font-mono bg-palenight-card border border-palenight-border text-palenight-fg hover:text-palenight-bright px-2.5 py-1 rounded-md whitespace-nowrap active:bg-palenight-active transition-colors touch-manipulation"
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
          type="text"
          value={inputPrompt}
          onChange={(e) => setInputPrompt(e.target.value)}
          placeholder="Send prompt or instruction to Luna..."
          className="flex-1 bg-palenight-bg border border-palenight-border text-palenight-bright px-3 py-2 rounded-md text-xs sm:text-xs focus:outline-none focus:border-palenight-mauve placeholder-palenight-muted font-mono transition-colors"
        />
        <button
          type="submit"
          disabled={!inputPrompt.trim()}
          className="bg-palenight-mauve text-palenight-dark font-bold p-2.5 rounded-md disabled:opacity-30 active:scale-95 transition-all touch-manipulation shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
