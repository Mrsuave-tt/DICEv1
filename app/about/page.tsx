'use client';
import Link from 'next/link';
import { useTheme } from '@/app/context/ThemeContext';

export default function AboutPage() {
  const { isDark } = useTheme();

  return (
    <div className={`min-h-screen p-8 md:p-20 transition-colors duration-500 ${isDark ? 'bg-[#030305] text-white/80' : 'bg-slate-50 text-slate-800'}`}>
      <div className="max-w-3xl mx-auto pt-20">
        <Link href="/" className="inline-block mb-10 text-sm font-bold uppercase tracking-widest hover:text-purple-400 transition-colors">
          ← Back to Vault
        </Link>
        <h1 className="text-4xl md:text-5xl font-black uppercase tracking-[0.2em] mb-8 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-indigo-600">
          About The Vault
        </h1>
        <div className={`space-y-6 text-lg leading-relaxed ${isDark ? 'text-white/60' : 'text-slate-600'}`}>
          <p>Welcome to Mini Game Hub, the premier destination for high-end digital minigames and interactive live streaming experiences.</p>
          <p>Our platform was built from the ground up to provide broadcasters and content creators with an unparalleled level of polish. We pride ourselves on being <strong>completely free and open-source</strong>, ensuring that anyone can host a premium minigame experience without barriers.</p>
          <p>Whether you are running a high-stakes Color Clash tournament, a suspenseful High Dice battle, or a classic Prize Wheel raffle, our engine guarantees fast updates, seamless real-time syncing, and a visually stunning broadcast.</p>
        </div>
      </div>
    </div>
  );
}
