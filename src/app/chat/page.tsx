"use client";

import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sql?: string;
  data?: string;
  generatedBy?: string;
}

const SUGGESTIONS = [
  { text: "Which brand has the highest overall score in Automotive?", icon: "Rank" },
  { text: "What is the average sentiment score across all brands?", icon: "Avg" },
  { text: "List the pipeline runs and their dates", icon: "Ops" },
  { text: "Which brands have a recommendation score above 80% (above 32 out of 40)?", icon: "Rec" },
  { text: "Compare top 3 Technology brands by score", icon: "Cmp" },
  { text: "Show the top 5 brands with highest score", icon: "Top" },
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const endOfMessagesRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function handleSend(text: string) {
    if (!text.trim() || loading) return;

    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text })
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch answer');
      }

      setMessages(prev => [
        ...prev, 
        { 
          role: 'assistant', 
          content: data.answer,
          sql: data.sql,
          data: data.data,
          generatedBy: data.generatedBy
        }
      ]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: `⚠️ **Error:** ${err instanceof Error ? err.message : 'Something went wrong.'}` }
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput('');
    handleSend(userMsg);
  }

  function copyToClipboard(text: string, index: number) {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  }

  const hasMessages = messages.length > 0;

  return (
    <div className="rs-page flex flex-col relative overflow-hidden" style={{ minHeight: 'calc(100vh - 58px)' }}>
      {/* Background ambient glows */}
      <div className="absolute top-[10%] left-[20%] w-[450px] h-[450px] rounded-full bg-indigo-500/[0.025] blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[10%] w-[350px] h-[350px] rounded-full bg-purple-500/[0.025] blur-[120px] pointer-events-none" />

      {/* Empty State / Welcome */}
      {!hasMessages && (
        <div className="flex-grow flex flex-col items-center justify-center px-4 py-8 sm:py-12 relative z-10 animate-fade-in">
          
          {/* Product mark */}
          <div className="relative mb-5">
            <div className="absolute -inset-px bg-indigo-500/20 rounded-2xl blur-sm opacity-80" />
            <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[#16181d] border border-white/[0.08] flex items-center justify-center shadow-lg">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor" className="w-8 h-8 text-indigo-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
              </svg>
            </div>
            <div className="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full bg-emerald-500 border-4 flex items-center justify-center" style={{ borderColor: 'var(--rs-bg-base)' }}>
              <span className="text-[9px] text-white font-black">✓</span>
            </div>
          </div>
          
          <h1 className="text-3xl sm:text-5xl font-semibold mb-3 tracking-[-0.03em] text-center text-white">
            Ask your <span className="gradient-text">brand data</span>
          </h1>
          <p className="text-sm sm:text-base max-w-2xl text-center leading-relaxed mb-4 text-balance" style={{ color: 'var(--rs-text-secondary)' }}>
            Ask plain-language questions across tracked brands, categories, model scores, and pipeline runs.
          </p>
          <div className="flex max-w-full items-center gap-2 mb-6 sm:mb-8 bg-white/[0.02] border border-white/[0.06] rounded-full px-3 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-400">Read-only · auditable · live data</span>
          </div>

          {/* Suggestion Grid */}
          <div className="grid grid-cols-1 gap-3 w-full max-w-4xl sm:grid-cols-2 lg:grid-cols-3">
            {SUGGESTIONS.map((sug, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(sug.text)}
                disabled={loading}
                className="group rs-card text-left px-4 py-3.5 sm:py-4 flex items-start gap-3 bg-[#16181d]/70 border-white/[0.08] hover:border-white/[0.16] transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-sm"
              >
                <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-[10px] font-semibold uppercase tracking-wider mt-0.5 shrink-0 text-indigo-300 group-hover:bg-white/[0.06] transition-colors">
                  {sug.icon}
                </div>
                <span className="text-sm leading-snug font-medium align-middle my-auto" style={{ color: 'var(--rs-text-secondary)' }}>
                  {sug.text}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      {hasMessages && (
        <div className="flex-grow overflow-y-auto px-4 sm:px-6 pt-6 pb-4 relative z-10">
          <div className="max-w-3xl mx-auto space-y-5">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                <div className="max-w-[88%] sm:max-w-[82%] relative">
                  {/* User message */}
                  {msg.role === 'user' && (
                    <div className="rounded-2xl rounded-br-md px-5 py-3.5 text-[14px] leading-relaxed text-white shadow-lg" style={{ background: 'linear-gradient(135deg, rgba(var(--rs-accent-rgb), 0.9), rgba(139,92,246,0.85))' }}>
                      {msg.content}
                    </div>
                  )}

                  {/* Assistant message */}
                  {msg.role === 'assistant' && (
                    <div className="rounded-2xl rounded-bl-md p-5 shadow-lg bg-[#16181d]/50 backdrop-blur-md border border-white/[0.06]">
                      {/* Header */}
                      <div className="flex items-center justify-between mb-3 pb-2.5" style={{ borderBottom: '1px solid var(--rs-border)' }}>
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-white">
                              <path d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                            </svg>
                          </div>
                          <span className="text-[10px] font-bold uppercase tracking-widest text-white">rAsh AI</span>
                        </div>
                        {msg.generatedBy && (
                          <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300">
                            {msg.generatedBy}
                          </span>
                        )}
                      </div>
                      
                      {/* Content */}
                      <div className="prose prose-sm max-w-none prose-invert prose-p:text-[var(--rs-text-secondary)] prose-p:leading-relaxed prose-strong:text-indigo-300 prose-strong:font-bold prose-code:text-indigo-300 prose-code:bg-indigo-500/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:before:content-none prose-code:after:content-none prose-table:text-xs prose-th:text-left prose-th:text-[var(--rs-text-secondary)] prose-th:font-semibold prose-td:text-[var(--rs-text-secondary)]">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {msg.content}
                        </ReactMarkdown>
                      </div>

                      {/* SQL Inspector */}
                      {msg.sql && (
                        <div className="mt-4 pt-3" style={{ borderTop: '1px solid var(--rs-border)' }}>
                          <details className="group/sql">
                            <summary className="cursor-pointer text-[10px] font-semibold font-mono uppercase tracking-wider select-none outline-none flex items-center gap-1.5 transition-colors text-slate-500 hover:text-indigo-400">
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-3 h-3 transition-transform group-open/sql:rotate-90">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                              </svg>
                              SQL Execution
                            </summary>
                            
                            <div className="mt-3 rounded-xl overflow-hidden bg-[#0f1115] border border-white/[0.06]">
                              {/* Editor Header */}
                              <div className="px-4 py-2.5 flex items-center justify-between bg-white/[0.02]" style={{ borderBottom: '1px solid var(--rs-border)' }}>
                                <div className="flex items-center gap-1.5">
                                  <span className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
                                  <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
                                  <span className="w-2.5 h-2.5 rounded-full bg-green-500/50" />
                                  <span className="text-[9px] font-mono ml-2 text-slate-500">query.sql</span>
                                </div>
                                <button
                                  onClick={() => copyToClipboard(msg.sql || '', i)}
                                  className="text-[9px] font-mono px-2.5 py-1 rounded-md transition-all hover:bg-white/[0.05] text-slate-400 hover:text-white"
                                  style={{ border: '1px solid var(--rs-border)' }}
                                >
                                  {copiedIndex === i ? '✓ Copied' : 'Copy'}
                                </button>
                              </div>
                              <pre className="p-4 text-xs font-mono text-indigo-300/80 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                                {msg.sql}
                              </pre>
                            </div>
                          </details>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {/* Loading indicator */}
            {loading && (
              <div className="flex justify-start animate-fade-in">
                <div className="rounded-2xl rounded-bl-md px-5 py-4 flex items-center gap-3 bg-[#16181d]/50 border border-white/[0.06]">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce" />
                    <span className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce [animation-delay:0.15s]" />
                    <span className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce [animation-delay:0.3s]" />
                  </div>
                  <span className="text-xs font-mono text-slate-500">Querying database...</span>
                </div>
              </div>
            )}
            
            <div ref={endOfMessagesRef} />
          </div>
        </div>
      )}

      {/* Input Area — always at bottom */}
      <div className="shrink-0 px-4 sm:px-6 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-5 pt-3 z-20 sticky bottom-0" style={{ background: `linear-gradient(to top, var(--rs-bg-base) 70%, transparent)` }}>
        <div className="max-w-3xl mx-auto">
          {/* Quick suggestions when in conversation */}
          {hasMessages && !loading && (
            <div className="flex gap-2 mb-3 overflow-x-auto no-scrollbar whitespace-nowrap pb-1">
              {SUGGESTIONS.slice(0, 4).map((sug, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(sug.text)}
                  disabled={loading}
                  className="shrink-0 text-[11px] px-3 py-1.5 rounded-lg transition-all disabled:opacity-50 bg-[#16181d]/40 border border-white/[0.06] hover:border-indigo-500/20 text-slate-400 hover:text-white"
                >
                  {sug.icon} {sug.text.length > 30 ? sug.text.slice(0, 30) + '…' : sug.text}
                </button>
              ))}
            </div>
          )}

          {/* Input form */}
          <form onSubmit={handleSubmit} className="relative group">
            {/* Focus glow */}
            <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl blur opacity-25 group-focus-within:opacity-50 transition duration-500" />
            
            <div className="relative flex items-center rounded-2xl overflow-hidden bg-[#16181d]/95 border border-white/[0.1] backdrop-blur-md">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={hasMessages ? "Ask a follow-up question..." : "Ask anything about brands, scores, or trends..."}
                className="w-full bg-transparent pl-4 sm:pl-5 pr-14 py-3.5 sm:py-4 text-white focus:outline-none text-sm placeholder:text-slate-500"
                style={{ caretColor: 'rgb(var(--rs-accent-rgb))' }}
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="absolute right-2.5 w-9 h-9 flex items-center justify-center rounded-xl text-white disabled:opacity-30 transition-all active:scale-90 z-20"
                style={{ background: input.trim() ? 'rgb(var(--rs-accent-rgb))' : 'rgba(255,255,255,0.05)' }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                  <path d="M3.478 2.404a.75.75 0 00-.926.941l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.404z" />
                </svg>
              </button>
            </div>
          </form>
          
          <div className="text-center mt-2.5">
            <span className="text-[10px] font-mono tracking-wider text-slate-500">
              Secure SQL · Read-only · Data refreshes hourly
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
