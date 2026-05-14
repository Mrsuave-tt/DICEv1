'use client';

import Link from 'next/link';
import { useTheme } from '@/app/context/ThemeContext';

const GAMES = [
  {
    href: '/dice',
    title: 'Color Dice',
    subtitle: 'Roll · Match · Win',
    emoji: '🎲',
    gradient: 'from-orange-500 via-red-500 to-pink-600',
    stats: '+24.5%',
    buttonText: 'PLAY NOW',
    badge: 'LIVE',
    badgeColor: 'bg-green-500/20 text-green-400 border border-green-500/30',
  },
  {
    href: '/clash',
    title: 'Color Clash',
    subtitle: 'Cinematic Stream Display',
    emoji: '⚔️',
    gradient: 'from-rose-500 to-orange-600',
    stats: '+15.2%',
    buttonText: 'PLAY NOW',
    badge: 'LIVE',
    badgeColor: 'bg-green-500/20 text-green-400 border border-green-500/30',
  },
  {
    href: '/wheel',
    title: 'Prize Wheel',
    subtitle: 'Spin · Dare · Claim',
    emoji: '🎡',
    gradient: 'from-blue-500 via-indigo-500 to-purple-600',
    stats: '+8.4%',
    buttonText: 'PLAY NOW',
    badge: 'SOON',
    badgeColor: 'bg-white/10 text-white/40 border border-white/10',
  },
  {
    href: '/highdice',
    title: 'High Dice',
    subtitle: 'Pure RNG Battle',
    emoji: '🎲',
    gradient: 'from-cyan-500 to-blue-600',
    stats: '+12.1%',
    buttonText: 'PLAY NOW',
    badge: 'BETA',
    badgeColor: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  }
];

