import { useEffect, useRef, useState, type FormEvent } from 'react';
import { sendChatMessage, type ChatMessage } from '../api';
import { useAuth } from '../context/AuthContext';

const GREETING: ChatMessage = {
  role: 'assistant',
  content:
    "Hi! I'm the TaraPeak trail assistant. Ask me about mountains, trail difficulty, distance, or hazards — I'll answer from TaraPeak's own trail data.",
};

/** Floating chatbot available app-wide, grounded in the app's own trail data via POST /chat. */
export default function ChatWidget() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, open]);

  if (!user) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    const history = messages.filter((m) => m !== GREETING);
    const nextMessages = [...messages, { role: 'user', content: text } as ChatMessage];
    setMessages(nextMessages);
    setInput('');
    setSending(true);
    setError(null);

    try {
      const result = await sendChatMessage(text, history);
      setMessages([...nextMessages, { role: 'assistant', content: result.reply }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reach the assistant');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="flex h-[28rem] w-[22rem] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between gap-2 bg-primary px-4 py-3 text-white">
            <div className="flex items-center gap-2 min-w-0">
              <span aria-hidden="true" className="material-symbols-outlined text-[20px]">
                forum
              </span>
              <span className="font-semibold text-sm truncate">TaraPeak Assistant</span>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              className="flex h-7 w-7 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            >
              <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
                close
              </span>
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2.5 bg-gray-50">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-line ${
                  m.role === 'user'
                    ? 'self-end bg-primary text-white rounded-br-sm'
                    : 'self-start bg-white border border-gray-200 text-gray-800 rounded-bl-sm'
                }`}
              >
                {m.content}
              </div>
            ))}
            {sending && (
              <div className="self-start flex items-center gap-2 rounded-2xl rounded-bl-sm border border-gray-200 bg-white px-3 py-2 text-xs text-gray-400">
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                Thinking…
              </div>
            )}
            {error && <p className="text-xs text-red-600 px-1">{error}</p>}
          </div>

          <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-gray-200 bg-white p-2.5">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about a trail…"
              disabled={sending}
              className="min-w-0 flex-1 rounded-full border border-gray-200 bg-gray-50 px-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-primary disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              aria-label="Send message"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-white transition-transform duration-150 ease-out active:scale-90 disabled:opacity-40"
            >
              <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
                send
              </span>
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close TaraPeak assistant' : 'Open TaraPeak assistant'}
        aria-expanded={open}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg transition-transform duration-150 ease-out hover:scale-105 active:scale-95"
      >
        <span aria-hidden="true" className="material-symbols-outlined text-[26px]">
          {open ? 'close' : 'forum'}
        </span>
      </button>
    </div>
  );
}
