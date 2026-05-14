'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

const DiceFace = ({ number, isRolling, glowColor }: { number: number, isRolling: boolean, glowColor: string }) => {
  // Mapping 1-6 to a 3x3 grid (9 cells)
  // 0 1 2
  // 3 4 5
  // 6 7 8
  const pipMaps: Record<number, number[]> = {
    1: [4],
    2: [2, 6],
    3: [2, 4, 6],
    4: [0, 2, 6, 8],
    5: [0, 2, 4, 6, 8],
    6: [0, 3, 6, 2, 5, 8],
  };

  const activePips = pipMaps[number] || [4];

  return (
    <div 
      className={`relative grid grid-cols-3 grid-rows-3 gap-3 sm:gap-6 md:gap-8 p-6 sm:p-10 md:p-16 w-full h-full rounded-3xl border border-white/20 bg-white/5 backdrop-blur-xl transition-all duration-300 shadow-[inset_0_0_50px_rgba(255,255,255,0.05)] ${isRolling ? 'animate-dice-shake scale-95 opacity-80' : 'scale-100 opacity-100'}`}
      style={{ boxShadow: `0 0 80px ${glowColor}, inset 0 0 50px rgba(255,255,255,0.05)` }}
    >
      {[...Array(9)].map((_, i) => (
        <div key={i} className="flex items-center justify-center">
          {activePips.includes(i) && (
            <div className="w-8 h-8 sm:w-12 sm:h-12 md:w-16 md:h-16 rounded-full bg-white shadow-[0_0_40px_rgba(255,255,255,1)]" />
          )}
        </div>
      ))}
    </div>
  );
};

