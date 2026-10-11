'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type {
  AntilinkClientMessage,
  AntilinkServerMessage,
  DiscoveredPort,
  SystemTelemetry,
  AgentStep,
  ToolConfirmationPayload,
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

  const socketRef = useRef<WebSocket | null>(null);
  const pingStartRef = useRef<number>(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (typeof window === 'undefined') return;

    // Resolve auth token
    const queryToken = new URLSearchParams(window.location.search).get('token');
    if (queryToken) {
      localStorage.setItem('antilink_token', queryToken);
    }
    const token = queryToken || localStorage.getItem('antilink_token') || '';

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws?token=${token}`;

    setStatus('connecting');

    try {
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        setStatus('connected');
        pingStartRef.current = performance.now();
        ws.send(JSON.stringify({ type: 'GET_STATE' } satisfies AntilinkClientMessage));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as AntilinkServerMessage;

          switch (msg.type) {
            case 'AUTH_SUCCESS':
              setMachineName(msg.session.machineName);
              break;

            case 'INITIAL_STATE':
              setMachineName(msg.data.machineName);
              setTunnelUrl(msg.data.tunnelUrl);
              setPorts(msg.data.ports);
              setTelemetry(msg.data.telemetry);
              setSteps(msg.data.recentSteps);
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

            case 'COMMAND_OUTPUT':
              setCommandOutput({ output: msg.output, exitCode: msg.exitCode });
              break;
          }
        } catch {
          // ignore parse errors
        }
      };

      ws.onclose = () => {
        setStatus('disconnected');
        socketRef.current = null;
        // Reconnect after 2 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 2000);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      setStatus('disconnected');
    }
  }, []);

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
    (stepIdx: number, approved: boolean) => {
      if (!activeConfirmation) return;
      sendMessage({
        type: 'TOOL_CONFIRM',
        payload: {
          conversationId: activeConfirmation.conversationId,
          stepIdx,
          approved,
          decision: approved ? 'allow' : 'deny',
        },
      });
      setActiveConfirmation(null);
    },
    [activeConfirmation, sendMessage]
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

  return {
    status,
    latencyMs,
    machineName,
    tunnelUrl,
    ports,
    telemetry,
    steps,
    activeConfirmation,
    commandOutput,
    sendPrompt,
    confirmTool,
    toggleCaffeinate,
    scanPorts,
    execCommand,
  };
}
