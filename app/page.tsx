'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';

// ─── Constants ────────────────────────────────────────────────────────────────

const DICE_COLORS = ['red', 'orange', 'yellow', 'green', 'blue', 'purple'] as const;
type DiceColor = (typeof DICE_COLORS)[number];

interface ColorConfig {
  hex: string;
  border: string;
  label: string;
}

const COLOR_CONFIG: Record<DiceColor, ColorConfig> = {
  red:    { hex: '#e53e3e', border: '#c53030', label: 'Red'    },
  orange: { hex: '#dd6b20', border: '#c05621', label: 'Orange' },
  yellow: { hex: '#d69e2e', border: '#b7791f', label: 'Yellow' },
  green:  { hex: '#38a169', border: '#276749', label: 'Green'  },
  blue:   { hex: '#3182ce', border: '#2b6cb0', label: 'Blue'   },
  purple: { hex: '#805ad5', border: '#6b46c1', label: 'Purple' },
};

// Display colours for the "Possible colors" strip (vivid, on white bg)
const COLOR_TEXT: Record<DiceColor, string> = {
  red: '#e53e3e', orange: '#dd6b20', yellow: '#ca8a04',
  green: '#16a34a', blue: '#2563eb', purple: '#7c3aed',
};

const ROLL_DURATION_MS    = 1800;
const SHUFFLE_INTERVAL_MS = 80;
const MAX_HISTORY         = 20;

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

// ─── Die ──────────────────────────────────────────────────────────────────────

interface DieProps { color: DiceColor | null; rolling: boolean; index: number }

