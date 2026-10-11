'use client';

import React, { useState, useEffect } from 'react';
import { useAntilink } from '@/hooks/useAntilink';
import { Header } from '@/components/Header';
import { ActivityBar, ActiveTab } from '@/components/ActivityBar';
import { AgentStream } from '@/components/AgentStream';
import { PreviewMatrix } from '@/components/PreviewMatrix';
import { GitViewer } from '@/components/GitViewer';
import { Cockpit } from '@/components/Cockpit';
import { ConversationsDrawer } from '@/components/ConversationsDrawer';
import { AuxiliaryDrawer } from '@/components/AuxiliaryDrawer';
import { ShortcutsModal } from '@/components/ShortcutsModal';

export default function AntilinkApp() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('stream');
  const [isConversationsOpen, setIsConversationsOpen] = useState(false);
  const [isAuxiliaryOpen, setIsAuxiliaryOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);

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
    activeConversationId,
    activeConversationTitle,
    conversations,
    subagents,
    tasks,
    artifacts,
    sendPrompt,
    confirmTool,
    switchConversation,
    killTask,
    toggleCaffeinate,
    scanPorts,
    execCommand,
  } = useAntilink();

  const userEmail = 'shreeprasandh@gmail.com';
  const userName = 'Shreeprasandh';
  const gitRepo = 'Shreeprasandh/antilink';
  const gitBranch = 'main';
  const remoteControlUrl =
    'https://antigravity.google.com/r/fe05edc8-4845-4227-8a3a-6f6eb60335d4-v2?p=c%2Fd933eaf8-272e-4559-89bc-a9c284a5eed0%3Fsection%3Ddefault-cli-project';

  // Global Keyboard Navigation Listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is currently typing inside an input or textarea
      const target = e.target as HTMLElement | null;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');

      // Esc closes any open drawer or modal
      if (e.key === 'Escape') {
        setIsConversationsOpen(false);
        setIsAuxiliaryOpen(false);
        setIsShortcutsOpen(false);
        return;
      }

      // Cmd/Ctrl + K: Toggle Sessions History Drawer
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsConversationsOpen((prev) => !prev);
        return;
      }

      // Cmd/Ctrl + B: Toggle Auxiliary Panels Drawer
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setIsAuxiliaryOpen((prev) => !prev);
        return;
      }

      if (isInput) return;

      // Question mark (?) toggles Shortcuts modal
      if (e.key === '?') {
        e.preventDefault();
        setIsShortcutsOpen((prev) => !prev);
        return;
      }

      // 1, 2, 3, 4: Quick Tab Switch
      if (e.key === '1') setActiveTab('stream');
      if (e.key === '2') setActiveTab('preview');
      if (e.key === '3') setActiveTab('git');
      if (e.key === '4') setActiveTab('cockpit');
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="flex flex-col h-[100dvh] bg-palenight-bg text-palenight-fg select-none overflow-hidden font-mono">
      {/* Top Header with Drawer Toggles, Remote Control Link & Wake Indicator */}
      <Header
        status={status}
        latencyMs={latencyMs}
        machineName={machineName}
        activeConversationTitle={activeConversationTitle}
        tunnelUrl={tunnelUrl}
        telemetry={telemetry}
        userEmail={userEmail}
        remoteControlUrl={remoteControlUrl}
        onOpenConversations={() => setIsConversationsOpen(true)}
        onOpenAuxiliary={() => setIsAuxiliaryOpen(true)}
        onToggleCaffeinate={toggleCaffeinate}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Desktop Left Activity Bar */}
        <div className="hidden md:block">
          <ActivityBar
            activeTab={activeTab}
            onTabChange={setActiveTab}
            openPortCount={ports.length}
            hasPendingApproval={Boolean(activeConfirmation)}
          />
        </div>

        {/* Dynamic Center Stage Panel */}
        <main className="flex-1 flex flex-col overflow-hidden relative">
          {activeTab === 'stream' && (
            <AgentStream
              steps={steps}
              activeConfirmation={activeConfirmation}
              activeConversationTitle={activeConversationTitle}
              onConfirmTool={confirmTool}
              onSendPrompt={sendPrompt}
              onExecCommand={execCommand}
              onOpenShortcuts={() => setIsShortcutsOpen(true)}
            />
          )}

          {activeTab === 'preview' && (
            <PreviewMatrix ports={ports} onScanPorts={scanPorts} />
          )}

          {activeTab === 'git' && (
            <GitViewer
              onExecCommand={execCommand}
              commandOutput={commandOutput}
              gitRepo={gitRepo}
              gitBranch={gitBranch}
              userEmail={userEmail}
              userName={userName}
            />
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

        {/* Mobile Bottom Navigation Activity Bar */}
        <div className="md:hidden">
          <ActivityBar
            activeTab={activeTab}
            onTabChange={setActiveTab}
            openPortCount={ports.length}
            hasPendingApproval={Boolean(activeConfirmation)}
          />
        </div>
      </div>

      {/* Left Slide-Out: Conversations History Drawer */}
      <ConversationsDrawer
        isOpen={isConversationsOpen}
        onClose={() => setIsConversationsOpen(false)}
        conversations={conversations}
        activeId={activeConversationId}
        onSelectConversation={switchConversation}
      />

      {/* Right Slide-Out: Auxiliary Panels Drawer (Artifacts, Tasks, Subagents, Shell) */}
      <AuxiliaryDrawer
        isOpen={isAuxiliaryOpen}
        onClose={() => setIsAuxiliaryOpen(false)}
        subagents={subagents}
        tasks={tasks}
        artifacts={artifacts}
        commandOutput={commandOutput}
        onExecCommand={execCommand}
        onKillTask={killTask}
      />

      {/* Keyboard Shortcuts Dialog Modal */}
      <ShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />
    </div>
  );
}
