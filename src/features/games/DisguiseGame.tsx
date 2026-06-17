/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Trophy, Swords, Grid, Gamepad, Sparkles, User, Award, Shield, Timer, ChevronRight } from 'lucide-react';
import ChessGame from './ChessGame';
import SudokuGame from './SudokuGame';
import MahjongGame from './MahjongGame';
import OpenGamesExplorer from '../opengames/OpenGamesExplorer';

interface DisguiseGameProps {
  onSecretTrigger: () => void;
  isLightTheme?: boolean;
}

export default function DisguiseGame({ onSecretTrigger, isLightTheme = false }: DisguiseGameProps) {
  const [activeGame, setActiveGame] = useState<'mahjong' | 'chess' | 'sudoku' | 'opengames'>('mahjong');
  const [secretCounter, setSecretCounter] = useState(0);

  // Statistics State
  const [stats, setStats] = useState({
    mahjongBest: 0,
    sudokuBestTime: '--:--',
    chessWins: 0,
  });

  const loadStats = () => {
    try {
      const mBest = Number(localStorage.getItem('cyber_mahjong_best') || '0');
      const cWins = Number(localStorage.getItem('cyber_chess_wins') || '0');
      const sBestRaw = localStorage.getItem('cyber_sudoku_best_time');
      
      let sBestFormatted = '--:--';
      if (sBestRaw) {
        const secs = parseInt(sBestRaw);
        if (!isNaN(secs)) {
          const mins = Math.floor(secs / 60);
          const remainingSecs = secs % 60;
          sBestFormatted = `${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
        }
      }

      setStats({
        mahjongBest: mBest,
        sudokuBestTime: sBestFormatted,
        chessWins: cWins
      });
    } catch (e) {
      console.warn("Failed to load game stats:", e);
    }
  };

  useEffect(() => {
    loadStats();
    
    // Listen to custom stats update event
    window.addEventListener('cyber_game_stats_updated', loadStats);
    return () => {
      window.removeEventListener('cyber_game_stats_updated', loadStats);
    };
  }, []);

  // Handle tapping of the Trophy to unlock the backdoor
  const handleTrophyClick = () => {
    const clicks = secretCounter + 1;
    setSecretCounter(clicks);
    if (clicks >= 3) {
      setSecretCounter(0);
      onSecretTrigger(); // unlock back door
    }
  };

  const gameOptions = [
    {
      id: 'mahjong' as const,
      title: 'Mahjong Solitaire',
      tagline: 'Stack Clear Challenge',
      description: 'Clear the 3D block layout by matching identical free tiles.',
      icon: <Sparkles className="w-5 h-5 text-emerald-450 text-emerald-500" />,
      badge: 'Board Game',
      accentColor: 'from-emerald-500/10 to-teal-500/10 hover:border-emerald-500/30',
      activeBorder: 'border-emerald-500/60 shadow-emerald-500/10 ring-2 ring-emerald-500/15'
    },
    {
      id: 'chess' as const,
      title: 'Tactical Cyber Chess',
      tagline: 'MiniMax AI Handshake',
      description: 'Engage against the tactical heuristic chess engine in deep PvP/AI match.',
      icon: <Swords className="w-5 h-5 text-indigo-400 text-indigo-500" />,
      badge: 'Strategy',
      accentColor: 'from-indigo-500/10 to-blue-500/10 hover:border-indigo-500/30',
      activeBorder: 'border-indigo-500/60 shadow-indigo-500/10 ring-2 ring-indigo-500/15'
    },
    {
      id: 'sudoku' as const,
      title: 'Cryptic Sudoku',
      tagline: 'Grid Checksum Solver',
      description: 'Solve grid checksum integrity matrices with notes and hints support.',
      icon: <Grid className="w-5 h-5 text-violet-405 text-violet-500" />,
      badge: 'Logic',
      accentColor: 'from-violet-500/10 to-purple-500/10 hover:border-violet-500/30',
      activeBorder: 'border-violet-500/60 shadow-violet-500/10 ring-2 ring-violet-500/15'
    },
    {
      id: 'opengames' as const,
      title: 'OpenGames Explorer',
      tagline: '2000+ Open Source Games',
      description: 'Search, filter, and discover awesome open-source games with GitHub statistics.',
      icon: <Gamepad className="w-5 h-5 text-pink-500" />,
      badge: 'Explorer',
      accentColor: 'from-pink-500/10 to-rose-500/10 hover:border-pink-500/30',
      activeBorder: 'border-pink-500/60 shadow-pink-500/10 ring-2 ring-pink-500/15'
    }
  ];

  return (
    <div className="mx-auto w-full max-w-6xl transition-all duration-300">
      
      {/* Premium Dashboard Layout Grid */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        
        {/* Left Side: Game Selector and Statistics Console */}
        <div className="w-full lg:w-[320px] shrink-0 space-y-6">
          
          {/* Gamer Profile Card */}
          <div className={`border rounded-2xl p-5 shadow-xl transition-all relative overflow-hidden backdrop-blur-md ${
            isLightTheme 
              ? 'bg-white/80 border-slate-200 text-slate-800 shadow-slate-100/60' 
              : 'bg-[#182533]/80 border-[#1c2e3f]/60 text-white shadow-black/30'
          }`}>
            <div className={`absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl opacity-10 bg-indigo-500`} />
            
            <div className="flex items-center gap-3 relative z-10">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center border ${
                isLightTheme ? 'bg-indigo-50 border-indigo-150 text-indigo-600' : 'bg-indigo-950/40 border-[#1c2e3f] text-indigo-400'
              }`}>
                <User className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-mono font-bold text-slate-400 tracking-wider block">Operational Agent</span>
                <span className="text-sm font-black tracking-tight block">Security Node Client</span>
              </div>
            </div>

            {/* Statistics Row Widget */}
            <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-slate-200 dark:border-[#1c2e3f]/50">
              <div className="text-center">
                <span className="text-[7.5px] uppercase font-mono font-bold text-slate-400 tracking-wider block">Mahjong Best</span>
                <span className="text-xs font-black font-mono text-emerald-500 mt-0.5 block">{stats.mahjongBest}</span>
              </div>
              <div className="text-center border-x border-slate-200 dark:border-[#1c2e3f]/50">
                <span className="text-[7.5px] uppercase font-mono font-bold text-slate-400 tracking-wider block">Sudoku Best</span>
                <span className="text-xs font-black font-mono text-violet-500 mt-0.5 block">{stats.sudokuBestTime}</span>
              </div>
              <div className="text-center">
                <span className="text-[7.5px] uppercase font-mono font-bold text-slate-400 tracking-wider block">Chess Wins</span>
                <span className="text-xs font-black font-mono text-indigo-500 mt-0.5 block">{stats.chessWins}</span>
              </div>
            </div>
          </div>

          {/* Premium Game Selection Cards Grid */}
          <div className="space-y-3">
            <span className="text-[9px] uppercase font-mono font-black text-slate-400 tracking-widest pl-2">Select Active Module</span>
            
            {gameOptions.map((opt) => {
              const isActive = activeGame === opt.id;
              return (
                <div
                  key={opt.id}
                  onClick={() => setActiveGame(opt.id)}
                  className={`border rounded-2xl p-4 shadow-md transition-all duration-300 cursor-pointer relative overflow-hidden group hover:-translate-y-0.5 active:translate-y-0 backdrop-blur-sm ${
                    isActive
                      ? (isLightTheme 
                          ? `bg-white border-slate-300 shadow-slate-200 ${opt.activeBorder}` 
                          : `bg-[#1a2b3c] ${opt.activeBorder}`)
                      : (isLightTheme 
                          ? `bg-white/60 hover:bg-white border-slate-200 hover:shadow-slate-100 ${opt.accentColor}` 
                          : `bg-[#182533]/50 hover:bg-[#182533] border-[#101921]/60 ${opt.accentColor}`)
                  }`}
                >
                  {/* Glass Background Highlight */}
                  <div className={`absolute inset-0 bg-gradient-to-r opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${opt.accentColor}`} />
                  
                  <div className="flex gap-3 items-start relative z-10">
                    <div className={`p-2.5 rounded-xl border shrink-0 transition-transform duration-300 group-hover:scale-105 ${
                      isActive 
                        ? (isLightTheme ? 'bg-white border-slate-250' : 'bg-slate-900 border-[#1c2e3f]')
                        : (isLightTheme ? 'bg-slate-50 border-slate-150' : 'bg-[#101921]/50 border-[#1c2e3f]')
                    }`}>
                      {opt.icon}
                    </div>

                    <div className="flex-grow space-y-0.5">
                      <div className="flex items-center justify-between">
                        <span className={`text-[8px] font-mono font-bold tracking-wider uppercase px-1.5 py-0.5 rounded ${
                          isActive 
                            ? 'bg-indigo-600 text-white'
                            : (isLightTheme ? 'bg-slate-100 text-slate-500' : 'bg-[#101921] text-slate-400')
                        }`}>
                          {opt.badge}
                        </span>
                        
                        {isActive && (
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping" />
                        )}
                      </div>
                      <h4 className="text-xs font-black tracking-tight leading-snug">{opt.title}</h4>
                      <p className="text-[10px] text-slate-400 leading-normal line-clamp-2">{opt.description}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Secure Backdoor Access Gate Console */}
          <div className={`border rounded-2xl p-4.5 shadow-xl transition-all select-none backdrop-blur-md ${
            isLightTheme 
              ? 'bg-white/80 border-slate-205 text-slate-800' 
              : 'bg-[#182533]/80 border-[#101921] text-white'
          }`}>
            <div className="flex items-center justify-between border-b pb-2.5 border-slate-200 dark:border-[#101921]/60 mb-3">
              <div className="flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-indigo-500" />
                <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-slate-400">Tunnel Decryption</span>
              </div>
              <span className={`text-[8.5px] font-mono px-1.5 py-0.5 rounded font-black ${
                secretCounter > 0 
                  ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20 animate-pulse'
                  : (isLightTheme ? 'bg-slate-100 text-slate-400' : 'bg-[#101921] text-slate-500')
              }`}>
                {secretCounter > 0 ? `Bypass Signal ${secretCounter}/3` : 'SECURE GATE'}
              </span>
            </div>

            <p className="text-[9px] text-slate-450 font-mono leading-relaxed mb-3.5">
              Secure administrative gateway backdoor is active. Authenticated credentials override requires 3 bypass taps.
            </p>

            <button
              onClick={handleTrophyClick}
              className={`w-full flex items-center justify-center gap-2 border font-bold py-2 text-[10px] rounded-xl transition duration-200 active:scale-97 cursor-pointer select-none ${
                secretCounter > 0
                  ? 'bg-amber-600 hover:bg-amber-500 border-amber-500 text-white shadow-md shadow-amber-500/10'
                  : (isLightTheme 
                      ? 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700 shadow-sm' 
                      : 'bg-[#101921] hover:bg-[#182533] border-slate-800 text-slate-300 shadow-inner')
              }`}
            >
              <Trophy className={`w-3.5 h-3.5 ${secretCounter > 0 ? 'text-white fill-amber-200 animate-bounce' : 'text-yellow-500 fill-yellow-400'}`} />
              <span>{secretCounter > 0 ? `Trigger Bypass Node (${secretCounter}/3)` : 'Tap Decrypter Gate'}</span>
              <ChevronRight className="w-3 h-3 text-slate-500 ml-auto" />
            </button>
          </div>
        </div>

        {/* Right Side: Active Game Framed Canvas */}
        <div className="flex-grow w-full space-y-4">
          <div className={`p-1.5 rounded-3xl border shadow-inner overflow-visible ${
            isLightTheme
              ? 'bg-slate-50 border-slate-200'
              : 'bg-[#101921]/60 border-[#101921]'
          }`}>
            {/* RENDER CURRENTLY SELECTED SUBGAME */}

            {/* Game 1: Classic Mahjong Solitaire */}
            {activeGame === 'mahjong' && (
              <MahjongGame isLightTheme={isLightTheme} />
            )}

            {/* Game 2: Tactical Cyber Chess */}
            {activeGame === 'chess' && (
              <ChessGame isLightTheme={isLightTheme} />
            )}

            {/* Game 3: Cyber Cryptic Sudoku */}
            {activeGame === 'sudoku' && (
              <SudokuGame isLightTheme={isLightTheme} />
            )}

            {/* Game 4: OpenGames Explorer */}
            {activeGame === 'opengames' && (
              <OpenGamesExplorer isLightTheme={isLightTheme} />
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
