'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

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
  const [activeCategory, setActiveCategory] = useState<'dice' | 'wheel' | 'clash' | 'highdice'>('dice');

  // Dice State
  const [activeColor, setActiveColor] = useState<string | null | undefined>(undefined);
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');

  // Clash State
  const [clashOverrideLeft, setClashOverrideLeft] = useState('Random');
  const [clashOverrideRight, setClashOverrideRight] = useState('Random');
  const [clashStatus, setClashStatus] = useState<Status>('idle');

  // High Dice State
  const [highDiceOverrideLeft, setHighDiceOverrideLeft] = useState('Random');
  const [highDiceOverrideRight, setHighDiceOverrideRight] = useState('Random');
  const [highDiceStatus, setHighDiceStatus] = useState<Status>('idle');

  // Raffle / Prize Wheel State
  const [raffleParticipants, setRaffleParticipants] = useState<string[]>([]);
  const [raffleQueue, setRaffleQueue] = useState<string[]>([]);
  const [raffleSearch, setRaffleSearch] = useState('');
  const [raffleStatus, setRaffleStatus] = useState<Status>('idle');

  useEffect(() => {
    supabase.from('game_settings').select('high_dice_left, high_dice_right, raffle_participants, raffle_override').eq('id', 1).single()
      .then(({ data, error }) => {
        if (!error && data) {
          setHighDiceOverrideLeft(data.high_dice_left ?? 'Random');
          setHighDiceOverrideRight(data.high_dice_right ?? 'Random');
          if (data.raffle_participants && Array.isArray(data.raffle_participants)) {
            setRaffleParticipants(data.raffle_participants);
          }
          try {
            const parsed = JSON.parse(data.raffle_override ?? '[]');
            setRaffleQueue(Array.isArray(parsed) ? parsed : (data.raffle_override && data.raffle_override !== 'Random' ? [data.raffle_override] : []));
          } catch {
            setRaffleQueue(data.raffle_override && data.raffle_override !== 'Random' ? [data.raffle_override] : []);
          }
        }
      });
      
    // Listen for real-time participant sync from the PC
    const channel = supabase.channel('game-settings-admin-raffle')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'game_settings', filter: 'id=eq.1' },
        (payload) => {
          if (payload.new.raffle_participants) {
            setRaffleParticipants(payload.new.raffle_participants);
          }
          if (payload.new.raffle_override !== undefined) {
            try {
              const parsed = JSON.parse(payload.new.raffle_override ?? '[]');
              setRaffleQueue(Array.isArray(parsed) ? parsed : (payload.new.raffle_override && payload.new.raffle_override !== 'Random' ? [payload.new.raffle_override] : []));
            } catch {
              setRaffleQueue(payload.new.raffle_override && payload.new.raffle_override !== 'Random' ? [payload.new.raffle_override] : []);
            }
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

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

  // ── Select Handler (Dice) ──
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

  // ── Select Handler (Clash) ──
  const handleClashSelect = async (side: 'left' | 'right', color: string) => {
    setClashStatus('loading');
    
    const newLeft = side === 'left' ? color : clashOverrideLeft;
    const newRight = side === 'right' ? color : clashOverrideRight;
    
    if (side === 'left') setClashOverrideLeft(color);
    if (side === 'right') setClashOverrideRight(color);

    try {
      const res = await fetch('/api/admin/set-clash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ left: newLeft, right: newRight }),
      });
      if (!res.ok) throw new Error('Failed to update Clash settings');
      setClashStatus('success');
      setTimeout(() => setClashStatus('idle'), 2000);
    } catch (err) {
      setClashStatus('error');
    }
  };

  const handleClashForceWinner = async (color: string) => {
    setClashStatus('loading');
    setClashOverrideLeft(color);
    setClashOverrideRight(color);

    try {
      const res = await fetch('/api/admin/set-clash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ left: color, right: color }),
      });
      if (!res.ok) throw new Error('Failed to force winner');
      setClashStatus('success');
      setTimeout(() => setClashStatus('idle'), 2000);
    } catch (err) {
      setClashStatus('error');
    }
  };

  // ── Select Handler (High Dice) ──
  const handleHighDiceSelect = async (side: 'left' | 'right', value: string) => {
    setHighDiceStatus('loading');
    
    const newLeft = side === 'left' ? value : highDiceOverrideLeft;
    const newRight = side === 'right' ? value : highDiceOverrideRight;
    
    if (side === 'left') setHighDiceOverrideLeft(value);
    if (side === 'right') setHighDiceOverrideRight(value);

    try {
      const res = await fetch('/api/admin/set-highdice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ left: newLeft, right: newRight }),
      });
      if (!res.ok) throw new Error('Failed to update High Dice settings');
      setHighDiceStatus('success');
      setTimeout(() => setHighDiceStatus('idle'), 2000);
    } catch (err) {
      setHighDiceStatus('error');
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

  // ─── VIEW 2: THE DASHBOARD ─────────────────────────────

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

  const clashOptions = ['Random', 'Red', 'Orange', 'Yellow', 'Green', 'Blue', 'Purple'];
  const getClashColorClass = (color: string) => {
    switch (color) {
      case 'Red': return 'bg-red-500 border-red-400';
      case 'Orange': return 'bg-orange-500 border-orange-400';
      case 'Yellow': return 'bg-yellow-500 border-yellow-400';
      case 'Green': return 'bg-green-500 border-green-400';
      case 'Blue': return 'bg-blue-500 border-blue-400';
      case 'Purple': return 'bg-purple-500 border-purple-400';
      default: return 'bg-gray-800 border-gray-600';
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col md:flex-row">
      
      {/* ── Sidebar Navigation ── */}
      <div className="w-full md:w-64 bg-gray-900 border-r border-gray-800 p-6 flex flex-col gap-4 shrink-0">
        <div className="mb-8 flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
          </span>
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
            System Online
          </p>
        </div>

        <nav className="flex flex-col gap-2">
          <button
            onClick={() => setActiveCategory('dice')}
            className={`px-4 py-3 rounded-xl font-bold text-left transition-all ${activeCategory === 'dice' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
          >
            🎲 Color Dice
          </button>
          <button
            onClick={() => setActiveCategory('clash')}
            className={`px-4 py-3 rounded-xl font-bold text-left transition-all ${activeCategory === 'clash' ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
          >
            💥 Color Clash
          </button>
          <button
            onClick={() => setActiveCategory('highdice')}
            className={`px-4 py-3 rounded-xl font-bold text-left transition-all ${activeCategory === 'highdice' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
          >
            ⚔️ High Dice
          </button>
          <button
            onClick={() => setActiveCategory('wheel')}
            className={`px-4 py-3 rounded-xl font-bold text-left transition-all ${activeCategory === 'wheel' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
          >
            🎡 Prize Wheel
          </button>
        </nav>
      </div>

      {/* ── Main Content Area ── */}
      <div className="flex-1 p-6 md:p-14 overflow-y-auto">
        <div className="mx-auto max-w-3xl">
          
          {/* ─────────────────────────────────────────────────────────────────
              DICE DASHBOARD
              ───────────────────────────────────────────────────────────────── */}
          {activeCategory === 'dice' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                🎲 Dice Game
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

              {/* ── House Edge Control Panel ── */}
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
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────────
              COLOR CLASH DASHBOARD
              ───────────────────────────────────────────────────────────────── */}
          {activeCategory === 'clash' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl drop-shadow-md">
                💥 Color Clash — Streamer Override
              </h1>
              <p className="mt-2 text-sm text-gray-400">
                Secretly rig the next roll, or leave it on Random for fair play.
              </p>

              <div className="my-8 h-px bg-gradient-to-r from-transparent via-gray-700 to-transparent" />

              {/* Status Bar */}
              <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between rounded-xl border border-purple-500/30 bg-purple-950/20 px-5 py-4 backdrop-blur-md shadow-[0_0_30px_rgba(168,85,247,0.1)]">
                <span className="text-sm font-medium text-purple-200/70 mb-2 sm:mb-0">Current Setup</span>
                <span className="text-sm font-black tracking-widest text-purple-300 drop-shadow-[0_0_10px_rgba(216,180,254,0.5)]">
                  LEFT is <span className="text-white">{clashOverrideLeft.toUpperCase()}</span> | RIGHT is <span className="text-white">{clashOverrideRight.toUpperCase()}</span>
                </span>
              </div>

              {/* Force Winner Section */}
              <div className="mb-8 flex flex-col gap-4 rounded-2xl border border-purple-500/50 bg-purple-900/20 p-6 backdrop-blur-xl shadow-[0_0_40px_rgba(168,85,247,0.15)]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between">
                  <h2 className="text-xl font-black tracking-widest text-purple-300 uppercase drop-shadow-[0_0_10px_rgba(216,180,254,0.5)]">
                    Force Winner (Double)
                  </h2>
                  <p className="text-xs font-semibold text-purple-300/50 mt-2 sm:mt-0 uppercase">Sets both dice instantly</p>
                </div>
                <div className="flex flex-wrap gap-3 mt-2">
                  {clashOptions.map((opt) => {
                    const isActive = clashOverrideLeft === opt && clashOverrideRight === opt;
                    return (
                      <button
                        key={`winner-${opt}`}
                        onClick={() => handleClashForceWinner(opt)}
                        className={`flex-1 min-w-[80px] rounded-xl border-2 px-4 py-4 text-sm font-black uppercase tracking-wider transition-all duration-300 ${getClashColorClass(opt)} ${isActive ? 'border-white text-white shadow-[0_0_25px_rgba(255,255,255,0.6)] scale-[1.03] opacity-100 ring-2 ring-white/50 ring-offset-2 ring-offset-purple-950' : 'border-transparent text-white/80 opacity-60 hover:opacity-100 hover:scale-[1.02]'}`}
                      >
                        {opt === 'Random' ? 'Fair Play' : opt}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Left Die Override Controls */}
                <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
                  <h2 className="text-lg font-bold tracking-widest text-white/50 uppercase">Force Left Die</h2>
                  <div className="flex flex-wrap gap-3">
                    {clashOptions.map((opt) => {
                      const isActive = clashOverrideLeft === opt;
                      return (
                        <button
                          key={`left-${opt}`}
                          onClick={() => handleClashSelect('left', opt)}
                          className={`flex-1 min-w-[60px] rounded-xl border-2 px-3 py-2 text-xs font-black uppercase tracking-wider transition-all duration-300 ${getClashColorClass(opt)} ${isActive ? 'border-white text-white shadow-[0_0_20px_rgba(255,255,255,0.5)] scale-105 opacity-100' : 'border-transparent text-white/70 opacity-50 hover:opacity-80 hover:scale-100'}`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Right Die Override Controls */}
                <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
                  <h2 className="text-lg font-bold tracking-widest text-white/50 uppercase">Force Right Die</h2>
                  <div className="flex flex-wrap gap-3">
                    {clashOptions.map((opt) => {
                      const isActive = clashOverrideRight === opt;
                      return (
                        <button
                          key={`right-${opt}`}
                          onClick={() => handleClashSelect('right', opt)}
                          className={`flex-1 min-w-[60px] rounded-xl border-2 px-3 py-2 text-xs font-black uppercase tracking-wider transition-all duration-300 ${getClashColorClass(opt)} ${isActive ? 'border-white text-white shadow-[0_0_20px_rgba(255,255,255,0.5)] scale-105 opacity-100' : 'border-transparent text-white/70 opacity-50 hover:opacity-80 hover:scale-100'}`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* House Edge: Avoid Color Section */}
              <div className="mt-8 flex flex-col gap-4 rounded-2xl border border-amber-500/30 bg-amber-950/20 p-6 backdrop-blur-xl shadow-[0_0_40px_rgba(245,158,11,0.1)]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between">
                  <h2 className="text-lg font-bold tracking-widest text-amber-300 uppercase drop-shadow-[0_0_10px_rgba(252,211,77,0.3)]">
                    House Edge (Avoid Color)
                  </h2>
                  <p className="text-xs font-semibold text-amber-300/50 mt-2 sm:mt-0 uppercase">0% chance for both dice</p>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {['Red', 'Orange', 'Yellow', 'Green', 'Blue', 'Purple'].map((opt) => {
                    const avoidKey = `avoid:${opt}`;
                    const isActive = clashOverrideLeft === avoidKey && clashOverrideRight === avoidKey;
                    return (
                      <button
                        key={`clash-avoid-${opt}`}
                        onClick={async () => {
                          setClashStatus('loading');
                          setClashOverrideLeft(avoidKey);
                          setClashOverrideRight(avoidKey);
                          try {
                            const res = await fetch('/api/admin/set-clash', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ left: avoidKey, right: avoidKey }),
                            });
                            if (!res.ok) throw new Error('Failed to set house edge');
                            setClashStatus('success');
                            setTimeout(() => setClashStatus('idle'), 2000);
                          } catch (err) {
                            setClashStatus('error');
                          }
                        }}
                        className={`flex-1 min-w-[70px] rounded-full border-2 px-3 py-2 text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all duration-300 ${isActive ? 'bg-amber-600/50 border-amber-400 text-amber-200 shadow-[0_0_15px_rgba(245,158,11,0.5)] opacity-100 scale-105' : 'bg-transparent border-white/10 text-white/50 opacity-60 hover:opacity-100 hover:bg-white/5'}`}
                      >
                        {isActive && <span className="mr-1">🚭</span>}
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </div>
              
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────────
              HIGH DICE DASHBOARD
              ───────────────────────────────────────────────────────────────── */}
          {activeCategory === 'highdice' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl drop-shadow-md">
                ⚔️ High Dice Battle — Streamer Override
              </h1>
              <p className="mt-2 text-sm text-gray-400">
                Secretly rig the next roll numbers, or leave it on Random for fair play.
              </p>

              <div className="my-8 h-px bg-gradient-to-r from-transparent via-gray-700 to-transparent" />

              {/* Status Bar */}
              <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between rounded-xl border border-blue-500/30 bg-blue-950/20 px-5 py-4 backdrop-blur-md shadow-[0_0_30px_rgba(59,130,246,0.1)]">
                <span className="text-sm font-medium text-blue-200/70 mb-2 sm:mb-0">Current Setup</span>
                <span className="text-sm font-black tracking-widest text-blue-300 drop-shadow-[0_0_10px_rgba(147,197,253,0.5)]">
                  LEFT is <span className="text-white">{highDiceOverrideLeft.toUpperCase()}</span> | RIGHT is <span className="text-white">{highDiceOverrideRight.toUpperCase()}</span>
                </span>
              </div>

              {/* Force Winner Section */}
              <div className="mb-8 flex flex-col gap-4 rounded-2xl border border-blue-500/50 bg-blue-900/20 p-6 backdrop-blur-xl shadow-[0_0_40px_rgba(59,130,246,0.15)]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between">
                  <h2 className="text-xl font-black tracking-widest text-blue-300 uppercase drop-shadow-[0_0_10px_rgba(147,197,253,0.5)]">
                    Force Winner (Double)
                  </h2>
                  <p className="text-xs font-semibold text-blue-300/50 mt-2 sm:mt-0 uppercase">Sets both dice instantly</p>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {['Random', '1', '2', '3', '4', '5', '6'].map((opt) => {
                    const isActive = highDiceOverrideLeft === opt && highDiceOverrideRight === opt;
                    return (
                      <button
                        key={`hd-winner-${opt}`}
                        onClick={async () => {
                          setHighDiceStatus('loading');
                          setHighDiceOverrideLeft(opt);
                          setHighDiceOverrideRight(opt);
                          try {
                            const res = await fetch('/api/admin/set-highdice', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ left: opt, right: opt }),
                            });
                            if (!res.ok) throw new Error('Failed to force winner');
                            setHighDiceStatus('success');
                            setTimeout(() => setHighDiceStatus('idle'), 2000);
                          } catch (err) {
                            setHighDiceStatus('error');
                          }
                        }}
                        className={`flex-1 min-w-[60px] rounded-xl border-2 px-4 py-4 text-sm font-black uppercase tracking-wider transition-all duration-300 ${opt === 'Random' ? 'bg-gray-800' : 'bg-blue-600'} ${isActive ? 'border-white text-white shadow-[0_0_25px_rgba(255,255,255,0.6)] scale-[1.03] opacity-100 ring-2 ring-white/50 ring-offset-2 ring-offset-blue-950' : 'border-transparent text-white/80 opacity-60 hover:opacity-100 hover:scale-[1.02]'}`}
                      >
                        {opt === 'Random' ? 'Fair Play' : opt}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Left Die Override Controls */}
                <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
                  <h2 className="text-lg font-bold tracking-widest text-white/50 uppercase">Force Left Die</h2>
                  <div className="flex flex-wrap gap-2">
                    {['Random', '1', '2', '3', '4', '5', '6'].map((opt) => {
                      const isActive = highDiceOverrideLeft === opt;
                      return (
                        <button
                          key={`hd-left-${opt}`}
                          onClick={() => handleHighDiceSelect('left', opt)}
                          className={`flex-1 min-w-[60px] rounded-xl border-2 px-3 py-3 text-sm font-black uppercase tracking-wider transition-all duration-300 ${opt === 'Random' ? 'bg-gray-800' : 'bg-blue-600/50'} ${isActive ? 'border-white text-white shadow-[0_0_20px_rgba(255,255,255,0.5)] scale-105 opacity-100' : 'border-transparent text-white/70 opacity-50 hover:opacity-80 hover:scale-100'}`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Right Die Override Controls */}
                <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
                  <h2 className="text-lg font-bold tracking-widest text-white/50 uppercase">Force Right Die</h2>
                  <div className="flex flex-wrap gap-2">
                    {['Random', '1', '2', '3', '4', '5', '6'].map((opt) => {
                      const isActive = highDiceOverrideRight === opt;
                      return (
                        <button
                          key={`hd-right-${opt}`}
                          onClick={() => handleHighDiceSelect('right', opt)}
                          className={`flex-1 min-w-[60px] rounded-xl border-2 px-3 py-3 text-sm font-black uppercase tracking-wider transition-all duration-300 ${opt === 'Random' ? 'bg-gray-800' : 'bg-red-600/50'} ${isActive ? 'border-white text-white shadow-[0_0_20px_rgba(255,255,255,0.5)] scale-105 opacity-100' : 'border-transparent text-white/70 opacity-50 hover:opacity-80 hover:scale-100'}`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* House Edge: Avoid Number Section */}
              <div className="mt-8 flex flex-col gap-4 rounded-2xl border border-amber-500/30 bg-amber-950/20 p-6 backdrop-blur-xl shadow-[0_0_40px_rgba(245,158,11,0.1)]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between">
                  <h2 className="text-lg font-bold tracking-widest text-amber-300 uppercase drop-shadow-[0_0_10px_rgba(252,211,77,0.3)]">
                    House Edge (Avoid Number)
                  </h2>
                  <p className="text-xs font-semibold text-amber-300/50 mt-2 sm:mt-0 uppercase">0% chance for both dice</p>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {['1', '2', '3', '4', '5', '6'].map((opt) => {
                    const avoidKey = `avoid:${opt}`;
                    const isActive = highDiceOverrideLeft === avoidKey && highDiceOverrideRight === avoidKey;
                    return (
                      <button
                        key={`hd-avoid-${opt}`}
                        onClick={async () => {
                          setHighDiceStatus('loading');
                          setHighDiceOverrideLeft(avoidKey);
                          setHighDiceOverrideRight(avoidKey);
                          try {
                            const res = await fetch('/api/admin/set-highdice', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ left: avoidKey, right: avoidKey }),
                            });
                            if (!res.ok) throw new Error('Failed to set house edge');
                            setHighDiceStatus('success');
                            setTimeout(() => setHighDiceStatus('idle'), 2000);
                          } catch (err) {
                            setHighDiceStatus('error');
                          }
                        }}
                        className={`flex-1 min-w-[50px] rounded-full border-2 px-3 py-2 text-sm font-black uppercase tracking-wider transition-all duration-300 ${isActive ? 'bg-amber-600/50 border-amber-400 text-amber-200 shadow-[0_0_15px_rgba(245,158,11,0.5)] opacity-100 scale-105' : 'bg-transparent border-white/10 text-white/50 opacity-60 hover:opacity-100 hover:bg-white/5'}`}
                      >
                        {isActive && <span className="mr-1">🚭</span>}
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </div>
              
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────────
              PRIZE WHEEL DASHBOARD (Raffle Engine)
              ───────────────────────────────────────────────────────────────── */}
          {activeCategory === 'wheel' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              
              <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between rounded-xl border border-purple-500/30 bg-purple-950/20 px-5 py-4 backdrop-blur-md shadow-[0_0_30px_rgba(168,85,247,0.1)]">
                <span className="text-sm font-medium text-purple-200/70 mb-2 sm:mb-0">Current Rigged Winner(s) Queue</span>
                <span className="text-sm font-black tracking-widest text-purple-300 drop-shadow-[0_0_10px_rgba(216,180,254,0.5)]">
                  {raffleQueue.length > 0 ? raffleQueue.map(q => q.toUpperCase()).join(' ➔ ') : 'RANDOM'}
                </span>
              </div>

              <div className="mb-8 flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2">
                  <h2 className="text-xl font-black tracking-widest text-white uppercase">
                    Force Winners
                  </h2>
                  <div className="relative w-full sm:w-64 mt-4 sm:mt-0">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                      <svg className="w-4 h-4 text-gray-400" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 20">
                        <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m19 19-4-4m0-7A7 7 0 1 1 1 8a7 7 0 0 1 14 0Z"/>
                      </svg>
                    </div>
                    <input 
                      type="text" 
                      value={raffleSearch}
                      onChange={(e) => setRaffleSearch(e.target.value)}
                      className="block w-full p-2 pl-10 text-sm border rounded-lg bg-gray-900 border-gray-700 placeholder-gray-400 text-white focus:ring-purple-500 focus:border-purple-500" 
                      placeholder="Search participants..." 
                    />
                  </div>
                </div>
                
                {raffleParticipants.length === 0 ? (
                  <div className="text-center py-8 text-white/50">
                    <span className="text-4xl mb-4 block">👻</span>
                    <p>No participants found.</p>
                    <p className="text-sm mt-2">Add names in the Raffle Engine on your PC to sync them here.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {/* Always include Random option at the top */}
                    <button
                      onClick={async () => {
                        setRaffleStatus('loading');
                        setRaffleQueue([]);
                        try {
                          await fetch('/api/admin/set-raffle', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ winnerName: JSON.stringify([]) }),
                          });
                          setRaffleStatus('success');
                        } catch (err) {
                          setRaffleStatus('error');
                        }
                      }}
                      className={`rounded-xl border-2 px-3 py-3 text-sm font-black uppercase tracking-wider transition-all duration-300 ${raffleQueue.length === 0 ? 'border-purple-400 bg-purple-600/50 text-white shadow-[0_0_15px_rgba(168,85,247,0.5)] scale-105' : 'border-white/10 bg-gray-800 text-white/70 hover:bg-gray-700 hover:text-white'}`}
                    >
                      🎲 CLEAR QUEUE
                    </button>

                    {Array.from(new Set(raffleParticipants))
                      .filter(name => name.toLowerCase().includes(raffleSearch.toLowerCase()))
                      .map((name, i) => {
                        const queueIndex = raffleQueue.indexOf(name);
                        const isActive = queueIndex !== -1;
                        return (
                          <button
                            key={`raf-${i}`}
                            onClick={async () => {
                              setRaffleStatus('loading');
                              let newQueue = [...raffleQueue];
                              if (isActive) {
                                newQueue = newQueue.filter(q => q !== name);
                              } else {
                                newQueue.push(name);
                              }
                              setRaffleQueue(newQueue);
                              try {
                                await fetch('/api/admin/set-raffle', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ winnerName: JSON.stringify(newQueue) }),
                                });
                                setRaffleStatus('success');
                              } catch (err) {
                                setRaffleStatus('error');
                              }
                            }}
                            className={`relative rounded-xl border-2 px-3 py-3 text-sm font-bold truncate transition-all duration-300 ${isActive ? 'border-purple-400 bg-purple-600/50 text-white shadow-[0_0_15px_rgba(168,85,247,0.5)] scale-105' : 'border-white/5 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'}`}
                            title={name}
                          >
                            {name}
                            {isActive && (
                              <span className="absolute -top-2 -right-2 w-6 h-6 bg-purple-500 text-white text-xs font-black flex items-center justify-center rounded-full shadow-lg">
                                {queueIndex + 1}
                              </span>
                            )}
                          </button>
                        );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          <p className="mt-12 text-center text-xs text-gray-700">
            Changes take effect on the next roll · Not visible to players
          </p>
        </div>
      </div>
    </div>
  );
}