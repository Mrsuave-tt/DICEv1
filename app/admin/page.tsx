'use client';

import { useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type Status = 'idle' | 'loading' | 'success' | 'error';

interface ColorConfig {
  label: string;
  value: string | null;
  classes: string;
  ring: string;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const COLORS: ColorConfig[] = [
  { label: 'Red', value: 'red', classes: 'bg-red-600 hover:bg-red-500 text-white', ring: 'ring-red-400' },
  { label: 'Orange', value: 'orange', classes: 'bg-orange-500 hover:bg-orange-400 text-white', ring: 'ring-orange-300' },
  { label: 'Yellow', value: 'yellow', classes: 'bg-yellow-400 hover:bg-yellow-300 text-gray-900', ring: 'ring-yellow-200' },
  { label: 'Green', value: 'green', classes: 'bg-emerald-600 hover:bg-emerald-500 text-white', ring: 'ring-emerald-400' },
  { label: 'Blue', value: 'blue', classes: 'bg-blue-600 hover:bg-blue-500 text-white', ring: 'ring-blue-400' },
  { label: 'Purple', value: 'purple', classes: 'bg-purple-600 hover:bg-purple-500 text-white', ring: 'ring-purple-400' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function setWinner(color: string | null): Promise<void> {
  const res = await fetch('/api/admin/set-winner', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ color }),
  });

  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error ?? 'Request failed');
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminPage() {
  // ── Security State ──
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [errorShake, setErrorShake] = useState(false);
  const SECRET_PIN = '%^#!'; // Set your secret PIN here!

  // ── Dashboard State ──
  const [activeColor, setActiveColor] = useState<string | null | undefined>(undefined);
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');

  // ── PIN Handler ──
  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput === SECRET_PIN) {
      setIsUnlocked(true);
    } else {
      setErrorShake(true);
      setPinInput('');
      setTimeout(() => setErrorShake(false), 500);
    }
  };

  // ── Select Handler ──
  const handleSelect = async (color: string | null) => {
    setStatus('loading');
    setMessage('');

    try {
      await setWinner(color);
      setActiveColor(color);
      setStatus('success');
      setMessage(
        color
          ? `All dice locked to "${color}". 🎲`
          : 'Forced colour cleared — rolls are now fair. ⚖️',
      );
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Something went wrong.');
    }
  };

  // ─── VIEW 1: THE LOCK SCREEN ─────────────────────────────────────────────────
  if (!isUnlocked) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
        <form
          onSubmit={handlePinSubmit}
          className={`w-full max-w-sm rounded-2xl border border-gray-800 bg-gray-900 p-8 shadow-2xl transition-transform duration-100 ${errorShake ? 'translate-x-2 border-red-500/50' : ''}`}
        >
          <div className="mb-6 flex justify-center items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
            </span>
            <h2 className="text-sm font-semibold uppercase tracking-widest text-red-400">System Locked</h2>
          </div>

          <input
            type="password"
            maxLength={4}
            autoFocus
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value)}
            className="mb-6 w-full rounded-xl border border-gray-700 bg-gray-950 px-6 py-4 text-center text-4xl tracking-[0.5em] text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="****"
          />

          <button
            type="submit"
            className="w-full rounded-xl bg-blue-600 py-4 text-sm font-bold uppercase tracking-widest text-white transition-colors hover:bg-blue-500 active:scale-95"
          >
            Authenticate
          </button>
        </form>
      </div>
    );
  }

  // ─── VIEW 2: THE DASHBOARD (Your Original Code) ─────────────────────────────

  const statusBanner =
    status === 'loading' ? (
      <div className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-800/60 px-4 py-3 text-sm text-gray-300">
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-500 border-t-white" />
        Sending command…
      </div>
    ) : status === 'success' ? (
      <div className="rounded-lg border border-emerald-700 bg-emerald-950/60 px-4 py-3 text-sm text-emerald-300">
        ✅ {message}
      </div>
    ) : status === 'error' ? (
      <div className="rounded-lg border border-red-700 bg-red-950/60 px-4 py-3 text-sm text-red-300">
        ❌ {message}
      </div>
    ) : null;

  const isAvoid = typeof activeColor === 'string' && activeColor.startsWith('avoid:');
  const avoidedColorName = isAvoid
    ? (activeColor as string).slice(6).charAt(0).toUpperCase() + (activeColor as string).slice(7)
    : '';

  const modeLabel =
    activeColor === undefined
      ? 'Not yet set this session'
      : activeColor === null
        ? 'Fair Play (True Random)'
        : isAvoid
          ? `House Edge: Excluded ${avoidedColorName}`
          : `Forced → ${activeColor.charAt(0).toUpperCase() + activeColor.slice(1)}`;

  return (
    <div className="min-h-screen bg-gray-950 px-4 py-14 text-white">
      <div className="mx-auto max-w-2xl">
        <div className="mb-2 flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
          </span>
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
            Access Granted
          </p>
        </div>

        <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          🎲 Dice Game — Admin Dashboard
        </h1>
        <p className="mt-2 text-sm text-gray-400">
          Select a colour to rig all three dice, or restore fair play.
        </p>

        <div className="my-8 h-px bg-gradient-to-r from-transparent via-gray-700 to-transparent" />

        <div className="mb-6 flex items-center justify-between rounded-xl border border-gray-800 bg-gray-900 px-5 py-4">
          <span className="text-sm font-medium text-gray-400">Current mode</span>
          <span
            className={`text-sm font-bold ${activeColor === null
              ? 'text-emerald-400'
              : activeColor === undefined
                ? 'text-gray-500'
                : isAvoid
                  ? 'text-amber-400'
                  : 'text-red-400'
              }`}
          >
            {modeLabel}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {COLORS.map((cfg) => {
            const isActive = activeColor === cfg.value;
            const isLoading = status === 'loading';

            return (
              <button
                key={cfg.label}
                id={`admin-btn-${cfg.value ?? 'fair'}`}
                onClick={() => handleSelect(cfg.value)}
                disabled={isLoading}
                aria-pressed={isActive}
                className={[
                  'relative flex flex-col items-center justify-center gap-1.5 rounded-xl px-4 py-5',
                  'font-semibold transition-all duration-150',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950',
                  cfg.classes,
                  isActive
                    ? `ring-2 ring-offset-2 ring-offset-gray-950 ${cfg.ring} scale-[1.03] shadow-lg shadow-black/40`
                    : 'ring-0 opacity-80 hover:opacity-100',
                  isLoading ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
                ].join(' ')}
              >
                {isActive && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-white text-gray-900 text-[10px] font-black shadow">
                    ✓
                  </span>
                )}
                <span className="text-base">{cfg.label}</span>
                {cfg.value !== null && (
                  <span className="text-[11px] font-normal opacity-70 capitalize">
                    {cfg.value}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── House Edge Control Panel ─────────────────────────────────── */}
        <div className="mt-6 rounded-xl border border-gray-800 bg-gray-900/50 p-6">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-500">
            House Edge Control
          </p>

          {/* True Random reset */}
          <button
            id="admin-btn-fair"
            onClick={() => handleSelect(null)}
            disabled={status === 'loading'}
            aria-pressed={activeColor === null}
            className={[
              'mb-5 w-full rounded-xl border px-4 py-3 text-sm font-bold transition-all duration-150',
              activeColor === null
                ? 'border-emerald-600 bg-emerald-900/40 text-emerald-300 ring-2 ring-emerald-500/50'
                : 'border-gray-700 bg-gray-800 text-gray-200 hover:border-emerald-700 hover:bg-emerald-900/20 hover:text-emerald-300',
              status === 'loading' ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
            ].join(' ')}
          >
            ⚖️ True Random (100% Fair)
          </button>

          {/* Exclusion pills */}
          <p className="mb-3 text-[11px] font-medium text-gray-600">
            Or secretly exclude a color (0% chance):
          </p>
          <div className="flex flex-wrap gap-2">
            {COLORS.map((cfg) => {
              const avoidKey = `avoid:${cfg.value}`;
              const isExcluded = activeColor === avoidKey;
              return (
                <button
                  key={avoidKey}
                  id={`admin-btn-avoid-${cfg.value}`}
                  onClick={() => handleSelect(avoidKey)}
                  disabled={status === 'loading'}
                  aria-pressed={isExcluded}
                  className={[
                    'rounded-full border px-4 py-1.5 text-xs font-semibold transition-colors duration-150',
                    isExcluded
                      ? 'border-red-500 bg-red-900/40 text-red-300'
                      : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white',
                    status === 'loading' ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
                  ].join(' ')}
                >
                  {isExcluded && <span className="mr-1">🚭</span>}
                  {cfg.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-6">{statusBanner}</div>

        <p className="mt-12 text-center text-xs text-gray-700">
          Changes take effect on the next roll · Not visible to players
        </p>
      </div>
    </div>
  );
}