'use client';

import { useEffect, useState } from 'react';
import { STORAGE_KEYS } from '@sfaizh/shared';
import { api } from '../../lib/api-client';
import { readLocal, removeLocal, writeLocal } from '../../lib/storage';

/**
 * A single password, exchanged for an HMAC-signed session token. The token is
 * kept in `localStorage` rather than a cookie because every call is made by
 * `fetch` from this one page — there is no cross-site request to protect.
 */

type Status = 'checking' | 'locked' | 'unlocked';

export function LoginGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>('checking');
  const [password, setPassword] = useState('');
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!readLocal(STORAGE_KEYS.token)) {
      setStatus('locked');
      return;
    }
    api
      .session()
      .then(() => setStatus('unlocked'))
      .catch(() => {
        removeLocal(STORAGE_KEYS.token);
        setStatus('locked');
      });
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setFailure(null);
    try {
      const session = await api.login(password);
      writeLocal(STORAGE_KEYS.token, session.token);
      setPassword('');
      setStatus('unlocked');
    } catch (cause) {
      setFailure((cause as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (status === 'unlocked') return <>{children}</>;

  return (
    <div className="flex h-[100dvh] w-full items-center justify-center px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-lg border border-[color:var(--ctp-surface1)] bg-[color:var(--ctp-mantle)] p-6 font-mono"
      >
        <div className="mb-1 text-[color:var(--ctp-mauve)]">sfaizh.top — admin</div>
        <label htmlFor="admin-password" className="block text-[13px] text-[color:var(--ctp-overlay1)]">
          [sudo] password for faiz:
        </label>

        <input
          id="admin-password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={status === 'checking' || busy}
          autoFocus
          autoComplete="current-password"
          className="mt-3 w-full rounded border border-[color:var(--ctp-surface1)] bg-[color:var(--ctp-base)] px-3 py-2 text-[color:var(--ctp-text)] outline-none focus:border-[color:var(--ctp-lavender)]"
        />

        {failure && (
          <p role="alert" className="mt-3 text-[13px] text-[color:var(--ctp-red)]">
            {failure}
          </p>
        )}

        <div className="mt-4 flex items-center justify-between">
          <a href="/" className="text-[13px] text-[color:var(--ctp-overlay1)] underline">
            ← back to the terminal
          </a>
          <button
            type="submit"
            disabled={busy || !password}
            className="rounded bg-[color:var(--ctp-mauve)] px-4 py-2 font-bold text-[color:var(--ctp-crust)] disabled:opacity-50"
          >
            {busy ? 'authenticating…' : 'unlock'}
          </button>
        </div>

        <p className="mt-4 text-[12px] leading-relaxed text-[color:var(--ctp-overlay0)]">
          Set <code>AUTH_SECRET</code> and <code>ADMIN_PASSWORD_HASH</code> in the environment.
          Locally, the default password is <code>catppuccin</code>.
        </p>
      </form>
    </div>
  );
}
