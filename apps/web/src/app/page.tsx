'use client';

import React, { useState } from 'react';
import { useAntilink } from '@/hooks/useAntilink';
import { Header } from '@/components/Header';
import { ActivityBar, ActiveTab } from '@/components/ActivityBar';
import { AgentStream } from '@/components/AgentStream';
import { PreviewMatrix } from '@/components/PreviewMatrix';
import { GitViewer } from '@/components/GitViewer';
import { Cockpit } from '@/components/Cockpit';

export default function AntilinkApp() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('stream');

  const {
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
  } = useAntilink();

  return (
    <div className="flex flex-col h-[100dvh] bg-palenight-bg text-palenight-fg select-none overflow-hidden">
      {/* Top Header */}
      <Header
        status={status}
        latencyMs={latencyMs}
        machineName={machineName}
        tunnelUrl={tunnelUrl}
        telemetry={telemetry}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Activity Bar (Left on desktop, Bottom on mobile) */}
        <div className="hidden md:block">
          <ActivityBar
            activeTab={activeTab}
            onTabChange={setActiveTab}
            openPortCount={ports.length}
            hasPendingApproval={Boolean(activeConfirmation)}
          />
        </div>

        {/* Dynamic Workspace Panel */}
        <main className="flex-1 flex flex-col overflow-hidden relative">
          {activeTab === 'stream' && (
            <AgentStream
              steps={steps}
              activeConfirmation={activeConfirmation}
              onConfirmTool={confirmTool}
              onSendPrompt={sendPrompt}
              onExecCommand={execCommand}
            />
          )}

          {activeTab === 'preview' && (
            <PreviewMatrix ports={ports} onScanPorts={scanPorts} />
          )}

          {activeTab === 'git' && (
            <GitViewer onExecCommand={execCommand} commandOutput={commandOutput} />
          )}

          {activeTab === 'cockpit' && (
            <Cockpit
              telemetry={telemetry}
              tunnelUrl={tunnelUrl}
              commandOutput={commandOutput}
              onToggleCaffeinate={toggleCaffeinate}
              onExecCommand={execCommand}
            />
          )}
        </main>

        {/* Mobile Bottom Navigation */}
        <div className="md:hidden">
          <ActivityBar
            activeTab={activeTab}
            onTabChange={setActiveTab}
            openPortCount={ports.length}
            hasPendingApproval={Boolean(activeConfirmation)}
          />
        </div>
      </div>
    </div>
  );
}
