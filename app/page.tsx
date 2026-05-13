'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';

// ─── Constants ────────────────────────────────────────────────────────────────

const DICE_COLORS = ['red', 'orange', 'yellow', 'green', 'blue', 'purple'] as const;
type DiceColor = (typeof DICE_COLORS)[number];

interface ColorConfig {
  label: string;
  hex: string;
  border: string;
  glow: string;
  textClass: string;
}

const COLOR_CONFIG: Record<DiceColor, ColorConfig> = {
  red: { label: 'Red', hex: '#EF4444', border: '#F87171', glow: 'rgba(239,68,68,0.6)', textClass: 'text-red-400' },
  orange: { label: 'Orange', hex: '#F97316', border: '#FB923C', glow: 'rgba(249,115,22,0.6)', textClass: 'text-orange-400' },
  yellow: { label: 'Yellow', hex: '#EAB308', border: '#FDE047', glow: 'rgba(234,179,8,0.6)', textClass: 'text-yellow-300' },
  green: { label: 'Green', hex: '#22C55E', border: '#4ADE80', glow: 'rgba(34,197,94,0.6)', textClass: 'text-green-400' },
  blue: { label: 'Blue', hex: '#3B82F6', border: '#60A5FA', glow: 'rgba(59,130,246,0.6)', textClass: 'text-blue-400' },
  purple: { label: 'Purple', hex: '#A855F7', border: '#C084FC', glow: 'rgba(168,85,247,0.6)', textClass: 'text-purple-400' },
};

// ── Random rolling phrases ───────────────────────────────────────────────────
const ROLL_PHRASES = [
  'Fingers Crossed..',
  'Here We Go!',
  'Come On Lucky!',
  'Rolling The Fates..',
  'Let It Ride!',
  'Big Win Loading..',
  'Don\'t Peek Yet..',
  'Show Me The Money!',
  'Destiny Decides..',
  'Spin To Win!',
  'Feel The Rush..',
  'Lucky Numbers..',
  'One More Time..',
  'Make It Count!',
  'The Dice Are Hot!',
];

const ROLL_DURATION_MS = 1600;
const SHUFFLE_INTERVAL_MS = 60;
const MAX_HISTORY = 30;

// ─── Types ────────────────────────────────────────────────────────────────────

interface RollHistoryEntry {
  id: number;
  dice: [DiceColor, DiceColor, DiceColor];
  winner: DiceColor;
  isTriple: boolean;
  time: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function randomColor(): DiceColor {
  return DICE_COLORS[Math.floor(Math.random() * DICE_COLORS.length)];
}

function resolveRoll(forced: string | null): [DiceColor, DiceColor, DiceColor] {
  if (forced && DICE_COLORS.includes(forced as DiceColor)) {
    const c = forced as DiceColor;
    return [c, c, c];
  }
  return [randomColor(), randomColor(), randomColor()];
}

function dominantColor(d: [DiceColor, DiceColor, DiceColor]): DiceColor {
  const freq: Partial<Record<DiceColor, number>> = {};
  for (const c of d) freq[c] = (freq[c] ?? 0) + 1;
  let best = d[0];
  for (const c of d) if ((freq[c] ?? 0) > (freq[best] ?? 0)) best = c;
  return best;
}

function nowHMS(): string {
  return new Date().toLocaleTimeString('en-US', { hour12: false });
}

function pickPhrase(): string {
  return ROLL_PHRASES[Math.floor(Math.random() * ROLL_PHRASES.length)];
}

// ─── Die ──────────────────────────────────────────────────────────────────────

interface DieProps { color: DiceColor | null; rolling: boolean; index: number }

function Die({ color, rolling, index }: DieProps) {
  const cfg = color ? COLOR_CONFIG[color] : null;

  const boxShadow = cfg
    ? `0 0 24px ${cfg.glow}, 0 0 60px ${cfg.glow.replace('0.6', '0.25')}, inset 0 1px 0 rgba(255,255,255,0.18)`
    : 'inset 0 1px 0 rgba(255,255,255,0.04)';

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        id={`die-${index + 1}`}
        aria-label={rolling ? 'Rolling…' : color ? `Die ${index + 1}: ${cfg!.label}` : `Die ${index + 1}`}
        className={[
          'relative flex h-28 w-28 items-center justify-center rounded-[1.5rem] sm:h-32 sm:w-32',
          'transition-all duration-150',
          rolling ? 'scale-90 opacity-60 animate-pulse' : 'scale-100 opacity-100',
        ].join(' ')}
        style={{
          backgroundColor: cfg ? cfg.hex : 'rgba(255,255,255,0.03)',
          border: `2px solid ${cfg ? cfg.border : 'rgba(255,255,255,0.07)'}`,
          boxShadow,
        }}
      >
        <span
          className="block h-5 w-5 rounded-full bg-white"
          style={{ boxShadow: cfg ? `0 0 10px white, 0 0 20px ${cfg.glow}` : 'none', opacity: cfg ? 1 : 0.15 }}
        />
      </div>
      <span className={[
        'text-[11px] font-bold uppercase tracking-[0.2em] transition-colors duration-300',
        cfg ? cfg.textClass : 'text-white/20',
      ].join(' ')}>
        {rolling ? '· · ·' : cfg ? cfg.label : '—'}
      </span>
    </div>
  );
}