function Die({ color, rolling, index }: DieProps) {
  const cfg = color ? COLOR_CONFIG[color] : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
      <div
        id={`die-${index + 1}`}
        aria-label={rolling ? 'Rolling…' : color ? `Die ${index + 1}: ${cfg!.label}` : `Die ${index + 1}`}
        style={{
          width: '100px', height: '100px',
          borderRadius: '14px',
          backgroundColor: cfg ? cfg.hex : '#ffffff',
          border: `4px solid ${cfg ? '#ffffff' : '#bfdbfe'}`,
          boxShadow: cfg
            ? `0 4px 0 ${cfg.border}, 0 6px 20px rgba(0,0,0,0.18)`
            : '0 4px 0 #93c5fd, 0 6px 16px rgba(0,0,0,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: rolling ? 'background-color 0.08s' : 'all 0.35s ease',
          transform: rolling ? 'scale(0.94) rotate(-2deg)' : 'scale(1) rotate(0deg)',
          cursor: 'default',
        }}
      >
        {/* centre dot */}
        <span style={{
          display: 'block', width: '20px', height: '20px',
          borderRadius: '50%', backgroundColor: 'white',
          boxShadow: cfg ? '0 1px 4px rgba(0,0,0,0.3)' : '0 1px 4px rgba(0,0,0,0.1)',
        }} />
      </div>

      {/* colour label below die */}
      <span style={{
        fontSize: '13px', fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.06em',
        color: cfg ? cfg.hex : '#93c5fd',
        transition: 'color 0.3s',
      }}>
        {rolling ? '· · ·' : cfg ? cfg.label : '—'}
      </span>
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

const DISCOVER_LEFT = [
  'dice', 'Board Games', 'die', 'tabletop games', 'board games',
  'Board & Card Games', 'Dice', 'DICE',
];
const DISCOVER_RIGHT = [
  'Educational Dice Games', 'Custom Dice Roller', 'Dice Roller App',
  'Color Dice Sets', 'games', 'Dice Game History',
  'Dice Game Tutorials', 'Dice Game Tournaments',
];

function Sidebar({ links }: { links: string[] }) {
  return (
    <div style={{
      width: '170px', flexShrink: 0,
      backgroundColor: '#ffffff',
      borderRadius: '10px',
      padding: '12px 14px',
      boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
      alignSelf: 'flex-start',
    }}>
      <p style={{ margin: '0 0 10px', fontSize: '13px', fontWeight: 700, color: '#1e3a5f', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
        Discover more
      </p>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column' }}>
        {links.map((l) => (
          <li key={l} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '7px 0', borderBottom: '1px solid #f1f5f9',
            fontSize: '13px', color: '#1d4ed8', cursor: 'pointer',
            userSelect: 'none',
          }}>
            <span>{l}</span>
            <span style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 700 }}>›</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── History list ─────────────────────────────────────────────────────────────

function HistoryList({ entries }: { entries: RollHistoryEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <div style={{ borderTop: '2px solid #e0f2fe', padding: '12px 16px' }}>
      <p style={{ margin: '0 0 8px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#94a3b8' }}>
        Triple Winner Log
      </p>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', maxHeight: '160px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '5px' }}>
        {entries.map((e, idx) => (
          <li key={e.id} style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '5px 8px', borderRadius: '8px',
            background: idx === 0 ? '#eff6ff' : 'transparent',
            border: idx === 0 ? '1px solid #bfdbfe' : '1px solid transparent',
          }}>
            {/* 3 mini dice */}
            {e.dice.map((c, i) => (
              <span key={i} style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: '22px', height: '22px', borderRadius: '5px',
                backgroundColor: COLOR_CONFIG[c].hex,
                border: '2px solid white',
                boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                flexShrink: 0,
              }}>
                <span style={{ display: 'block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'white' }} />
              </span>
            ))}
            <span style={{ flex: 1, fontSize: '11px', fontWeight: 700, color: COLOR_CONFIG[e.winner].hex, textTransform: 'uppercase' }}>
              {e.isTriple ? `🎉 Triple ${COLOR_CONFIG[e.winner].label}!` : e.dice.map(c => COLOR_CONFIG[c].label).join(' · ')}
            </span>
            <span style={{ fontSize: '10px', color: '#94a3b8', flexShrink: 0 }}>{e.time}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function GamePage() {
  const [secretForcedColor, setSecretForcedColor] = useState<string | null>(null);
  const [dice, setDice]       = useState<[DiceColor, DiceColor, DiceColor] | null>(null);
  const [rolling, setRolling] = useState(false);
  const [rollCount, setRollCount] = useState(0);
  const [history, setHistory] = useState<RollHistoryEntry[]>([]);
  const rollIdRef = useRef(0);

  // ── Hydration-safe random init ──
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
          setSecretForcedColor((payload.new as { forced_color?: string | null }).forced_color ?? null);
        })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // ── Roll handler ──
  const handleRoll = useCallback(() => {
    if (rolling) return;
    setRolling(true);

    const shuffleId = setInterval(() => {
      setDice([randomColor(), randomColor(), randomColor()]);
    }, SHUFFLE_INTERVAL_MS);

    setTimeout(() => {
      clearInterval(shuffleId);
      const result   = resolveRoll(secretForcedColor);
      const isTriple = result[0] === result[1] && result[1] === result[2];
      const winner   = dominantColor(result);

      setDice(result);
      setRolling(false);
      setRollCount(c => c + 1);

      if (isTriple) {
        setHistory(prev => [{
          id: ++rollIdRef.current, dice: result, winner, isTriple, time: nowHMS(),
        }, ...prev].slice(0, MAX_HISTORY));
      }
    }, ROLL_DURATION_MS);
  }, [rolling, secretForcedColor]);

  const isTriple = dice && dice[0] === dice[1] && dice[1] === dice[2];

  // ── Result text ──
  let resultText: React.ReactNode = null;
  if (rolling) {
    resultText = (
      <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#3182ce', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
        Rolling…
      </p>
    );
  } else if (isTriple && dice) {
    resultText = (
      <p style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: COLOR_CONFIG[dice[0]].hex, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        🎉 Triple {COLOR_CONFIG[dice[0]].label}!
      </p>
    );
  } else if (dice && rollCount > 0) {
    resultText = (
      <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#4a5568', letterSpacing: '0.06em' }}>
        {dice.map(c => COLOR_CONFIG[c].label).join('  ·  ')}
      </p>
    );
  }

  return (
    <>
      {/* Inject global styles + keyframes */}
      <style>{`
        *, *::before, *::after { box-sizing: border-box; }
        body { margin: 0; padding: 0; font-family: Arial, 'Helvetica Neue', sans-serif; }

        /* Dice roll shake */
        @keyframes diceShake {
          0%,100% { transform: rotate(0deg) scale(0.94); }
          25%      { transform: rotate(-6deg) scale(0.92); }
          75%      { transform: rotate(6deg) scale(0.96); }
        }

        /* Overlay bounce */
        @keyframes overlayBounce {
          0%,100% { transform: translateY(0) scale(1); }
          50%      { transform: translateY(-12px) scale(1.06); }
        }
        @keyframes overlayPulse {
          0%,100% { opacity: 0.4; transform: scale(0.85); }
          50%      { opacity: 1;   transform: scale(1.15); }
        }

        /* Scrollbar */
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #bfdbfe; border-radius: 4px; }

        /* Sidebar hide on mobile */
        .sidebar { display: none; }
        @media (min-width: 1024px) { .sidebar { display: block; } }

        /* Roll button press */
        #roll-btn:active:not(:disabled) { transform: translateY(3px); box-shadow: 0 1px 0 #92400e !important; }
      `}</style>

      {/* ── FINGERS CROSSED OVERLAY ──────────────────────────────────────────── */}
      <div
        aria-live="assertive"
        aria-label={rolling ? 'Rolling dice…' : undefined}
        style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '24px',
          background: 'rgba(24,90,178,0.88)',
          backdropFilter: 'blur(10px)',
          opacity: rolling ? 1 : 0,
          pointerEvents: rolling ? 'all' : 'none',
          transition: 'opacity 0.22s ease',
        }}
      >
        <p style={{ margin: 0, fontSize: '11px', fontWeight: 800, letterSpacing: '0.3em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.65)' }}>
          Rolling
        </p>
        <h2 style={{
          margin: 0, fontSize: 'clamp(28px, 6vw, 48px)', fontWeight: 900, textTransform: 'uppercase',
          letterSpacing: '0.07em', color: '#ffffff',
          textShadow: '0 2px 20px rgba(255,255,255,0.3)',
        }}>
          Fingers Crossed..
        </h2>

        {/* 3 bouncing white dice */}
        <div style={{ display: 'flex', gap: '16px' }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: '72px', height: '72px', borderRadius: '14px',
              background: 'rgba(255,255,255,0.15)',
              border: '3px solid rgba(255,255,255,0.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: `overlayBounce 0.65s ease-in-out ${i * 0.13}s infinite`,
            }}>
              <span style={{ display: 'block', width: '16px', height: '16px', borderRadius: '50%', background: 'white', opacity: 0.85 }} />
            </div>
          ))}
        </div>

        {/* pulsing dots */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {[0, 1, 2].map(i => (
            <span key={i} style={{
              display: 'block', width: '7px', height: '7px', borderRadius: '50%', background: 'white',
              animation: `overlayPulse 0.75s ease-in-out ${i * 0.2}s infinite`,
            }} />
          ))}
        </div>
      </div>

      {/* ── PAGE SHELL ───────────────────────────────────────────────────────── */}
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #4fc3f7 0%, #29b6f6 40%, #03a9f4 100%)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '24px 12px 40px',
        position: 'relative', overflow: 'hidden',
      }}>

        {/* Watermark dice pattern */}
        <div aria-hidden style={{
          position: 'absolute', inset: 0, opacity: 0.06, pointerEvents: 'none',
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Crect x='10' y='10' width='26' height='26' rx='5' fill='none' stroke='white' stroke-width='2.5'/%3E%3Ccircle cx='23' cy='23' r='3.5' fill='white'/%3E%3Crect x='44' y='44' width='26' height='26' rx='5' fill='none' stroke='white' stroke-width='2.5'/%3E%3Ccircle cx='52' cy='52' r='3' fill='white'/%3E%3Ccircle cx='62' cy='62' r='3' fill='white'/%3E%3C/svg%3E")`,
          backgroundSize: '80px 80px',
        }} />

        {/* ── 3-COL LAYOUT ─────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: '14px', width: '100%', maxWidth: '980px', position: 'relative', zIndex: 1, alignItems: 'flex-start' }}>

          {/* Left sidebar */}
          <div className="sidebar">
            <Sidebar links={DISCOVER_LEFT} />
          </div>

          {/* ── CENTER GAME CARD ───────────────────────────────────────────── */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0' }}>
            <div style={{
              backgroundColor: '#ffffff',
              borderRadius: '14px',
              border: '3px solid #29b6f6',
              boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
              overflow: 'hidden',
            }}>

              {/* ── Title ── */}
              <div style={{ padding: '18px 20px 14px', textAlign: 'center', borderBottom: '2px solid #e0f7fa' }}>
                <h1 style={{
                  margin: 0, fontSize: '22px', fontWeight: 900, textTransform: 'uppercase',
                  letterSpacing: '0.1em', color: '#0288d1',
                }}>
                  Roll Color Dice
                </h1>
              </div>

              {/* ── Selector row ── */}
              <div style={{
                display: 'flex', gap: '8px', padding: '10px 16px',
                background: '#f0f9ff', borderBottom: '1px solid #b3e5fc', flexWrap: 'wrap',
              }}>
                {[
                  { default: '3 Dice',    opts: ['1 Die', '2 Dice', '3 Dice', '4 Dice', '5 Dice', '6 Dice'] },
                  { default: 'Color Dice', opts: ['Color Dice', 'Number Dice', 'Custom Dice'] },
                  { default: 'No Bets',   opts: ['No Bets', 'With Bets'] },
                ].map((s, idx) => (
                  <select
                    key={idx}
                    defaultValue={s.default}
                    style={{
                      flex: '1 1 120px',
                      padding: '7px 10px',
                      border: '2px solid #29b6f6',
                      borderRadius: '8px',
                      background: 'white',
                      color: '#0277bd',
                      fontSize: '13px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      cursor: 'pointer',
                      outline: 'none',
                    }}
                  >
                    {s.opts.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ))}
              </div>

              {/* ── Dice area ── */}
              <div
                id="dice-area"
                aria-live="polite"
                aria-atomic="true"
                style={{
                  display: 'flex', justifyContent: 'center', alignItems: 'center',
                  gap: '20px', padding: '28px 20px 18px',
                  background: 'linear-gradient(180deg, #f0f9ff 0%, #ffffff 100%)',
                }}
              >
                {[0, 1, 2].map(i => (
                  <Die key={i} index={i} color={dice ? dice[i] : null} rolling={rolling} />
                ))}
              </div>

              {/* ── Result line ── */}
              <div style={{ minHeight: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', paddingBottom: '6px' }}>
                {resultText ?? (
                  <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    Press Roll to start
                  </p>
                )}
              </div>

              {/* ── Winner log ── */}
              <HistoryList entries={history} />

              {/* ── Roll button ── */}
              <div style={{ padding: '12px 16px 14px' }}>
                <button
                  id="roll-btn"
                  onClick={handleRoll}
                  disabled={rolling}
                  aria-busy={rolling}
                  style={{
                    display: 'block', width: '100%',
                    padding: '15px',
                    border: 'none', borderRadius: '10px',
                    background: rolling
                      ? 'linear-gradient(180deg, #fde68a 0%, #fcd34d 100%)'
                      : 'linear-gradient(180deg, #fde047 0%, #facc15 100%)',
                    color: '#78350f',
                    fontSize: '18px', fontWeight: 900,
                    textTransform: 'uppercase', letterSpacing: '0.12em',
                    cursor: rolling ? 'not-allowed' : 'pointer',
                    boxShadow: rolling
                      ? '0 2px 0 #b45309, 0 4px 12px rgba(234,179,8,0.25)'
                      : '0 5px 0 #b45309, 0 8px 20px rgba(234,179,8,0.35)',
                    transform: rolling ? 'translateY(3px)' : 'none',
                    transition: 'all 0.12s ease',
                    userSelect: 'none',
                  }}
                >
                  {rolling ? 'Rolling...' : rollCount === 0 ? '🎲  Roll !' : '🎲  Roll Again !'}
                </button>

                {rollCount > 0 && (
                  <p style={{ margin: '8px 0 0', textAlign: 'center', fontSize: '11px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                    {rollCount} {rollCount === 1 ? 'roll' : 'rolls'} total
                  </p>
                )}
              </div>

              {/* ── Possible colours strip ── */}
              <div style={{
                padding: '12px 16px',
                borderTop: '1px solid #e0f2fe',
                background: '#f8fbff',
                fontSize: '13px', color: '#475569', lineHeight: '1.6',
                textAlign: 'center',
              }}>
                <span style={{ fontWeight: 600 }}>Possible colors are: </span>
                {DICE_COLORS.map((c, i) => (
                  <span key={c}>
                    <span style={{ color: COLOR_TEXT[c], fontWeight: 700 }}>{COLOR_CONFIG[c].label}</span>
                    {i < DICE_COLORS.length - 1 ? (i === DICE_COLORS.length - 2 ? ' and ' : ', ') : '.'}
                  </span>
                ))}
              </div>

              {/* ── Change Theme dropdown ── */}
              <div style={{
                padding: '10px 16px 14px',
                borderTop: '1px solid #e0f2fe',
                background: '#f8fbff',
                display: 'flex', justifyContent: 'center',
              }}>
                <select style={{
                  padding: '6px 14px',
                  border: '2px solid #29b6f6',
                  borderRadius: '8px',
                  background: 'white',
                  color: '#0277bd',
                  fontSize: '12px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  cursor: 'pointer',
                }}>
                  <option>Change Theme</option>
                  <option>Classic Blue</option>
                  <option>Dark Mode</option>
                  <option>Neon</option>
                </select>
              </div>

            </div>{/* end white card */}
          </div>{/* end center column */}

          {/* Right sidebar */}
          <div className="sidebar">
            <Sidebar links={DISCOVER_RIGHT} />
          </div>

        </div>{/* end 3-col */}
      </div>{/* end page shell */}
    </>
  );
}
