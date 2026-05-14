'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';

const DICE_COLORS = ['red', 'orange', 'yellow', 'green', 'blue', 'purple'] as const;
type DiceColor = (typeof DICE_COLORS)[number];

interface ColorConfig { label: string; hex: string; border: string; glow: string; textClass: string; }

const COLOR_CONFIG: Record<DiceColor, ColorConfig> = {
  red:    { label: 'Red',    hex: '#EF4444', border: '#F87171', glow: 'rgba(239,68,68,0.6)',   textClass: 'text-red-400'    },
  orange: { label: 'Orange', hex: '#F97316', border: '#FB923C', glow: 'rgba(249,115,22,0.6)',  textClass: 'text-orange-400' },
  yellow: { label: 'Yellow', hex: '#EAB308', border: '#FDE047', glow: 'rgba(234,179,8,0.6)',   textClass: 'text-yellow-300' },
  green:  { label: 'Green',  hex: '#22C55E', border: '#4ADE80', glow: 'rgba(34,197,94,0.6)',   textClass: 'text-green-400'  },
  blue:   { label: 'Blue',   hex: '#3B82F6', border: '#60A5FA', glow: 'rgba(59,130,246,0.6)',  textClass: 'text-blue-400'   },
  purple: { label: 'Purple', hex: '#A855F7', border: '#C084FC', glow: 'rgba(168,85,247,0.6)',  textClass: 'text-purple-400' },
};

const ROLL_PHRASES = [
  'Fingers Crossed..', 'Here We Go!', 'Come On Lucky!', 'Rolling The Fates..',
  'Let It Ride!', 'Big Win Loading..', "Don't Peek Yet..", 'Show Me The Money!',
  'Destiny Decides..', 'Spin To Win!', 'Feel The Rush..', 'Lucky Numbers..',
  'One More Time..', 'Make It Count!', 'The Dice Are Hot!',
];

const ROLL_DURATION_MS = 1600;
const SHUFFLE_INTERVAL_MS = 60;
const MAX_HISTORY = 30;
const MIN_DICE = 1;
const MAX_DICE = 14;

// ─── Themes ───────────────────────────────────────────────────────────────────

interface Theme {
  id: string;
  label: string;
  emoji: string;
  bg: string;          // CSS background value
  orb1: string;        // Tailwind / inline colour for top-left orb
  orb2: string;        // for bottom-right orb
}

const THEMES: Theme[] = [
  { id: 'default',  label: 'Default',  emoji: '🌌', bg: '#07070a', orb1: 'rgba(29,78,216,0.20)',   orb2: 'rgba(109,40,217,0.20)'  },
  { id: 'ocean',    label: 'Ocean',    emoji: '🌊', bg: '#030d12', orb1: 'rgba(6,182,212,0.22)',   orb2: 'rgba(14,116,144,0.22)'  },
  { id: 'sunset',   label: 'Sunset',   emoji: '🌅', bg: '#100508', orb1: 'rgba(234,88,12,0.22)',   orb2: 'rgba(219,39,119,0.22)'  },
  { id: 'forest',   label: 'Forest',   emoji: '🌿', bg: '#040d06', orb1: 'rgba(21,128,61,0.25)',   orb2: 'rgba(134,239,172,0.12)' },
  { id: 'galaxy',   label: 'Galaxy',   emoji: '🔮', bg: '#06030f', orb1: 'rgba(139,92,246,0.28)',  orb2: 'rgba(236,72,153,0.22)'  },
  { id: 'neon',     label: 'Neon',     emoji: '⚡', bg: '#020209', orb1: 'rgba(0,255,200,0.18)',   orb2: 'rgba(255,0,128,0.18)'   },
  { id: 'midnight', label: 'Midnight', emoji: '🌙', bg: '#000000', orb1: 'rgba(30,30,50,0.40)',    orb2: 'rgba(20,20,40,0.40)'    },
  { id: 'custom',   label: 'Custom Image', emoji: '🖼️', bg: '#07070a', orb1: 'transparent', orb2: 'transparent' },
];

interface RollHistoryEntry {
  id: number;
  dice: DiceColor[];
  winner: DiceColor;
  isJackpot: boolean;
  time: string;
}

