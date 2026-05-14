'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useTheme } from '@/app/context/ThemeContext';
import { supabase } from '@/lib/supabaseClient';

const COLORS = ['Red', 'Orange', 'Yellow', 'Green', 'Blue', 'Purple'];

type ColorType = 'Red' | 'Orange' | 'Yellow' | 'Green' | 'Blue' | 'Purple' | 'Neutral';

const colorStyles: Record<ColorType, { bg: string; border: string; shadow: string; text: string; glow: string }> = {
  Red: { bg: 'bg-red-500', border: 'border-red-400', shadow: 'shadow-[0_0_100px_rgba(239,68,68,0.5)]', text: 'text-red-500', glow: 'bg-red-500/30' },
  Orange: { bg: 'bg-orange-500', border: 'border-orange-400', shadow: 'shadow-[0_0_100px_rgba(249,115,22,0.5)]', text: 'text-orange-500', glow: 'bg-orange-500/30' },
  Yellow: { bg: 'bg-yellow-500', border: 'border-yellow-400', shadow: 'shadow-[0_0_100px_rgba(234,179,8,0.5)]', text: 'text-yellow-500', glow: 'bg-yellow-500/30' },
  Green: { bg: 'bg-green-500', border: 'border-green-400', shadow: 'shadow-[0_0_100px_rgba(34,197,94,0.5)]', text: 'text-green-500', glow: 'bg-green-500/30' },
  Blue: { bg: 'bg-blue-500', border: 'border-blue-400', shadow: 'shadow-[0_0_100px_rgba(59,130,246,0.5)]', text: 'text-blue-500', glow: 'bg-blue-500/30' },
  Purple: { bg: 'bg-purple-500', border: 'border-purple-400', shadow: 'shadow-[0_0_100px_rgba(168,85,247,0.5)]', text: 'text-purple-500', glow: 'bg-purple-500/30' },
  Neutral: { bg: 'bg-white/5', border: 'border-white/10', shadow: 'shadow-none', text: 'text-white/20', glow: 'bg-white/5' }
};

