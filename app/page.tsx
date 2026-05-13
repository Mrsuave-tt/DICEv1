'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';

// ─── Constants ────────────────────────────────────────────────────────────────

const DICE_COLORS = ['red', 'orange', 'yellow', 'green', 'blue', 'purple'] as const;
type DiceColor = (typeof DICE_COLORS)[number];

interface ColorConfig {
  hex: string;
  border: string;
  glow: string;
  dotGlow: string;
  label: string;
  textClass: string;
  bgClass: string;    // for the tiny history swatch
}

const COLOR_CONFIG: Record<DiceColor, ColorConfig> = {
  red: { hex: '#EF4444', border: '#F87171', glow: 'rgba(239,68,68,0.75)', dotGlow: 'rgba(255,255,255,0.9)', label: 'Red', textClass: 'text-red-400', bgClass: 'bg-red-500' },
  orange: { hex: '#F97316', border: '#FB923C', glow: 'rgba(249,115,22,0.75)', dotGlow: 'rgba(255,255,255,0.9)', label: 'Orange', textClass: 'text-orange-400', bgClass: 'bg-orange-500' },
  yellow: { hex: '#EAB308', border: '#FDE047', glow: 'rgba(234,179,8,0.75)', dotGlow: 'rgba(255,255,255,0.9)', label: 'Yellow', textClass: 'text-yellow-300', bgClass: 'bg-yellow-400' },
  green: { hex: '#22C55E', border: '#4ADE80', glow: 'rgba(34,197,94,0.75)', dotGlow: 'rgba(255,255,255,0.9)', label: 'Green', textClass: 'text-green-400', bgClass: 'bg-green-500' },
  blue: { hex: '#3B82F6', border: '#60A5FA', glow: 'rgba(59,130,246,0.75)', dotGlow: 'rgba(255,255,255,0.9)', label: 'Blue', textClass: 'text-blue-400', bgClass: 'bg-blue-500' },
  purple: { hex: '#A855F7', border: '#C084FC', glow: 'rgba(168,85,247,0.75)', dotGlow: 'rgba(255,255,255,0.9)', label: 'Purple', textClass: 'text-purple-400', bgClass: 'bg-purple-500' },
};

const ROLL_DURATION_MS = 500;
const SHUFFLE_INTERVAL_MS = 50;
const MAX_HISTORY = 12;

// ─── Types ────────────────────────────────────────────────────────────────────

interface RollHistoryEntry {
  id: number;
  dice: [DiceColor, DiceColor, DiceColor];
  winner: DiceColor;   // dominant / majority colour
  isTriple: boolean;
  time: string;        // formatted HH:MM:SS
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

/** Returns the colour that appears most often; ties broken by first occurrence. */
function dominantColor(dice: [DiceColor, DiceColor, DiceColor]): DiceColor {
  const freq: Partial<Record<DiceColor, number>> = {};
  for (const c of dice) freq[c] = (freq[c] ?? 0) + 1;
  let best = dice[0];
  for (const c of dice) {
    if ((freq[c] ?? 0) > (freq[best] ?? 0)) best = c;
  }
  return best;
}

function nowHMS(): string {
  return new Date().toLocaleTimeString('en-US', { hour12: false });
}

// ─── Die component ────────────────────────────────────────────────────────────

interface DieProps { color: DiceColor | null; rolling: boolean; index: number; }

function Die({ color, rolling, index }: DieProps) {
  const cfg = color ? COLOR_CONFIG[color] : null;

  const dieStyle: React.CSSProperties = cfg
    ? {
      backgroundColor: cfg.hex,
      border: `1.5px solid ${cfg.border}`,
      boxShadow: `0 0 30px ${cfg.glow}, 0 0 60px ${cfg.glow.replace('0.75', '0.35')}, inset 0 1px 0 rgba(255,255,255,0.15)`,
      transition: rolling ? 'background-color 0.05s ease, box-shadow 0.05s ease' : 'background-color 0.4s ease, box-shadow 0.4s ease',
    }
    : { backgroundColor: '#1e1e2e', border: '1.5px solid rgba(255,255,255,0.08)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)' };

  const dotStyle: React.CSSProperties = cfg
    ? { boxShadow: `0 0 10px white, 0 0 20px ${cfg.dotGlow}` }
    : { boxShadow: 'none', backgroundColor: 'rgba(255,255,255,0.12)' };

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        id={`die-${index + 1}`}
        aria-label={rolling ? 'Rolling…' : color ? `Die ${index + 1}: ${cfg!.label}` : `Die ${index + 1}`}
        style={dieStyle}
        className={[
          'relative flex h-28 w-28 items-center justify-center rounded-[1.75rem] sm:h-32 sm:w-32',
          rolling ? 'animate-pulse scale-90' : 'scale-100',
          'transition-transform duration-150',
        ].join(' ')}
      >
        <span className="block h-5 w-5 rounded-full bg-white" style={dotStyle} />
      </div>
      <span className={['text-[11px] font-bold uppercase tracking-[0.2em]', cfg ? cfg.textClass : 'text-white/20', 'transition-colors duration-300'].join(' ')}>
        {rolling ? '·  ·  ·' : cfg ? cfg.label : '—'}
      </span>
    </div>
  );
}

