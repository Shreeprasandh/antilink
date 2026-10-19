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
  Clock,
  Paperclip,
  Mic,
  MicOff,
  Loader2,
  Play,
  FileText,
  AlertTriangle,
  Activity,
  Archive,
} from 'lucide-react';
import type { AgentStep, ToolConfirmationPayload, QueuedPrompt, AgentActivityState } from '@antilink/shared';
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
    if (toolName === 'view_file' || toolName === 'read_file' || toolName === 'read_text_file') {
      const file = (args.AbsolutePath as string) || (args.path as string) || '';
      const base = file ? file.split('/').filter(Boolean).pop() : 'file';
      return `Reading ${base}`;
    }
    if (toolName === 'write_to_file') {
      const file = (args.TargetFile as string) || (args.path as string) || '';
      const base = file ? file.split('/').filter(Boolean).pop() : 'file';
      return `Writing ${base}`;
    }
    if (toolName === 'replace_file_content' || toolName === 'edit_file') {
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

function classifyToolCategory(step: AgentStep): 'read' | 'edit' | 'command' | 'task' | 'search' | 'output' | 'other' {
  if (step.type === 'GENERIC') return 'output';
  if (!step.toolCalls || step.toolCalls.length === 0) return 'other';
  const name = step.toolCalls[0].name;
  if (name === 'view_file' || name === 'read_file' || name === 'read_text_file' || name === 'read_multiple_files' || name === 'get_file_info') return 'read';
  if (name === 'replace_file_content' || name === 'write_to_file' || name === 'edit_file') return 'edit';
  if (name === 'run_command') return 'command';
  if (name === 'manage_task' || name === 'schedule' || name === 'invoke_subagent') return 'task';
  if (name === 'search_web' || name === 'read_url_content') return 'search';
  return 'other';
}

function formatGroupSummary(steps: AgentStep[]): { title: string; subtitle?: string } {
  const fileNames: string[] = [];
  const commandSnippets: string[] = [];
  let readCount = 0;
  let editCount = 0;
  let cmdCount = 0;
  let taskCount = 0;

  for (const s of steps) {
    if (s.toolCalls && s.toolCalls.length > 0) {
      for (const t of s.toolCalls) {
        const name = t.name;
        const args = t.args || {};
        if (name === 'view_file' || name === 'read_file' || name === 'read_text_file' || name === 'read_multiple_files') {
          readCount++;
          const p = (args.AbsolutePath as string) || (args.path as string) || '';
          if (p) {
            const base = p.split('/').filter(Boolean).pop();
            if (base && !fileNames.includes(base)) fileNames.push(base);
          }
        } else if (name === 'replace_file_content' || name === 'write_to_file' || name === 'edit_file') {
          editCount++;
          const p = (args.TargetFile as string) || (args.path as string) || '';
          if (p) {
            const base = p.split('/').filter(Boolean).pop();
            if (base && !fileNames.includes(base)) fileNames.push(base);
          }
        } else if (name === 'run_command') {
          cmdCount++;
          const raw = ((args.CommandLine as string) || (args.command as string) || '').replace(/^["']|["']$/g, '').trim();
          const tokens = raw.split(/\s+/).slice(0, 3).join(' ');
          if (tokens && !commandSnippets.includes(tokens)) commandSnippets.push(tokens);
        } else if (name === 'manage_task' || name === 'schedule' || name === 'invoke_subagent') {
          taskCount++;
        }
      }
    }
  }

  // 1. All reads
  if (readCount > 0 && editCount === 0 && cmdCount === 0 && taskCount === 0) {
    const preview = fileNames.slice(0, 3).join(', ');
    const remaining = fileNames.length - 3;
    const suffix = remaining > 0 ? `, +${remaining}` : '';
    return {
      title: `Explored ${readCount} ${readCount === 1 ? 'file' : 'files'}`,
      subtitle: preview ? `(${preview}${suffix})` : undefined,
    };
  }

  // 2. All edits
  if (editCount > 0 && readCount === 0 && cmdCount === 0 && taskCount === 0) {
    const preview = fileNames.slice(0, 3).join(', ');
    const remaining = fileNames.length - 3;
    const suffix = remaining > 0 ? `, +${remaining}` : '';
    return {
      title: `Edited ${editCount} ${editCount === 1 ? 'file' : 'files'}`,
      subtitle: preview ? `(${preview}${suffix})` : undefined,
    };
  }

  // 3. Commands & Tasks
  if (cmdCount > 0 || taskCount > 0) {
    const parts: string[] = [];
    if (cmdCount > 0) parts.push(`Ran ${cmdCount} ${cmdCount === 1 ? 'command' : 'commands'}`);
    if (taskCount > 0) parts.push(`managed ${taskCount} ${taskCount === 1 ? 'task' : 'tasks'}`);
    if (readCount > 0) parts.push(`explored ${readCount}`);
    if (editCount > 0) parts.push(`edited ${editCount}`);

    const preview = commandSnippets.slice(0, 2).join(' · ');
    const remaining = commandSnippets.length - 2;
    const suffix = remaining > 0 ? ` · +${remaining} more` : '';

    return {
      title: parts.slice(0, 2).join(', '),
      subtitle: preview ? `(${preview}${suffix})` : undefined,
    };
  }

  // 4. Large mixed group
  const breakdownParts: string[] = [];
  if (readCount > 0) breakdownParts.push(`${readCount} reads`);
  if (editCount > 0) breakdownParts.push(`${editCount} edits`);
  if (cmdCount > 0) breakdownParts.push(`${cmdCount} commands`);
  if (taskCount > 0) breakdownParts.push(`${taskCount} tasks`);

  return {
    title: `${steps.length} actions`,
    subtitle: breakdownParts.length > 0 ? `(${breakdownParts.join(', ')})` : undefined,
  };
}

interface StepGroupItem {
  id: string;
  category: string;
  title: string;
  subtitle?: string;
  steps: AgentStep[];
}

type TurnItem =
  | { type: 'user'; id: string; step: AgentStep }
  | { type: 'group'; id: string; group: StepGroupItem }
  | { type: 'summary'; id: string; step: AgentStep };

interface AgentStreamProps {
  isActive?: boolean;
  gatewayUrl?: string;
  steps: AgentStep[];
  activeConfirmation: ToolConfirmationPayload | null;
  activeConversationTitle?: string;
  activeConversationId?: string | null;
  isHistoricalSession?: boolean;
  remoteControlUrl?: string;
  userName?: string;
  assistantName?: string;
  isAgentWorking?: boolean;
  activity?: AgentActivityState | null;
  projectName?: string;
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
  activeConversationId,
  isHistoricalSession = false,
  remoteControlUrl = 'https://antigravity.google.com/r/fe05edc8-4845-4227-8a3a-6f6eb60335d4-v2?p=c%2Fd933eaf8-272e-4559-89bc-a9c284a5eed0%3Fsection%3Ddefault-cli-project',
  userName = 'Shreeprasandh',
  assistantName = 'Luna',
  isAgentWorking = false,
  activity = null,
  projectName = '',
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
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
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
  const shouldBeRecordingRef = useRef<boolean>(false);
  const basePromptRef = useRef<string>('');

  // Merge steps with optimistic user prompts
  const allSteps = useMemo(() => {
    if (optimisticSteps.length === 0) return steps;
    const pendingOptimistic = optimisticSteps.filter(
      (opt) => !steps.some((s) => (s.source === 'USER_EXPLICIT' || s.type === 'USER_INPUT') && s.content === opt.content)
    );
    return [...steps, ...pendingOptimistic];
  }, [steps, optimisticSteps]);

  // Identify final assistant summary responses in each turn
  const finalSummaryStepIndices = useMemo(() => {
    const finalSet = new Set<number>();
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

      if (!isToolOutput && !isSystem && !hasTools && hasContent) {
        lastCandidateIndexInTurn = step.stepIndex;
      }
    }

    if (lastCandidateIndexInTurn !== null) {
      finalSet.add(lastCandidateIndexInTurn);
    }

    return finalSet;
  }, [allSteps]);

  // Partition steps into Hierarchical Turns & Cohesive Action Groups
  const turnItems = useMemo<TurnItem[]>(() => {
    const items: TurnItem[] = [];
    let currentIntermediateSteps: AgentStep[] = [];
    let currentCategory: string | null = null;
    let groupCounter = 0;

    const flushGroup = () => {
      if (currentIntermediateSteps.length === 0) return;
      const grpSummary = formatGroupSummary(currentIntermediateSteps);
      const grpId = `group-${currentIntermediateSteps[0].stepIndex}-${groupCounter++}`;
      items.push({
        type: 'group',
        id: grpId,
        group: {
          id: grpId,
          category: currentCategory || 'mixed',
          title: grpSummary.title,
          subtitle: grpSummary.subtitle,
          steps: [...currentIntermediateSteps],
        },
      });
      currentIntermediateSteps = [];
      currentCategory = null;
    };

    for (let i = 0; i < allSteps.length; i++) {
      const step = allSteps[i];
      const isUser = step.source === 'USER_EXPLICIT' || step.type === 'USER_INPUT';
      const isFinalSummary = finalSummaryStepIndices.has(step.stepIndex);

      if (isUser) {
        flushGroup();
        items.push({
          type: 'user',
          id: `user-${step.stepIndex}`,
          step,
        });
        continue;
      }

      if (isFinalSummary) {
        flushGroup();
        items.push({
          type: 'summary',
          id: `summary-${step.stepIndex}`,
          step,
        });
        continue;
      }

      // Intermediate tool / thought / generic step
      const stepCat = classifyToolCategory(step);
      if (currentCategory && currentCategory !== stepCat && stepCat !== 'output' && currentIntermediateSteps.length >= 2) {
        flushGroup();
      }

      if (!currentCategory || currentCategory === 'output') {
        currentCategory = stepCat;
      }
      currentIntermediateSteps.push(step);

      if (currentIntermediateSteps.length >= 8) {
        flushGroup();
      }
    }

    flushGroup();
    return items;
  }, [allSteps, finalSummaryStepIndices]);

  // Determine if there is an active pending approval request
  const pendingApproval = useMemo<{
    type: 'TOOL';
    stepIndex: number;
    toolName?: string;
    commandLine?: string;
    targetFile?: string;
  } | null>(() => {
    // 1. Explicit tool confirmation from server takes precedence
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

    // 2. Fallback: check if latest step is a pending PLANNER_RESPONSE with sensitive tool call while agent is working
    if (allSteps.length > 0 && isAgentWorking) {
      const lastStep = allSteps[allSteps.length - 1];
      if (
        !dismissedSteps.has(lastStep.stepIndex) &&
        lastStep.source !== 'USER_EXPLICIT' &&
        lastStep.type !== 'USER_INPUT' &&
        lastStep.type === 'PLANNER_RESPONSE' &&
        lastStep.toolCalls &&
        lastStep.toolCalls.length > 0
      ) {
        const tool = lastStep.toolCalls[0];
        if (tool.name === 'run_command' || tool.name === 'ask_question' || tool.isConfirmationRequired) {
          const rawCmd = (tool.args.CommandLine as string) || (tool.args.command as string) || '';
          const cmd = rawCmd.replace(/^["']|["']$/g, '').trim();
          return {
            type: 'TOOL',
            stepIndex: lastStep.stepIndex,
            toolName: tool.name,
            commandLine: cmd || undefined,
            targetFile: (tool.args.TargetFile as string) || (tool.args.path as string) || undefined,
          };
        }
      }
    }

    return null;
  }, [activeConfirmation, allSteps, dismissedSteps, isAgentWorking]);

  // Toggle all steps expanded / collapsed (Ctrl+O parity)
  const toggleAllSteps = useCallback(() => {
    setAllExpanded((prev) => {
      const next = !prev;
      const updatedSteps: Record<number, boolean> = {};
      const updatedGroups: Record<string, boolean> = {};

      allSteps.forEach((s) => {
        updatedSteps[s.stepIndex] = next;
      });
      turnItems.forEach((item) => {
        if (item.type === 'group') {
          updatedGroups[item.group.id] = next;
        }
      });

      setExpandedSteps(updatedSteps);
      setExpandedGroups(updatedGroups);
      return next;
    });
  }, [allSteps, turnItems]);

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

  // Keyboard shortcuts for Interactive Permission / Approval Card (1, 2, 4, Enter, Esc)
  useEffect(() => {
    if (!pendingApproval) return;

    const handleApprovalKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      const stepIdx = pendingApproval.stepIndex;
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
        setActionFeedback(`Option 2 selected: Persisted '${prefix}' to permissions [2] ✓`);
        setTimeout(() => setActionFeedback(null), 3000);
      } else if (e.key === '4' || e.key === 'Escape') {
        e.preventDefault();
        onConfirmTool(stepIdx, false, 4, rawCmd);
        setDismissedSteps((prev) => new Set(prev).add(stepIdx));
        setActionFeedback('Option 4 selected: Cancelled command [Esc] ✗');
        setTimeout(() => setActionFeedback(null), 3000);
      }
    };

    window.addEventListener('keydown', handleApprovalKey);
    return () => window.removeEventListener('keydown', handleApprovalKey);
  }, [pendingApproval, onConfirmTool]);

  // Scroll preservation
  useEffect(() => {
    if (isActive && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop =
        lastScrollTopRef.current > 0 ? lastScrollTopRef.current : scrollContainerRef.current.scrollHeight;
    }
  }, [isActive]);

  useEffect(() => {
    initialScrollDoneRef.current = false;
  }, [activeConversationTitle]);

  useEffect(() => {
    if (!scrollContainerRef.current) return;
    if (!initialScrollDoneRef.current) {
      if (allSteps.length > 0) {
        scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
        initialScrollDoneRef.current = true;
      }
      return;
    }
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

  // Dynamic textarea auto-resize with ZERO initial scrollbars
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

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
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

  // Continuous Real-Time Speech-to-Text streaming dictation
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
      shouldBeRecordingRef.current = false;
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
      setIsRecording(false);
      setActionFeedback('Voice dictation stopped');
      setTimeout(() => setActionFeedback(null), 1500);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      basePromptRef.current = inputPrompt;
      shouldBeRecordingRef.current = true;

      recognition.onstart = () => {
        setIsRecording(true);
        setActionFeedback('Listening in real time... Speak now');
      };

      recognition.onresult = (event: any) => {
        let interim = '';
        let final = '';

        for (let i = 0; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }

        const currentSpoken = (final + (interim ? ' ' + interim : '')).trim();
        if (currentSpoken) {
          const base = basePromptRef.current.trim();
          const separator = base ? ' ' : '';
          setInputPrompt(`${base}${separator}${currentSpoken}`);
        }
      };

      recognition.onerror = (e: any) => {
        if (e.error === 'no-speech') return;
        shouldBeRecordingRef.current = false;
        setIsRecording(false);
        recognitionRef.current = null;
      };

      recognition.onend = () => {
        if (shouldBeRecordingRef.current) {
          try {
            recognition.start();
          } catch {
            setIsRecording(false);
            shouldBeRecordingRef.current = false;
          }
        } else {
          setIsRecording(false);
          recognitionRef.current = null;
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setIsRecording(false);
      shouldBeRecordingRef.current = false;
      setActionFeedback('Microphone access denied');
      setTimeout(() => setActionFeedback(null), 2500);
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

      if (res.ok) {
        const data = await res.json();
        const uploadedPath = data.path || file.name;
        setInputPrompt((prev) => {
          const spacer = prev ? ' ' : '';
          return `${prev}${spacer}[Uploaded file: ${uploadedPath}]`;
        });
        setActionFeedback(`Uploaded ${file.name} successfully ✓`);
      } else {
        setActionFeedback(`Upload failed: ${res.statusText}`);
      }
    } catch (err: any) {
      setActionFeedback(`Upload error: ${err.message}`);
    } finally {
      setIsUploading(false);
      setTimeout(() => setActionFeedback(null), 3000);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const slashCommands = [
    { cmd: '/arise shadows', title: 'The Seven Shadows Audit', desc: 'Full-spectrum automated security & database parity audit', category: 'PROTOCOL' },
    { cmd: '/audit db', title: 'Database Parity Audit', desc: 'Run 100% database schema parity & RLS policy audit', category: 'PROTOCOL' },
    { cmd: '/convene the five monks', title: 'The Five Monks Council', desc: 'Summon strategic advisory council (Contrarian, Advisor, Expansionist, Outsider, Executor)', category: 'PROTOCOL' },
    { cmd: '/summon the alchemists', title: 'The Alchemists Team', desc: 'Mobilize 10-member research & data reconnaissance team', category: 'PROTOCOL' },
    { cmd: '/ask elders', title: 'The Elders Substrate', desc: 'Query calibrated System One decision substrate (Choice, Noul, Score)', category: 'PROTOCOL' },
    { cmd: '/refer the dumb', title: 'The Dumb Notebook', desc: 'Consult the living Master Study Notebook architecture record', category: 'PROTOCOL' },
    { cmd: '/plan', title: 'Architectural Plan', desc: 'Generate rigorous step-by-step engineering plan before execution', category: 'STANDARD' },
    { cmd: '/boost', title: 'Deep Reasoning Mode', desc: 'Engage multi-perspective strategic planning and deep verification', category: 'STANDARD' },
    { cmd: '/goal', title: 'Overnight Goal Mode', desc: 'Run autonomous long-running task until goal is fully achieved', category: 'STANDARD' },
    { cmd: '/schedule', title: 'Background Scheduler', desc: 'Schedule recurring cron job or one-time notification timer', category: 'STANDARD' },
    { cmd: '/compact', title: 'Compact Context', desc: 'Compact active conversation history into summary context', category: 'STANDARD' },
  ];

  const filteredCommands = useMemo(() => {
    if (!inputPrompt.startsWith('/')) return [];
    const query = inputPrompt.toLowerCase();
    return slashCommands.filter(
      (c) => c.cmd.toLowerCase().includes(query) || c.title.toLowerCase().includes(query)
    );
  }, [inputPrompt]);

  const selectCommand = (cmd: string) => {
    setInputPrompt(cmd + ' ');
    setShowSlashMenu(false);
    textareaRef.current?.focus();
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

  const quickChips = [
    { label: '/arise shadows', cmd: '/arise shadows' },
    { label: '/audit db', cmd: '/audit db' },
    { label: '/convene the five monks', cmd: '/convene the five monks' },
    { label: '/summon the alchemists', cmd: '/summon the alchemists' },
    { label: '/ask elders', cmd: '/ask elders' },
    { label: '/refer the dumb', cmd: '/refer the dumb' },
  ];

  // Helper renderer for Level 3 expanded tool execution cards
  const renderExpandedStep = (step: AgentStep, isSummary: boolean) => {
    const hasThought = Boolean(step.thinking);
    const isThoughtExpanded = Boolean(expandedThoughts[step.stepIndex]);

    return (
      <div
        key={step.stepIndex}
        className={`rounded-lg border p-3.5 transition-colors mr-2 sm:mr-6 min-w-0 max-w-full break-words overflow-hidden ${
          isSummary
            ? 'bg-palenight-card/90 border-palenight-border shadow-md'
            : 'bg-palenight-card/50 border-palenight-border/60'
        }`}
      >
        {/* Step Header */}
        <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-palenight-border/40 text-[10px]">
          <div className="flex items-center space-x-1.5 truncate mr-2">
            <Bot className="w-3.5 h-3.5 text-palenight-mauve shrink-0" />
            <span className="text-palenight-mauve font-bold truncate">
              {isSummary ? `${assistantName.toUpperCase()} (SUMMARY)` : `${assistantName.toUpperCase()} (STEP)`}
            </span>
            <span className="text-palenight-muted font-mono shrink-0">#{step.stepIndex}</span>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <span className="text-palenight-muted font-mono text-[10px]">
              {new Date(step.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            {!isSummary && (
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

        {/* Collapsible Reasoning Trace */}
        {hasThought && (
          <div className="mb-2.5 bg-palenight-dark/80 rounded border border-palenight-border/50 p-2 text-[11px] min-w-0 overflow-hidden">
            <button
              onClick={() => toggleThought(step.stepIndex)}
              className="flex items-center space-x-1 text-palenight-muted hover:text-palenight-fg w-full text-left touch-manipulation cursor-pointer"
            >
              {isThoughtExpanded ? (
                <ChevronDown className="w-3.5 h-3.5 text-palenight-mauve shrink-0" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-palenight-mauve shrink-0" />
              )}
              <span className="italic text-[10px] text-palenight-mauve">Internal Reasoning Trace</span>
            </button>
            {isThoughtExpanded && (
              <div className="mt-1.5 text-palenight-muted whitespace-pre-wrap pl-3.5 border-l-2 border-palenight-mauve/40 text-[10px] leading-relaxed break-words overflow-hidden">
                {step.thinking}
              </div>
            )}
          </div>
        )}

        {/* Message Content */}
        {step.content && (
          <div className="text-palenight-bright select-text min-w-0 overflow-hidden break-words">
            <MarkdownRenderer content={step.content} />
          </div>
        )}

        {/* Tool Invocations */}
        {step.toolCalls && step.toolCalls.length > 0 && (
          <div className="mt-2.5 space-y-1.5 min-w-0 overflow-hidden">
            {step.toolCalls.map((tool, tIdx) => {
              const toolKey = `${step.stepIndex}-${tIdx}`;
              const isCopied = copiedIndex === toolKey;

              return (
                <div
                  key={tIdx}
                  className="bg-palenight-dark border border-palenight-border rounded overflow-hidden text-[11px] min-w-0"
                >
                  <div className="flex items-center justify-between px-2.5 py-1.5 bg-palenight-card/50 select-none">
                    <div className="flex items-center space-x-2 truncate">
                      <Code className="w-3 h-3 text-palenight-cyan shrink-0" />
                      <span className="text-palenight-cyan font-bold truncate">{tool.name}</span>
                    </div>
                    <button
                      onClick={() => copyToClipboard(JSON.stringify(tool.args, null, 2), toolKey)}
                      className="text-palenight-muted hover:text-palenight-fg p-0.5 cursor-pointer shrink-0"
                      title="Copy arguments"
                    >
                      {isCopied ? <Check className="w-3 h-3 text-palenight-green" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>

                  <pre className="text-palenight-fg text-[10px] bg-palenight-bg/90 p-2 overflow-x-auto max-w-full leading-tight font-mono">
                    {JSON.stringify(tool.args, null, 2)}
                  </pre>

                  {tool.output && (
                    <div className="p-2 border-t border-palenight-border/40 bg-palenight-bg/60 overflow-hidden">
                      <pre className="text-palenight-muted text-[10px] max-h-36 overflow-y-auto overflow-x-auto max-w-full leading-snug whitespace-pre font-mono">
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
  };

  return (
    <div className="flex flex-col h-full bg-palenight-bg text-palenight-fg select-none font-mono text-xs overflow-hidden w-full max-w-full min-w-0">
      {/* Session Breadcrumb & Controls Bar */}
      <div className="px-3 py-1.5 bg-palenight-dark/95 border-b border-palenight-border flex items-center justify-between shrink-0 select-none text-[11px] min-w-0">
        <div className="flex items-center space-x-2 truncate mr-2">
          <Terminal className="w-3.5 h-3.5 text-palenight-mauve shrink-0" />
          <span className="text-palenight-bright font-bold truncate">
            {activeConversationTitle || 'Antilink Active Stream'}
          </span>
          {projectName && (
            <span className="text-[10px] text-palenight-cyan bg-palenight-card px-1.5 py-0.2 rounded border border-palenight-border/50 shrink-0">
              {projectName}
            </span>
          )}
        </div>

        <div className="flex items-center space-x-2 text-[10px] shrink-0">
          <button
            onClick={toggleAllSteps}
            className="flex items-center space-x-1 text-palenight-muted hover:text-palenight-bright bg-palenight-card/80 hover:bg-palenight-card border border-palenight-border px-1.5 py-0.5 rounded cursor-pointer transition-colors"
            title="Expand/Collapse all turn groups (Ctrl+O)"
          >
            {allExpanded ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
            <span className="hidden xs:inline">{allExpanded ? 'Collapse' : 'Expand'} (Ctrl+O)</span>
          </button>

          {onOpenShortcuts && (
            <button
              onClick={onOpenShortcuts}
              className="text-palenight-muted hover:text-palenight-fg p-0.5 cursor-pointer"
              title="Keyboard Shortcuts (?)"
            >
              <HelpCircle className="w-3.5 h-3.5" />
            </button>
          )}

          <span className="text-palenight-muted hidden sm:inline">{allSteps.length} steps</span>
        </div>
      </div>

      {/* Historical / Archived Session Banner */}
      {isHistoricalSession && (
        <div className="bg-palenight-yellow/10 border-b border-palenight-yellow/30 px-3 py-1.5 flex items-center justify-between text-[11px] text-palenight-yellow shrink-0">
          <div className="flex items-center space-x-2 truncate">
            <Archive className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Viewing historical conversation. Sending a prompt will resume this session.</span>
          </div>
        </div>
      )}

      {/* Main Steps Transcript Scroll Container (Guaranteed NO Horizontal Overflow) */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto overflow-x-hidden min-w-0 w-full max-w-full p-3 sm:p-4 space-y-3 font-mono text-xs overscroll-contain"
      >
        {turnItems.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-palenight-muted space-y-2 p-6 text-center select-none">
            <Bot className="w-8 h-8 text-palenight-border" />
            <p className="text-palenight-fg font-medium">Waiting for active agent session...</p>
            <p className="text-[11px] text-palenight-muted max-w-xs leading-relaxed">
              Consecutive actions are automatically grouped into clean summary pills. Click any group to inspect individual actions.
            </p>
          </div>
        )}

        {turnItems.map((item) => {
          // 1. USER PROMPT BUBBLE
          if (item.type === 'user' && item.step) {
            const step = item.step;
            return (
              <div
                key={item.id}
                className="rounded-lg border border-palenight-blue/40 bg-palenight-card p-3 ml-4 sm:ml-12 shadow-sm min-w-0 max-w-full break-words overflow-hidden"
              >
                <div className="flex items-center justify-between mb-1.5 pb-1 border-b border-palenight-border/40 text-[10px]">
                  <div className="flex items-center space-x-1.5 truncate mr-2">
                    <User className="w-3.5 h-3.5 text-palenight-blue shrink-0" />
                    <span className="text-palenight-blue font-bold truncate">{userName.toUpperCase()}</span>
                    <span className="text-palenight-muted font-mono shrink-0">#{step.stepIndex}</span>
                  </div>
                  <span className="text-palenight-muted font-mono shrink-0">
                    {new Date(step.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="text-palenight-bright select-text min-w-0 break-words overflow-hidden">
                  <MarkdownRenderer content={step.content || ''} />
                </div>
              </div>
            );
          }

          // 2. FINAL ASSISTANT RESPONSE / SUMMARY
          if (item.type === 'summary' && item.step) {
            return renderExpandedStep(item.step, true);
          }

          // 3. HIERARCHICAL ACTION GROUP
          if (item.type === 'group' && item.group) {
            const grp = item.group;
            const isGroupExpanded = expandedGroups[grp.id] || allExpanded;

            // Level 1: Collapsed Summary Pill (e.g. ● Explored 6 files)
            if (!isGroupExpanded) {
              return (
                <div
                  key={grp.id}
                  onClick={() => toggleGroup(grp.id)}
                  className="bg-palenight-dark/80 hover:bg-palenight-card border border-palenight-border/60 hover:border-palenight-mauve/40 rounded-md px-3 py-1.5 flex items-center justify-between transition-all cursor-pointer select-none text-[11px] font-mono group mr-2 sm:mr-6 min-w-0 max-w-full"
                  title="Click to expand action items (Ctrl+O)"
                >
                  <div className="flex items-center space-x-2 truncate mr-2">
                    <ChevronRight className="w-3.5 h-3.5 text-palenight-muted group-hover:text-palenight-mauve shrink-0 transition-transform" />
                    <span className="w-1.5 h-1.5 rounded-full bg-palenight-mauve shrink-0" />
                    <span className="font-semibold text-palenight-fg group-hover:text-palenight-bright truncate">
                      {grp.title}
                    </span>
                    {grp.subtitle && (
                      <span className="text-palenight-muted truncate text-[10px] hidden xs:inline">
                        {grp.subtitle}
                      </span>
                    )}
                  </div>

                  <span className="text-[10px] text-palenight-muted bg-palenight-card px-1.5 py-0.2 rounded border border-palenight-border/50 shrink-0 font-mono">
                    {grp.steps.length} {grp.steps.length === 1 ? 'action' : 'actions'}
                  </span>
                </div>
              );
            }

            // Level 2: Expanded Group Container listing each step
            return (
              <div
                key={grp.id}
                className="bg-palenight-dark/40 border border-palenight-border/80 rounded-lg p-2.5 mr-2 sm:mr-6 space-y-2 min-w-0 max-w-full transition-all"
              >
                {/* Group Header */}
                <div
                  onClick={() => toggleGroup(grp.id)}
                  className="flex items-center justify-between pb-1.5 border-b border-palenight-border/40 cursor-pointer select-none text-[11px]"
                >
                  <div className="flex items-center space-x-1.5 text-palenight-bright font-bold truncate">
                    <ChevronDown className="w-3.5 h-3.5 text-palenight-mauve shrink-0" />
                    <span className="truncate">{grp.title}</span>
                    {grp.subtitle && <span className="text-palenight-muted text-[10px] font-normal truncate">{grp.subtitle}</span>}
                  </div>
                  <span className="text-[10px] text-palenight-muted font-mono shrink-0">
                    {grp.steps.length} {grp.steps.length === 1 ? 'step' : 'steps'}
                  </span>
                </div>

                {/* Individual Steps in Group */}
                <div className="space-y-1.5 pl-1 min-w-0">
                  {grp.steps.map((step) => {
                    const isStepExpanded = expandedSteps[step.stepIndex] || allExpanded;

                    // Level 3 Inspector if step is clicked
                    if (isStepExpanded) {
                      return renderExpandedStep(step, false);
                    }

                    // Level 2 Compact Step Row
                    const summaryLabel = formatStepSummary(step);
                    return (
                      <div
                        key={step.stepIndex}
                        onClick={() => toggleStep(step.stepIndex)}
                        className="bg-palenight-dark hover:bg-palenight-card/80 border border-palenight-border/60 rounded px-2.5 py-1.5 flex items-center justify-between transition-colors cursor-pointer select-none text-[10.5px] font-mono group min-w-0"
                        title="Click to inspect parameters & outputs"
                      >
                        <div className="flex items-center space-x-2 truncate mr-2">
                          <ChevronRight className="w-3 h-3 text-palenight-muted group-hover:text-palenight-mauve shrink-0" />
                          <span className="text-palenight-muted font-bold shrink-0">#{step.stepIndex}</span>
                          <span className="text-palenight-fg truncate">{summaryLabel}</span>
                        </div>
                        <span className="text-[9.5px] text-palenight-muted shrink-0 bg-palenight-card px-1 py-0.2 rounded border border-palenight-border/40">
                          {step.status === 'DONE' ? 'completed' : step.status.toLowerCase()}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          }

          return null;
        })}

        {/* High-Priority Floating Tool Confirmation Card (Surfaced prominently on mobile!) */}
        {pendingApproval && (
          <div className="rounded-lg border-2 border-palenight-mauve bg-palenight-card p-3.5 sm:p-4 shadow-2xl transition-all mr-2 sm:mr-6 animate-in slide-in-from-bottom-2 duration-150 space-y-3 min-w-0 max-w-full">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-palenight-bright font-bold text-xs font-mono truncate">
                <ShieldCheck className="w-4 h-4 text-palenight-mauve shrink-0" />
                <span className="truncate">Tool Execution Confirmation</span>
              </div>
              <div className="flex items-center space-x-2 shrink-0">
                <span className="text-[10px] text-palenight-yellow font-mono font-bold bg-palenight-dark px-2 py-0.5 rounded border border-palenight-border animate-pulse">
                  Step #{pendingApproval.stepIndex}
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

            <div className="space-y-2">
              <div className="bg-palenight-dark rounded p-2.5 border border-palenight-border/60 text-xs font-mono space-y-1 min-w-0">
                <div className="text-[10px] text-palenight-muted">Requesting execution for:</div>
                <pre className="text-palenight-cyan bg-palenight-bg p-2 rounded overflow-x-auto max-w-full text-[11px] font-bold border border-palenight-border/40 select-text leading-relaxed font-mono">
                  {pendingApproval.commandLine || pendingApproval.targetFile || pendingApproval.toolName}
                </pre>
              </div>

              <div className="text-[11px] text-palenight-bright font-mono font-bold">
                Run this action? Select an option:
              </div>

              {/* 3 Interactive Decision Buttons */}
              <div className="space-y-1.5 pt-0.5">
                {/* Option 1: Yes, run command */}
                <button
                  onClick={() => {
                    const stepIdx = pendingApproval.stepIndex;
                    onConfirmTool(stepIdx, true, 1, pendingApproval.commandLine);
                    setDismissedSteps((prev) => new Set(prev).add(stepIdx));
                    setActionFeedback('Option 1 selected: Running command [Enter] ✓');
                    setTimeout(() => setActionFeedback(null), 3000);
                  }}
                  className="w-full text-left bg-palenight-green/10 hover:bg-palenight-green/20 border border-palenight-green/50 text-palenight-bright p-2 rounded-md flex items-center justify-between transition-all cursor-pointer group active:scale-[0.99]"
                >
                  <div className="flex items-center space-x-2 text-xs font-mono truncate mr-2">
                    <span className="font-bold text-palenight-green text-sm shrink-0">1.</span>
                    <span className="font-semibold text-palenight-bright group-hover:text-palenight-green truncate">
                      Yes, run command
                    </span>
                  </div>
                  <span className="text-[10px] text-palenight-muted group-hover:text-palenight-bright font-mono bg-palenight-dark px-1.5 py-0.5 rounded border border-palenight-border/40 shrink-0">
                    [1 / Enter]
                  </span>
                </button>

                {/* Option 2: Yes, and always allow */}
                <button
                  onClick={() => {
                    const stepIdx = pendingApproval.stepIndex;
                    onConfirmTool(stepIdx, true, 2, pendingApproval.commandLine);
                    setDismissedSteps((prev) => new Set(prev).add(stepIdx));
                    const cmd = (pendingApproval.commandLine || 'command').replace(/^["']|["']$/g, '').trim();
                    const prefix = cmd.split(/\s+/).slice(0, 2).join(' ');
                    setActionFeedback(`Option 2 selected: Saved '${prefix}' to permissions [2] ✓`);
                    setTimeout(() => setActionFeedback(null), 3000);
                  }}
                  className="w-full text-left bg-palenight-card hover:bg-palenight-card/80 border border-palenight-border text-palenight-fg hover:text-palenight-bright p-2 rounded-md flex items-center justify-between transition-all cursor-pointer group active:scale-[0.99]"
                >
                  <div className="flex items-center space-x-2 text-xs font-mono truncate mr-2">
                    <span className="font-bold text-palenight-mauve text-sm shrink-0">2.</span>
                    <span className="text-palenight-fg group-hover:text-palenight-bright truncate">
                      Yes, and always allow
                    </span>
                  </div>
                  <span className="text-[10px] text-palenight-muted font-mono bg-palenight-dark px-1.5 py-0.5 rounded border border-palenight-border/40 shrink-0">
                    [2]
                  </span>
                </button>

                {/* Option 4: No, reject / cancel */}
                <button
                  onClick={() => {
                    const stepIdx = pendingApproval.stepIndex;
                    onConfirmTool(stepIdx, false, 4, pendingApproval.commandLine);
                    setDismissedSteps((prev) => new Set(prev).add(stepIdx));
                    setActionFeedback('Option 4 selected: Cancelled command [Esc] ✗');
                    setTimeout(() => setActionFeedback(null), 3000);
                  }}
                  className="w-full text-left bg-palenight-red/10 hover:bg-palenight-red/20 border border-palenight-red/40 hover:border-palenight-red text-palenight-fg hover:text-palenight-bright p-2 rounded-md flex items-center justify-between transition-all cursor-pointer group active:scale-[0.99]"
                >
                  <div className="flex items-center space-x-2 text-xs font-mono truncate mr-2">
                    <span className="font-bold text-palenight-red text-sm shrink-0">4.</span>
                    <span className="text-palenight-fg group-hover:text-palenight-red truncate">
                      No, cancel execution
                    </span>
                  </div>
                  <span className="text-[10px] text-palenight-muted group-hover:text-palenight-bright font-mono bg-palenight-dark px-1.5 py-0.5 rounded border border-palenight-border/40 shrink-0">
                    [4 / Esc]
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Queued Prompts Container */}
        {promptQueue && promptQueue.length > 0 && (
          <div className="space-y-2 mr-2 sm:mr-6 animate-in slide-in-from-bottom-2 duration-150 min-w-0">
            {promptQueue.map((item, qIdx) => (
              <div
                key={item.id}
                className="rounded-lg border border-palenight-yellow/50 bg-palenight-card/90 p-3 shadow-lg space-y-1.5 min-w-0"
              >
                <div className="flex items-center justify-between pb-1 border-b border-palenight-border/50 text-[10px]">
                  <div className="flex items-center space-x-1.5 truncate mr-2">
                    <Clock className="w-3.5 h-3.5 text-palenight-yellow animate-pulse shrink-0" />
                    <span className="text-palenight-yellow font-bold uppercase truncate">
                      WAITING IN QUEUE (#{qIdx + 1})
                    </span>
                  </div>
                  {onCancelQueuedPrompt && (
                    <button
                      onClick={() => onCancelQueuedPrompt(item.id)}
                      className="text-palenight-red hover:text-palenight-bright text-[10px] bg-palenight-dark px-1.5 py-0.5 rounded border border-palenight-red/40 cursor-pointer flex items-center space-x-1 shrink-0"
                      title="Cancel queued prompt"
                    >
                      <X className="w-3 h-3" />
                      <span>Cancel</span>
                    </button>
                  )}
                </div>
                <div className="bg-palenight-dark rounded p-2 text-palenight-bright text-xs font-mono break-words">
                  {item.text}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Live Working Activity Indicator & Real-Time Thought Stream */}
      {(isAgentWorking || activity?.isWorking) && (
        <div className="mx-3 mb-1 bg-palenight-dark/95 border border-palenight-mauve/50 rounded-lg p-2.5 shadow-xl animate-in fade-in slide-in-from-bottom-1 duration-150 shrink-0 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center space-x-2 truncate mr-2">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-palenight-green opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-palenight-green" />
              </span>
              <span className="font-bold text-palenight-bright text-[11px] truncate">
                {assistantName} is working
              </span>
              {activity?.currentAction && (
                <span className="text-palenight-mauve font-semibold truncate text-[10.5px]">
                  • {activity.currentAction}
                </span>
              )}
            </div>
            {activity?.stepIndex && (
              <span className="text-[10px] text-palenight-muted font-mono shrink-0">
                Step #{activity.stepIndex}
              </span>
            )}
          </div>

          {activity?.currentThought && (
            <div className="text-[10.5px] text-palenight-muted italic truncate leading-snug pl-4 border-l border-palenight-mauve/40">
              "{activity.currentThought}"
            </div>
          )}
        </div>
      )}

      {/* Floating Action Feedback Toast */}
      {actionFeedback && (
        <div className="mx-3 mb-1 bg-palenight-card border border-palenight-yellow/50 text-palenight-yellow px-3 py-1.5 rounded text-[11px] font-mono flex items-center justify-between shadow-lg animate-in fade-in slide-in-from-bottom-1 duration-150 z-30 shrink-0">
          <span className="flex items-center space-x-1.5 truncate mr-2">
            <Clock className="w-3.5 h-3.5 animate-spin shrink-0" />
            <span className="truncate">{actionFeedback}</span>
          </span>
          <button
            onClick={() => setActionFeedback(null)}
            className="text-palenight-muted hover:text-palenight-fg p-0.5 ml-2 cursor-pointer shrink-0"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Slash Commands Autocomplete Menu */}
      {showSlashMenu && filteredCommands.length > 0 && (
        <div className="mx-2 mb-1 bg-palenight-dark border border-palenight-border rounded-lg shadow-2xl overflow-hidden font-mono text-xs max-h-56 overflow-y-auto z-20 animate-in slide-in-from-bottom-2 duration-150 shrink-0">
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

      {/* Quick Action Chips Bar */}
      <div className="px-3 py-1.5 bg-palenight-dark border-t border-palenight-border/60 flex space-x-1.5 overflow-x-auto no-scrollbar shrink-0 select-none">
        {quickChips.map((chip, i) => (
          <button
            key={i}
            onClick={() => onSendPrompt(chip.cmd)}
            className="text-[10px] font-mono bg-palenight-card border border-palenight-border text-palenight-fg hover:text-palenight-bright hover:border-palenight-mauve px-2.5 py-1 rounded-md whitespace-nowrap active:bg-palenight-active transition-colors touch-manipulation cursor-pointer shrink-0"
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Prompt Input Form (Clean Auto-Growing Textarea with ZERO Pre-Typing Scrollbars) */}
      <form
        onSubmit={handleSend}
        className="p-2.5 bg-palenight-dark border-t border-palenight-border shrink-0 flex items-end space-x-2 relative min-w-0"
      >
        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileUpload}
        />

        {/* File Upload Button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="p-2 rounded-md text-palenight-muted hover:text-palenight-bright hover:bg-palenight-card border border-palenight-border active:scale-95 transition-all touch-manipulation shrink-0 cursor-pointer disabled:opacity-40"
          title="Upload file to workspace"
        >
          {isUploading ? <Loader2 className="w-4 h-4 animate-spin text-palenight-mauve" /> : <Paperclip className="w-4 h-4" />}
        </button>

        {/* Real-time Voice Dictation Button */}
        <button
          type="button"
          onClick={toggleVoiceRecording}
          className={`p-2 rounded-md border active:scale-95 transition-all touch-manipulation shrink-0 cursor-pointer ${
            isRecording
              ? 'bg-palenight-red/20 border-palenight-red text-palenight-red animate-pulse'
              : 'text-palenight-muted hover:text-palenight-bright hover:bg-palenight-card border-palenight-border'
          }`}
          title={isRecording ? 'Stop voice recording' : 'Live real-time voice dictation'}
        >
          {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>

        {/* Auto-Resizing Textarea */}
        <div className="flex-1 relative flex items-center min-w-0">
          <textarea
            ref={textareaRef}
            rows={1}
            value={inputPrompt}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={
              isAgentWorking
                ? "Luna is working... Type to queue a prompt"
                : "Type message or / for commands..."
            }
            className={`w-full bg-palenight-bg border border-palenight-border text-palenight-bright px-3 py-2 pr-8 rounded-md text-xs focus:outline-none focus:border-palenight-mauve placeholder-palenight-muted font-mono transition-all resize-none leading-relaxed ${
              inputPrompt.includes('\n') || (textareaRef.current && textareaRef.current.scrollHeight > 50)
                ? 'overflow-y-auto'
                : 'overflow-hidden'
            }`}
            style={{ minHeight: '38px', maxHeight: isExpandedInput ? '240px' : '120px' }}
          />

          <button
            type="button"
            onClick={() => setIsExpandedInput((prev) => !prev)}
            className="absolute right-2 top-2.5 text-palenight-muted hover:text-palenight-fg p-0.5 cursor-pointer"
            title={isExpandedInput ? "Collapse input" : "Expand input"}
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
