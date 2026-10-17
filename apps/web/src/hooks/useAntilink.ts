'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type {
  AntilinkClientMessage,
  AntilinkServerMessage,
  DiscoveredPort,
  SystemTelemetry,
  AgentStep,
  ToolConfirmationPayload,
  ConversationSummary,
  SubagentInfo,
  BackgroundTaskInfo,
  ArtifactInfo,
  QueuedPrompt,
} from '@antilink/shared';

export function useAntilink() {
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [latencyMs, setLatencyMs] = useState<number>(0);
  const [machineName, setMachineName] = useState<string>('Localhost');
  const [tunnelUrl, setTunnelUrl] = useState<string | null>(null);
  const [ports, setPorts] = useState<DiscoveredPort[]>([]);
  const [telemetry, setTelemetry] = useState<SystemTelemetry | null>(null);
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [activeConfirmation, setActiveConfirmation] = useState<ToolConfirmationPayload | null>(null);
  const [commandOutput, setCommandOutput] = useState<{ output: string; exitCode?: number } | null>(null);
  const [isAgentWorking, setIsAgentWorking] = useState<boolean>(false);
  const [promptQueue, setPromptQueue] = useState<QueuedPrompt[]>([]);

  // Full Antigravity Parity states
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activeConversationTitle, setActiveConversationTitle] = useState<string>('Antilink');
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [subagents, setSubagents] = useState<SubagentInfo[]>([]);
  const [tasks, setTasks] = useState<BackgroundTaskInfo[]>([]);
  const [artifacts, setArtifacts] = useState<ArtifactInfo[]>([]);

  // Gateway URL for Hosted Web PWA on Vercel
  const [gatewayUrl, setGatewayUrl] = useState<string>('');

  // Host Identity profile synced from active authenticated Mac daemon
  const [userProfile, setUserProfile] = useState<{
    userName: string;
    userEmail: string;
    assistantName: string;
  } | null>(null);

  // Two-Tier Hardware & Master PIN Security States
  const [isPairingRequired, setIsPairingRequired] = useState<boolean>(false);
  const [pairingMessage, setPairingMessage] = useState<string>('');
  const [isPinRequired, setIsPinRequired] = useState<boolean>(false);
  const [pinError, setPinError] = useState<string | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const pingStartRef = useRef<number>(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const resetState = useCallback(() => {
    setSteps([]);
    setConversations([]);
    setSubagents([]);
    setTasks([]);
    setArtifacts([]);
    setPorts([]);
    setTelemetry(null);
    setMachineName('');
    setUserProfile(null);
    setActiveConfirmation(null);
    setCommandOutput(null);
    setIsAgentWorking(false);
    setPromptQueue([]);
    setIsPairingRequired(false);
    setIsPinRequired(false);
    setLatencyMs(0);
  }, []);


  const connect = useCallback(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    let queryGateway = params.get('gateway');
    let queryToken = params.get('token');

    if (queryGateway) {
      try {
        const gu = new URL(queryGateway.startsWith('http') ? queryGateway : `https://${queryGateway}`);
        const gt = gu.searchParams.get('token');
        if (gt && !queryToken) queryToken = gt;
        queryGateway = gu.origin;
      } catch {
        // ignore
      }
      localStorage.setItem('antilink_gateway_url', queryGateway);
    }
    if (queryToken) {
      localStorage.setItem('antilink_token', queryToken);
    }

    const DEFAULT_GATEWAY = 'https://battery-zoom-twister.ngrok-free.dev';

    let storedGateway = localStorage.getItem('antilink_gateway_url') || '';
    let token = queryToken || localStorage.getItem('antilink_token') || 'fab4b0b4cbb7';

    // Auto-migrate from dead cloudflare tunnels or initialize default ngrok static gateway on Vercel
    if (window.location.hostname.includes('vercel.app')) {
      if (!storedGateway || storedGateway.includes('trycloudflare.com')) {
        storedGateway = DEFAULT_GATEWAY;
        localStorage.setItem('antilink_gateway_url', storedGateway);
      }
    }

    // If storedGateway is a full URL containing ?token=... or ?gateway=...
    if (storedGateway.includes('?token=') || storedGateway.includes('?gateway=')) {
      try {
        const u = new URL(storedGateway.startsWith('http') ? storedGateway : `https://${storedGateway}`);
        if (u.searchParams.has('gateway')) {
          const inner = u.searchParams.get('gateway')!;
          const iu = new URL(inner.startsWith('http') ? inner : `https://${inner}`);
          storedGateway = iu.origin;
          const it = iu.searchParams.get('token');
          if (it && !token) token = it;
        } else {
          const t = u.searchParams.get('token');
          if (t && !token) token = t;
          storedGateway = u.origin;
        }
        localStorage.setItem('antilink_gateway_url', storedGateway);
        if (token) localStorage.setItem('antilink_token', token);
      } catch {
        // ignore
      }
    }

    // Determine target host and protocols
    let targetHost = window.location.host;
    let targetProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    let targetHttpOrigin = window.location.origin;

    if (storedGateway) {
      try {
        const parsed = new URL(storedGateway.startsWith('http') ? storedGateway : `https://${storedGateway}`);
        targetHost = parsed.host;
        targetProtocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
        targetHttpOrigin = parsed.origin;
      } catch {
        // ignore
      }
    } else {
      // If no gateway is configured and running on Vercel
      if (window.location.hostname.includes('vercel.app')) {
        targetHost = 'battery-zoom-twister.ngrok-free.dev';
        targetProtocol = 'wss:';
        targetHttpOrigin = DEFAULT_GATEWAY;
      }
    }

    // Hardware Device Identity (Tier 1)
    let deviceId = localStorage.getItem('antilink_device_id') || '';
    if (!deviceId) {
      deviceId =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : 'dev_' + Math.random().toString(36).substring(2, 12);
      localStorage.setItem('antilink_device_id', deviceId);
    }

    let deviceName = 'Browser Client';
    if (typeof navigator !== 'undefined') {
      const ua = navigator.userAgent;
      if (/iPhone|iPad|iPod/.test(ua)) deviceName = 'iPhone (Mobile Safari)';
      else if (/Android/.test(ua)) deviceName = 'Android Mobile';
      else if (/Macintosh/.test(ua)) deviceName = 'Mac Desktop';
      else if (/Windows/.test(ua)) deviceName = 'Windows PC';
      else if (/Linux/.test(ua)) deviceName = 'Linux Client';
    }

    // Master Security PIN (Tier 2)
    const storedPin =
      (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('antilink_master_pin') : null) ||
      localStorage.getItem('antilink_master_pin') ||
      '';

    setGatewayUrl(targetHttpOrigin);
    const wsUrl = `${targetProtocol}//${targetHost}/ws?token=${token}&deviceId=${deviceId}&deviceName=${encodeURIComponent(
      deviceName
    )}&pin=${storedPin}`;

    setStatus('connecting');

    try {
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        setStatus('connected');
        pingStartRef.current = performance.now();
        ws.send(
          JSON.stringify({
            type: 'DEVICE_HANDSHAKE',
            deviceId,
            deviceName,
            token,
            pin: storedPin,
          } satisfies AntilinkClientMessage)
        );
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as AntilinkServerMessage;

          switch (msg.type) {
            case 'AUTH_FAILED':
              setIsPairingRequired(true);
              setPairingMessage(msg.error || 'Authentication required');
              setIsPinRequired(false);
              break;

            case 'PAIR_CHALLENGE':
              setIsPairingRequired(true);
              setPairingMessage(msg.message);
              setIsPinRequired(false);
              break;

            case 'PIN_REQUIRED':
              setIsPairingRequired(false);
              setIsPinRequired(true);
              setPinError(msg.error || null);
              break;

            case 'AUTH_SUCCESS':
              setIsPairingRequired(false);
              setIsPinRequired(false);
              setPinError(null);
              setMachineName(msg.session.machineName);
              break;

            case 'INITIAL_STATE':
              setMachineName(msg.data.machineName);
              setTunnelUrl(msg.data.tunnelUrl);
              setPorts(msg.data.ports);
              setTelemetry(msg.data.telemetry);
              setSteps(msg.data.recentSteps);
              setActiveConversationId(msg.data.activeConversationId);
              if (msg.data.activeConversationTitle) {
                setActiveConversationTitle(msg.data.activeConversationTitle);
              }
              setConversations(msg.data.conversations || []);
              setSubagents(msg.data.subagents || []);
              setTasks(msg.data.tasks || []);
              setArtifacts(msg.data.artifacts || []);
              setIsAgentWorking(Boolean(msg.data.isAgentWorking));
              setPromptQueue(msg.data.promptQueue || []);
              if (msg.data.activeConfirmation !== undefined) {
                setActiveConfirmation(msg.data.activeConfirmation);
              }
              if (msg.data.userProfile) {
                setUserProfile(msg.data.userProfile);
              }
              if (pingStartRef.current > 0) {
                setLatencyMs(Math.round(performance.now() - pingStartRef.current));
              }
              break;

            case 'AGENT_STEP_ADDED':
              setSteps((prev) => [...prev, msg.step]);
              break;

            case 'AGENT_STEP_UPDATED':
              setSteps((prev) =>
                prev.map((s) => (s.stepIndex === msg.step.stepIndex ? msg.step : s))
              );
              break;

            case 'TOOL_CONFIRM_REQUEST':
              setActiveConfirmation(msg.payload);
              playChime('permission');
              triggerHaptic([120, 60, 120]);
              break;

            case 'TOOL_CONFIRM_RESOLVED':
              setActiveConfirmation((prev) => (prev?.stepIdx === msg.stepIdx ? null : prev));
              break;

            case 'CONVERSATIONS_UPDATED':
              setConversations(msg.conversations);
              if (activeConversationId) {
                const current = msg.conversations.find((c) => c.id === activeConversationId);
                if (current?.title) {
                  setActiveConversationTitle(current.title);
                }
              }
              break;

            case 'SUBAGENTS_UPDATED':
              setSubagents(msg.subagents);
              break;

            case 'TASKS_UPDATED':
              setTasks(msg.tasks);
              break;

            case 'ARTIFACTS_UPDATED':
              setArtifacts(msg.artifacts);
              break;

            case 'PORTS_UPDATED':
              setPorts(msg.ports);
              break;

            case 'TELEMETRY_UPDATED':
              setTelemetry(msg.telemetry);
              break;

            case 'TUNNEL_UPDATED':
              setTunnelUrl(msg.tunnelUrl);
              break;

            case 'PROMPT_QUEUE_UPDATED':
              setPromptQueue(msg.queue);
              break;

            case 'AGENT_STATUS_CHANGED':
              setIsAgentWorking(msg.isWorking);
              if (!msg.isWorking) {
                playChime('completion');
                triggerHaptic([60]);
              }
              break;

            case 'COMMAND_OUTPUT':
              setCommandOutput({ output: msg.output, exitCode: msg.exitCode });
              break;

            case 'SESSION_ENDED':
              setStatus('disconnected');
              resetState();
              break;
          }
        } catch {
          // ignore
        }
      };

      ws.onclose = () => {
        setStatus('disconnected');
        socketRef.current = null;
        resetState();
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      setStatus('disconnected');
    }
  }, [resetState]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (socketRef.current) socketRef.current.close();
    };
  }, [connect]);

  const sendMessage = useCallback((msg: AntilinkClientMessage) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const sendPrompt = useCallback(
    (prompt: string) => {
      sendMessage({ type: 'SEND_PROMPT', prompt });
    },
    [sendMessage]
  );

  const confirmTool = useCallback(
    (stepIdx: number, approved: boolean, optionNumber?: number, commandLine?: string) => {
      const convId = activeConfirmation?.conversationId || activeConversationId || '';
      sendMessage({
        type: 'TOOL_CONFIRM',
        payload: {
          conversationId: convId,
          stepIdx,
          approved,
          decision: approved ? 'allow' : 'deny',
          optionNumber: optionNumber ?? (approved ? 1 : 4),
          commandLine: commandLine || activeConfirmation?.commandLine,
        },
      });
      setActiveConfirmation(null);
    },
    [activeConfirmation, activeConversationId, sendMessage]
  );

  const switchConversation = useCallback(
    (conversationId: string) => {
      sendMessage({ type: 'SWITCH_CONVERSATION', conversationId });
      setActiveConversationId(conversationId);
      const target = conversations.find((c) => c.id === conversationId);
      if (target?.title) {
        setActiveConversationTitle(target.title);
      }
    },
    [sendMessage, conversations]
  );

  const killTask = useCallback(
    (taskId: string) => {
      sendMessage({ type: 'KILL_TASK', taskId });
    },
    [sendMessage]
  );

  const toggleCaffeinate = useCallback(
    (enable: boolean) => {
      sendMessage({ type: 'TOGGLE_CAFFEINATE', enable });
    },
    [sendMessage]
  );

  const scanPorts = useCallback(() => {
    sendMessage({ type: 'SCAN_PORTS' });
  }, [sendMessage]);

  const execCommand = useCallback(
    (command: string) => {
      setCommandOutput(null);
      sendMessage({ type: 'EXEC_COMMAND', command });
    },
    [sendMessage]
  );

  const cancelQueuedPrompt = useCallback(
    (promptId: string) => {
      sendMessage({ type: 'CANCEL_QUEUED_PROMPT', promptId });
    },
    [sendMessage]
  );

  const setGateway = useCallback(
    (urlWithToken: string) => {
      if (typeof window === 'undefined') return;
      try {
        const trimmed = urlWithToken.trim();
        if (!trimmed) {
          localStorage.removeItem('antilink_gateway_url');
          localStorage.removeItem('antilink_token');
          setGatewayUrl('');
          if (socketRef.current) socketRef.current.close();
          setStatus('disconnected');
          return;
        }

        const withProto = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
        const u = new URL(withProto);

        let targetGateway = u.origin;
        let token = u.searchParams.get('token');

        // If the user pasted a Vercel URL that wraps the actual gateway (e.g. ?gateway=https://...&token=...)
        if (u.searchParams.has('gateway')) {
          const innerGateway = u.searchParams.get('gateway')!;
          const innerWithProto = innerGateway.startsWith('http') ? innerGateway : `https://${innerGateway}`;
          try {
            const innerU = new URL(innerWithProto);
            targetGateway = innerU.origin;
            const innerToken = innerU.searchParams.get('token');
            if (innerToken) token = innerToken;
          } catch {
            targetGateway = innerGateway;
          }
        }

        if (token) {
          localStorage.setItem('antilink_token', token);
        }
        localStorage.setItem('antilink_gateway_url', targetGateway);
        setGatewayUrl(targetGateway);
        if (socketRef.current) {
          socketRef.current.close();
        }
        setTimeout(() => {
          connect();
        }, 100);
      } catch {
        // ignore
      }
    },
    [connect]
  );

  const submitPairingCode = useCallback(
    (code: string) => {
      const devId = typeof window !== 'undefined' ? localStorage.getItem('antilink_device_id') || '' : '';
      sendMessage({
        type: 'PAIR_VERIFY',
        deviceId: devId,
        code,
      });
    },
    [sendMessage]
  );

  const submitPin = useCallback(
    (pin: string) => {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('antilink_master_pin', pin);
        localStorage.setItem('antilink_master_pin', pin);
      }
      sendMessage({
        type: 'PIN_VERIFY',
        pin,
      });
    },
    [sendMessage]
  );

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    resetState();
    setStatus('disconnected');
  }, [resetState]);

  return {
    status,
    latencyMs,
    machineName,
    userProfile,
    tunnelUrl,
    ports,
    telemetry,
    steps,
    activeConfirmation,
    commandOutput,
    isAgentWorking,
    promptQueue,
    activeConversationId,
    activeConversationTitle,
    conversations,
    subagents,
    tasks,
    artifacts,
    gatewayUrl,
    isPairingRequired,
    pairingMessage,
    isPinRequired,
    pinError,
    submitPairingCode,
    submitPin,
    disconnect,
    setGateway,
    sendPrompt,
    cancelQueuedPrompt,
    confirmTool,
    switchConversation,
    killTask,
    toggleCaffeinate,
    scanPorts,
    execCommand,
  };
}

function playChime(type: 'permission' | 'completion') {
  if (typeof window === 'undefined') return;
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    if (type === 'permission') {
      // Two-tone alert chime: 520Hz then 660Hz
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.setValueAtTime(660, now + 0.12);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.36);
    } else {
      // Gentle ascending task completion chime: 440Hz -> 554Hz -> 659Hz
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(554.37, now + 0.1);
      osc.frequency.setValueAtTime(659.25, now + 0.2);
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.46);
    }
  } catch {
    // AudioContext blocked until user interaction, ignore gracefully
  }
}

function triggerHaptic(pattern: number[] = [80]) {
  if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
    try {
      navigator.vibrate(pattern);
    } catch {
      // ignore
    }
  }
}