export default function ColorClash() {
  const [leftColor, setLeftColor] = useState<ColorType>('Neutral');
  const [rightColor, setRightColor] = useState<ColorType>('Neutral');
  const [isRolling, setIsRolling] = useState(false);
  const { isDark } = useTheme();

  // Supabase state
  const [overrideLeft, setOverrideLeft] = useState<string>('Random');
  const [overrideRight, setOverrideRight] = useState<string>('Random');

  useEffect(() => {
    supabase.from('game_settings').select('clash_left_color, clash_right_color').eq('id', 1).single()
      .then(({ data, error }) => { 
        if (!error && data) {
          setOverrideLeft(data.clash_left_color ?? 'Random');
          setOverrideRight(data.clash_right_color ?? 'Random');
        }
      });

    const channel = supabase.channel('game-settings-clash')
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'game_settings', filter: 'id=eq.1' },
        (payload) => { 
          const newSettings = payload.new as { clash_left_color?: string, clash_right_color?: string };
          if (newSettings.clash_left_color) setOverrideLeft(newSettings.clash_left_color);
          if (newSettings.clash_right_color) setOverrideRight(newSettings.clash_right_color);
        })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const rollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const triggerRoll = useCallback(() => {
    if (isRolling) return;
    
    setIsRolling(true);

    let ticks = 0;
    const MAX_TICKS = 60; // 60 ticks * 50ms = 3000ms (3 seconds)

    rollIntervalRef.current = setInterval(() => {
      setLeftColor(COLORS[Math.floor(Math.random() * COLORS.length)] as ColorType);
      setRightColor(COLORS[Math.floor(Math.random() * COLORS.length)] as ColorType);
      
      ticks++;
      if (ticks >= MAX_TICKS) {
        if (rollIntervalRef.current) clearInterval(rollIntervalRef.current);
        
        // Final roll: check overrides
        let finalLeft = COLORS[Math.floor(Math.random() * COLORS.length)] as ColorType;
        if (overrideLeft.startsWith('avoid:')) {
          const avoidColor = overrideLeft.slice(6);
          do {
            finalLeft = COLORS[Math.floor(Math.random() * COLORS.length)] as ColorType;
          } while (finalLeft === avoidColor);
        } else if (overrideLeft !== 'Random' && COLORS.includes(overrideLeft)) {
          finalLeft = overrideLeft as ColorType;
        }

        let finalRight = COLORS[Math.floor(Math.random() * COLORS.length)] as ColorType;
        if (overrideRight.startsWith('avoid:')) {
          const avoidColor = overrideRight.slice(6);
          do {
            finalRight = COLORS[Math.floor(Math.random() * COLORS.length)] as ColorType;
          } while (finalRight === avoidColor);
        } else if (overrideRight !== 'Random' && COLORS.includes(overrideRight)) {
          finalRight = overrideRight as ColorType;
        }

        setLeftColor(finalLeft);
        setRightColor(finalRight);
        setIsRolling(false);
      }
    }, 50);

  }, [isRolling, overrideLeft, overrideRight]);

  return (
    <div className="relative flex min-h-screen flex-col bg-[#050508] bg-fixed font-sans overflow-hidden text-white">
      {/* Ambient Orbs */}
      <div className={`pointer-events-none absolute -left-64 -top-64 h-[800px] w-[800px] rounded-full blur-[150px] transition-colors duration-700 ${colorStyles[leftColor].glow}`} />
      <div className={`pointer-events-none absolute -bottom-64 -right-64 h-[800px] w-[800px] rounded-full blur-[150px] transition-colors duration-700 ${colorStyles[rightColor].glow}`} />

      {/* Header */}
      <header className="relative z-10 flex w-full items-center justify-between p-4 md:p-8">
        <h1 className="text-lg sm:text-xl md:text-2xl font-black uppercase tracking-[0.4em] text-white/80">
          Color Clash
        </h1>
        <Link href="/" className="rounded-full border border-white/10 bg-white/5 px-4 py-2 md:px-6 md:py-2.5 text-[10px] md:text-xs font-bold uppercase tracking-widest text-white/50 transition-all hover:bg-white/10 hover:text-white">
          ← Lobby
        </Link>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center gap-6 md:gap-16 px-2 py-4 md:px-4 md:py-8">
        
        {/* Possible Colors Pill */}
        <div className="flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-white/5 bg-white/[0.02] px-4 py-3 sm:px-8 sm:py-4 backdrop-blur-md max-w-[90%]">
          <span className="text-[9px] sm:text-xs font-black uppercase tracking-[0.2em] text-white/30 mr-1 sm:mr-3">Possible Colors:</span>
          {COLORS.map((c, i) => (
            <React.Fragment key={c}>
              <span className={`text-[10px] sm:text-xs font-black uppercase tracking-widest ${colorStyles[c as ColorType].text} drop-shadow-md`}>
                {c}
              </span>
              {i < COLORS.length - 1 && <span className="text-white/20 text-[10px]">,</span>}
            </React.Fragment>
          ))}
        </div>

        {/* The Arena (Center) */}
        <div className="flex flex-row items-start justify-center gap-3 sm:gap-8 md:gap-16 w-full max-w-5xl">
          
          {/* Left Die Container */}
          <div className="flex flex-col items-center gap-3 md:gap-8">
            <span className="text-xs sm:text-lg md:text-3xl leading-none font-black uppercase tracking-[0.3em] text-white/40 drop-shadow-md">
              LEFT
            </span>
            <div className={`flex h-28 w-28 sm:h-48 sm:w-48 md:h-96 md:w-96 shrink-0 flex-col items-center justify-center rounded-[2rem] md:rounded-[3rem] border-[3px] md:border-[6px] backdrop-blur-3xl transition-all duration-300 ${colorStyles[leftColor].bg} ${colorStyles[leftColor].border} ${colorStyles[leftColor].shadow} ${isRolling ? 'animate-pulse scale-95' : 'scale-100'}`}>
              {leftColor === 'Neutral' ? (
                <span className={`text-4xl sm:text-6xl md:text-9xl font-black uppercase tracking-widest ${colorStyles[leftColor].text} drop-shadow-2xl`}>
                  ?
                </span>
              ) : (
                <div className="h-8 w-8 sm:h-12 sm:w-12 md:h-24 md:w-24 rounded-full bg-white shadow-[0_0_40px_rgba(255,255,255,1)]" />
              )}
            </div>
            <span className={`text-base sm:text-3xl md:text-5xl leading-none font-black uppercase tracking-[0.2em] ${colorStyles[leftColor].text} drop-shadow-lg transition-opacity ${leftColor === 'Neutral' && !isRolling ? 'opacity-0' : 'opacity-100'}`}>
              {leftColor === 'Neutral' && !isRolling ? '...' : leftColor}
            </span>
          </div>

          {/* VS Divider perfectly aligned to centers of the dice squares */}
          <div className="flex h-10 w-10 sm:h-16 sm:w-16 md:h-24 md:w-24 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xs sm:text-xl md:text-2xl font-black text-white/30 backdrop-blur-md mt-[60px] sm:mt-[94px] md:mt-[206px]">
            VS
          </div>

          {/* Right Die Container */}
          <div className="flex flex-col items-center gap-3 md:gap-8">
            <span className="text-xs sm:text-lg md:text-3xl leading-none font-black uppercase tracking-[0.3em] text-white/40 drop-shadow-md">
              RIGHT
            </span>
            <div className={`flex h-28 w-28 sm:h-48 sm:w-48 md:h-96 md:w-96 shrink-0 flex-col items-center justify-center rounded-[2rem] md:rounded-[3rem] border-[3px] md:border-[6px] backdrop-blur-3xl transition-all duration-300 ${colorStyles[rightColor].bg} ${colorStyles[rightColor].border} ${colorStyles[rightColor].shadow} ${isRolling ? 'animate-pulse scale-95' : 'scale-100'}`}>
              {rightColor === 'Neutral' ? (
                <span className={`text-4xl sm:text-6xl md:text-9xl font-black uppercase tracking-widest ${colorStyles[rightColor].text} drop-shadow-2xl`}>
                  ?
                </span>
              ) : (
                <div className="h-8 w-8 sm:h-12 sm:w-12 md:h-24 md:w-24 rounded-full bg-white shadow-[0_0_40px_rgba(255,255,255,1)]" />
              )}
            </div>
            <span className={`text-base sm:text-3xl md:text-5xl leading-none font-black uppercase tracking-[0.2em] ${colorStyles[rightColor].text} drop-shadow-lg transition-opacity ${rightColor === 'Neutral' && !isRolling ? 'opacity-0' : 'opacity-100'}`}>
              {rightColor === 'Neutral' && !isRolling ? '...' : rightColor}
            </span>
          </div>

        </div>

        {/* Result Readout */}
        <div className="flex min-h-[60px] md:min-h-[100px] flex-col items-center justify-center text-center">
          {isRolling ? (
            <p className="text-xl sm:text-3xl md:text-5xl font-black uppercase tracking-[0.3em] text-white/30 animate-pulse">
              Clashing...
            </p>
          ) : (
            leftColor !== 'Neutral' && rightColor !== 'Neutral' && (
              leftColor === rightColor ? (
                <p className={`text-2xl sm:text-5xl md:text-7xl font-black uppercase tracking-[0.1em] ${colorStyles[leftColor].text} drop-shadow-[0_0_30px_currentColor] animate-bounce`}>
                  🎉 DOUBLE {leftColor}! 🎉
                </p>
              ) : (
                <div className="h-4 md:h-8" />
              )
            )
          )}
        </div>

        {/* Control Panel (Bottom) */}
        <button
          onClick={triggerRoll}
          disabled={isRolling}
          className={`group relative overflow-hidden rounded-2xl border-2 px-8 py-5 sm:px-12 sm:py-6 md:px-16 md:py-8 transition-all duration-300 ${
            isRolling 
              ? 'border-white/10 bg-white/5 cursor-not-allowed' 
              : 'border-indigo-500/50 bg-indigo-500/20 hover:scale-105 hover:bg-indigo-500/30 hover:shadow-[0_0_60px_rgba(99,102,241,0.4)]'
          }`}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:animate-[shimmer_1.5s_infinite]" />
          <span className={`relative text-lg sm:text-2xl md:text-4xl font-black uppercase tracking-[0.2em] ${isRolling ? 'text-white/30' : 'text-indigo-100 drop-shadow-lg'}`}>
            {isRolling ? 'Rolling...' : '🎲 Shuffle & Roll'}
          </span>
        </button>

      </main>
    </div>
  );
}
