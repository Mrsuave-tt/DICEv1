'use client';

import { useTheme } from '@/app/context/ThemeContext';

export default function ThemeToggle() {
  const { isDark, toggle } = useTheme();

  return (
    <button
      id="theme-toggle"
      onClick={toggle}
      title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      className={[
        'fixed right-5 top-5 z-[99999]',
        'flex h-10 w-10 items-center justify-center rounded-full',
        'border text-base shadow-lg transition-all duration-200',
        'hover:scale-110 active:scale-95',
        isDark
          ? 'border-white/20 bg-white/10 backdrop-blur-md hover:bg-white/20'
          : 'border-slate-300 bg-white shadow-slate-200 hover:bg-slate-100',
      ].join(' ')}
    >
      {isDark ? '☀️' : '🌙'}
    </button>
  );
}