function randomColor(): DiceColor { return DICE_COLORS[Math.floor(Math.random() * DICE_COLORS.length)]; }

function randomDice(count: number): DiceColor[] {
  return Array.from({ length: count }, () => randomColor());
}

function resolveRoll(forced: string | null, count: number): DiceColor[] {
  if (forced && DICE_COLORS.includes(forced as DiceColor)) {
    return Array(count).fill(forced as DiceColor);
  }
  return randomDice(count);
}

function dominantColor(d: DiceColor[]): DiceColor {
  const freq: Partial<Record<DiceColor, number>> = {};
  for (const c of d) freq[c] = (freq[c] ?? 0) + 1;
  let best = d[0];
  for (const c of d) if ((freq[c] ?? 0) > (freq[best] ?? 0)) best = c;
  return best;
}

function isAllSame(d: DiceColor[]): boolean { return d.length > 0 && d.every(c => c === d[0]); }
function nowHMS(): string { return new Date().toLocaleTimeString('en-US', { hour12: false }); }
function pickPhrase(): string { return ROLL_PHRASES[Math.floor(Math.random() * ROLL_PHRASES.length)]; }

// ─── Die (size-aware) ────────────────────────────────────────────────────────

interface DieProps { color: DiceColor | null; rolling: boolean; index: number; size: 'lg' | 'md' | 'sm' | 'xs'; }

function Die({ color, rolling, index, size }: DieProps) {
  const cfg = color ? COLOR_CONFIG[color] : null;
  const boxShadow = cfg
    ? `0 0 20px ${cfg.glow}, 0 0 50px ${cfg.glow.replace('0.6','0.2')}, inset 0 1px 0 rgba(255,255,255,0.18)`
    : 'inset 0 1px 0 rgba(255,255,255,0.04)';

  const sizeMap = { lg: 'h-28 w-28 rounded-[1.5rem]', md: 'h-20 w-20 rounded-[1.2rem]', sm: 'h-14 w-14 rounded-[0.9rem]', xs: 'h-11 w-11 rounded-[0.7rem]' };
  const dotMap  = { lg: 'h-5 w-5', md: 'h-4 w-4', sm: 'h-3 w-3', xs: 'h-2.5 w-2.5' };
  const textMap = { lg: 'text-[11px]', md: 'text-[10px]', sm: 'text-[9px]', xs: 'text-[8px]' };

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        id={`die-${index + 1}`}
        aria-label={rolling ? 'Rolling…' : color ? `Die ${index + 1}: ${cfg!.label}` : `Die ${index + 1}`}
        className={['relative flex items-center justify-center transition-all duration-150', sizeMap[size], rolling ? 'scale-90 opacity-60 animate-pulse' : 'scale-100 opacity-100'].join(' ')}
        style={{ backgroundColor: cfg ? cfg.hex : 'rgba(255,255,255,0.03)', border: `2px solid ${cfg ? cfg.border : 'rgba(255,255,255,0.07)'}`, boxShadow }}
      >
        <span className={['block rounded-full bg-white', dotMap[size]].join(' ')}
          style={{ boxShadow: cfg ? `0 0 8px white, 0 0 16px ${cfg.glow}` : 'none', opacity: cfg ? 1 : 0.15 }} />
      </div>
      <span className={['font-bold uppercase tracking-[0.15em] transition-colors duration-300', textMap[size], cfg ? cfg.textClass : 'text-white/20'].join(' ')}>
        {rolling ? '·' : cfg ? cfg.label : '—'}
      </span>
    </div>
  );
}

// ─── Dice Count Selector ──────────────────────────────────────────────────────

interface DiceCountSelectorProps { count: number; onChange: (n: number) => void; disabled: boolean; }

