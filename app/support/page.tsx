'use client';
import Link from 'next/link';
import { useTheme } from '@/app/context/ThemeContext';

export default function SupportPage() {
  const { isDark } = useTheme();

  return (
    <div className={`min-h-screen p-8 md:p-20 transition-colors duration-500 ${isDark ? 'bg-[#030305] text-white/80' : 'bg-slate-50 text-slate-800'}`}>
      <div className="max-w-3xl mx-auto pt-20">
        <Link href="/" className="inline-block mb-10 text-sm font-bold uppercase tracking-widest hover:text-blue-400 transition-colors">
          ← Back to Vault
        </Link>
        <h1 className="text-4xl md:text-5xl font-black uppercase tracking-[0.2em] mb-8 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-600">
          VIP Support
        </h1>
        <div className={`space-y-6 text-lg leading-relaxed ${isDark ? 'text-white/60' : 'text-slate-600'}`}>
          <p>Need assistance with your Vault deployment? Our support team is here to help.</p>
          
          <div className="mt-8 p-6 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl">
            <h3 className="text-xl font-bold mb-4 text-white">Contact Us</h3>
            <p className="mb-2">Email: <a href="mailto:support@minigamehub.com" className="text-blue-400 hover:underline">support@minigamehub.com</a></p>
            <p>Response Time: Typically within 24 hours.</p>
          </div>

          <h3 className="text-2xl font-bold mt-12 mb-4 text-white">FAQ</h3>
          <ul className="space-y-4 list-disc pl-5">
            <li><strong>How do I add participants to a game?</strong><br/>Use the bulk add feature on any game page to instantly sync players into the active pool.</li>
            <li><strong>Are results truly random?</strong><br/>Yes, the engine uses secure RNG for all fair-play rolls and spins, ensuring your live streams are trustworthy.</li>
            <li><strong>Is the platform really free?</strong><br/>Yes, the Mini Game Hub is open-source and 100% free for content creators to use on their streams.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
