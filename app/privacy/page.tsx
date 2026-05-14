'use client';
import Link from 'next/link';
import { useTheme } from '@/app/context/ThemeContext';

export default function PrivacyPage() {
  const { isDark } = useTheme();

  return (
    <div className={`min-h-screen p-8 md:p-20 transition-colors duration-500 ${isDark ? 'bg-[#030305] text-white/80' : 'bg-slate-50 text-slate-800'}`}>
      <div className="max-w-3xl mx-auto pt-20">
        <Link href="/" className="inline-block mb-10 text-sm font-bold uppercase tracking-widest hover:text-emerald-400 transition-colors">
          ← Back to Vault
        </Link>
        <h1 className="text-4xl md:text-5xl font-black uppercase tracking-[0.2em] mb-8 bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-teal-600">
          Privacy Policy
        </h1>
        <div className={`space-y-6 text-lg leading-relaxed ${isDark ? 'text-white/60' : 'text-slate-600'}`}>
          <p>Last Updated: May 14, 2026</p>
          
          <h3 className="text-2xl font-bold text-white mt-8">1. Information We Collect</h3>
          <p>We believe in privacy first. Our platform collects absolutely minimal data necessary to run the live stream minigames. This includes the list of participants entered during active sessions and basic game settings. We do not track, store, or sell any personal identifiable information.</p>
          
          <h3 className="text-2xl font-bold text-white mt-8">2. Free & Open Source</h3>
          <p>Mini Game Hub is designed to be the ultimate free, open-source tool for live streamers. We believe that engaging your audience shouldn't require expensive subscriptions or hidden fees. Our platform is completely free to use, and we encourage the community to contribute and help us make it even better.</p>
          
          <h3 className="text-2xl font-bold text-white mt-8">3. Fast Updates & Performance</h3>
          <p>The core of our engine is built for speed. Data such as raffle participants is stored securely in our real-time database strictly for the duration of the broadcast. Everything is processed with lightning-fast updates, ensuring your live stream never drops a frame and the results are instant.</p>
        </div>
      </div>
    </div>
  );
}
