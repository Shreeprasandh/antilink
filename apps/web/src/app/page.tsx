'use client';

import React, { useState, useEffect } from 'react';
import { useAntilink } from '@/hooks/useAntilink';
import { useWakeLock } from '@/hooks/useWakeLock';
import { Header } from '@/components/Header';
import { ActivityBar, ActiveTab } from '@/components/ActivityBar';
import { AgentStream } from '@/components/AgentStream';
import { PreviewMatrix } from '@/components/PreviewMatrix';
import { GitViewer } from '@/components/GitViewer';
import { Cockpit } from '@/components/Cockpit';
import { ConversationsDrawer } from '@/components/ConversationsDrawer';
import { AuxiliaryDrawer } from '@/components/AuxiliaryDrawer';
import { ShortcutsModal } from '@/components/ShortcutsModal';
import { SettingsModal } from '@/components/SettingsModal';
import { GatewayModal } from '@/components/GatewayModal';
import { SecurityLockModal } from '@/components/SecurityLockModal';
import { LegalModal } from '@/components/LegalModal';

export default function AntilinkApp() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('stream');
  const [isConversationsOpen, setIsConversationsOpen] = useState(false);
  const [isAuxiliaryOpen, setIsAuxiliaryOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isGatewayModalOpen, setIsGatewayModalOpen] = useState(false);
  const [isLegalOpen, setIsLegalOpen] = useState(false);

  const [userName, setUserName] = useState('');
  const [assistantName, setAssistantName] = useState('Luna');
  const [userEmail, setUserEmail] = useState('');

  const { isLocked: isScreenWakeActive } = useWakeLock();

  const {
    status,
    latencyMs,
    machineName,
    projectName,
    userProfile,
    tunnelUrl,
    ports,
    telemetry,
    steps,
    activeConfirmation,
    commandOutput,
    isAgentWorking,
    activity,
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
  } = useAntilink();

  // Sync developer identity securely only while authenticated
  useEffect(() => {
    if (status === 'connected' && userProfile) {
      if (userProfile.userName) setUserName(userProfile.userName);
      if (userProfile.assistantName) setAssistantName(userProfile.assistantName);
      if (userProfile.userEmail) setUserEmail(userProfile.userEmail);
    } else if (status !== 'connected') {
      setUserName('');
      setUserEmail('');
    }
  }, [status, userProfile]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedGateway = localStorage.getItem('antilink_gateway_url');
      const hasQueryGateway = new URLSearchParams(window.location.search).get('gateway');
      if (!storedGateway && !hasQueryGateway && window.location.hostname.includes('vercel.app')) {
        setIsGatewayModalOpen(true);
      }
    }
  }, []);

  useEffect(() => {
    if (isPairingRequired || isPinRequired) {
      setIsGatewayModalOpen(false);
      setIsSettingsOpen(false);
    }
  }, [isPairingRequired, isPinRequired]);

  const handleSaveSettings = (settings: { userName: string; assistantName: string; userEmail: string }) => {
    setUserName(settings.userName);
    setAssistantName(settings.assistantName);
    setUserEmail(settings.userEmail);
  };

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
        setIsSettingsOpen(false);
        setIsGatewayModalOpen(false);
        setIsLegalOpen(false);
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
        projectName={projectName}
        isScreenWakeActive={isScreenWakeActive}
        activeConversationTitle={activeConversationTitle}
        tunnelUrl={tunnelUrl}
        telemetry={telemetry}
        userEmail={status === 'connected' ? userEmail : ''}
        remoteControlUrl={status === 'connected' ? remoteControlUrl : undefined}
        onOpenGatewayModal={() => setIsGatewayModalOpen(true)}
        onOpenConversations={() => setIsConversationsOpen(true)}
        onOpenAuxiliary={() => setIsAuxiliaryOpen(true)}
        onToggleCaffeinate={toggleCaffeinate}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-w-0">
        {/* Desktop Left Activity Bar */}
        <div className="hidden md:block">
          <ActivityBar
            activeTab={activeTab}
            onTabChange={setActiveTab}
            openPortCount={ports.length}
            hasPendingApproval={Boolean(activeConfirmation)}
          />
        </div>

        {/* Dynamic Center Stage Panel - Persistent DOM preserves scroll and state across tab switches */}
        <main className="flex-1 flex flex-col overflow-hidden relative min-w-0">
          <div className={`h-full w-full flex flex-col min-w-0 ${activeTab === 'stream' ? '' : 'hidden'}`}>
            <AgentStream
              isActive={activeTab === 'stream'}
              gatewayUrl={gatewayUrl}
              steps={steps}
              activeConfirmation={activeConfirmation}
              activeConversationTitle={activeConversationTitle}
              activeConversationId={activeConversationId}
              isHistoricalSession={Boolean(activeConversationId && conversations.length > 0 && !conversations.find((c) => c.id === activeConversationId)?.isActive)}
              remoteControlUrl={remoteControlUrl}
              userName={userName}
              assistantName={assistantName}
              isAgentWorking={isAgentWorking}
              activity={activity}
              projectName={projectName}
              promptQueue={promptQueue}
              onCancelQueuedPrompt={cancelQueuedPrompt}
              onConfirmTool={confirmTool}
              onSendPrompt={sendPrompt}
              onExecCommand={execCommand}
              onOpenShortcuts={() => setIsShortcutsOpen(true)}
              onOpenSettings={() => setIsSettingsOpen(true)}
            />
          </div>

          <div className={`h-full w-full flex flex-col ${activeTab === 'preview' ? '' : 'hidden'}`}>
            <PreviewMatrix ports={ports} gatewayUrl={gatewayUrl} onScanPorts={scanPorts} />
          </div>

          <div className={`h-full w-full flex flex-col ${activeTab === 'git' ? '' : 'hidden'}`}>
            <GitViewer
              onExecCommand={execCommand}
              commandOutput={commandOutput}
              gitRepo={status === 'connected' ? gitRepo : 'Disconnected'}
              gitBranch={status === 'connected' ? gitBranch : 'None'}
              userEmail={status === 'connected' ? userEmail : ''}
              userName={status === 'connected' ? userName : 'Standby'}
            />
          </div>

          <div className={`h-full w-full flex flex-col ${activeTab === 'cockpit' ? '' : 'hidden'}`}>
            <Cockpit
              telemetry={telemetry}
              tunnelUrl={tunnelUrl}
              commandOutput={commandOutput}
              onToggleCaffeinate={toggleCaffeinate}
              onExecCommand={execCommand}
            />
          </div>
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

      {/* Identity & Preferences Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        isConnected={status === 'connected'}
        userName={userName}
        assistantName={assistantName}
        userEmail={userEmail}
        onSave={handleSaveSettings}
        onOpenLegal={() => setIsLegalOpen(true)}
      />


      {/* Mac Gateway Connection Modal */}
      <GatewayModal
        isOpen={isGatewayModalOpen}
        onClose={() => setIsGatewayModalOpen(false)}
        status={status}
        machineName={machineName}
        latencyMs={latencyMs}
        currentGatewayUrl={gatewayUrl}
        userName={userName}
        onConnect={(newGateway) => setGateway(newGateway)}
        onUpdateUserName={(name) => {
          setUserName(name);
          if (typeof window !== 'undefined') {
            localStorage.setItem('antilink_user_name', name);
          }
        }}
        onOpenLegal={() => setIsLegalOpen(true)}
      />

      {/* Hardware Device Pairing & Master PIN Security Modal */}
      <SecurityLockModal
        isOpen={isPairingRequired || isPinRequired}
        mode={isPairingRequired ? 'pairing' : 'pin'}
        pairingMessage={pairingMessage}
        pinError={pinError || undefined}
        onSubmitPairingCode={submitPairingCode}
        onSubmitPin={submitPin}
        onDisconnect={disconnect}
        onOpenLegal={() => setIsLegalOpen(true)}
      />

      {/* Privacy Policy, Terms & Legal Compliance Modal */}
      <LegalModal
        isOpen={isLegalOpen}
        onClose={() => setIsLegalOpen(false)}
      />
    </div>
  );
}