// ─── History Panel ────────────────────────────────────────────────────────────

interface HistoryPanelProps { entries: RollHistoryEntry[]; }

function HistoryPanel({ entries }: HistoryPanelProps) {
  return (
    <div
      className={[
        'relative z-10 flex w-full flex-col rounded-[2rem]',
        'bg-white/[0.03] backdrop-blur-xl border border-white/10',
        'shadow-[0_32px_80px_rgba(0,0,0,0.6)]',
        'p-5',
        /* desktop: fixed width sidebar; mobile: full width */
        'lg:w-60 lg:min-h-0',
      ].join(' ')}
    >
      {/* Inner top shine */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-t-[2rem]"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)' }}
      />

      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40">
          Winner History
        </p>
        {entries.length > 0 && (
          <span className="rounded-full bg-white/5 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-white/25">
            {entries.length}
          </span>
        )}
      </div>

      {/* Entry list */}
      {entries.length === 0 ? (
        <div className="flex flex-1 items-center justify-center py-8">
          <p className="text-center text-[11px] font-medium uppercase tracking-widest text-white/15">
            No rolls yet
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2 overflow-hidden lg:overflow-y-auto lg:max-h-[420px]
                       [&::-webkit-scrollbar]:w-1
                       [&::-webkit-scrollbar-track]:bg-transparent
                       [&::-webkit-scrollbar-thumb]:rounded-full
                       [&::-webkit-scrollbar-thumb]:bg-white/10">
          {entries.map((entry, idx) => {
            const isLatest = idx === 0;

            return (
              <li
                key={entry.id}
                className={[
                  'flex flex-col gap-2 rounded-xl px-3 py-3',
                  'transition-all duration-300',
                  isLatest
                    ? 'bg-white/[0.06] border border-white/10'
                    : 'bg-white/[0.02] border border-transparent',
                ].join(' ')}
              >
                {/* ── 3 neon dice squares ───────────────────────────── */}
                <div className="flex items-center justify-center gap-2">
                  {entry.dice.map((c, i) => {
                    const dcfg = COLOR_CONFIG[c];
                    return (
                      <div
                        key={i}
                        className="relative flex h-14 w-14 items-center justify-center rounded-2xl"
                        style={{
                          backgroundColor: dcfg.hex,
                          border: `1.5px solid ${dcfg.border}`,
                          boxShadow: isLatest
                            ? `0 0 16px ${dcfg.glow}, 0 0 32px ${dcfg.glow.replace('0.75', '0.3')}, inset 0 1px 0 rgba(255,255,255,0.15)`
                            : `0 0 8px ${dcfg.glow.replace('0.75', '0.35')}, inset 0 1px 0 rgba(255,255,255,0.08)`,
                          transition: 'box-shadow 0.3s ease',
                        }}
                      >
                        {/* Centre dot */}
                        <span
                          className="block h-3 w-3 rounded-full bg-white"
                          style={{ boxShadow: isLatest ? `0 0 6px white, 0 0 12px white` : '0 0 4px rgba(255,255,255,0.6)' }}
                        />
                      </div>
                    );
                  })}
                </div>

                {/* ── Labels row ───────────────────────────────────── */}
                <div className="flex items-center justify-between">
                  {/* 3 colour names */}
                  <div className="flex items-center gap-1">
                    {entry.dice.map((c, i) => (
                      <span
                        key={i}
                        className={['text-[9px] font-bold uppercase tracking-wide', COLOR_CONFIG[c].textClass].join(' ')}
                      >
                        {COLOR_CONFIG[c].label}{i < 2 ? ' ·' : ''}
                      </span>
                    ))}
                  </div>

                  {/* Badges + time */}
                  <div className="flex items-center gap-1">
                    {entry.isTriple && (
                      <span className="rounded-full bg-amber-500/20 px-1.5 py-px text-[8px] font-black uppercase tracking-widest text-amber-400">
                        Triple!
                      </span>
                    )}
                    {isLatest && (
                      <span className="rounded-full bg-purple-500/20 px-1.5 py-px text-[8px] font-black uppercase tracking-widest text-purple-400">
                        Latest
                      </span>
                    )}
                  </div>
                </div>

                {/* Timestamp */}
                <p className="text-right text-[9px] text-white/20">{entry.time}</p>

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
  const rollIdRef = useRef(0);

  // ── Set random dice colours after mount (avoids SSR hydration mismatch) ──
  useEffect(() => {
    setDice([randomColor(), randomColor(), randomColor()]);
  }, []);

  // ── Supabase: initial fetch + realtime ────────────────────────────────────
  useEffect(() => {
    supabase
      .from('game_settings')
      .select('forced_color')
      .eq('id', 1)
      .single()
      .then(({ data, error }) => {
        if (!error && data) setSecretForcedColor(data.forced_color ?? null);
      });

    const channel = supabase
      .channel('game-settings-player')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'game_settings', filter: 'id=eq.1' },
        (payload) => {
          const updated = (payload.new as { forced_color?: string | null }).forced_color ?? null;
          setSecretForcedColor(updated);
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // ── Roll handler ──────────────────────────────────────────────────────────
  const handleRoll = useCallback(() => {
    if (rolling) return;
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
      setRollCount((c) => c + 1);

      // Only log triples (all 3 dice the same colour) — random rolls are skipped
      if (isTriple) {
        const entry: RollHistoryEntry = {
          id: ++rollIdRef.current,
          dice: result,
          winner,
          isTriple,
          time: nowHMS(),
        };
        setHistory((prev) => [entry, ...prev].slice(0, MAX_HISTORY));
      }
    }, ROLL_DURATION_MS);
  }, [rolling, secretForcedColor]);

  const isTriple = dice && dice[0] === dice[1] && dice[1] === dice[2];

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#0a0a0f] px-4 py-12">

      {/* ── FINGERS CROSSED overlay ─────────────────────────────────────────── */}
      <div
        aria-live="assertive"
        aria-label={rolling ? 'Rolling dice…' : undefined}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '2.5rem',
          background: 'rgba(10,10,15,0.85)',
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
          opacity: rolling ? 1 : 0,
          pointerEvents: rolling ? 'all' : 'none',
          transition: 'opacity 0.25s ease',
        }}
      >
        {/* Title */}
        <div style={{ textAlign: 'center' }}>
          <p
            style={{
              fontSize: '0.7rem',
              fontWeight: 800,
              letterSpacing: '0.35em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.35)',
              marginBottom: '0.75rem',
            }}
          >
            Rolling
          </p>
          <h2
            style={{
              fontSize: 'clamp(2rem, 6vw, 3.5rem)',
              fontWeight: 900,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              backgroundImage: 'linear-gradient(135deg, #e2e8f0 0%, #a78bfa 40%, #ec4899 80%, #f59e0b 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              lineHeight: 1.1,
            }}
          >
            Fingers Crossed..
          </h2>
        </div>

        {/* 3 bouncing dice */}
        <div style={{ display: 'flex', gap: '1.25rem' }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                width: '5.5rem',
                height: '5.5rem',
                borderRadius: '1.25rem',
                background: 'rgba(255,255,255,0.07)',
                border: '1.5px solid rgba(255,255,255,0.15)',
                boxShadow: '0 0 30px rgba(168,85,247,0.25), inset 0 1px 0 rgba(255,255,255,0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                animation: `fingersCrossedBounce 0.6s ease-in-out ${i * 0.12}s infinite alternate`,
              }}
            >
              <span
                style={{
                  display: 'block',
                  width: '1.1rem',
                  height: '1.1rem',
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.35)',
                  boxShadow: '0 0 8px rgba(255,255,255,0.3)',
                }}
              />
            </div>
          ))}
        </div>

        {/* Pulsing dots loader */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              style={{
                display: 'block',
                width: '0.4rem',
                height: '0.4rem',
                borderRadius: '50%',
                background: 'rgba(168,85,247,0.7)',
                animation: `fingersCrossedPulse 0.8s ease-in-out ${i * 0.18}s infinite alternate`,
              }}
            />
          ))}
        </div>

        {/* Keyframes injected inline */}
        <style>{`
          @keyframes fingersCrossedBounce {
            from { transform: translateY(0px) scale(1);    box-shadow: 0 0 30px rgba(168,85,247,0.25); }
            to   { transform: translateY(-14px) scale(1.06); box-shadow: 0 18px 40px rgba(0,0,0,0.4), 0 0 30px rgba(168,85,247,0.5); }
          }
          @keyframes fingersCrossedPulse {
            from { opacity: 0.3; transform: scale(0.8); }
            to   { opacity: 1;   transform: scale(1.2); }
          }
        `}</style>
      </div>

      {/* ── Ambient blobs ──────────────────────────────────────────────────── */}

      <div aria-hidden="true" className="pointer-events-none absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-blue-600/25 blur-[120px]" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-purple-700/25 blur-[120px]" />
      <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/3 h-[300px] w-[300px] -translate-x-1/2 rounded-full bg-indigo-500/10 blur-[100px]" />

      {/* ── Possible colours banner ─────────────────────────────────────────── */}
      <div className="relative z-10 mb-6 w-full max-w-2xl">
        <div
          className={[
            'flex flex-wrap items-center justify-center gap-x-1 gap-y-1',
            'rounded-2xl px-6 py-3',
            'bg-white/[0.04] backdrop-blur-md border border-white/10',
            'shadow-[0_4px_24px_rgba(0,0,0,0.4)]',
          ].join(' ')}
        >
          {/* Shine line */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-t-2xl"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)' }}
          />

          <span className="text-xs font-semibold text-white/50 tracking-wide">
            Possible colors are:
          </span>

          {(
            [
              { label: 'Red', color: '#EF4444', glow: 'rgba(239,68,68,0.8)' },
              { label: 'Orange', color: '#F97316', glow: 'rgba(249,115,22,0.8)' },
              { label: 'Yellow', color: '#EAB308', glow: 'rgba(234,179,8,0.8)' },
              { label: 'Green', color: '#22C55E', glow: 'rgba(34,197,94,0.8)' },
              { label: 'Blue', color: '#3B82F6', glow: 'rgba(59,130,246,0.8)' },
              { label: 'Purple', color: '#A855F7', glow: 'rgba(168,85,247,0.8)' },
            ] as const
          ).map(({ label, color, glow }, i, arr) => (
            <span key={label} className="flex items-center gap-x-1">
              <span
                className="text-xs font-extrabold tracking-wide"
                style={{ color, textShadow: `0 0 10px ${glow}, 0 0 20px ${glow.replace('0.8', '0.4')}` }}
              >
                {label}
              </span>
              {i < arr.length - 1 && (
                <span className="text-white/25 text-xs">,</span>
              )}
              {i === arr.length - 2 && (
                <span className="text-white/50 text-xs font-semibold tracking-wide">and</span>
              )}
            </span>
          ))}

          <span className="text-white/25 text-xs">.</span>
        </div>
      </div>

      {/* ── Header ─────────────────────────────────────────────────────────── */}

      <div className="relative z-10 mb-8 text-center">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.35em] text-purple-400/70">
          Provably Fair · Live Game
        </p>
        <h1
          className="text-5xl font-extrabold tracking-tight sm:text-6xl"
          style={{
            backgroundImage: 'linear-gradient(135deg, #e2e8f0 0%, #94a3b8 50%, #cbd5e1 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          COLOR DICE
        </h1>
        <p className="mt-2 text-xs font-medium uppercase tracking-[0.25em] text-slate-500">
          Roll · Win · Repeat
        </p>
      </div>

      {/* ── Main layout: [Game Card] + [History Panel] ─────────────────────── */}
      <div className="relative z-10 flex w-full max-w-3xl flex-col items-start gap-5 lg:flex-row lg:items-stretch">

        {/* ── Game Card ─────────────────────────────────────────────────────── */}
        <div
          className={[
            'relative flex-1 w-full rounded-[2rem]',
            'bg-white/[0.03] backdrop-blur-xl border border-white/10',
            'p-8 sm:p-10',
            'shadow-[0_32px_80px_rgba(0,0,0,0.6)]',
          ].join(' ')}
        >
          {/* Top shine */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-t-[2rem]"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)' }}
          />

          {/* Dice */}
          <div id="dice-area" className="flex items-end justify-center gap-5 sm:gap-7" aria-live="polite" aria-atomic="true">
            {[0, 1, 2].map((i) => (
              <Die key={i} index={i} color={dice ? dice[i] : null} rolling={rolling} />
            ))}
          </div>

          {/* Result line */}
          <div className="mt-7 flex min-h-[28px] items-center justify-center">
            {rolling ? (
              <p className="animate-pulse text-[11px] font-medium uppercase tracking-[0.3em] text-purple-400/60">
                Determining outcome…
              </p>
            ) : rollCount === 0 || !dice ? (
              <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-white/20">
                Press below to roll
              </p>
            ) : isTriple ? (
              <div className="flex items-center gap-2">
                <span className="text-lg">🎉</span>
                <span
                  className="text-sm font-bold uppercase tracking-widest"
                  style={{ backgroundImage: 'linear-gradient(90deg, #f59e0b, #ec4899, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}
                >
                  Triple {COLOR_CONFIG[dice[0]].label}!
                </span>
                <span className="text-lg">🎉</span>
              </div>
            ) : (
              <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-white/30">
                {dice.map((c) => COLOR_CONFIG[c].label).join('  ·  ')}
              </p>
            )}
          </div>

          {/* Divider */}
          <div className="my-7 h-px w-full" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)' }} />

          {/* Roll button */}
          <button
            id="roll-button"
            onClick={handleRoll}
            disabled={rolling}
            aria-busy={rolling}
            className={[
              'w-full rounded-2xl py-5',
              'text-sm font-extrabold uppercase tracking-[0.35em] text-white',
              'bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500',
              'transition-all duration-200',
              rolling
                ? 'cursor-not-allowed opacity-50 scale-[0.98]'
                : 'hover:scale-[1.02] active:scale-[0.98] hover:shadow-[0_0_40px_rgba(168,85,247,0.5)] hover:brightness-110',
            ].join(' ')}
            style={rolling ? {} : { boxShadow: '0 4px 24px rgba(139,92,246,0.35), 0 1px 0 rgba(255,255,255,0.1) inset' }}
          >
            {rolling ? 'Rolling...' : rollCount === 0 ? 'Roll Dice' : 'Roll Again'}
          </button>

          {rollCount > 0 && (
            <p className="mt-5 text-center text-[10px] font-medium uppercase tracking-[0.3em] text-white/20">
              {rollCount} {rollCount === 1 ? 'Roll' : 'Rolls'}
            </p>
          )}
        </div>

        {/* ── History Panel ─────────────────────────────────────────────────── */}
        <HistoryPanel entries={history} />
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}

    </div>
  );
}