export default function LobbyPage() {
  const { isDark } = useTheme();

  return (
    <div className={`relative flex min-h-screen flex-col overflow-hidden font-sans transition-colors duration-500 ${isDark ? 'bg-[#0f071a]' : 'bg-slate-50'}`}>

      {/* ── Background & Particles ── */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className={`absolute -top-40 -left-40 h-[600px] w-[600px] rounded-full blur-[120px] ${isDark ? 'bg-purple-900/30' : 'bg-purple-300/30'}`} />
        <div className={`absolute top-1/4 -right-40 h-[800px] w-[800px] rounded-full blur-[150px] ${isDark ? 'bg-indigo-900/20' : 'bg-indigo-300/20'}`} />
        <div className={`absolute -bottom-40 left-1/3 h-[500px] w-[500px] rounded-full blur-[100px] ${isDark ? 'bg-fuchsia-900/20' : 'bg-fuchsia-300/20'}`} />
        {/* Star-like dust */}
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at center, #ffffff 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
      </div>

      {/* ── Navbar ── */}
      <header className="relative z-10 flex items-center justify-between px-8 py-6 w-full max-w-7xl mx-auto">
        <div className={`text-sm font-bold tracking-[0.2em] uppercase ${isDark ? 'text-white' : 'text-slate-900'}`}>
          Mini Game Hub
        </div>
      </header>

      <main className="relative z-10 flex flex-col items-center px-4 pt-20 pb-32 flex-grow w-full max-w-7xl mx-auto">

        {/* ── Hero Section ── */}
        <div className="text-center max-w-3xl mb-24">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 backdrop-blur-md">
            <span className="h-1.5 w-1.5 rounded-full bg-purple-400 shadow-[0_0_8px_#c084fc]"></span>
            <span className={`text-[10px] font-bold uppercase tracking-[0.2em] ${isDark ? 'text-purple-200' : 'text-purple-800'}`}>
              Welcome to the Hub
            </span>
          </div>

          <h1 className="text-5xl sm:text-7xl font-black tracking-tight mb-6"
            style={{ color: isDark ? '#ffffff' : '#0f172a' }}>
            Ready to <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-400">Win?</span>
          </h1>

          <p className={`text-lg mb-10 max-w-xl mx-auto leading-relaxed ${isDark ? 'text-white/60' : 'text-slate-600'}`}>
            Experience the next generation of interactive minigames. Join millions of players worldwide in our highly curated gaming ecosystem.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button className="px-8 py-4 rounded-full bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-bold tracking-wide shadow-[0_0_30px_rgba(139,92,246,0.3)] hover:shadow-[0_0_40px_rgba(139,92,246,0.5)] hover:scale-105 transition-all duration-300 w-full sm:w-auto">
              Get Started Now
            </button>
          </div>
        </div>

        {/* ── Stats Section ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 w-full mb-24 py-10 border-y border-white/5">
          {[
            { label: 'Active Players', value: '1k' },
            { label: 'Games Played', value: '500+' },
            { label: 'Daily Winners', value: '50+' },
            { label: 'Free to Use', value: '100%' }
          ].map((stat, i) => (
            <div key={i} className="text-center">
              <div className={`text-3xl font-black mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>{stat.value}</div>
              <div className={`text-xs font-bold uppercase tracking-widest ${isDark ? 'text-white/40' : 'text-slate-500'}`}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* ── Games Grid ── */}
        <div className="w-full">
          <div className="flex items-center justify-between mb-8">
            <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Featured Games</h2>
            <button className={`text-sm font-semibold transition-colors ${isDark ? 'text-purple-400 hover:text-purple-300' : 'text-purple-600 hover:text-purple-500'}`}>View All →</button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {GAMES.map((g) => (
              <div key={g.href} className={`group relative flex flex-col rounded-[24px] border ${isDark ? 'border-white/[0.08] bg-white/[0.02]' : 'border-black/5 bg-white shadow-lg'} backdrop-blur-xl p-6 transition-all duration-300 hover:-translate-y-2 hover:border-purple-500/30`}>

                <div className="flex justify-between items-start mb-6">
                  <div className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br text-2xl shadow-lg ${g.gradient}`}>
                    {g.emoji}
                  </div>
                  <span className={`px-3 py-1 rounded-full text-[9px] font-black tracking-widest ${g.badgeColor}`}>
                    {g.badge}
                  </span>
                </div>

                <h3 className={`text-xl font-bold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>{g.title}</h3>
                <p className={`text-xs font-medium mb-6 ${isDark ? 'text-white/40' : 'text-slate-500'}`}>{g.subtitle}</p>

                <div className="mt-auto">
                  <div className={`flex justify-between items-center mb-4 text-sm font-semibold ${isDark ? 'text-white/60' : 'text-slate-600'}`}>
                    <span>Trending</span>
                    <span className="text-green-400">{g.stats}</span>
                  </div>
                  <Link href={g.href} className={`block w-full py-3 rounded-xl text-center text-xs font-bold tracking-widest transition-colors ${isDark ? 'bg-white/5 hover:bg-white/10 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-800'}`}>
                    {g.buttonText}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="relative z-10 w-full border-t border-white/5 bg-black/20 backdrop-blur-md py-10 mt-auto">
        <div className="max-w-7xl mx-auto px-8 flex flex-col md:flex-row items-center justify-between gap-6">

          <div className={`text-sm font-bold tracking-[0.2em] uppercase ${isDark ? 'text-white/50' : 'text-slate-400'}`}>
            Mini Game Hub
          </div>

          {/* Navigation Links */}
          <div className="flex flex-wrap justify-center gap-8">
            {['About', 'Games', 'Support', 'Privacy', 'Terms'].map((link) => (
              <Link
                key={link}
                href={`/${link.toLowerCase()}`}
                className={`group relative text-sm tracking-wide transition-all duration-300 ${isDark
                  ? 'text-white/50 hover:text-white'
                  : 'text-slate-500 hover:text-slate-900'
                  }`}
              >
                {/* Hover Dot Effect */}
                <span className={`absolute -top-3 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-white opacity-0 transition-all duration-300 group-hover:opacity-100 ${isDark ? 'shadow-[0_0_8px_white]' : 'bg-slate-900'}`} />
                {link}
              </Link>
            ))}
          </div>

          <div className={`text-xs ${isDark ? 'text-white/30' : 'text-slate-400'}`}>
            © 2026. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