export default function HighDiceBattle() {
  const [leftNum, setLeftNum] = useState<number>(6);
  const [rightNum, setRightNum] = useState<number>(6);
  const [isRolling, setIsRolling] = useState(false);
  
  const [targetLeft, setTargetLeft] = useState<string>('Random');
  const [targetRight, setTargetRight] = useState<string>('Random');

  useEffect(() => {
    // Initial fetch
    supabase.from('game_settings').select('high_dice_left, high_dice_right').eq('id', 1).single()
      .then(({ data, error }) => {
        if (!error && data) {
          setTargetLeft(data.high_dice_left ?? 'Random');
          setTargetRight(data.high_dice_right ?? 'Random');
        }
      });

    // Realtime subscription
    const channel = supabase.channel('game-settings-highdice')
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'game_settings', filter: 'id=eq.1' },
        (payload) => {
          const newSettings = payload.new as { high_dice_left?: string, high_dice_right?: string };
          if (newSettings.high_dice_left) setTargetLeft(newSettings.high_dice_left);
          if (newSettings.high_dice_right) setTargetRight(newSettings.high_dice_right);
        })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const rollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const triggerRoll = useCallback(() => {
    if (isRolling) return;
    
    setIsRolling(true);

    let ticks = 0;
    const MAX_TICKS = 60; // 3 seconds at 50ms intervals

    rollIntervalRef.current = setInterval(() => {
      setLeftNum(Math.floor(Math.random() * 6) + 1);
      setRightNum(Math.floor(Math.random() * 6) + 1);
      
      ticks++;
      if (ticks >= MAX_TICKS) {
        if (rollIntervalRef.current) clearInterval(rollIntervalRef.current);
        
        // Final Roll
        let finalLeft = Math.floor(Math.random() * 6) + 1;
        if (targetLeft.startsWith('avoid:')) {
          const avoidNum = parseInt(targetLeft.split(':')[1], 10);
          do {
            finalLeft = Math.floor(Math.random() * 6) + 1;
          } while (finalLeft === avoidNum);
        } else if (targetLeft !== 'Random') {
          finalLeft = parseInt(targetLeft, 10);
        }

        let finalRight = Math.floor(Math.random() * 6) + 1;
        if (targetRight.startsWith('avoid:')) {
          const avoidNum = parseInt(targetRight.split(':')[1], 10);
          do {
            finalRight = Math.floor(Math.random() * 6) + 1;
          } while (finalRight === avoidNum);
        } else if (targetRight !== 'Random') {
          finalRight = parseInt(targetRight, 10);
        }

        setLeftNum(isNaN(finalLeft) ? (Math.floor(Math.random() * 6) + 1) : finalLeft);
        setRightNum(isNaN(finalRight) ? (Math.floor(Math.random() * 6) + 1) : finalRight);
        
        setIsRolling(false);
      }
    }, 50);
  }, [isRolling, targetLeft, targetRight]);

  const leftWins = leftNum > rightNum;
  const rightWins = rightNum > leftNum;
  const isTie = leftNum === rightNum;

  return (
    <div className="relative flex min-h-screen flex-col bg-[#050508] bg-fixed font-sans overflow-hidden text-white">
      <style>{`
        @keyframes dice-shake {
          0% { transform: translate(1px, 1px) rotate(0deg); }
          10% { transform: translate(-1px, -2px) rotate(-1deg); }
          20% { transform: translate(-3px, 0px) rotate(1deg); }
          30% { transform: translate(3px, 2px) rotate(0deg); }
          40% { transform: translate(1px, -1px) rotate(1deg); }
          50% { transform: translate(-1px, 2px) rotate(-1deg); }
          60% { transform: translate(-3px, 1px) rotate(0deg); }
          70% { transform: translate(3px, 1px) rotate(-1deg); }
          80% { transform: translate(-1px, -1px) rotate(1deg); }
          90% { transform: translate(1px, 2px) rotate(0deg); }
          100% { transform: translate(1px, -2px) rotate(-1deg); }
        }
        .animate-dice-shake {
          animation: dice-shake 0.3s infinite;
        }
      `}</style>

      {/* Ambient Orbs */}
      <div className="pointer-events-none absolute -left-64 -top-64 h-[800px] w-[800px] rounded-full blur-[150px] transition-colors duration-700 bg-blue-500/20" />
      <div className="pointer-events-none absolute -bottom-64 -right-64 h-[800px] w-[800px] rounded-full blur-[150px] transition-colors duration-700 bg-red-500/20" />

      {/* Header */}
      <header className="relative z-10 flex w-full items-center justify-between p-4 md:p-8">
        <h1 className="text-lg sm:text-xl md:text-2xl font-black uppercase tracking-[0.4em] text-white/80">
          High Dice Battle
        </h1>
        <Link href="/" className="rounded-full border border-white/10 bg-white/5 px-4 py-2 md:px-6 md:py-2.5 text-[10px] md:text-xs font-bold uppercase tracking-widest text-white/50 transition-all hover:bg-white/10 hover:text-white">
          ← Lobby
        </Link>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center gap-10 md:gap-16 px-4 py-8">
        
        {/* The Arena */}
        <div className="flex flex-row items-center justify-center gap-8 md:gap-24 w-full max-w-5xl">
          
          {/* Left Die */}
          <div className="flex flex-col items-center gap-6">
            <span className="text-sm sm:text-xl md:text-3xl font-black uppercase tracking-[0.3em] text-blue-400 drop-shadow-[0_0_15px_rgba(96,165,250,0.5)]">
              LEFT
            </span>
            <div className="w-40 h-40 sm:w-64 sm:h-64 md:w-96 md:h-96 shrink-0">
              <DiceFace number={leftNum} isRolling={isRolling} glowColor="rgba(59,130,246,0.15)" />
            </div>
          </div>

          {/* VS Divider */}
          <div className="flex h-12 w-12 sm:h-20 sm:w-20 md:h-28 md:w-28 shrink-0 items-center justify-center rounded-full border-2 border-white/20 bg-white/10 text-sm sm:text-2xl md:text-3xl font-black text-white/50 backdrop-blur-md shadow-[0_0_50px_rgba(255,255,255,0.1)]">
            VS
          </div>

          {/* Right Die */}
          <div className="flex flex-col items-center gap-6">
            <span className="text-sm sm:text-xl md:text-3xl font-black uppercase tracking-[0.3em] text-red-400 drop-shadow-[0_0_15px_rgba(248,113,113,0.5)]">
              RIGHT
            </span>
            <div className="w-40 h-40 sm:w-64 sm:h-64 md:w-96 md:h-96 shrink-0">
              <DiceFace number={rightNum} isRolling={isRolling} glowColor="rgba(239,68,68,0.15)" />
            </div>
          </div>

        </div>

        {/* Result Readout */}
        <div className="flex min-h-[60px] md:min-h-[100px] flex-col items-center justify-center text-center">
          {isRolling ? (
            <p className="text-2xl sm:text-4xl md:text-6xl font-black uppercase tracking-[0.3em] text-white/30 animate-pulse">
              Rolling...
            </p>
          ) : (
            leftWins ? (
              <p className="text-3xl sm:text-5xl md:text-7xl font-black uppercase tracking-[0.2em] text-blue-400 drop-shadow-[0_0_40px_rgba(59,130,246,0.8)] animate-bounce">
                🔥 LEFT WINS! 🔥
              </p>
            ) : rightWins ? (
              <p className="text-3xl sm:text-5xl md:text-7xl font-black uppercase tracking-[0.2em] text-red-400 drop-shadow-[0_0_40px_rgba(239,68,68,0.8)] animate-bounce">
                🔥 RIGHT WINS! 🔥
              </p>
            ) : isTie ? (
              <p className="text-3xl sm:text-5xl md:text-7xl font-black uppercase tracking-[0.2em] text-yellow-400 drop-shadow-[0_0_40px_rgba(234,179,8,0.8)] animate-pulse">
                ⚔️ TIE! ⚔️
              </p>
            ) : null
          )}
        </div>

        {/* Control Panel */}
        <button
          onClick={triggerRoll}
          disabled={isRolling}
          className={`mt-4 group relative overflow-hidden rounded-[2rem] border-[3px] px-10 py-6 sm:px-16 sm:py-8 md:px-24 md:py-10 transition-all duration-300 ${
            isRolling 
              ? 'border-white/10 bg-white/5 cursor-not-allowed opacity-50' 
              : 'border-white/30 bg-white/10 hover:scale-105 hover:bg-white/20 hover:border-white/50 shadow-[0_0_50px_rgba(255,255,255,0.1)] hover:shadow-[0_0_80px_rgba(255,255,255,0.3)]'
          }`}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:animate-[shimmer_1.5s_infinite]" />
          <span className={`relative text-xl sm:text-3xl md:text-5xl font-black uppercase tracking-[0.2em] ${isRolling ? 'text-white/30' : 'text-white drop-shadow-lg'}`}>
            {isRolling ? 'Rolling...' : '🎲 ROLL DICE'}
          </span>
        </button>

      </main>
    </div>
  );
}