// ─── History Panel (side) ─────────────────────────────────────────────────────

interface HistoryPanelProps { entries: RollHistoryEntry[] }

function HistoryPanel({ entries }: HistoryPanelProps) {
  return (
    <div className={[
      'relative flex w-full flex-col rounded-[2rem] lg:w-60 lg:self-stretch lg:min-h-0',
      'border border-white/10 bg-white/[0.02] backdrop-blur-2xl',
      'shadow-[0_32px_80px_rgba(0,0,0,0.6)] p-5',
    ].join(' ')}>
      {/* Inner top shine */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-t-[2rem]"
        style={{ background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.12),transparent)' }}
      />

      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40">
          Triple Winner Log
        </p>
        {entries.length > 0 && (
          <span className="rounded-full bg-white/5 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-white/25">
            {entries.length}
          </span>
        )}
      </div>

      {/* List */}
      {entries.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8">
          <span className="text-3xl opacity-20">🎲</span>
          <p className="text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-white/15">
            No triples yet — keep rolling!
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2 overflow-y-auto lg:max-h-[520px]
                       [&::-webkit-scrollbar]:w-[3px]
                       [&::-webkit-scrollbar-track]:bg-transparent
                       [&::-webkit-scrollbar-thumb]:rounded-full
                       [&::-webkit-scrollbar-thumb]:bg-white/10">
          {entries.map((entry, idx) => {
            const isLatest = idx === 0;
            const wcfg = COLOR_CONFIG[entry.winner];
            return (
              <li
                key={entry.id}
                className={[
                  'flex flex-col gap-2 rounded-xl px-3 py-3 transition-all duration-300',
                  isLatest
                    ? 'border border-white/10 bg-white/[0.05]'
                    : 'border border-transparent bg-white/[0.015]',
                ].join(' ')}
              >
                {/* 3 mini neon dice */}
                <div className="flex items-center justify-center gap-2">
                  {entry.dice.map((c, i) => {
                    const dc = COLOR_CONFIG[c];
                    return (
                      <span
                        key={i}
                        className="flex h-[2.1rem] w-[2.1rem] items-center justify-center rounded-lg"
                        style={{
                          backgroundColor: dc.hex,
                          border: `1.5px solid ${dc.border}`,
                          boxShadow: isLatest ? `0 0 10px ${dc.glow}` : 'none',
                        }}
                      >
                        <span className="block h-[7px] w-[7px] rounded-full bg-white" />
                      </span>
                    );
                  })}
                </div>

                {/* Labels + badges */}
                <div className="flex items-center justify-between">
                  {/* 3 colour names */}
                  <div className="flex items-center gap-1 flex-wrap">
                    {entry.dice.map((c, i) => (
                      <span
                        key={i}
                        className={['text-[8px] font-bold uppercase tracking-wide', COLOR_CONFIG[c].textClass].join(' ')}
                      >
                        {COLOR_CONFIG[c].label}{i < 2 ? ' ·' : ''}
                      </span>
                    ))}
                  </div>

                  {/* Badges */}
                  <div className="flex shrink-0 items-center gap-1">
                    {entry.isTriple && (
                      <span className="rounded-full bg-amber-500/20 px-1.5 py-px text-[7px] font-black uppercase tracking-widest text-amber-400">
                        Triple!
                      </span>
                    )}
                    {isLatest && (
                      <span className="rounded-full bg-purple-500/20 px-1.5 py-px text-[7px] font-black uppercase tracking-widest text-purple-400">
                        Latest
                      </span>
                    )}
                  </div>
                </div>

                {/* Time */}
                <p className="text-right text-[8px] text-white/20">{entry.time}</p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function GamePage() {
  const [secretForcedColor, setSecretForcedColor] = useState<string | null>(null);
  const [dice, setDice] = useState<[DiceColor, DiceColor, DiceColor] | null>(null);
  const [rolling, setRolling] = useState(false);
  const [rollCount, setRollCount] = useState(0);
  const [history, setHistory] = useState<RollHistoryEntry[]>([]);
  const [rollPhrase, setRollPhrase] = useState(ROLL_PHRASES[0]);
  const rollIdRef = useRef(0);

  // ── Hydration-safe init ──
  useEffect(() => {
    setDice([randomColor(), randomColor(), randomColor()]);
  }, []);

  // ── Supabase realtime ──
  useEffect(() => {
    supabase.from('game_settings').select('forced_color').eq('id', 1).single()
      .then(({ data, error }) => {
        if (!error && data) setSecretForcedColor(data.forced_color ?? null);
      });

    const channel = supabase.channel('game-settings-player')
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'game_settings', filter: 'id=eq.1' },
        (payload) => {
          setSecretForcedColor(
            (payload.new as { forced_color?: string | null }).forced_color ?? null,
          );
        })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // ── Roll handler ──
  const handleRoll = useCallback(() => {
    if (rolling) return;

    // Pick a new random phrase each roll
    setRollPhrase(pickPhrase());
    setRolling(true);

    const shuffleId = setInterval(() => {
      setDice([randomColor(), randomColor(), randomColor()]);
    }, SHUFFLE_INTERVAL_MS);

    setTimeout(() => {
      clearInterval(shuffleId);
      const result = resolveRoll(secretForcedColor);
      const isTriple = result[0] === result[1] && result[1] === result[2];
      const winner = dominantColor(result);

      setDice(result);
      setRolling(false);
      setRollCount(c => c + 1);

      // Only log triples (all 3 dice the same colour)
      if (isTriple) {
        setHistory(prev => [{
          id: ++rollIdRef.current, dice: result, winner, isTriple, time: nowHMS(),
        }, ...prev].slice(0, MAX_HISTORY));
      }
    }, ROLL_DURATION_MS);
  }, [rolling, secretForcedColor]);

  const isTriple = dice && dice[0] === dice[1] && dice[1] === dice[2];

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#07070a] px-4 py-14">

      {/* ── Keyframes ─────────────────────────────────────────────────────────── */}
      <style>{`
        @keyframes fcBounce {
          from { transform: translateY(0) scale(1); }
          to   { transform: translateY(-16px) scale(1.08); }
        }
        @keyframes fcPulse {
          from { opacity: 0.3; transform: scale(0.8); }
          to   { opacity: 1;   transform: scale(1.2); }
        }
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* ── Ambient orbs ──────────────────────────────────────────────────────── */}
      <div aria-hidden className="pointer-events-none absolute -left-56 -top-56 h-[600px] w-[600px] rounded-full bg-blue-700/20 blur-[150px]" />
      <div aria-hidden className="pointer-events-none absolute -bottom-56 -right-56 h-[600px] w-[600px] rounded-full bg-purple-800/20 blur-[150px]" />
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-600/[0.08] blur-[120px]" />

      {/* ── ROLLING OVERLAY ───────────────────────────────────────────────────── */}
      <div
        aria-live="assertive"
        aria-label={rolling ? 'Rolling dice…' : undefined}
        className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-8 transition-opacity duration-200"
        style={{
          background: 'rgba(7,7,10,0.88)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          opacity: rolling ? 1 : 0,
          pointerEvents: rolling ? 'all' : 'none',
        }}
      >
        <p className="text-[10px] font-extrabold uppercase tracking-[0.4em] text-white/30">Rolling</p>

        {/* Random phrase — fades in each roll */}
        <h2
          key={rollPhrase}
          className="bg-clip-text text-[clamp(2rem,6vw,3.5rem)] font-black uppercase tracking-[0.07em] text-transparent"
          style={{
            backgroundImage: 'linear-gradient(135deg,#e2e8f0 0%,#a78bfa 45%,#ec4899 80%,#f59e0b 100%)',
            animation: 'fadeSlideIn 0.3s ease both',
          }}
        >
          {rollPhrase}
        </h2>

        {/* Bouncing dice */}
        <div className="flex gap-5">
          {[0, 1, 2].map(i => (
            <div key={i}
              className="flex h-20 w-20 items-center justify-center rounded-[1.1rem] border border-white/15"
              style={{
                background: 'rgba(255,255,255,0.05)',
                boxShadow: '0 0 30px rgba(139,92,246,0.2)',
                animation: `fcBounce 0.6s ease-in-out ${i * 0.13}s infinite alternate`,
              }}
            >
              <span className="block h-4 w-4 rounded-full bg-white/40" />
            </div>
          ))}
        </div>

        {/* Pulsing dots */}
        <div className="flex gap-2">
          {[0, 1, 2].map(i => (
            <span key={i} className="block h-[7px] w-[7px] rounded-full bg-purple-400/70"
              style={{ animation: `fcPulse 0.75s ease-in-out ${i * 0.2}s infinite alternate` }} />
          ))}
        </div>
      </div>

      {/* ── Possible colours banner ────────────────────────────────────────────── */}
      <div className="relative z-10 mb-8 w-full max-w-3xl">
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-2xl border border-white/[0.08] bg-white/[0.025] px-5 py-3 backdrop-blur-md">
          <span className="text-[11px] font-semibold tracking-widest text-white/35 uppercase">Possible colors:</span>
          {DICE_COLORS.map((c, i) => {
            const cfg = COLOR_CONFIG[c];
            return (
              <span key={c} className="flex items-center gap-1">
                <span className={`text-[11px] font-extrabold tracking-wide ${cfg.textClass}`}
                  style={{ textShadow: `0 0 12px ${cfg.glow}` }}>
                  {cfg.label}
                </span>
                {i < DICE_COLORS.length - 1 && <span className="text-white/20 text-[11px]">,</span>}
              </span>
            );
          })}
        </div>
      </div>

      {/* ── Header ────────────────────────────────────────────────────────────── */}
      <div className="relative z-10 mb-10 text-center">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.4em] text-purple-400/60">
          Provably Fair · Live Game
        </p>
        <h1
          className="bg-clip-text text-5xl font-black uppercase tracking-[0.3em] text-transparent sm:text-6xl"
          style={{ backgroundImage: 'linear-gradient(135deg,#f1f5f9 0%,#94a3b8 50%,#cbd5e1 100%)' }}
        >
          Color Dice
        </h1>
        <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.25em] text-slate-600">
          Roll · Win · Repeat
        </p>
      </div>

      {/* ── Two-column layout: [Game Card] + [History Panel] ─────────────────── */}
      <div className="relative z-10 flex w-full max-w-3xl flex-col items-start gap-5 lg:flex-row lg:items-stretch">

        {/* ── Game Card ─────────────────────────────────────────────────────── */}
        <div className="relative flex-1 w-full">
          {/* Top shine */}
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-t-[2rem]"
            style={{ background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.12),transparent)' }} />

          <div className="rounded-[2rem] border border-white/10 bg-white/[0.02] p-8 shadow-[0_32px_80px_rgba(0,0,0,0.7)] backdrop-blur-2xl sm:p-10">

            {/* Dice */}
            <div id="dice-area"
              aria-live="polite" aria-atomic="true"
              className="flex items-center justify-center gap-6 sm:gap-8">
              {[0, 1, 2].map(i => (
                <Die key={i} index={i} color={dice ? dice[i] : null} rolling={rolling} />
              ))}
            </div>

            {/* Result caption */}
            <div className="mt-7 flex min-h-[30px] items-center justify-center">
              {rolling ? (
                <p className="animate-pulse text-[11px] font-bold uppercase tracking-[0.3em] text-purple-400/70">
                  Determining outcome…
                </p>
              ) : isTriple && dice ? (
                <div className="flex items-center gap-2">
                  <span className="text-xl">🎉</span>
                  <span className="bg-clip-text text-sm font-black uppercase tracking-widest text-transparent"
                    style={{ backgroundImage: 'linear-gradient(90deg,#f59e0b,#ec4899,#a855f7)' }}>
                    Triple {COLOR_CONFIG[dice[0]].label}!
                  </span>
                  <span className="text-xl">🎉</span>
                </div>
              ) : dice && rollCount > 0 ? (
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/25">
                  {dice.map(c => COLOR_CONFIG[c].label).join('  ·  ')}
                </p>
              ) : (
                <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/15">
                  Press below to roll
                </p>
              )}
            </div>

            {/* Divider */}
            <div className="my-7 h-px w-full"
              style={{ background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.07),transparent)' }} />

            {/* Roll button */}
            <button
              id="roll-button"
              onClick={handleRoll}
              disabled={rolling}
              aria-busy={rolling}
              className={[
                'w-full rounded-2xl py-5',
                'bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600',
                'text-sm font-extrabold uppercase tracking-[0.35em] text-white',
                'transition-all duration-200',
                rolling
                  ? 'cursor-not-allowed scale-[0.98] opacity-50'
                  : [
                    'hover:scale-[1.02] active:scale-[0.98]',
                    'hover:shadow-[0_0_40px_rgba(79,70,229,0.45),0_0_80px_rgba(168,85,247,0.2)]',
                    'hover:brightness-110',
                  ].join(' '),
              ].join(' ')}
              style={rolling ? {} : { boxShadow: '0 4px 24px rgba(99,102,241,0.35), inset 0 1px 0 rgba(255,255,255,0.12)' }}
            >
              {rolling ? 'Rolling…' : rollCount === 0 ? '🎲  Roll Dice' : '🎲  Roll Again'}
            </button>

            {rollCount > 0 && (
              <p className="mt-4 text-center text-[10px] font-semibold uppercase tracking-[0.3em] text-white/20">
                {rollCount} {rollCount === 1 ? 'Roll' : 'Rolls'}
              </p>
            )}
          </div>
        </div>

        {/* ── History Panel (side) ───────────────────────────────────────────── */}
        <HistoryPanel entries={history} />

      </div>

      {/* ── Footer ────────────────────────────────────────────────────────────── */}
      <p className="relative z-10 mt-10 text-center text-[10px] font-medium uppercase tracking-[0.25em] text-white/10">
        © 2026 dice-ph.vercel.app
      </p>
    </div>
  );
}
