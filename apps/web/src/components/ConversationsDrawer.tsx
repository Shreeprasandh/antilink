'use client';

import React from 'react';
import { MessageSquare, Plus, Check, X, Clock } from 'lucide-react';
import type { ConversationSummary } from '@antilink/shared';

interface ConversationsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  conversations: ConversationSummary[];
  activeId: string | null;
  onSelectConversation: (id: string) => void;
}

export const ConversationsDrawer: React.FC<ConversationsDrawerProps> = ({
  isOpen,
  onClose,
  conversations,
  activeId,
  onSelectConversation,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Body */}
      <div className="relative w-80 max-w-[85vw] h-full bg-palenight-dark border-r border-palenight-border flex flex-col font-mono text-xs shadow-2xl z-10 animate-in slide-in-from-left duration-200">
        {/* Top Header */}
        <div className="h-12 border-b border-palenight-border px-3.5 flex items-center justify-between select-none">
          <div className="flex items-center space-x-2 text-palenight-bright font-bold">
            <MessageSquare className="w-4 h-4 text-palenight-mauve" />
            <span>SESSION HISTORY</span>
          </div>
          <button
            onClick={onClose}
            className="text-palenight-muted hover:text-palenight-fg p-1 rounded active:scale-95 transition-transform"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* New Session Action */}
        <div className="p-3 border-b border-palenight-border/60">
          <button
            onClick={() => {
              onClose();
            }}
            className="w-full bg-palenight-card border border-palenight-border hover:border-palenight-mauve text-palenight-bright py-2 px-3 rounded-md flex items-center justify-center space-x-2 font-medium active:scale-98 transition-all touch-manipulation cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-palenight-mauve" />
            <span className="truncate">Current: {conversations.find((c) => c.id === activeId)?.title || 'Active Session'}</span>
          </button>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1 overscroll-contain">
          {conversations.length === 0 && (
            <div className="text-palenight-muted text-center py-8 text-[11px]">
              No past sessions discovered in Antigravity storage.
            </div>
          )}

          {conversations.map((conv) => {
            const isActive = conv.id === activeId;

            return (
              <button
                key={conv.id}
                onClick={() => {
                  onSelectConversation(conv.id);
                  onClose();
                }}
                className={`w-full text-left p-2.5 rounded-md border transition-all touch-manipulation flex flex-col space-y-1 cursor-pointer ${
                  isActive
                    ? 'bg-palenight-card border-palenight-mauve/70 text-palenight-bright shadow-sm'
                    : 'bg-palenight-dark/40 border-palenight-border/50 text-palenight-fg hover:bg-palenight-card/50'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-bold truncate text-[11px] text-palenight-bright max-w-[200px]">
                    {conv.title}
                  </span>
                  {isActive && <Check className="w-3.5 h-3.5 text-palenight-mauve shrink-0" />}
                </div>

                {conv.preview && conv.preview !== conv.title && (
                  <div className="text-[10px] text-palenight-muted truncate line-clamp-1 leading-snug">
                    {conv.preview}
                  </div>
                )}

                <div className="flex items-center justify-between text-[10px] text-palenight-muted pt-0.5">
                  <span className="flex items-center space-x-1">
                    <Clock className="w-3 h-3" />
                    <span>{new Date(conv.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </span>
                  <span>{conv.stepCount} turns</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
