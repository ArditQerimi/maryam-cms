'use client';

import { Fragment, useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { MessageCircle, Send, ThumbsDown, ThumbsUp, X } from 'lucide-react';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import styles from './agent-chat.module.css';

type Turn = { role: 'user' | 'assistant'; text: string; runId?: string; rating?: 1 | -1 };

const STORAGE_KEY = 'shop-agent-chat';
const MAX_SENT_TURNS = 16;

const COPY = {
  sq: {
    open: 'Hap bisedën',
    close: 'Mbyll bisedën',
    title: 'Asistenti i dyqanit',
    subtitle: 'Pyet për produkte, çmime ose bëj porosi',
    greeting: 'Përshëndetje! Si mund t’ju ndihmoj? Mund të pyesni për produkte, çmime, dërgesë ose të bëni porosi këtu.',
    placeholder: 'Shkruaj një mesazh…',
    send: 'Dërgo',
    error: 'Nuk mund të lidhem tani. Provoni pak më vonë.',
    helpful: 'Ishte e dobishme?',
    good: 'Përgjigje e mirë',
    bad: 'Përgjigje e gabuar',
    thanks: 'Faleminderit!',
  },
  en: {
    open: 'Open chat',
    close: 'Close chat',
    title: 'Shop assistant',
    subtitle: 'Ask about products, prices or place an order',
    greeting: 'Hello! How can I help? Ask about products, prices, delivery, or place an order here.',
    placeholder: 'Write a message…',
    send: 'Send',
    error: 'I cannot connect right now. Please try again later.',
    helpful: 'Was this helpful?',
    good: 'Good answer',
    bad: 'Wrong answer',
    thanks: 'Thank you!',
  },
} as const;

/** Turns site-relative links (/home/...) in a reply into real links; everything else stays text. */
function renderText(text: string): ReactNode[] {
  return text.split(/(\/home\/[A-Za-z0-9\-_/.?=&%]+)/g).map((piece, index) =>
    piece.startsWith('/home/') ? (
      <a key={index} href={piece.replace(/[.,;:!?)]+$/, '')}>
        {piece.replace(/[.,;:!?)]+$/, '')}
      </a>
    ) : (
      piece
    ),
  );
}

export default function AgentChat() {
  const { locale } = useLocale();
  const copy = locale === 'en' ? COPY.en : COPY.sq;
  const [open, setOpen] = useState(false);
  // The conversation only renders once the panel is open (client-side), so reading storage here
  // cannot cause a hydration mismatch.
  const [turns, setTurns] = useState<Turn[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = window.sessionStorage.getItem(STORAGE_KEY);
      return saved ? (JSON.parse(saved) as Turn[]) : [];
    } catch {
      return [];
    }
  });
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(turns.slice(-40)));
    } catch {
      // Ignore.
    }
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [turns, busy, open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const send = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      const message = draft.trim();
      if (!message || busy) return;
      const history = turns.slice(-MAX_SENT_TURNS);
      setTurns((current) => [...current, { role: 'user', text: message }]);
      setDraft('');
      setBusy(true);
      try {
        const response = await fetch('/api/agent/chat', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ message, history }),
        });
        const payload = (await response.json().catch(() => ({}))) as { reply?: string; runId?: string | null };
        const reply = response.ok && payload.reply ? payload.reply : copy.error;
        const runId = response.ok && payload.runId ? payload.runId : undefined;
        setTurns((current) => [...current, { role: 'assistant', text: reply, runId }]);
      } catch {
        setTurns((current) => [...current, { role: 'assistant', text: copy.error }]);
      } finally {
        setBusy(false);
      }
    },
    [busy, copy.error, draft, turns],
  );

  /** 👍 / 👎 for one answer (shown in the shop's CMS, used to improve the assistant). */
  const rate = useCallback((index: number, rating: 1 | -1) => {
    const turn = turns[index];
    if (!turn?.runId || turn.rating === rating) return;
    setTurns((current) => current.map((item, i) => (i === index ? { ...item, rating } : item)));
    void fetch('/api/agent/feedback', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ runId: turn.runId, rating }),
    }).catch(() => undefined);
  }, [turns]);

  return (
    <div className={styles.root}>
      {open ? (
        <section className={styles.panel} aria-label={copy.title}>
          <header className={styles.head}>
            <div>
              <strong>{copy.title}</strong>
              <span>{copy.subtitle}</span>
            </div>
            <button type="button" className={styles.close} onClick={() => setOpen(false)} aria-label={copy.close}>
              <X size={18} strokeWidth={1.8} />
            </button>
          </header>

          <div className={styles.list} ref={listRef} aria-live="polite">
            <p className={`${styles.bubble} ${styles.assistant}`}>{copy.greeting}</p>
            {turns.map((turn, index) => (
              <Fragment key={index}>
                <p className={`${styles.bubble} ${turn.role === 'user' ? styles.user : styles.assistant}`}>
                  {turn.role === 'assistant' ? renderText(turn.text) : turn.text}
                </p>
                {turn.role === 'assistant' && turn.runId ? (
                  <div className={styles.rate}>
                    <span>{turn.rating ? copy.thanks : copy.helpful}</span>
                    <button type="button" aria-label={copy.good} title={copy.good} aria-pressed={turn.rating === 1} onClick={() => rate(index, 1)}>
                      <ThumbsUp size={14} strokeWidth={1.8} />
                    </button>
                    <button type="button" aria-label={copy.bad} title={copy.bad} aria-pressed={turn.rating === -1} onClick={() => rate(index, -1)}>
                      <ThumbsDown size={14} strokeWidth={1.8} />
                    </button>
                  </div>
                ) : null}
              </Fragment>
            ))}
            {busy ? (
              <p className={`${styles.bubble} ${styles.assistant} ${styles.typing}`} aria-hidden="true">
                <i />
                <i />
                <i />
              </p>
            ) : null}
          </div>

          <form className={styles.form} onSubmit={send}>
            <input
              ref={inputRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={copy.placeholder}
              maxLength={1000}
              autoComplete="off"
            />
            <button type="submit" disabled={busy || !draft.trim()} aria-label={copy.send}>
              <Send size={18} strokeWidth={1.8} />
            </button>
          </form>
        </section>
      ) : null}

      {!open ? (
        <button type="button" className={styles.launcher} onClick={() => setOpen(true)} aria-label={copy.open}>
          <MessageCircle size={24} strokeWidth={1.7} />
        </button>
      ) : null}
    </div>
  );
}
