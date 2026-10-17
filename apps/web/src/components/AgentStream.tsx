'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
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
  ShieldCheck,
  ExternalLink,
  Settings,
  Clock,
  Paperclip,
  Mic,
  MicOff,
  ChevronUp,
  Loader2,
} from 'lucide-react';
import type { AgentStep, ToolConfirmationPayload, QueuedPrompt } from '@antilink/shared';
import { MarkdownRenderer } from './MarkdownRenderer';

// Helper function to produce concise, informative 2-5 word step summaries
function formatStepSummary(step: AgentStep): string {
  if (step.toolCalls && step.toolCalls.length > 0) {
    const tool = step.toolCalls[0];
    const args = tool.args || {};
    if (typeof args.toolSummary === 'string' && args.toolSummary.trim()) {
      return args.toolSummary.trim();
    }
    if (typeof args.toolAction === 'string' && args.toolAction.trim()) {
      return args.toolAction.trim();
    }
    const toolName = tool.name;
    if (toolName === 'view_file') {
      const file = (args.AbsolutePath as string) || (args.path as string) || '';
      const base = file ? file.split('/').filter(Boolean).pop() : 'file';
      return `Reading ${base}`;
    }
    if (toolName === 'write_to_file') {
      const file = (args.TargetFile as string) || (args.path as string) || '';
      const base = file ? file.split('/').filter(Boolean).pop() : 'file';
      return `Writing ${base}`;
    }
    if (toolName === 'replace_file_content') {
      const file = (args.TargetFile as string) || (args.path as string) || '';
      const base = file ? file.split('/').filter(Boolean).pop() : 'file';
      return `Editing ${base}`;
    }
    if (toolName === 'run_command') {
      const cmd = ((args.CommandLine as string) || (args.command as string) || '').replace(/^["']|["']$/g, '').trim();
      const tokens = cmd.split(/\s+/).slice(0, 3).join(' ');
      return tokens ? `Running ${tokens}` : 'Running command';
    }
    if (toolName === 'search_web') {
      const query = (args.query as string) || '';
      return query ? `Searching: ${query.slice(0, 18)}` : 'Searching web';
    }
    if (toolName === 'read_url_content') return 'Fetching URL';
    if (toolName === 'manage_task') return 'Managing task';
    if (toolName === 'invoke_subagent') return 'Invoking subagent';
    return `Tool: ${toolName}`;
  }
  if (step.type === 'GENERIC') return 'Command output log';
  if (step.type === 'SYSTEM_MESSAGE') return 'System notification';
  if (step.thinking && (!step.content || !step.content.trim())) return 'Reasoning & planning';
  if (step.content && step.content.trim()) {
    const firstLine = step.content.trim().split('\n')[0].replace(/^[#*>\-\s]+/, '');
    const words = firstLine.split(/\s+/).slice(0, 5).join(' ');
    return words ? `${words}...` : 'Luna response';
  }
  return 'Execution step';
}

interface AgentStreamProps {
  isActive?: boolean;
  gatewayUrl?: string;
  steps: AgentStep[];
  activeConfirmation: ToolConfirmationPayload | null;
  activeConversationTitle?: string;
  remoteControlUrl?: string;
  userName?: string;
  assistantName?: string;
  isAgentWorking?: boolean;
  promptQueue?: QueuedPrompt[];
  onCancelQueuedPrompt?: (promptId: string) => void;
  onConfirmTool: (stepIdx: number, approved: boolean, optionNumber?: number, commandLine?: string) => void;
  onSendPrompt: (prompt: string) => void;
  onExecCommand: (cmd: string) => void;
  onOpenShortcuts?: () => void;
  onOpenSettings?: () => void;
}

export const AgentStream: React.FC<AgentStreamProps> = ({
  isActive = true,
  gatewayUrl,
  steps,
  activeConfirmation,
  activeConversationTitle,
  remoteControlUrl = 'https://antigravity.google.com/r/fe05edc8-4845-4227-8a3a-6f6eb60335d4-v2?p=c%2Fd933eaf8-272e-4559-89bc-a9c284a5eed0%3Fsection%3Ddefault-cli-project',
  userName = 'Shreeprasandh',
  assistantName = 'Luna',
  isAgentWorking = false,
  promptQueue = [],
  onCancelQueuedPrompt,
  onConfirmTool,
  onSendPrompt,
  onExecCommand,
  onOpenShortcuts,
  onOpenSettings,
}) => {
  const [inputPrompt, setInputPrompt] = useState('');
  const [optimisticSteps, setOptimisticSteps] = useState<AgentStep[]>([]);
  const [expandedSteps, setExpandedSteps] = useState<Record<number, boolean>>({});
  const [expandedThoughts, setExpandedThoughts] = useState<Record<number, boolean>>({});
  const [allExpanded, setAllExpanded] = useState<boolean>(false);
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);
  const [showSlashMenu, setShowSlashMenu] = useState<boolean>(false);
  const [selectedSlashIndex, setSelectedSlashIndex] = useState<number>(0);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [dismissedSteps, setDismissedSteps] = useState<Set<number>>(new Set());
  const [isExpandedInput, setIsExpandedInput] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastScrollTopRef = useRef<number>(0);
  const isAutoScrollRef = useRef<boolean>(true);
  const initialScrollDoneRef = useRef<boolean>(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  // Merge steps with optimistic user prompts
  const allSteps = useMemo(() => {
    if (optimisticSteps.length === 0) return steps;
    const pendingOptimistic = optimisticSteps.filter(
      (opt) => !steps.some((s) => (s.source === 'USER_EXPLICIT' || s.type === 'USER_INPUT') && s.content === opt.content)
    );
    return [...steps, ...pendingOptimistic];
  }, [steps, optimisticSteps]);

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

  // Determine which steps are "Final Summaries" vs "Intermediate Steps"
  // Per directive: "make sure each steps the ai takes is minimized and only the final summary is given expanded"
  const finalSummaryStepIndices = useMemo(() => {
    const finalSet = new Set<number>();
    if (allSteps.length === 0) return finalSet;

    let lastCandidateIndexInTurn: number | null = null;

    for (let i = 0; i < allSteps.length; i++) {
      const step = allSteps[i];
      const isUser = step.source === 'USER_EXPLICIT' || step.type === 'USER_INPUT';

      if (isUser) {
        if (lastCandidateIndexInTurn !== null) {
          finalSet.add(lastCandidateIndexInTurn);
          lastCandidateIndexInTurn = null;
        }
        continue;
      }

      const isToolOutput = step.type === 'GENERIC';
      const isSystem = step.type === 'SYSTEM_MESSAGE';
      const hasTools = Boolean(step.toolCalls && step.toolCalls.length > 0);
      const hasContent = Boolean(step.content && step.content.trim().length > 0);

      // Only clean assistant responses without pending tool invocations qualify as summaries
      if (!isToolOutput && !isSystem && !hasTools && hasContent) {
        lastCandidateIndexInTurn = step.stepIndex;
      }
    }

    if (lastCandidateIndexInTurn !== null) {
      finalSet.add(lastCandidateIndexInTurn);
    }

    return finalSet;
  }, [allSteps]);

  // Determine if there is an active pending approval request (and extract context)
  // Strictly applies to CLI tool execution ('run_command'), never conversational text
  const pendingApproval = useMemo<{
    type: 'TOOL';
    stepIndex: number;
    toolName?: string;
    commandLine?: string;
    targetFile?: string;
  } | null>(() => {
    // 1. Explicit tool confirmation takes precedence
    if (activeConfirmation) {
      if (dismissedSteps.has(activeConfirmation.stepIdx)) return null;
      return {
        type: 'TOOL',
        stepIndex: activeConfirmation.stepIdx,
        toolName: activeConfirmation.toolName,
        commandLine: activeConfirmation.commandLine,
        targetFile: activeConfirmation.targetFile,
      };
    }

    // 2. Check if the latest step in conversation is explicitly waiting for confirmation
    if (allSteps.length > 0) {
      const lastStep = allSteps[allSteps.length - 1];
      if (
        !dismissedSteps.has(lastStep.stepIndex) &&
        lastStep.source !== 'USER_EXPLICIT' &&
        lastStep.type !== 'USER_INPUT' &&
        lastStep.status === 'WAITING_CONFIRMATION' &&
        lastStep.toolCalls &&
        lastStep.toolCalls.length > 0
      ) {
        const tool = lastStep.toolCalls[0];
        if (tool.name === 'run_command') {
          const rawCmd = (tool.args.CommandLine as string) || (tool.args.command as string) || '';
          const cmd = rawCmd.replace(/^["']|["']$/g, '').trim();
          return {
            type: 'TOOL',
            stepIndex: lastStep.stepIndex,
            toolName: tool.name,
            commandLine: cmd || 'command',
            targetFile: undefined,
          };
        }
      }
    }

    return null;
  }, [activeConfirmation, allSteps, dismissedSteps]);

  // Toggle all steps expanded / collapsed (Ctrl+O parity)
  const toggleAllSteps = useCallback(() => {
    setAllExpanded((prev) => {
      const next = !prev;
      const updated: Record<number, boolean> = {};
      steps.forEach((s) => {
        updated[s.stepIndex] = next;
      });
      setExpandedSteps(updated);
      return next;
    });
  }, [steps]);

  // Global Ctrl+O keyboard listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        toggleAllSteps();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleAllSteps]);

  // Keyboard shortcuts for Interactive Permission / Approval Card (1, 2, 3, 4, Enter, Esc)
  useEffect(() => {
    if (!pendingApproval) return;

    const handleApprovalKey = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in chat input or another form field
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      const stepIdx = pendingApproval.stepIndex;

      if (pendingApproval.type === 'TOOL') {
        const rawCmd = pendingApproval.commandLine;
        if (e.key === '1' || e.key === 'Enter') {
          e.preventDefault();
          onConfirmTool(stepIdx, true, 1, rawCmd);
          setDismissedSteps((prev) => new Set(prev).add(stepIdx));
          setActionFeedback('Option 1 selected: Running command [Enter] ✓');
          setTimeout(() => setActionFeedback(null), 3000);
        } else if (e.key === '2') {
          e.preventDefault();
          onConfirmTool(stepIdx, true, 2, rawCmd);
          setDismissedSteps((prev) => new Set(prev).add(stepIdx));
          const cmd = (rawCmd || 'command').replace(/^["']|["']$/g, '').trim();
          const prefix = cmd.split(/\s+/).slice(0, 2).join(' ');
          setActionFeedback(`Option 2 selected: Allowed '${prefix}' in conversation [2] ✓`);
          setTimeout(() => setActionFeedback(null), 3000);
        } else if (e.key === '3') {
          e.preventDefault();
          onConfirmTool(stepIdx, true, 3, rawCmd);
          setDismissedSteps((prev) => new Set(prev).add(stepIdx));
          const cmd = (rawCmd || 'command').replace(/^["']|["']$/g, '').trim();
          const prefix = cmd.split(/\s+/).slice(0, 2).join(' ');
          setActionFeedback(`Option 3 selected: Persisted '${prefix}' to settings.json [3] ✓`);
          setTimeout(() => setActionFeedback(null), 3000);
        } else if (e.key === '4' || e.key === 'Escape') {
          e.preventDefault();
          onConfirmTool(stepIdx, false, 4, rawCmd);
          setDismissedSteps((prev) => new Set(prev).add(stepIdx));
          setActionFeedback('Option 4 selected: Cancelled command [Esc] ✗');
          setTimeout(() => setActionFeedback(null), 3000);
        }
      }
    };

    window.addEventListener('keydown', handleApprovalKey);
    return () => window.removeEventListener('keydown', handleApprovalKey);
  }, [pendingApproval, onConfirmTool]);

  // Scroll position preservation on tab switch: restore instantly without smooth animation
  useEffect(() => {
    if (isActive && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop =
        lastScrollTopRef.current > 0 ? lastScrollTopRef.current : scrollContainerRef.current.scrollHeight;
    }
  }, [isActive]);

  // Reset initial scroll flag when switching conversation title
  useEffect(() => {
    initialScrollDoneRef.current = false;
  }, [activeConversationTitle]);

  // Auto-scroll on steps / confirmation
  useEffect(() => {
    if (!scrollContainerRef.current) return;

    // On initial mount / reload: jump instantly to bottom without smooth scrolling animation
    if (!initialScrollDoneRef.current) {
      if (allSteps.length > 0) {
        scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
        initialScrollDoneRef.current = true;
      }
      return;
    }

    // Incremental steps: only smooth-scroll if user is already at bottom
    if (isAutoScrollRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [allSteps, activeConfirmation]);

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    if (scrollTop > 0) {
      lastScrollTopRef.current = scrollTop;
    }
    isAutoScrollRef.current = scrollHeight - scrollTop - clientHeight < 100;
  };

  // Auto-resize textarea to fit content up to max-height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const maxHeight = isExpandedInput ? 240 : 120;
      const nextHeight = Math.min(textareaRef.current.scrollHeight, maxHeight);
      textareaRef.current.style.height = `${Math.max(38, nextHeight)}px`;
    }
  }, [inputPrompt, isExpandedInput]);

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const promptText = inputPrompt.trim();
    if (!promptText) return;
    if (pendingApproval) {
      setDismissedSteps((prev) => new Set(prev).add(pendingApproval.stepIndex));
    }

    // If agent is busy, prompt will be queued in waiting state rather than immediate execution
    if (!isAgentWorking) {
      const optimisticStep: AgentStep = {
        stepIndex: Date.now(),
        source: 'USER_EXPLICIT',
        type: 'USER_INPUT',
        status: 'DONE',
        createdAt: new Date().toISOString(),
        content: promptText,
      };
      setOptimisticSteps((prev) => [...prev, optimisticStep]);
    } else {
      setActionFeedback('Prompt waiting in queue — will send when Luna finishes current task');
      setTimeout(() => setActionFeedback(null), 3500);
    }

    onSendPrompt(promptText);
    setInputPrompt('');
    setShowSlashMenu(false);
    isAutoScrollRef.current = true;
  };

  const toggleStep = (stepIdx: number) => {
    setExpandedSteps((prev) => ({ ...prev, [stepIdx]: !prev[stepIdx] }));
  };

  const toggleThought = (idx: number) => {
    setExpandedThoughts((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(id);
    setTimeout(() => setCopiedIndex(null), 1500);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInputPrompt(val);
    if (val.startsWith('/')) {
      setShowSlashMenu(true);
      setSelectedSlashIndex(0);
    } else {
      setShowSlashMenu(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showSlashMenu && filteredCommands.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedSlashIndex((prev) => (prev + 1) % filteredCommands.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedSlashIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        selectCommand(filteredCommands[selectedSlashIndex].cmd);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowSlashMenu(false);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setActionFeedback(`Uploading ${file.name}...`);

    try {
      const token = localStorage.getItem('antilink_token') || '';
      const apiBase = gatewayUrl ? gatewayUrl : '';
      const res = await fetch(`${apiBase}/api/upload?token=${token}&filename=${encodeURIComponent(file.name)}`, {
        method: 'POST',
        headers: {
          'ngrok-skip-browser-warning': 'true',
        },
        body: file,
      });
      const data = await res.json();
      if (data.success && data.filePath) {
        setInputPrompt((prev) => {
          const spacer = prev && !prev.endsWith(' ') && !prev.endsWith('\n') ? ' ' : '';
          return `${prev}${spacer}[Attached file: ${data.filePath}]`;
        });
        setActionFeedback(`Uploaded: ${file.name}`);
      } else {
        setActionFeedback(`Upload failed: ${data.error || 'Unknown error'}`);
      }
    } catch (err: unknown) {
      setActionFeedback(`Upload failed: ${(err as Error).message}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setTimeout(() => setActionFeedback(null), 3000);
    }
  };

  const toggleVoiceRecording = () => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition =
      (window as unknown as { SpeechRecognition?: any }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: any }).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setActionFeedback('Speech recognition not supported in this browser');
      setTimeout(() => setActionFeedback(null), 2500);
      return;
    }

    if (isRecording) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
      setIsRecording(false);
      setActionFeedback('Voice recording stopped');
      setTimeout(() => setActionFeedback(null), 1500);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsRecording(true);
        setActionFeedback('Listening... Speak now');
      };

      recognition.onresult = (event: any) => {
        let final = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript;
          }
        }
        if (final) {
          setInputPrompt((prev) => {
            const spacer = prev && !prev.endsWith(' ') && !prev.endsWith('\n') ? ' ' : '';
            return `${prev}${spacer}${final.trim()}`;
          });
        }
      };

      recognition.onerror = () => {
        setIsRecording(false);
        recognitionRef.current = null;
      };

      recognition.onend = () => {
        setIsRecording(false);
        recognitionRef.current = null;
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setIsRecording(false);
      setActionFeedback('Microphone permission denied');
      setTimeout(() => setActionFeedback(null), 2500);
    }
  };

  const selectCommand = (cmd: string) => {
    setInputPrompt(cmd + ' ');
    setShowSlashMenu(false);
    textareaRef.current?.focus();
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
        <span className="flex items-center space-x-1.5 truncate max-w-[65%]">
          <Terminal className="w-3.5 h-3.5 text-palenight-mauve shrink-0" />
          <span className="text-palenight-bright font-semibold truncate">
            {activeConversationTitle || 'TERMINAL & STREAM'}
          </span>
          {isAgentWorking ? (
            <span className="flex items-center space-x-1 text-palenight-yellow bg-palenight-yellow/10 border border-palenight-yellow/30 px-1.5 py-0.2 rounded text-[9px] font-mono shrink-0 ml-1">
              <span className="w-1.5 h-1.5 rounded-full bg-palenight-yellow animate-ping shrink-0" />
              <span>WORKING</span>
            </span>
          ) : (
            <span className="flex items-center space-x-1 text-palenight-green bg-palenight-green/10 border border-palenight-green/30 px-1.5 py-0.2 rounded text-[9px] font-mono shrink-0 ml-1">
              <span className="w-1.5 h-1.5 rounded-full bg-palenight-green shrink-0" />
              <span>IDLE</span>
            </span>
          )}
        </span>

        <div className="flex items-center space-x-2 text-[10px]">
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
        {allSteps.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-palenight-muted space-y-2 p-6 text-center select-none">
            <Bot className="w-8 h-8 text-palenight-border" />
            <p className="text-palenight-fg font-medium">Waiting for active agent session...</p>
            <p className="text-[11px] text-palenight-muted max-w-xs leading-relaxed">
              Intermediate steps will be minimized and final responses will be expanded in professional layout.
            </p>
          </div>
        )}

        {allSteps.map((step) => {
          const isUser = step.source === 'USER_EXPLICIT' || step.type === 'USER_INPUT';
          const isFinalSummary = finalSummaryStepIndices.has(step.stepIndex);
          const hasThought = Boolean(step.thinking);
          const isThoughtExpanded = Boolean(expandedThoughts[step.stepIndex]);

          // By default: Final summaries are EXPANDED; Intermediate steps are MINIMIZED
          const isStepExpanded =
            expandedSteps[step.stepIndex] !== undefined
              ? expandedSteps[step.stepIndex]
              : isFinalSummary || allExpanded;

          // 1. USER PROMPT BUBBLE
          if (isUser) {
            return (
              <div
                key={step.stepIndex}
                className="rounded-lg border border-palenight-blue/40 bg-palenight-card p-3 ml-4 sm:ml-12 shadow-sm"
              >
                <div className="flex items-center justify-between mb-1.5 pb-1 border-b border-palenight-border/40 text-[10px]">
                  <div className="flex items-center space-x-1.5">
                    <User className="w-3.5 h-3.5 text-palenight-blue" />
                    <span className="text-palenight-blue font-bold">{userName.toUpperCase()}</span>
                    <span className="text-palenight-muted font-mono">#{step.stepIndex}</span>
                  </div>
                  <span className="text-palenight-muted font-mono">
                    {new Date(step.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="text-palenight-bright select-text">
                  <MarkdownRenderer content={step.content || ''} />
                </div>
              </div>
            );
          }

          // 2. MINIMIZED INTERMEDIATE MODEL STEP
          if (!isFinalSummary && !isStepExpanded) {
            const label = formatStepSummary(step);

            return (
              <div
                key={step.stepIndex}
                onClick={() => toggleStep(step.stepIndex)}
                className="bg-palenight-dark/60 hover:bg-palenight-card/80 border border-palenight-border/60 rounded px-3 py-1.5 flex items-center justify-between transition-colors cursor-pointer select-none text-[11px] font-mono group mr-2 sm:mr-6"
                title="Click or press Ctrl+O to expand intermediate details"
              >
                <div className="flex items-center space-x-2 truncate mr-2">
                  <ChevronRight className="w-3.5 h-3.5 text-palenight-muted group-hover:text-palenight-mauve shrink-0" />
                  <span className="text-[10px] text-palenight-muted font-bold">#{step.stepIndex}</span>
                  <span className="text-palenight-fg truncate">{label}</span>
                </div>

                <span className="text-[10px] text-palenight-muted shrink-0 bg-palenight-card px-1.5 py-0.2 rounded border border-palenight-border/50 font-mono">
                  {step.status === 'DONE' ? 'completed' : step.status.toLowerCase()}
                </span>
              </div>
            );
          }

          // 3. EXPANDED STEP (Final Summary OR User-Expanded Intermediate Step)
          return (
            <div
              key={step.stepIndex}
              className={`rounded-lg border p-3.5 transition-colors mr-2 sm:mr-6 ${
                isFinalSummary
                  ? 'bg-palenight-card/90 border-palenight-border shadow-md'
                  : 'bg-palenight-card/50 border-palenight-border/60'
              }`}
            >
              {/* Step Header */}
              <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-palenight-border/40 text-[10px]">
                <div className="flex items-center space-x-1.5">
                  <Bot className="w-3.5 h-3.5 text-palenight-mauve" />
                  <span className="text-palenight-mauve font-bold">
                    {isFinalSummary ? `${assistantName.toUpperCase()} (SUMMARY)` : `${assistantName.toUpperCase()} (STEP)`}
                  </span>
                  <span className="text-palenight-muted font-mono">#{step.stepIndex}</span>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="text-palenight-muted font-mono">
                    {new Date(step.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                  {!isFinalSummary && (
                    <button
                      onClick={() => toggleStep(step.stepIndex)}
                      className="text-palenight-muted hover:text-palenight-fg p-0.5 cursor-pointer"
                      title="Minimize step"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Collapsible Thinking Block */}
              {hasThought && (
                <div className="mb-2.5 bg-palenight-dark/80 rounded border border-palenight-border/50 p-2 text-[11px]">
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

              {/* Tool Calls Execution Cards */}
              {step.toolCalls && step.toolCalls.length > 0 && (
                <div className="mt-2.5 space-y-1.5">
                  {step.toolCalls.map((tool, tIdx) => {
                    const toolKey = `${step.stepIndex}-${tIdx}`;
                    const isCopied = copiedIndex === toolKey;

                    return (
                      <div
                        key={tIdx}
                        className="bg-palenight-dark border border-palenight-border rounded overflow-hidden text-[11px]"
                      >
                        <div className="flex items-center justify-between px-2.5 py-1.5 bg-palenight-card/50 select-none">
                          <div className="flex items-center space-x-2 truncate">
                            <Code className="w-3 h-3 text-palenight-cyan shrink-0" />
                            <span className="text-palenight-cyan font-bold">{tool.name}</span>
                          </div>
                          <button
                            onClick={() => copyToClipboard(JSON.stringify(tool.args, null, 2), toolKey)}
                            className="text-palenight-muted hover:text-palenight-fg p-0.5 cursor-pointer"
                            title="Copy arguments"
                          >
                            {isCopied ? <Check className="w-3 h-3 text-palenight-green" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </div>

                        <pre className="text-palenight-fg text-[10px] bg-palenight-bg/90 p-2 overflow-x-auto leading-tight">
                          {JSON.stringify(tool.args, null, 2)}
                        </pre>

                        {tool.output && (
                          <div className="p-2 border-t border-palenight-border/40 bg-palenight-bg/60">
                            <pre className="text-palenight-muted text-[10px] max-h-32 overflow-y-auto leading-snug whitespace-pre-wrap">
                              {tool.output}
                            </pre>
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

        {/* Interactive Action Approval Card (ONLY shown when there is ACTUALLY something to approve!) */}
        {pendingApproval && (
          <div className="rounded-lg border-2 border-palenight-mauve/80 bg-palenight-card p-4 shadow-2xl transition-all mr-2 sm:mr-6 animate-in slide-in-from-bottom-2 duration-150 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-palenight-bright font-bold text-xs font-mono">
                <ShieldCheck className="w-4 h-4 text-palenight-mauve" />
                <span>Tool Execution Permission</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] text-palenight-yellow font-mono font-bold bg-palenight-dark px-2.5 py-0.5 rounded border border-palenight-border animate-pulse">
                  Pending Decision
                </span>
                <button
                  onClick={() => setDismissedSteps((prev) => new Set(prev).add(pendingApproval.stepIndex))}
                  className="text-palenight-muted hover:text-palenight-fg p-0.5 cursor-pointer"
                  title="Dismiss card"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Tool / Command Permission Request matching Antigravity CLI */}
            <div className="space-y-3">
              <div className="bg-palenight-dark/95 rounded p-3 border border-palenight-border/60 text-xs font-mono space-y-1.5">
                <div className="text-[10px] text-palenight-muted">Requesting permission for:</div>
                <pre className="text-palenight-cyan bg-palenight-bg p-2 rounded overflow-x-auto text-[11px] font-bold border border-palenight-border/40 select-text leading-relaxed">
                  {pendingApproval.commandLine || pendingApproval.targetFile || pendingApproval.toolName}
                </pre>
              </div>

              <div className="text-xs text-palenight-bright font-mono font-bold">
                Run this command?
              </div>

              {/* 4 Interactive Choice Buttons matching CLI numbered menu */}
              <div className="space-y-1.5 pt-0.5">
                {/* Option 1: Yes, run command */}
                <button
                  onClick={() => {
                    const stepIdx = pendingApproval.stepIndex;
                    onConfirmTool(stepIdx, true, 1, pendingApproval.commandLine);
                    setDismissedSteps((prev) => new Set(prev).add(stepIdx));
                    setActionFeedback('Option 1 selected: Running command ✓');
                    setTimeout(() => setActionFeedback(null), 3000);
                  }}
                  className="w-full text-left bg-palenight-green/10 hover:bg-palenight-green/20 border border-palenight-green/40 hover:border-palenight-green text-palenight-bright p-2.5 rounded-md flex items-center justify-between transition-all cursor-pointer group"
                >
                  <div className="flex items-center space-x-2 text-xs font-mono">
                    <span className="font-bold text-palenight-green text-sm">1.</span>
                    <span className="font-semibold text-palenight-bright group-hover:text-palenight-green">
                      Yes, run command
                    </span>
                  </div>
                  <span className="text-[10px] text-palenight-muted group-hover:text-palenight-bright font-mono bg-palenight-dark px-1.5 py-0.5 rounded border border-palenight-border/40">
                    [Enter]
                  </span>
                </button>

                {/* Option 2: Yes, and always allow in this conversation */}
                <button
                  onClick={() => {
                    const stepIdx = pendingApproval.stepIndex;
                    onConfirmTool(stepIdx, true, 2, pendingApproval.commandLine);
                    setDismissedSteps((prev) => new Set(prev).add(stepIdx));
                    const cmd = (pendingApproval.commandLine || 'command').replace(/^["']|["']$/g, '').trim();
                    const prefix = cmd.split(/\s+/).slice(0, 2).join(' ');
                    setActionFeedback(`Option 2 selected: Allowed '${prefix}' in conversation ✓`);
                    setTimeout(() => setActionFeedback(null), 3000);
                  }}
                  className="w-full text-left bg-palenight-dark hover:bg-palenight-card border border-palenight-border/60 hover:border-palenight-mauve text-palenight-fg p-2.5 rounded-md flex items-center justify-between transition-all cursor-pointer group"
                >
                  <div className="flex items-center space-x-2 text-xs font-mono">
                    <span className="font-bold text-palenight-mauve text-sm">2.</span>
                    <span className="text-[11px] group-hover:text-palenight-bright">
                      Yes, and always allow in this conversation for commands that start with &apos;{(() => {
                        const cmd = (pendingApproval.commandLine || 'command').replace(/^["']|["']$/g, '').trim();
                        return cmd.split(/\s+/).slice(0, 2).join(' ');
                      })()}&apos;
                    </span>
                  </div>
                  <span className="text-[10px] text-palenight-muted font-mono bg-palenight-dark px-1.5 py-0.5 rounded border border-palenight-border/40">
                    [2]
                  </span>
                </button>

                {/* Option 3: Yes, and always allow (Persist to settings.json) */}
                <button
                  onClick={() => {
                    const stepIdx = pendingApproval.stepIndex;
                    onConfirmTool(stepIdx, true, 3, pendingApproval.commandLine);
                    setDismissedSteps((prev) => new Set(prev).add(stepIdx));
                    const cmd = (pendingApproval.commandLine || 'command').replace(/^["']|["']$/g, '').trim();
                    const prefix = cmd.split(/\s+/).slice(0, 2).join(' ');
                    setActionFeedback(`Option 3 selected: Persisted '${prefix}' to settings.json ✓`);
                    setTimeout(() => setActionFeedback(null), 3000);
                  }}
                  className="w-full text-left bg-palenight-dark hover:bg-palenight-card border border-palenight-border/60 hover:border-palenight-cyan text-palenight-fg p-2.5 rounded-md flex items-center justify-between transition-all cursor-pointer group"
                >
                  <div className="flex items-center space-x-2 text-xs font-mono">
                    <span className="font-bold text-palenight-cyan text-sm">3.</span>
                    <span className="text-[11px] group-hover:text-palenight-bright">
                      Yes, and always allow for commands that start with &apos;{(() => {
                        const cmd = (pendingApproval.commandLine || 'command').replace(/^["']|["']$/g, '').trim();
                        return cmd.split(/\s+/).slice(0, 2).join(' ');
                      })()}&apos; (Persist to settings.json)
                    </span>
                  </div>
                  <span className="text-[10px] text-palenight-muted font-mono bg-palenight-dark px-1.5 py-0.5 rounded border border-palenight-border/40">
                    [3]
                  </span>
                </button>

                {/* Option 4: No, cancel */}
                <button
                  onClick={() => {
                    const stepIdx = pendingApproval.stepIndex;
                    onConfirmTool(stepIdx, false, 4, pendingApproval.commandLine);
                    setDismissedSteps((prev) => new Set(prev).add(stepIdx));
                    setActionFeedback('Option 4 selected: Cancelled command ✗');
                    setTimeout(() => setActionFeedback(null), 3000);
                  }}
                  className="w-full text-left bg-palenight-red/10 hover:bg-palenight-red/20 border border-palenight-red/40 hover:border-palenight-red text-palenight-bright p-2.5 rounded-md flex items-center justify-between transition-all cursor-pointer group"
                >
                  <div className="flex items-center space-x-2 text-xs font-mono">
                    <span className="font-bold text-palenight-red text-sm">4.</span>
                    <span className="font-semibold text-palenight-red">
                      No, cancel
                    </span>
                  </div>
                  <span className="text-[10px] text-palenight-muted font-mono bg-palenight-dark px-1.5 py-0.5 rounded border border-palenight-border/40">
                    [4]
                  </span>
                </button>
              </div>
            </div>

            {/* Quick Action Steering Pills */}
            <div className="flex flex-wrap gap-1.5 pt-1 border-t border-palenight-border/40">
              <span className="text-[10px] text-palenight-muted py-0.5 mr-1 font-mono">Quick Steer:</span>
              <button
                onClick={() => {
                  setDismissedSteps((prev) => new Set(prev).add(pendingApproval.stepIndex));
                  onSendPrompt('npm test');
                }}
                className="text-[10px] bg-palenight-dark hover:bg-palenight-card border border-palenight-border/60 text-palenight-fg px-2 py-0.5 rounded cursor-pointer touch-manipulation transition-colors"
              >
                Run Tests
              </button>
              <button
                onClick={() => {
                  setDismissedSteps((prev) => new Set(prev).add(pendingApproval.stepIndex));
                  onSendPrompt('/arise shadows');
                }}
                className="text-[10px] bg-palenight-dark hover:bg-palenight-card border border-palenight-border/60 text-palenight-mauve px-2 py-0.5 rounded cursor-pointer touch-manipulation transition-colors"
              >
                /arise shadows
              </button>
              <button
                onClick={() => {
                  setDismissedSteps((prev) => new Set(prev).add(pendingApproval.stepIndex));
                  onSendPrompt('/convene the five monks');
                }}
                className="text-[10px] bg-palenight-dark hover:bg-palenight-card border border-palenight-border/60 text-palenight-yellow px-2 py-0.5 rounded cursor-pointer touch-manipulation transition-colors"
              >
                Five Monks
              </button>
            </div>

            {/* Official Google Remote Control Direct Link */}
            <div className="pt-1 text-center border-t border-palenight-border/30">
              <a
                href={remoteControlUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-palenight-cyan hover:underline inline-flex items-center space-x-1 font-mono"
              >
                <span>Direct Google Antigravity Remote Control Link</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
          </div>
        )}

        {/* Waiting / Queued Prompts Container */}
        {promptQueue && promptQueue.length > 0 && (
          <div className="space-y-2 mr-2 sm:mr-6 animate-in slide-in-from-bottom-2 duration-150">
            {promptQueue.map((item, qIdx) => (
              <div
                key={item.id}
                className="rounded-lg border border-palenight-yellow/50 bg-palenight-card/90 p-3.5 shadow-lg space-y-2"
              >
                <div className="flex items-center justify-between pb-1.5 border-b border-palenight-border/50 text-[10px]">
                  <div className="flex items-center space-x-1.5">
                    <Clock className="w-3.5 h-3.5 text-palenight-yellow animate-pulse shrink-0" />
                    <span className="text-palenight-yellow font-bold uppercase tracking-wider">
                      WAITING TO SEND (QUEUED #{qIdx + 1})
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] text-palenight-muted font-mono">
                      {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                    {onCancelQueuedPrompt && (
                      <button
                        onClick={() => onCancelQueuedPrompt(item.id)}
                        className="text-palenight-red hover:text-palenight-bright text-[10px] bg-palenight-dark px-1.5 py-0.5 rounded border border-palenight-red/40 hover:border-palenight-red cursor-pointer flex items-center space-x-1 transition-colors"
                        title="Cancel this queued prompt"
                      >
                        <X className="w-3 h-3" />
                        <span>Cancel</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="text-[11px] text-palenight-muted leading-relaxed">
                  Luna is currently executing. This message will automatically dispatch as soon as she completes the active task.
                </div>

                <div className="bg-palenight-dark rounded p-2.5 border border-palenight-border/60 text-palenight-bright select-text text-xs leading-relaxed font-mono">
                  {item.text}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Floating Action Feedback Toast */}
      {actionFeedback && (
        <div className="mx-3 mb-1 bg-palenight-card border border-palenight-yellow/50 text-palenight-yellow px-3 py-1.5 rounded text-[11px] font-mono flex items-center justify-between shadow-lg animate-in fade-in slide-in-from-bottom-1 duration-150 z-30">
          <span className="flex items-center space-x-1.5">
            <Clock className="w-3.5 h-3.5 animate-spin shrink-0" />
            <span>{actionFeedback}</span>
          </span>
          <button
            onClick={() => setActionFeedback(null)}
            className="text-palenight-muted hover:text-palenight-fg p-0.5 ml-2 cursor-pointer"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

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
        className="p-2.5 bg-palenight-dark border-t border-palenight-border shrink-0 flex items-end space-x-2 relative"
      >
        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileUpload}
        />

        {/* File Upload Button (Paperclip) */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="p-2 rounded-md text-palenight-muted hover:text-palenight-bright hover:bg-palenight-card border border-palenight-border active:scale-95 transition-all touch-manipulation shrink-0 cursor-pointer disabled:opacity-40"
          title="Upload file or screenshot to workspace"
        >
          {isUploading ? (
            <Loader2 className="w-4 h-4 animate-spin text-palenight-mauve" />
          ) : (
            <Paperclip className="w-4 h-4" />
          )}
        </button>

        {/* Voice Dictation Button (Microphone) */}
        <button
          type="button"
          onClick={toggleVoiceRecording}
          className={`p-2 rounded-md border active:scale-95 transition-all touch-manipulation shrink-0 cursor-pointer ${
            isRecording
              ? 'bg-palenight-red/20 border-palenight-red text-palenight-red animate-pulse'
              : 'text-palenight-muted hover:text-palenight-bright hover:bg-palenight-card border-palenight-border'
          }`}
          title={isRecording ? 'Stop voice recording' : 'Voice dictation (speech-to-text)'}
        >
          {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>

        {/* Auto-expanding Multiline Textarea Container */}
        <div className="flex-1 relative flex items-center">
          <textarea
            ref={textareaRef}
            rows={1}
            value={inputPrompt}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={
              isAgentWorking
                ? "Luna is working... Type to queue a message"
                : "Type a message or / for commands..."
            }
            className="w-full bg-palenight-bg border border-palenight-border text-palenight-bright px-3 py-2 pr-8 rounded-md text-xs focus:outline-none focus:border-palenight-mauve placeholder-palenight-muted font-mono transition-all resize-none leading-relaxed overflow-y-auto"
          />

          {/* Expand/Collapse Long Message Toggle */}
          <button
            type="button"
            onClick={() => setIsExpandedInput((prev) => !prev)}
            className="absolute right-2 top-2.5 text-palenight-muted hover:text-palenight-fg p-0.5 cursor-pointer"
            title={isExpandedInput ? "Collapse input" : "Expand input for long messages"}
          >
            {isExpandedInput ? (
              <Minimize2 className="w-3.5 h-3.5 text-palenight-mauve" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {/* Send Button */}
        <button
          type="submit"
          disabled={!inputPrompt.trim()}
          className="bg-palenight-mauve text-palenight-dark font-bold p-2.5 rounded-md disabled:opacity-30 active:scale-95 transition-all touch-manipulation shrink-0 cursor-pointer"
          title={isAgentWorking ? "Queue message for Luna" : "Send message to Luna"}
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