function DiceCountSelector({ count, onChange, disabled }: DiceCountSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const label = count === 1 ? '1 Die' : `${count} Dice`;

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        onClick={() => !disabled && setOpen(o => !o)}
        disabled={disabled}
        className={[
          'flex items-center gap-2 rounded-full px-4 py-2',
          'border border-white/15 bg-white/[0.05] backdrop-blur-md',
          'text-[11px] font-extrabold uppercase tracking-[0.2em] text-white/70',
          'transition-all duration-150',
          disabled ? 'cursor-not-allowed opacity-40' : 'hover:border-white/30 hover:bg-white/10 hover:text-white cursor-pointer',
        ].join(' ')}
      >
        <span>🎲</span>
        <span>{label}</span>
        <span className={['text-white/40 transition-transform duration-200', open ? 'rotate-180' : ''].join(' ')}>▾</span>
      </button>

      {/* Dropdown list */}
      {open && (
        <div className={[
          'absolute left-0 top-full z-50 mt-2 w-44',
          'rounded-2xl border border-white/10 bg-[#0f0f18] backdrop-blur-2xl',
          'shadow-[0_20px_60px_rgba(0,0,0,0.8)] overflow-hidden',
        ].join(' ')}>
          <div className="max-h-72 overflow-y-auto [&::-webkit-scrollbar]:w-[3px] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/10">
            {Array.from({ length: MAX_DICE - MIN_DICE + 1 }, (_, i) => i + MIN_DICE).map(n => {
              const isActive = n === count;
              const lbl = n === 1 ? '1 Die' : `${n} Dice`;
              return (
                <button
                  key={n}
                  onClick={() => { onChange(n); setOpen(false); }}
                  className={[
                    'flex w-full items-center gap-3 px-4 py-2.5 text-left',
                    'text-[12px] font-bold uppercase tracking-[0.15em]',
                    'transition-all duration-100',
                    isActive
                      ? 'bg-indigo-600/80 text-white'
                      : 'text-white/60 hover:bg-white/[0.06] hover:text-white',
                  ].join(' ')}
                >
                  {isActive && <span className="h-1.5 w-1.5 rounded-full bg-white shrink-0" />}
                  {!isActive && <span className="h-1.5 w-1.5 shrink-0" />}
                  {lbl}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── History Panel ────────────────────────────────────────────────────────────

function HistoryPanel({ entries }: { entries: RollHistoryEntry[] }) {
  return (
    <div className="relative flex w-full flex-col rounded-[2rem] border border-white/10 bg-white/[0.02] p-5 shadow-[0_32px_80px_rgba(0,0,0,0.6)] backdrop-blur-2xl lg:w-60 lg:self-stretch">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-t-[2rem]"
        style={{ background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.12),transparent)' }} />

      <div className="mb-4 flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40">Triple Winner Log</p>
        {entries.length > 0 && (
          <span className="rounded-full bg-white/5 px-2 py-0.5 text-[9px] font-semibold tracking-widest text-white/25">{entries.length}</span>
        )}
      </div>

      {entries.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8">
          <span className="text-3xl opacity-20">🎲</span>
          <p className="text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-white/15">No jackpots yet —{'\n'}keep rolling!</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2 overflow-y-auto lg:max-h-[520px] [&::-webkit-scrollbar]:w-[3px] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/10">
          {entries.map((entry, idx) => {
            const isLatest = idx === 0;
            const wcfg = COLOR_CONFIG[entry.winner];
            return (
              <li key={entry.id} className={['flex flex-col gap-2 rounded-xl px-3 py-3 transition-all duration-300', isLatest ? 'border border-white/10 bg-white/[0.05]' : 'border border-transparent bg-white/[0.015]'].join(' ')}>
                {/* Mini dice (flex-wrap for many) */}
                <div className="flex flex-wrap items-center justify-center gap-1.5">
                  {entry.dice.map((c, i) => {
                    const dc = COLOR_CONFIG[c];
                    return (
                      <span key={i} className="flex h-7 w-7 items-center justify-center rounded-lg"
                        style={{ backgroundColor: dc.hex, border: `1.5px solid ${dc.border}`, boxShadow: isLatest ? `0 0 8px ${dc.glow}` : 'none' }}>
                        <span className="block h-[6px] w-[6px] rounded-full bg-white" />
                      </span>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between">
                  <span className={`text-[9px] font-bold uppercase tracking-wide ${wcfg.textClass}`}>
                    🎉 {entry.dice.length === 3 ? 'Triple' : `${entry.dice.length}× All`} {wcfg.label}!
                  </span>
                  <div className="flex gap-1">
                    {isLatest && <span className="rounded-full bg-purple-500/20 px-1.5 py-px text-[7px] font-black uppercase tracking-widest text-purple-400">Latest</span>}
                  </div>
                </div>
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

function getDieSize(count: number): 'lg' | 'md' | 'sm' | 'xs' {
  if (count <= 3)  return 'lg';
  if (count <= 6)  return 'md';
  if (count <= 10) return 'sm';
  return 'xs';
}

// ─── Theme Selector component ─────────────────────────────────────────────────

function ThemeSelector({ current, onChange, onCustomUpload }: {
  current: string;
  onChange: (id: string) => void;
  onCustomUpload: (dataUrl: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const activeTheme = THEMES.find(t => t.id === current) ?? THEMES[0];

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target?.result as string;
      onCustomUpload(url);
      onChange('custom');
    };
    reader.readAsDataURL(file);
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.05] px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.2em] text-white/70 backdrop-blur-md transition-all hover:border-white/30 hover:bg-white/10 hover:text-white"
      >
        <span>{activeTheme.emoji}</span>
        <span>{activeTheme.label}</span>
        <span className={['text-white/40 transition-transform duration-200', open ? 'rotate-180' : ''].join(' ')}>▾</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-2xl border border-white/10 bg-[#0c0c18] shadow-[0_20px_60px_rgba(0,0,0,0.85)] backdrop-blur-2xl">
          <p className="border-b border-white/5 px-4 py-2.5 text-[9px] font-black uppercase tracking-[0.3em] text-white/30">Change Theme</p>
          <div className="max-h-72 overflow-y-auto [&::-webkit-scrollbar]:w-[3px] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/10">
            {THEMES.map(t => {
              const isActive = t.id === current;
              if (t.id === 'custom') return (
                <button key="custom" onClick={() => fileRef.current?.click()}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-[0.12em] text-indigo-300 transition-all hover:bg-white/[0.06]">
                  <span>{t.emoji}</span><span>{t.label}</span>
                </button>
              );
              return (
                <button key={t.id} onClick={() => { onChange(t.id); setOpen(false); }}
                  className={['flex w-full items-center gap-3 px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-[0.12em] transition-all duration-100',
                    isActive ? 'bg-indigo-600/70 text-white' : 'text-white/60 hover:bg-white/[0.06] hover:text-white'].join(' ')}>
                  <span>{t.emoji}</span>
                  <span>{t.label}</span>
                  {isActive && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-white" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Hidden file input */}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function GamePage() {
  const [secretForcedColor, setSecretForcedColor] = useState<string | null>(null);
  const [diceCount, setDiceCount] = useState(3);
  const [dice, setDice]           = useState<DiceColor[] | null>(null);
  const [rolling, setRolling]     = useState(false);
  const [rollCount, setRollCount] = useState(0);
  const [history, setHistory]     = useState<RollHistoryEntry[]>([]);
  const [rollPhrase, setRollPhrase] = useState(ROLL_PHRASES[0]);
  const [themeId, setThemeId]     = useState('default');
  const [customBg, setCustomBg]   = useState<string | null>(null);
  const rollIdRef = useRef(0);


  // Hydration-safe init
  useEffect(() => { setDice(randomDice(diceCount)); }, []);

  // Reset dice when count changes
  useEffect(() => { if (!rolling) setDice(randomDice(diceCount)); }, [diceCount]);

  // Supabase realtime
  useEffect(() => {
    supabase.from('game_settings').select('forced_color').eq('id', 1).single()
      .then(({ data, error }) => { if (!error && data) setSecretForcedColor(data.forced_color ?? null); });

    const channel = supabase.channel('game-settings-player')
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'game_settings', filter: 'id=eq.1' },
        (payload) => { setSecretForcedColor((payload.new as { forced_color?: string | null }).forced_color ?? null); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleRoll = useCallback(() => {
    if (rolling) return;
    setRollPhrase(pickPhrase());
    setRolling(true);

    const shuffleId = setInterval(() => { setDice(randomDice(diceCount)); }, SHUFFLE_INTERVAL_MS);

    setTimeout(() => {
      clearInterval(shuffleId);
      const result    = resolveRoll(secretForcedColor, diceCount);
      const isJackpot = isAllSame(result);
      const winner    = dominantColor(result);

      setDice(result);
      setRolling(false);
      setRollCount(c => c + 1);

      if (isJackpot) {
        setHistory(prev => [{ id: ++rollIdRef.current, dice: result, winner, isJackpot, time: nowHMS() }, ...prev].slice(0, MAX_HISTORY));
      }
    }, ROLL_DURATION_MS);
  }, [rolling, secretForcedColor, diceCount]);

  const jackpot  = dice && isAllSame(dice);
  const dieSize  = getDieSize(diceCount);
  const activeTheme = THEMES.find(t => t.id === themeId) ?? THEMES[0];

  // Compose background style
  const bgStyle: React.CSSProperties = themeId === 'custom' && customBg
    ? { backgroundImage: `url(${customBg})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: activeTheme.bg };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-14 transition-[background] duration-700" style={bgStyle}>
      {/* Dark overlay for custom images to keep text readable */}
      {themeId === 'custom' && customBg && (
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-black/55" />
      )}
      <style>{`
        @keyframes fcBounce { from { transform: translateY(0) scale(1); } to { transform: translateY(-16px) scale(1.08); } }
        @keyframes fcPulse  { from { opacity:0.3; transform:scale(0.8); } to { opacity:1; transform:scale(1.2); } }
        @keyframes fadeSlideIn { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:translateY(0); } }
      `}</style>

      {/* Dynamic ambient orbs */}
      <div aria-hidden className="pointer-events-none absolute -left-56 -top-56 h-[600px] w-[600px] rounded-full blur-[150px] transition-[background] duration-700"
        style={{ background: activeTheme.orb1 }} />
      <div aria-hidden className="pointer-events-none absolute -bottom-56 -right-56 h-[600px] w-[600px] rounded-full blur-[150px] transition-[background] duration-700"
        style={{ background: activeTheme.orb2 }} />

      {/* Rolling overlay */}
      <div
        aria-live="assertive"
        className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-8 transition-opacity duration-200"
        style={{ background:'rgba(7,7,10,0.88)', backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)', opacity: rolling ? 1 : 0, pointerEvents: rolling ? 'all' : 'none' }}
      >
        <p className="text-[10px] font-extrabold uppercase tracking-[0.4em] text-white/30">Rolling</p>
        <h2 key={rollPhrase} className="bg-clip-text text-[clamp(2rem,6vw,3.5rem)] font-black uppercase tracking-[0.07em] text-transparent"
          style={{ backgroundImage:'linear-gradient(135deg,#e2e8f0 0%,#a78bfa 45%,#ec4899 80%,#f59e0b 100%)', animation:'fadeSlideIn 0.3s ease both' }}>
          {rollPhrase}
        </h2>
        <div className="flex gap-5">
          {[0,1,2].map(i => (
            <div key={i} className="flex h-20 w-20 items-center justify-center rounded-[1.1rem] border border-white/15"
              style={{ background:'rgba(255,255,255,0.05)', boxShadow:'0 0 30px rgba(139,92,246,0.2)', animation:`fcBounce 0.6s ease-in-out ${i*0.13}s infinite alternate` }}>
              <span className="block h-4 w-4 rounded-full bg-white/40" />
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          {[0,1,2].map(i => <span key={i} className="block h-[7px] w-[7px] rounded-full bg-purple-400/70" style={{ animation:`fcPulse 0.75s ease-in-out ${i*0.2}s infinite alternate` }} />)}
        </div>
      </div>

      {/* Possible colours */}
      <div className="relative z-10 mb-8 w-full max-w-3xl">
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-2xl border border-white/[0.08] bg-white/[0.025] px-5 py-3 backdrop-blur-md">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-white/35">Possible colors:</span>
          {DICE_COLORS.map((c, i) => {
            const cfg = COLOR_CONFIG[c];
            return (
              <span key={c} className="flex items-center gap-1">
                <span className={`text-[11px] font-extrabold tracking-wide ${cfg.textClass}`} style={{ textShadow:`0 0 12px ${cfg.glow}` }}>{cfg.label}</span>
                {i < DICE_COLORS.length - 1 && <span className="text-[11px] text-white/20">,</span>}
              </span>
            );
          })}
        </div>
      </div>

      {/* Header */}
      <div className="relative z-10 mb-10 text-center">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.4em] text-purple-400/60">Provably Fair · Live Game</p>
        <h1 className="bg-clip-text text-5xl font-black uppercase tracking-[0.3em] text-transparent sm:text-6xl"
          style={{ backgroundImage:'linear-gradient(135deg,#f1f5f9 0%,#94a3b8 50%,#cbd5e1 100%)' }}>Color Dice</h1>
        <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.25em] text-slate-600">Roll · Win · Repeat</p>
      </div>

      {/* Two-column layout */}
      <div className="relative z-10 flex w-full max-w-3xl flex-col items-start gap-5 lg:flex-row lg:items-stretch">

        {/* Game Card */}
        <div className="relative flex-1 w-full">
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-t-[2rem]"
            style={{ background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.12),transparent)' }} />

          <div className="rounded-[2rem] border border-white/10 bg-white/[0.02] p-8 shadow-[0_32px_80px_rgba(0,0,0,0.7)] backdrop-blur-2xl sm:p-10">

            {/* Controls row: dice count + theme + roll count */}
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <DiceCountSelector count={diceCount} onChange={setDiceCount} disabled={rolling} />
                <ThemeSelector
                  current={themeId}
                  onChange={setThemeId}
                  onCustomUpload={setCustomBg}
                />
              </div>
              {rollCount > 0 && (
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/20">
                  {rollCount} {rollCount === 1 ? 'Roll' : 'Rolls'}
                </span>
              )}
            </div>

            {/* Dice area */}
            <div id="dice-area" aria-live="polite" aria-atomic="true"
              className="flex flex-wrap items-center justify-center gap-4">
              {Array.from({ length: diceCount }, (_, i) => (
                <Die key={i} index={i} color={dice ? dice[i] : null} rolling={rolling} size={dieSize} />
              ))}
            </div>

            {/* Result caption */}
            <div className="mt-7 flex min-h-[30px] items-center justify-center">
              {rolling ? (
                <p className="animate-pulse text-[11px] font-bold uppercase tracking-[0.3em] text-purple-400/70">Determining outcome…</p>
              ) : jackpot && dice ? (
                <div className="flex items-center gap-2">
                  <span className="text-xl">🎉</span>
                  <span className="bg-clip-text text-sm font-black uppercase tracking-widest text-transparent"
                    style={{ backgroundImage:'linear-gradient(90deg,#f59e0b,#ec4899,#a855f7)' }}>
                    {diceCount === 3 ? 'Triple' : `${diceCount}× All`} {COLOR_CONFIG[dice[0]].label}!
                  </span>
                  <span className="text-xl">🎉</span>
                </div>
              ) : dice && rollCount > 0 ? (
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/25">
                  {dice.slice(0, 6).map(c => COLOR_CONFIG[c].label).join('  ·  ')}{diceCount > 6 ? '  · …' : ''}
                </p>
              ) : (
                <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/15">Press below to roll</p>
              )}
            </div>

            <div className="my-7 h-px w-full" style={{ background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.07),transparent)' }} />

            {/* Roll button */}
            <button
              id="roll-button"
              onClick={handleRoll}
              disabled={rolling}
              aria-busy={rolling}
              className={['w-full rounded-2xl py-5', 'bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600', 'text-sm font-extrabold uppercase tracking-[0.35em] text-white', 'transition-all duration-200',
                rolling ? 'cursor-not-allowed scale-[0.98] opacity-50' : 'hover:scale-[1.02] active:scale-[0.98] hover:shadow-[0_0_40px_rgba(79,70,229,0.45),0_0_80px_rgba(168,85,247,0.2)] hover:brightness-110',
              ].join(' ')}
              style={rolling ? {} : { boxShadow:'0 4px 24px rgba(99,102,241,0.35), inset 0 1px 0 rgba(255,255,255,0.12)' }}
            >
              {rolling ? 'Rolling…' : rollCount === 0 ? '🎲  Roll Dice' : '🎲  Roll Again'}
            </button>
          </div>
        </div>

        {/* History Panel */}
        <HistoryPanel entries={history} />
      </div>

      <p className="relative z-10 mt-10 text-center text-[10px] font-medium uppercase tracking-[0.25em] text-white/10">
        © 2026 dice-ph.vercel.app
      </p>
    </div>
  );
}
