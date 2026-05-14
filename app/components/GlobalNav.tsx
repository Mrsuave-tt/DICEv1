'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useTheme } from '@/app/context/ThemeContext';
import ThemeToggle from './ThemeToggle';

export default function GlobalNav() {
  const pathname = usePathname();
  const { isDark } = useTheme();

  return (
    <>
      <ThemeToggle />
      
      {/* Show Lobby button on all pages except the homepage */}
      {pathname !== '/' && (
        <Link
          href="/"
          className={[
            'fixed left-5 top-5 z-[99999]',
            'flex items-center gap-2 rounded-full px-4 py-2',
            'border text-xs font-bold uppercase tracking-[0.2em] shadow-lg transition-all duration-200',
            'hover:scale-105 active:scale-95',
            isDark
              ? 'border-white/20 bg-white/10 text-white/80 backdrop-blur-md hover:bg-white/20 hover:text-white'
              : 'border-slate-300 bg-white text-slate-700 shadow-slate-200 hover:bg-slate-100 hover:text-slate-900',
          ].join(' ')}
        >
          <span className="text-sm">←</span>
          Lobby
        </Link>
      )}
    </>
  );
}
