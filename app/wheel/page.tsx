'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import Link from 'next/link';
import confetti from 'canvas-confetti';
import { useTheme } from '@/app/context/ThemeContext';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabaseClient';

// ── Types ──────────────────────────────────────────────────────────────────────
interface Participant { id: number; name: string; }
interface Prize { id: number; name: string; totalQty: number; remainingQty: number; }
interface Winner { id: number; participantName: string; prizeName: string; timestamp: string; }
type DrawState = 'idle' | 'shuffling' | 'winner';

let _pid = 0, _prizeid = 0, _winid = 0;
function nowHMS() { return new Date().toLocaleTimeString('en-US', { hour12: false }); }
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

function fireConfetti() {
  const burst = (angle: number, origin: { x: number; y: number }) =>
    confetti({ particleCount: 120, spread: 80, angle, origin, colors: ['#6366f1', '#a855f7', '#ec4899', '#f59e0b', '#10b981', '#38bdf8'] });
  burst(60, { x: 0, y: 0.6 });
  burst(120, { x: 1, y: 0.6 });
  setTimeout(() => confetti({ particleCount: 80, spread: 120, origin: { x: 0.5, y: 0.4 } }), 300);
}

export default function WheelPage() {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [activePrize, setActivePrize] = useState<Prize | null>(null);
  const [winners, setWinners] = useState<Winner[]>([]);
  const [drawState, setDrawState] = useState<DrawState>('idle');
  const [currentDisplay, setCurrentDisplay] = useState('');
  const [isFullscreenDraw, setIsFullscreenDraw] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [singleName, setSingleName] = useState('');
  const [prizeName, setPrizeName] = useState('');
  const [prizeQty, setPrizeQty] = useState('1');
  const [customBg, setCustomBg] = useState<string | null>(null);
  const [winnerScale, setWinnerScale] = useState(false);
  const [editingPrize, setEditingPrize] = useState<Prize | null>(null);
  const [drawCount, setDrawCount] = useState(1);
  const [currentDrawIndex, setCurrentDrawIndex] = useState(0);
  const [totalDraws, setTotalDraws] = useState(0);
  const [isDrawing, setIsDrawing] = useState(false);
  const [raffleOverrideQueue, setRaffleOverrideQueue] = useState<string[]>([]);
  const { isDark } = useTheme();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sync participants to Supabase (One-Way Sync)
  useEffect(() => {
    const names = participants.map(p => p.name);
    fetch('/api/admin/sync-raffle-participants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participants: names }),
    }).catch(err => console.error('Failed to sync participants', err));
  }, [participants]);

  // Listen for override changes
  useEffect(() => {
    const channel = supabase.channel('game-settings-raffle')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'game_settings', filter: 'id=eq.1' },
        (payload) => {
          if (payload.new.raffle_override !== undefined) {
            try {
              const parsed = JSON.parse(payload.new.raffle_override ?? '[]');
              setRaffleOverrideQueue(Array.isArray(parsed) ? parsed : (payload.new.raffle_override && payload.new.raffle_override !== 'Random' ? [payload.new.raffle_override] : []));
            } catch {
              setRaffleOverrideQueue(payload.new.raffle_override && payload.new.raffle_override !== 'Random' ? [payload.new.raffle_override] : []);
            }
          }
        }
      )
      .subscribe();
    
    // Initial fetch
    supabase.from('game_settings').select('raffle_override').eq('id', 1).single().then(({ data }) => {
      if (data?.raffle_override) {
        try {
          const parsed = JSON.parse(data.raffle_override);
          setRaffleOverrideQueue(Array.isArray(parsed) ? parsed : (data.raffle_override !== 'Random' ? [data.raffle_override] : []));
        } catch {
          setRaffleOverrideQueue(data.raffle_override !== 'Random' ? [data.raffle_override] : []);
        }
      }
    });

    return () => { supabase.removeChannel(channel); };
  }, []);
  const fileRef = useRef<HTMLInputElement>(null);
  const excelImportRef = useRef<HTMLInputElement>(null);

  const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

  // ── Theme ──
  const th = {
    root: isDark ? 'bg-[#07070a] text-white' : 'bg-slate-100 text-slate-900',
    aside: isDark ? 'bg-white/[0.025] border-white/10' : 'bg-white/90 border-slate-200',
    main: isDark ? '' : 'bg-slate-50/60',
    divider: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
    input: isDark ? 'border-white/10 bg-white/[0.04] text-white/70 placeholder-white/20'
      : 'border-slate-200 bg-white text-slate-700 placeholder-slate-400',
    label: isDark ? 'text-white/35' : 'text-slate-400',
    itemRow: isDark ? 'hover:bg-white/[0.04]' : 'hover:bg-slate-100',
    itemText: isDark ? 'text-white/60' : 'text-slate-600',
    panelBorder: isDark ? 'border-white/[0.07] bg-white/[0.02]' : 'border-slate-200 bg-white',
    subtleText: isDark ? 'text-white/20' : 'text-slate-400',
    orb1: isDark ? 'bg-blue-700/15' : 'bg-blue-300/20',
    orb2: isDark ? 'bg-purple-800/15' : 'bg-purple-300/20',
    btnSecondary: isDark ? 'border-white/10 bg-white/[0.05] text-white/50 hover:bg-white/10 hover:text-white'
      : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-100 hover:text-slate-800',
    badge: isDark ? 'bg-indigo-500/20 text-indigo-300' : 'bg-indigo-100 text-indigo-600',
    listPanel: isDark ? 'border-white/5 bg-white/[0.02]' : 'border-slate-200 bg-white',
    winnerPanel: isDark ? 'border-yellow-400/25 bg-yellow-400/[0.07]' : 'border-yellow-400/50 bg-yellow-50',
    winnerText: isDark ? 'text-white/75' : 'text-slate-800',
    emptySlot: isDark ? 'border-white/10' : 'border-slate-300',
    emptyText: isDark ? 'text-white/12' : 'text-slate-400',
    lobbyLink: isDark ? 'border-white/10 bg-white/5 text-white/40 hover:border-white/25 hover:text-white'
      : 'border-slate-200 bg-slate-100 text-slate-400 hover:border-slate-400 hover:text-slate-800',
  };

  // Close fullscreen on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') closeFullscreen(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  function closeFullscreen() {
    if (isDrawing) return; // Prevent closing while in loop
    if (intervalRef.current) clearInterval(intervalRef.current);
    setIsFullscreenDraw(false);
    setDrawState('idle');
    setCurrentDisplay('');
    setWinnerScale(false);
  }

  // ── Participants ──
  function handleAddSingle() {
    const name = singleName.trim();
    if (!name) return;
    setParticipants(prev => {
      if (prev.some(p => p.name.toLowerCase() === name.toLowerCase())) return prev;
      return [...prev, { id: ++_pid, name }];
    });
    setSingleName('');
  }

  function handleBulkAdd() {
    const names = nameInput.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
    setParticipants(prev => {
      const existing = new Set(prev.map(p => p.name.toLowerCase()));
      const unique = names.filter(n => !existing.has(n.toLowerCase()));
      return [...prev, ...unique.map(name => ({ id: ++_pid, name }))];
    });
    setNameInput('');
  }

  function handleRemoveParticipant(id: number) { setParticipants(p => p.filter(x => x.id !== id)); }

  // ── Prizes ──
  function handleAddPrize() {
    if (!prizeName.trim()) return;
    const qty = Math.max(1, parseInt(prizeQty) || 1);
    if (editingPrize) {
      const drawn = editingPrize.totalQty - editingPrize.remainingQty;
      const updated: Prize = { ...editingPrize, name: prizeName.trim(), totalQty: qty, remainingQty: Math.max(0, qty - drawn) };
      setPrizes(p => p.map(pr => pr.id === editingPrize.id ? updated : pr));
      if (activePrize?.id === editingPrize.id) setActivePrize(updated);
      setEditingPrize(null);
    } else {
      const np: Prize = { id: ++_prizeid, name: prizeName.trim(), totalQty: qty, remainingQty: qty };
      setPrizes(p => [...p, np]);
      if (!activePrize) setActivePrize(np);
    }
    setPrizeName(''); setPrizeQty('1');
  }

  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        
        const newNames: string[] = [];
        rawData.forEach(row => {
          row.forEach(cell => {
            if (typeof cell === 'string' && cell.trim().length > 0) {
              newNames.push(cell.trim());
            } else if (typeof cell === 'number') {
              newNames.push(String(cell));
            }
          });
        });

        const uniqueNames = [...new Set(newNames)];
        let addedCount = 0;
        
        setParticipants(prev => {
          const updated = [...prev];
          const existingSet = new Set(prev.map(p => p.name.toLowerCase()));
          
          uniqueNames.forEach(name => {
            if (!existingSet.has(name.toLowerCase())) {
              updated.push({ id: ++_pid, name });
              existingSet.add(name.toLowerCase());
              addedCount++;
            }
          });
          return updated;
        });
        
        alert(`Successfully imported ${addedCount} participants!`);
      } catch (err) {
        console.error(err);
        alert('Failed to read Excel file. Please try another file.');
      }
      
      if (excelImportRef.current) {
        excelImportRef.current.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleExportWinners = () => {
    if (winners.length === 0) {
      alert('No winners to export.');
      return;
    }

    const exportData = winners.map(w => ({
      Name: w.participantName,
      Prize: w.prizeName,
      Time: w.timestamp,
      Date: new Date().toLocaleDateString()
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Winners');
    
    XLSX.writeFile(workbook, 'Raffle_Winners.xlsx');
  };

  // ── Draw Engine ──
  const triggerDraw = useCallback(async (count = 1) => {
    if (participants.length === 0) { alert('Add participants first.'); return; }
    if (!activePrize || activePrize.remainingQty <= 0) { alert('Select a prize with remaining slots.'); return; }

    const actualCount = Math.min(count, activePrize.remainingQty, participants.length);
    if (actualCount <= 0) return;

    setIsFullscreenDraw(true);
    setIsDrawing(true);
    setTotalDraws(actualCount);

    let currentParticipants = [...participants];

    for (let i = 1; i <= actualCount; i++) {
      setCurrentDrawIndex(i);
      setDrawState('shuffling');
      setWinnerScale(false);
      setCurrentDisplay('');

      intervalRef.current = setInterval(() => {
        if (currentParticipants.length > 0) {
          setCurrentDisplay(pick(currentParticipants).name);
        }
      }, 50);

      await delay(2500);
      if (intervalRef.current) clearInterval(intervalRef.current);

      let winnerIdx = Math.floor(Math.random() * currentParticipants.length);
      
      // Override Queue Logic
      if (raffleOverrideQueue.length > 0) {
        // Pop the first rigged winner from the queue
        const nextWinnerName = raffleOverrideQueue[0];
        
        const overrideIdx = currentParticipants.findIndex(p => p.name.toLowerCase() === nextWinnerName.toLowerCase());
        if (overrideIdx !== -1) {
          winnerIdx = overrideIdx;
        }
        
        // Remove it from our local queue state
        const remainingQueue = raffleOverrideQueue.slice(1);
        setRaffleOverrideQueue(remainingQueue);
        
        // Update Supabase so the admin dashboard queue also shrinks in real-time
        fetch('/api/admin/set-raffle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ winnerName: JSON.stringify(remainingQueue) }),
        }).catch(err => console.error('Failed to update raffle override queue', err));
      }

      const winner = currentParticipants[winnerIdx];
      
      // Remove ALL instances of this winner's name from the local draw pool
      currentParticipants = currentParticipants.filter(p => p.name.toLowerCase() !== winner.name.toLowerCase());
      
      const now = nowHMS();
      const winnerRecord: Winner = { id: ++_winid, participantName: winner.name, prizeName: activePrize.name, timestamp: now };

      // Update React State immediately to remove ALL instances of this name from the global pool
      setParticipants(prev => prev.filter(p => p.name.toLowerCase() !== winner.name.toLowerCase()));
      setPrizes(prev => prev.map(p => p.id === activePrize.id ? { ...p, remainingQty: p.remainingQty - 1 } : p));
      setActivePrize(prev => prev ? { ...prev, remainingQty: prev.remainingQty - 1 } : null);
      setWinners(prev => [winnerRecord, ...prev]);

      setCurrentDisplay(winner.name);
      setDrawState('winner');
      setWinnerScale(true);
      fireConfetti();

      if (i < actualCount) {
        await delay(3000); // Pause so audience can read name
      }
    }

    setIsDrawing(false);
  }, [participants, activePrize]);

  const activePrizeWinners = winners.filter(w => w.prizeName === activePrize?.name);

  const bgStyle: React.CSSProperties = customBg
    ? { backgroundImage: `url(${customBg})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }
    : { background: 'linear-gradient(135deg,#06030f 0%,#0d0b1f 50%,#07070a 100%)', backgroundAttachment: 'fixed' };

  return (
    <div className={`relative flex min-h-screen flex-col bg-[#07070a] transition-colors duration-300 ${th.root}`}>
      {/* Ambient orbs */}
      <div aria-hidden className={`pointer-events-none absolute -left-48 -top-48 h-[500px] w-[500px] rounded-full blur-[150px] transition-colors duration-500 ${th.orb1}`} />
      <div aria-hidden className={`pointer-events-none absolute -bottom-48 -right-48 h-[500px] w-[500px] rounded-full blur-[150px] transition-colors duration-500 ${th.orb2}`} />

      <style>{`
        @keyframes shuffle { from{opacity:0;transform:translateY(-10px) scale(0.95)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes winPop  { 0%{transform:scale(1)} 50%{transform:scale(1.08)} 100%{transform:scale(1.04)} }
        .shuffle-anim { animation: shuffle 0.06s ease both; }
        .win-anim     { animation: winPop 0.6s cubic-bezier(0.34,1.56,0.64,1) both; }
      `}</style>

      {/* ── FULLSCREEN DRAW OVERLAY ────────────────────────────────────────── */}
      {isFullscreenDraw && (
        <div className="fixed inset-0 z-[9999] flex h-screen w-screen flex-col items-center justify-start overflow-y-auto bg-[#07070a] pb-12 pt-12 md:pt-24" style={bgStyle}>
          {/* Dark overlay */}
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-black/55 backdrop-blur-sm" />

          {/* Close button */}
          {!isDrawing && (
            <button onClick={closeFullscreen}
              className="absolute right-6 top-6 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 text-xl text-white/70 transition-all hover:bg-white/20 hover:text-white">
              ✕
            </button>
          )}

          {/* Status label (Winner text) */}
          {drawState === 'winner' && (
            <p className="relative z-10 mb-8 text-4xl font-black uppercase leading-tight tracking-[0.3em] text-white/90 drop-shadow-lg md:mb-12 md:text-6xl">
              🎉 Winner!
            </p>
          )}
          {drawState === 'shuffling' && (
            <p className="relative z-10 mb-8 text-[11px] font-black uppercase tracking-[0.6em] text-white/30 md:mb-12">
              Picking Winner…
            </p>
          )}

          {/* Giant name display */}
          <div className="relative z-10 mb-12 flex min-h-[180px] items-center justify-center px-8 text-center md:mb-16">
            {drawState === 'shuffling' && currentDisplay && (
              <h2 key={currentDisplay}
                className="shuffle-anim bg-clip-text text-[clamp(3.5rem,12vw,9rem)] font-black leading-tight tracking-tight text-transparent drop-shadow-2xl"
                style={{ backgroundImage: 'linear-gradient(135deg,#f8fafc 0%,#a78bfa 40%,#ec4899 70%,#f59e0b 100%)' }}>
                {currentDisplay}
              </h2>
            )}
            {drawState === 'winner' && currentDisplay && (
              <h2
                className={['bg-clip-text text-[clamp(3.5rem,12vw,9rem)] font-black leading-tight tracking-tight text-transparent drop-shadow-2xl', winnerScale ? 'win-anim' : ''].join(' ')}
                style={{ backgroundImage: 'linear-gradient(135deg,#fbbf24 0%,#f59e0b 30%,#ec4899 65%,#a855f7 100%)' }}>
                {currentDisplay}
              </h2>
            )}
            {drawState === 'shuffling' && !currentDisplay && (
              <div className="flex gap-3">
                {[0, 1, 2].map(i => <span key={i} className="block h-4 w-4 animate-ping rounded-full bg-indigo-400/60" style={{ animationDelay: `${i * 0.15}s` }} />)}
              </div>
            )}
          </div>

          {/* Draw again / close row */}
          {drawState === 'winner' && !isDrawing && (
            <div className="relative z-10 mb-12 flex flex-row items-center justify-center gap-4">
              {activePrize && activePrize.remainingQty > 0 && participants.length > 0 && (
                <button onClick={() => { setDrawState('idle'); setCurrentDisplay(''); setWinnerScale(false); setTimeout(() => triggerDraw(1), 80); }}
                  className="rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 px-8 py-4 text-sm font-black uppercase tracking-[0.3em] text-white shadow-[0_0_30px_rgba(99,102,241,0.4)] transition-all hover:scale-105 hover:brightness-110">
                  🎯 Draw Next Winner
                </button>
              )}
              <button onClick={closeFullscreen}
                className="rounded-2xl border border-white/15 bg-white/[0.06] px-8 py-4 text-sm font-black uppercase tracking-[0.3em] text-white/60 transition-all hover:bg-white/10 hover:text-white">
                Done
              </button>
            </div>
          )}

          {/* Vertical Winner List */}
          {activePrizeWinners.length > 0 && (
            <div className="relative z-10 flex w-full max-w-xl flex-col items-center gap-4 px-6">
              {activePrizeWinners.map(w => (
                <div key={w.id} className="flex w-full items-center justify-center rounded-2xl border border-white/20 bg-white/10 px-8 py-4 shadow-xl backdrop-blur-md">
                  <span className="text-3xl font-bold tracking-wide text-white">{w.participantName}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── MAIN SPLIT LAYOUT ─────────────────────────────────────────────── */}
      <div className="relative z-10 flex w-full flex-col lg:flex-row">

        {/* LEFT — Admin Panel */}
        <aside className={`flex w-full flex-col gap-5 border-b p-6 backdrop-blur-2xl lg:w-[38%] lg:min-h-screen lg:overflow-y-auto lg:border-b-0 lg:border-r transition-colors duration-300 ${th.aside}`}>

          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.4em] text-purple-400/50">Mini-Game Hub</p>
              <h1 className="text-xl font-black uppercase tracking-[0.12em]">Raffle Engine</h1>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/" className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-all ${th.lobbyLink}`}>
                ← Lobby
              </Link>
            </div>
          </div>

          <div className="h-px" style={{ background: `linear-gradient(90deg,transparent,${th.divider},transparent)` }} />

          {/* Add Participants */}
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className={`text-[10px] font-black uppercase tracking-[0.3em] ${th.label}`}>Add Participants</p>
              <span className={`rounded-full px-2 py-0.5 text-[9px] font-black ${th.badge}`}>{participants.length} loaded</span>
            </div>

            {/* Single add */}
            <div className="flex gap-2">
              <input value={singleName} onChange={e => setSingleName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddSingle()}
                placeholder="Type a name…"
                className={`flex-1 rounded-xl border px-3 py-2.5 text-[12px] outline-none focus:border-indigo-500/50 ${th.input}`} />
              <button onClick={handleAddSingle}
                className="rounded-xl bg-indigo-600/80 px-4 py-2.5 text-[11px] font-black text-white transition-all hover:bg-indigo-500">
                Add
              </button>
            </div>

            {/* Bulk add */}
            <textarea value={nameInput} onChange={e => setNameInput(e.target.value)}
              placeholder="Bulk add: comma or newline separated…"
              rows={3}
              className={`w-full resize-none rounded-xl border px-3 py-2.5 text-[12px] outline-none focus:border-indigo-500/50 ${th.input}`} />
            <div className="flex gap-2">
              <button onClick={handleBulkAdd}
                className={`flex-1 rounded-xl border py-2.5 text-[11px] font-black uppercase tracking-[0.15em] transition-all ${th.btnSecondary}`}>
                + Bulk Add
              </button>
              <button onClick={() => excelImportRef.current?.click()}
                className={`flex-1 rounded-xl border py-2.5 text-[11px] font-black uppercase tracking-[0.15em] transition-all border-emerald-500/30 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 dark:border-emerald-500/30 dark:text-emerald-400`}>
                📁 Import Excel
              </button>
              <input ref={excelImportRef} type="file" accept=".xlsx, .xls, .csv" className="hidden" onChange={handleExcelImport} />
            </div>

            {/* Participant list */}
            {participants.length > 0 && (
              <ul className={`flex max-h-48 flex-col gap-1 overflow-y-auto rounded-xl border p-2 [&::-webkit-scrollbar]:w-[3px] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/10 ${th.listPanel}`}>
                {participants.map(p => (
                  <li key={p.id} className={`group flex items-center justify-between rounded-lg px-3 py-1.5 transition-all ${th.itemRow}`}>
                    <span className={`text-[11px] ${th.itemText}`}>{p.name}</span>
                    <button onClick={() => handleRemoveParticipant(p.id)}
                      className="text-[10px] text-white/15 opacity-0 transition-all group-hover:opacity-100 hover:text-red-400">✕</button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="h-px" style={{ background: `linear-gradient(90deg,transparent,${th.divider},transparent)` }} />

          {/* Create / Edit Prize */}
          <section className="flex flex-col gap-3">
            <p className={`text-[10px] font-black uppercase tracking-[0.3em] ${th.label}`}>
              {editingPrize ? '✏️ Edit Prize' : 'Create Prize'}
            </p>
            <div className="flex gap-2">
              <input value={prizeName} onChange={e => setPrizeName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddPrize()}
                placeholder="Prize name…"
                className={`flex-1 rounded-xl border px-3 py-2.5 text-[12px] outline-none focus:border-indigo-500/50 ${th.input}`} />
              <input value={prizeQty} onChange={e => setPrizeQty(e.target.value)}
                type="number" min={1} placeholder="Qty"
                className={`w-16 rounded-xl border px-3 py-2.5 text-center text-[12px] outline-none focus:border-indigo-500/50 ${th.input}`} />
            </div>
            <div className="flex gap-2">
              <button onClick={handleAddPrize}
                className={`flex-1 rounded-xl border py-2.5 text-[11px] font-black uppercase tracking-[0.15em] transition-all ${editingPrize ? 'border-indigo-500/40 bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30' : th.btnSecondary}`}>
                {editingPrize ? '✓ Update Prize' : '+ Create Prize'}
              </button>
              {editingPrize && (
                <button onClick={() => { setEditingPrize(null); setPrizeName(''); setPrizeQty('1'); }}
                  className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-[11px] font-black uppercase tracking-widest text-red-400 transition-all hover:bg-red-500/20">
                  ✕
                </button>
              )}
            </div>

            {prizes.length > 0 && (
              <ul className="flex flex-col gap-1.5">
                {prizes.map(p => {
                  const isActive = activePrize?.id === p.id;
                  return (
                    <li key={p.id}
                      className={['flex cursor-pointer items-center justify-between rounded-xl border px-3 py-2.5 transition-all',
                        isActive ? 'border-indigo-500/40 bg-indigo-500/10' : `${th.panelBorder} hover:border-indigo-500/20`].join(' ')}>
                      <div className="flex flex-1 items-center gap-2" onClick={() => setActivePrize(p)}>
                        {isActive && <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />}
                        <span className={`text-[11px] font-semibold ${th.itemText}`}>🎁 {p.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-black text-indigo-300/70">{p.remainingQty}/{p.totalQty} left</span>
                        <button
                          onClick={e => { e.stopPropagation(); setEditingPrize(p); setPrizeName(p.name); setPrizeQty(String(p.totalQty)); }}
                          className="rounded-lg border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white/40 transition-all hover:border-indigo-500/40 hover:bg-indigo-500/10 hover:text-indigo-300">
                          ✏️
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <div className="h-px" style={{ background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.06),transparent)' }} />

          {/* Background upload */}
          <section className="flex flex-col gap-2">
            <p className={`text-[10px] font-black uppercase tracking-[0.3em] ${th.label}`}>Draw Background</p>
            <button onClick={() => fileRef.current?.click()}
              className={`rounded-xl border border-dashed py-2.5 text-[11px] font-bold uppercase tracking-[0.15em] transition-all ${isDark ? 'border-white/15 bg-white/[0.03] text-white/40 hover:border-white/25 hover:text-white' : 'border-slate-300 bg-white text-slate-400 hover:border-slate-400 hover:text-slate-700'}`}>
              🖼️ Upload Image
            </button>
            {customBg && (
              <button onClick={() => setCustomBg(null)}
                className="rounded-xl border border-red-500/20 bg-red-500/10 py-2 text-[10px] font-bold uppercase tracking-widest text-red-400 transition-all hover:bg-red-500/20">
                ✕ Remove Background
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = ev => setCustomBg(ev.target?.result as string); r.readAsDataURL(f); }} />
          </section>
        </aside>

        {/* RIGHT — Preview & Draw */}
        <main className="relative flex flex-1 flex-col items-center justify-between gap-6 p-8 lg:min-h-screen lg:overflow-y-auto">

          {/* Preview panel */}
          <div className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
            style={{ ...bgStyle, minHeight: '280px' }}>
            <div aria-hidden className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />

            <div className="relative z-10 flex h-full min-h-[280px] flex-col items-center justify-center gap-6 p-8 text-center">
              <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-white/40">
                {activePrize ? `Drawing for: ${activePrize.name}` : 'No prize selected'}
              </p>
              <h2 className="text-2xl font-black uppercase tracking-[0.15em] text-white/80 drop-shadow-lg">
                {participants.length > 0 ? 'Ready to draw a winner?' : 'Add participants to begin'}
              </h2>
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/30">
                {participants.length} participant{participants.length !== 1 ? 's' : ''} · {activePrize ? `${activePrize.remainingQty} slot${activePrize.remainingQty !== 1 ? 's' : ''} left` : 'No prize'}
              </p>

              {/* Buttons */}
              <div className="flex flex-col items-center justify-center gap-3">
                <button onClick={() => triggerDraw(1)}
                  disabled={participants.length === 0 || !activePrize || activePrize.remainingQty <= 0}
                  className={['w-full max-w-[280px] rounded-2xl px-7 py-3.5 text-[12px] font-black uppercase tracking-[0.25em] text-white transition-all duration-200',
                    'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600',
                    participants.length === 0 || !activePrize || activePrize.remainingQty <= 0
                      ? 'cursor-not-allowed opacity-30'
                      : 'hover:scale-105 hover:brightness-110 hover:shadow-[0_0_40px_rgba(99,102,241,0.5)] active:scale-[0.98]'].join(' ')}>
                  🎯 Pick One Winner
                </button>
                
                {/* Custom Bulk Draw Input */}
                {activePrize && activePrize.remainingQty > 1 && participants.length > 1 && (
                  <div className="flex w-full max-w-[280px] items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={Math.min(activePrize.remainingQty, participants.length)}
                      value={drawCount}
                      onChange={e => setDrawCount(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-16 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-center text-[12px] font-bold text-white outline-none focus:border-indigo-500/50"
                    />
                    <button onClick={() => triggerDraw(drawCount)}
                      disabled={drawCount > activePrize.remainingQty || drawCount > participants.length}
                      className={['flex-1 rounded-xl border border-purple-500/30 bg-purple-500/10 px-4 py-3 text-[12px] font-black uppercase tracking-[0.15em] text-purple-300 transition-all',
                        drawCount > activePrize.remainingQty || drawCount > participants.length ? 'cursor-not-allowed opacity-30' : 'hover:scale-105 hover:bg-purple-500/20'].join(' ')}>
                      ⚡ Draw {drawCount}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Winner Slots */}
          {activePrize && (
            <div className="w-full max-w-xl">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/25">
                  {activePrize.name} — Slots
                </p>
                <span className="text-[9px] text-white/20">{activePrizeWinners.length}/{activePrize.totalQty}</span>
              </div>
              <div className={`grid gap-2 ${activePrize.totalQty <= 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3 sm:grid-cols-5'}`}>
                {Array.from({ length: activePrize.totalQty }, (_, i) => {
                  const w = activePrizeWinners[i];
                  return w ? (
                    <div key={i} className="flex flex-col items-center gap-1 rounded-2xl border border-yellow-400/25 bg-yellow-400/[0.07] p-3 text-center">
                      <span className="text-lg">🏆</span>
                      <p className="text-[10px] font-bold leading-tight text-white/75 break-all">{w.participantName}</p>
                      <p className="text-[8px] text-white/20">{w.timestamp}</p>
                    </div>
                  ) : (
                    <div key={i} className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-white/10 p-3 text-center">
                      <span className="text-lg opacity-15">🎁</span>
                      <p className="text-[9px] uppercase tracking-wide text-white/12">Awaiting</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* All-session winners log */}
          {winners.length > 0 && (
            <div className="w-full max-w-xl">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20">Session Winners</p>
                <button onClick={handleExportWinners} className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.1em] text-emerald-400 transition-all hover:bg-emerald-500/20">
                  📥 Download Excel
                </button>
              </div>
              <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3 backdrop-blur-md">
                <ul className="flex max-h-44 flex-col gap-1.5 overflow-y-auto [&::-webkit-scrollbar]:w-[3px] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/10">
                  {winners.map((w, i) => (
                    <li key={w.id} className={['flex items-center justify-between rounded-xl px-3 py-2',
                      i === 0 ? 'border border-white/10 bg-white/[0.05]' : 'bg-transparent'].join(' ')}>
                      <div className="flex items-center gap-2">
                        <span>{i === 0 ? '🥇' : '·'}</span>
                        <div>
                          <p className="text-[11px] font-bold text-white/75">{w.participantName}</p>
                          <p className="text-[9px] text-indigo-300/50">{w.prizeName}</p>
                        </div>
                      </div>
                      <span className="text-[9px] text-white/20">{w.timestamp}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
