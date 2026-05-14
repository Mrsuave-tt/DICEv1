'use client';
import Link from 'next/link';
import { useTheme } from '@/app/context/ThemeContext';

export default function GamesPage() {
  const { isDark } = useTheme();

  return (
    <div className={`min-h-screen p-8 md:p-20 transition-colors duration-500 ${isDark ? 'bg-[#030305] text-white/80' : 'bg-slate-50 text-slate-800'}`}>
      <div className="max-w-3xl mx-auto pt-20">
        <Link href="/" className="inline-block mb-10 text-sm font-bold uppercase tracking-widest hover:text-rose-400 transition-colors">
          ← Back to Vault
        </Link>
        <h1 className="text-4xl md:text-5xl font-black uppercase tracking-[0.2em] mb-8 bg-clip-text text-transparent bg-gradient-to-r from-rose-400 to-orange-600">
          Our Games
        </h1>
        <div className={`space-y-6 text-lg leading-relaxed ${isDark ? 'text-white/60' : 'text-slate-600'}`}>
          <p>The Vault Engine offers a growing suite of premium interactive experiences.</p>
          
          <div className="grid gap-6 mt-12">
            <Link href="/clash" className="p-6 rounded-2xl border border-rose-500/30 bg-rose-500/5 hover:bg-rose-500/10 transition-colors">
              <h3 className="text-xl font-bold mb-2 text-rose-400 uppercase tracking-wider">Color Clash</h3>
              <p className="text-sm">Our flagship cinematic stream display. Pit players against each other in a visually stunning color war.</p>
            </Link>

            <Link href="/wheel" className="p-6 rounded-2xl border border-purple-500/30 bg-purple-500/5 hover:bg-purple-500/10 transition-colors">
              <h3 className="text-xl font-bold mb-2 text-purple-400 uppercase tracking-wider">Prize Wheel</h3>
              <p className="text-sm">The classic raffle experience elevated with glassmorphism, confetti physics, and real-time God-Mode admin controls.</p>
            </Link>

            <Link href="/highdice" className="p-6 rounded-2xl border border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 transition-colors">
              <h3 className="text-xl font-bold mb-2 text-blue-400 uppercase tracking-wider">High Dice</h3>
              <p className="text-sm">A pure RNG battle. Roll the highest number to win the jackpot.</p>
            </Link>

            <Link href="/dice" className="p-6 rounded-2xl border border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 transition-colors">
              <h3 className="text-xl font-bold mb-2 text-amber-400 uppercase tracking-wider">Color Dice</h3>
              <p className="text-sm">Roll the dice and match the colors to win multipliers.</p>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
