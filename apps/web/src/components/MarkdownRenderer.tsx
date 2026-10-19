'use client';

import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  // 1. Sanitize internal AI harness wrapper tags
  const sanitized = content
    .replace(/<USER_REQUEST>[\s\S]*?<\/USER_REQUEST>/g, (m) => m.replace(/<\/?USER_REQUEST>/g, ''))
    .replace(/<CONTEXT_SUMMARY>[\s\S]*?<\/CONTEXT_SUMMARY>/g, '')
    .replace(/<SYSTEM_MESSAGE>[\s\S]*?<\/SYSTEM_MESSAGE>/g, '')
    .replace(/<ADDITIONAL_METADATA>[\s\S]*?<\/ADDITIONAL_METADATA>/g, '')
    .replace(/<\/?(USER_REQUEST|CONTEXT_SUMMARY|SYSTEM_MESSAGE|ADDITIONAL_METADATA|RULE\[[^\]]+\])>/g, '')
    .trim();

  // 2. Parse into code blocks and prose chunks
  const parts = sanitized.split(/(```[\s\S]*?```)/g);

  return (
    <div className="space-y-2 text-xs sm:text-xs leading-relaxed font-mono select-text">
      {parts.map((part, index) => {
        if (!part) return null;

        if (part.startsWith('```') && part.endsWith('```')) {
          return <CodeBlock key={index} raw={part} />;
        }

        return <ProseBlock key={index} text={part} />;
      })}
    </div>
  );
};

const CodeBlock: React.FC<{ raw: string }> = ({ raw }) => {
  const [copied, setCopied] = useState(false);

  // Extract language and code body
  const match = raw.match(/^```([a-zA-Z0-9_\-+]*)\n?([\s\S]*?)```$/);
  const lang = (match ? match[1] : '').trim().toLowerCase() || 'text';
  const code = (match ? match[2] : raw.slice(3, -3)).trim();

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const isDiff = lang === 'diff' || code.includes('@@') || (code.includes('\n+') && code.includes('\n-'));

  return (
    <div className="my-2.5 rounded-md border border-palenight-border bg-palenight-dark overflow-hidden">
      {/* Code Header Bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-palenight-card/80 border-b border-palenight-border text-[10px] text-palenight-muted select-none">
        <span className="font-mono uppercase font-bold text-palenight-mauve">{lang}</span>
        <button
          onClick={handleCopy}
          className="flex items-center space-x-1 hover:text-palenight-bright transition-colors p-0.5 rounded cursor-pointer touch-manipulation"
          title="Copy code"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-palenight-green" />
              <span className="text-palenight-green">copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span>copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code Body with Diff Highlighting */}
      <div className="p-3 overflow-x-auto text-[11px] font-mono leading-relaxed bg-[#1B1E2B]">
        {isDiff ? (
          code.split('\n').map((line, idx) => {
            if (line.startsWith('+') && !line.startsWith('+++')) {
              return (
                <div key={idx} className="text-palenight-green bg-palenight-green/10 -mx-3 px-3">
                  {line}
                </div>
              );
            }
            if (line.startsWith('-') && !line.startsWith('---')) {
              return (
                <div key={idx} className="text-palenight-red bg-palenight-red/10 -mx-3 px-3">
                  {line}
                </div>
              );
            }
            if (line.startsWith('@@')) {
              return (
                <div key={idx} className="text-palenight-cyan font-bold opacity-80 -mx-3 px-3 bg-palenight-card/40">
                  {line}
                </div>
              );
            }
            return (
              <div key={idx} className="text-palenight-fg">
                {line}
              </div>
            );
          })
        ) : (
          <pre className="text-palenight-fg whitespace-pre max-w-full overflow-x-auto font-mono">{code}</pre>
        )}
      </div>
    </div>
  );
};

const ProseBlock: React.FC<{ text: string }> = ({ text }) => {
  const lines = text.split('\n');

  return (
    <div className="space-y-1.5 break-words min-w-0 max-w-full">
      {lines.map((line, lIdx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={lIdx} className="h-1.5" />;

        // Header 1
        if (line.startsWith('# ')) {
          return (
            <h1 key={lIdx} className="text-sm font-bold text-palenight-bright pt-2 pb-1 border-b border-palenight-border/60 break-words min-w-0">
              {renderInline(line.slice(2))}
            </h1>
          );
        }

        // Header 2
        if (line.startsWith('## ')) {
          return (
            <h2 key={lIdx} className="text-xs sm:text-xs font-bold text-palenight-bright pt-2 pb-0.5 text-palenight-mauve break-words min-w-0">
              {renderInline(line.slice(3))}
            </h2>
          );
        }

        // Header 3
        if (line.startsWith('### ')) {
          return (
            <h3 key={lIdx} className="text-xs font-semibold text-palenight-cyan pt-1 break-words min-w-0">
              {renderInline(line.slice(4))}
            </h3>
          );
        }

        // Blockquote
        if (line.startsWith('> ')) {
          return (
            <blockquote key={lIdx} className="border-l-2 border-palenight-mauve/70 pl-3 py-0.5 italic text-palenight-muted text-[11px] break-words min-w-0">
              {renderInline(line.slice(2))}
            </blockquote>
          );
        }

        // Bullet list
        if (line.startsWith('- ') || line.startsWith('* ')) {
          return (
            <div key={lIdx} className="flex items-start space-x-2 pl-2 break-words min-w-0">
              <span className="text-palenight-mauve font-bold shrink-0 mt-0.5">•</span>
              <span className="text-palenight-fg leading-relaxed break-words min-w-0">{renderInline(line.slice(2))}</span>
            </div>
          );
        }

        // Numbered list
        const numMatch = line.match(/^(\d+)\.\s+(.*)/);
        if (numMatch) {
          return (
            <div key={lIdx} className="flex items-start space-x-2 pl-2 break-words min-w-0">
              <span className="text-palenight-cyan font-bold shrink-0 text-[10px] mt-0.5">{numMatch[1]}.</span>
              <span className="text-palenight-fg leading-relaxed break-words min-w-0">{renderInline(numMatch[2])}</span>
            </div>
          );
        }

        // Standard paragraph line
        return (
          <p key={lIdx} className="text-palenight-fg leading-relaxed break-words min-w-0 max-w-full">
            {renderInline(line)}
          </p>
        );
      })}
    </div>
  );
};

function renderInline(str: string): React.ReactNode {
  // Regex token parser for inline code, bold, links
  const tokens = str.split(/(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g);

  return tokens.map((token, idx) => {
    if (!token) return null;

    // Inline Code: `code`
    if (token.startsWith('`') && token.endsWith('`')) {
      return (
        <code
          key={idx}
          className="bg-palenight-dark text-palenight-cyan px-1.5 py-0.5 rounded border border-palenight-border/60 text-[11px] font-mono mx-0.5"
        >
          {token.slice(1, -1)}
        </code>
      );
    }

    // Bold: **text**
    if (token.startsWith('**') && token.endsWith('**')) {
      return (
        <strong key={idx} className="font-bold text-palenight-bright">
          {token.slice(2, -2)}
        </strong>
      );
    }

    // Link: [label](url)
    const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      return (
        <a
          key={idx}
          href={linkMatch[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-palenight-blue hover:text-palenight-cyan underline underline-offset-2 transition-colors"
        >
          {linkMatch[1]}
        </a>
      );
    }

    return token;
  });
}
