/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { RefreshCw, RotateCcw, Lightbulb, Grid, Sparkles, AlertCircle, HelpCircle, ArrowLeft, Trophy, CheckCircle } from 'lucide-react';

interface TileDefinition {
  typeId: string;
  symbol: string;
  name: string;
  category: 'dragon' | 'wind' | 'bamboo' | 'dot' | 'character' | 'season';
  colorClass: string;
}

// 16 different tiles, 4 copies each = 64 total tiles
const TILE_SET_DEFINITIONS: TileDefinition[] = [
  { typeId: 'dragon-red', symbol: '中', name: 'Red Dragon', category: 'dragon', colorClass: 'text-rose-600 shadow-rose-100' },
  { typeId: 'dragon-green', symbol: '發', name: 'Green Dragon', category: 'dragon', colorClass: 'text-emerald-700 shadow-emerald-100' },
  { typeId: 'dragon-white', symbol: '白', name: 'White Dragon', category: 'dragon', colorClass: 'text-slate-600 border-slate-300' },
  { typeId: 'wind-east', symbol: '東', name: 'East Wind', category: 'wind', colorClass: 'text-indigo-700 shadow-indigo-100' },
  { typeId: 'wind-south', symbol: '南', name: 'South Wind', category: 'wind', colorClass: 'text-amber-700 shadow-amber-100' },
  { typeId: 'wind-west', symbol: '西', name: 'West Wind', category: 'wind', colorClass: 'text-orange-700 shadow-orange-100' },
  { typeId: 'wind-north', symbol: '北', name: 'North Wind', category: 'wind', colorClass: 'text-teal-700 shadow-teal-100' },
  { typeId: 'bamboo-1', symbol: '竹', name: 'Bamboo 1', category: 'bamboo', colorClass: 'text-emerald-600' },
  { typeId: 'bamboo-2', symbol: '双', name: 'Bamboo 2', category: 'bamboo', colorClass: 'text-green-600' },
  { typeId: 'dot-1', symbol: '餅', name: 'Dot 1', category: 'dot', colorClass: 'text-cyan-700' },
  { typeId: 'dot-2', symbol: '玉', name: 'Dot 2', category: 'dot', colorClass: 'text-blue-700' },
  { typeId: 'char-1', symbol: '萬', name: 'Char 1', category: 'character', colorClass: 'text-red-700' },
  { typeId: 'char-2', symbol: '金', name: 'Char 2', category: 'character', colorClass: 'text-amber-800' },
  { typeId: 'season-sp', symbol: '春', name: 'Spring', category: 'season', colorClass: 'text-pink-600' },
  { typeId: 'season-su', symbol: '夏', name: 'Summer', category: 'season', colorClass: 'text-yellow-600' },
  { typeId: 'season-au', symbol: '秋', name: 'Autumn', category: 'season', colorClass: 'text-sky-600' }
];

interface PlayTile {
  id: string;
  typeId: string;
  x: number;
  y: number;
  z: number;
  matched: boolean;
}

interface MahjongGameProps {
  isLightTheme?: boolean;
}

export default function MahjongGame({ isLightTheme = false }: MahjongGameProps) {
  const [tiles, setTiles] = useState<PlayTile[]>([]);
  const [boardScale, setBoardScale] = useState(1);
  const [tileZoomFactor, setTileZoomFactor] = useState<number>(1.0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.clientWidth;
        const targetWidth = 512; // Stable fixed scale base width
        let baseScale = 1;
        if (containerWidth > 0 && containerWidth < targetWidth) {
          baseScale = containerWidth / targetWidth;
        }
        setBoardScale(baseScale * tileZoomFactor);
      }
    };

    handleResize();
    const resizeObserver = new ResizeObserver(() => handleResize());
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [tileZoomFactor]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [score, setScore] = useState<number>(0);
  const [moveHistory, setMoveHistory] = useState<{ t1: PlayTile; t2: PlayTile }[]>([]);
  const [highlightedIds, setHighlightedIds] = useState<string[]>([]);
  const [bestScore, setBestScore] = useState<number>(() => {
    try {
      return Number(localStorage.getItem('cyber_mahjong_best') || '0');
    } catch {
      return 0;
    }
  });

  const [gameState, setGameState] = useState<'playing' | 'victory' | 'blocked'>('playing');
  const [feedbackMessage, setFeedbackMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Generate layouts symmetrically
  const generateLayoutCoordinates = (): { x: number; y: number; z: number }[] => {
    const coords: { x: number; y: number; z: number }[] = [];

    // Level 0 (Bottom Layer, z=0): 40 slots
    // Row 1 (y = 1): x 1 to 6 (6 slots)
    for (let x = 1; x <= 6; x++) coords.push({ x, y: 1, z: 0 });
    // Row 2 (y = 2): x 1 to 6 (6 slots)
    for (let x = 1; x <= 6; x++) coords.push({ x, y: 2, z: 0 });
    // Row 3 (y = 3): x 0 to 7 (8 slots)
    for (let x = 0; x <= 7; x++) coords.push({ x, y: 3, z: 0 });
    // Row 4 (y = 4): x 0 to 7 (8 slots)
    for (let x = 0; x <= 7; x++) coords.push({ x, y: 4, z: 0 });
    // Row 5 (y = 5): x 1 to 6 (6 slots)
    for (let x = 1; x <= 6; x++) coords.push({ x, y: 5, z: 0 });
    // Row 6 (y = 6): x 1 to 6 (6 slots)
    for (let x = 1; x <= 6; x++) coords.push({ x, y: 6, z: 0 });

    // Level 1 (z=1): 16 slots
    for (let y = 2; y <= 5; y++) {
      for (let x = 2; x <= 5; x++) {
        coords.push({ x, y, z: 1 });
      }
    }

    // Level 2 (z=2): 4 slots (centered)
    coords.push({ x: 3, y: 3, z: 2 });
    coords.push({ x: 4, y: 3, z: 2 });
    coords.push({ x: 3, y: 4, z: 2 });
    coords.push({ x: 4, y: 4, z: 2 });

    // Level 3 (Top Layer, z=3): 4 slots (centered)
    coords.push({ x: 3, y: 3, z: 3 });
    coords.push({ x: 4, y: 3, z: 3 });
    coords.push({ x: 3, y: 4, z: 3 });
    coords.push({ x: 4, y: 4, z: 3 });

    return coords;
  };

  // Check if tile is free based on simple 3D overlap and block rule
  const isTileFree = useCallback((tileId: string, currentTiles: PlayTile[]): boolean => {
    const target = currentTiles.find(t => t.id === tileId);
    if (!target || target.matched) return false;

    // 1. Any unmatched tile resting directly above it
    const onTop = currentTiles.some(
      other => !other.matched && other.x === target.x && other.y === target.y && other.z > target.z
    );
    if (onTop) return false;

    // 2. Blocked on left and right on the same level
    const hasLeftBlock = currentTiles.some(
      other => !other.matched && other.z === target.z && other.y === target.y && other.x === target.x - 1
    );
    const hasRightBlock = currentTiles.some(
      other => !other.matched && other.z === target.z && other.y === target.y && other.x === target.x + 1
    );

    return !hasLeftBlock || !hasRightBlock;
  }, []);

  // Check whether matching moves are possible on current tiles state
  const checkAvailableMoves = useCallback((currentTiles: PlayTile[]): boolean => {
    const activeTiles = currentTiles.filter(t => !t.matched);
    if (activeTiles.length === 0) return false;

    const freeTiles = activeTiles.filter(t => isTileFree(t.id, currentTiles));
    
    // Group free tiles by typeId
    const groups: { [key: string]: number } = {};
    freeTiles.forEach(tile => {
      groups[tile.typeId] = (groups[tile.typeId] || 0) + 1;
    });

    return Object.values(groups).some(count => count >= 2);
  }, [isTileFree]);

  // Initiate new game board
  const initBoard = useCallback(() => {
    const coords = generateLayoutCoordinates();
    
    // Create perfect match pool: exactly 4 copies of each of our 16 tiles
    const tilePool: { typeId: string }[] = [];
    TILE_SET_DEFINITIONS.forEach(def => {
      tilePool.push({ typeId: def.typeId });
      tilePool.push({ typeId: def.typeId });
      tilePool.push({ typeId: def.typeId });
      tilePool.push({ typeId: def.typeId });
    });

    // Shuffle tile types
    const shuffledPool = [...tilePool].sort(() => Math.random() - 0.5);

    // Map to coordinates
    const initialTiles: PlayTile[] = coords.map((co, idx) => ({
      id: `tile-${idx}-${Date.now()}`,
      typeId: shuffledPool[idx].typeId,
      x: co.x,
      y: co.y,
      z: co.z,
      matched: false
    }));

    setTiles(initialTiles);
    setSelectedId(null);
    setScore(0);
    setMoveHistory([]);
    setHighlightedIds([]);
    setGameState('playing');
    setFeedbackMessage({ text: 'Board reassembled! Pair up matching unblocked tiles.', type: 'info' });
  }, []);

  // Start initialization
  useEffect(() => {
    initBoard();
  }, [initBoard]);

  // Trigger brief alert text feedback
  const showFeedback = (text: string, type: 'success' | 'info' | 'error') => {
    setFeedbackMessage({ text, type });
    const timer = setTimeout(() => {
      setFeedbackMessage(prev => prev?.text === text ? null : prev);
    }, 4500);
    return () => clearTimeout(timer);
  };

  // Find a matching pair as hint
  const triggerHint = () => {
    const active = tiles.filter(t => !t.matched);
    const free = active.filter(t => isTileFree(t.id, tiles));

    // Group free tiles
    const map = new Map<string, PlayTile[]>();
    for (const tile of free) {
      if (!map.has(tile.typeId)) {
        map.set(tile.typeId, []);
      }
      map.get(tile.typeId)!.push(tile);
    }

    // Find the first group with >= 2 tiles
    let foundPair: PlayTile[] | null = null;
    for (const [_, matchingTiles] of map.entries()) {
      if (matchingTiles.length >= 2) {
        foundPair = matchingTiles.slice(0, 2);
        break;
      }
    }

    if (foundPair) {
      const ids = foundPair.map(t => t.id);
      setHighlightedIds(ids);
      showFeedback(`Hint: Pair found! look closely at the highlighted tiles.`, 'success');
      // Fade hint
      setTimeout(() => {
        setHighlightedIds(prev => prev.filter(id => !ids.includes(id)));
      }, 3500);
    } else {
      showFeedback('No matches available on the board. Need to Shuffle!', 'error');
    }
  };

  // Reshuffle remaining unmatched tiles
  const shuffleRemaining = () => {
    const unmatched = tiles.filter(t => !t.matched);
    if (unmatched.length === 0) {
      showFeedback('No tiles left to shuffle!', 'info');
      return;
    }

    // Extract type IDs and shuffle them
    const types = unmatched.map(t => t.typeId).sort(() => Math.random() - 0.5);

    // Reassign shuffled attributes back
    const updatedTiles = tiles.map(tile => {
      if (tile.matched) return tile;
      const index = unmatched.findIndex(u => u.id === tile.id);
      return {
        ...tile,
        typeId: types[index]
      };
    });

    setTiles(updatedTiles);
    setSelectedId(null);
    setHighlightedIds([]);
    setSelectedId(null);

    // Re-check game state
    const hasMoves = checkAvailableMoves(updatedTiles);
    if (hasMoves) {
      setGameState('playing');
      showFeedback('Remaining tiles shuffled! Ready to match.', 'success');
    } else {
      setGameState('blocked');
      showFeedback('Shuffled, but still no moves left! Try shuffling again.', 'error');
    }
  };

  // Undo last matched pair
  const undoLastMove = () => {
    if (moveHistory.length === 0) {
      showFeedback('No moves recorded in current session.', 'error');
      return;
    }

    const last = moveHistory[moveHistory.length - 1];
    setTiles(prev => prev.map(t => {
      if (t.id === last.t1.id || t.id === last.t2.id) {
        return { ...t, matched: false };
      }
      return t;
    }));
    setMoveHistory(prev => prev.slice(0, -1));
    setScore(prev => Math.max(0, prev - 100));
    setGameState('playing');
    setSelectedId(null);
    showFeedback('Match undo successfully.', 'info');
  };

  // Handle tile click event
  const handleTileClick = (tileId: string) => {
    // If playing state is blocked/win, skip
    if (gameState === 'victory') return;

    const tile = tiles.find(t => t.id === tileId);
    if (!tile || tile.matched) return;

    const free = isTileFree(tileId, tiles);
    if (!free) {
      showFeedback('Locked Tile! Left/Right block or tile above prevents removal.', 'error');
      return;
    }

    // Clear highlights when interacting
    setHighlightedIds([]);

    if (selectedId === null) {
      // First tile clicked
      setSelectedId(tileId);
    } else if (selectedId === tileId) {
      // Deselect clicked tile
      setSelectedId(null);
    } else {
      // Second tile clicked
      const firstTile = tiles.find(t => t.id === selectedId);
      if (firstTile && firstTile.typeId === tile.typeId) {
        // MATCH MADE!
        const nextTiles = tiles.map(t => {
          if (t.id === firstTile.id || t.id === tile.id) {
            return { ...t, matched: true };
          }
          return t;
        });

        setTiles(nextTiles);
        setSelectedId(null);
        setMoveHistory(prev => [...prev, { t1: firstTile, t2: tile }]);
        const gain = 100 + (firstTile.z + tile.z) * 20; // bonus score for top layers match!
        const nextScore = score + gain;
        setScore(nextScore);

        // Keep best highscore sync
        if (nextScore > bestScore) {
          setBestScore(nextScore);
          try {
            localStorage.setItem('cyber_mahjong_best', String(nextScore));
          } catch {}
        }

        const remainingCount = nextTiles.filter(t => !t.matched).length;
        if (remainingCount === 0) {
          setGameState('victory');
          showFeedback('Incredible! You cleared all tiles and solved the Mahjong Solitaire!', 'success');
        } else {
          // Check if moves available
          const hasMoves = checkAvailableMoves(nextTiles);
          if (!hasMoves) {
            setGameState('blocked');
            showFeedback('Warning: No more matches available! Use Shuffle to continue.', 'error');
          } else {
            showFeedback(`Nice pair! Matched ${TILE_SET_DEFINITIONS.find(d => d.typeId === tile.typeId)?.name || 'tiles'}.`, 'success');
          }
        }
      } else {
        // Not matching types: change selection to the clicked tile
        setSelectedId(tileId);
      }
    }
  };

  // Convert definitions to easy mapping dictionary
  const defDict = useMemo(() => {
    const dict: { [key: string]: TileDefinition } = {};
    TILE_SET_DEFINITIONS.forEach(def => {
      dict[def.typeId] = def;
    });
    return dict;
  }, []);

  const remainingTilesCount = tiles.filter(t => !t.matched).length;

  return (
    <div className={`border rounded-2xl p-3 sm:p-6 shadow-xl transition-colors duration-200 select-none w-full ${
      isLightTheme 
        ? 'bg-white border-slate-200 text-slate-800 shadow-slate-100' 
        : 'bg-slate-900 border-slate-800 text-white shadow-black/40'
    }`}>
      
      {/* Title block */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
        <div>
          <h2 className={`text-sm sm:text-base font-extrabold flex items-center gap-2 tracking-tight uppercase ${
            isLightTheme ? 'text-slate-950' : 'text-white'
          }`}>
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-500 shrink-0" />
            <span>Classic Mahjong Solitaire</span>
          </h2>
          <p className="text-[9px] sm:text-[10px] text-slate-400 font-mono mt-0.5">Clear the block layout by matching identical unblocked tiles.</p>
        </div>

        {/* Level stats */}
        <div className="flex items-center gap-2">
          <div className={`px-2 py-0.5 sm:py-1 rounded-lg text-[9px] sm:text-[10px] font-mono border ${
            isLightTheme ? 'bg-slate-50 border-slate-200 text-slate-600' : 'bg-slate-950/40 border-slate-800 text-slate-300'
          }`}>
            Tiles Left: <span className="font-bold text-rose-500">{remainingTilesCount}/64</span>
          </div>
        </div>
      </div>

      {/* Control Panel / Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        <div className={`p-1.5 sm:p-2 rounded-xl border flex flex-col justify-center items-center ${
          isLightTheme ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/40 border-slate-800'
        }`}>
          <p className="text-[7px] sm:text-[8px] uppercase tracking-wider font-mono text-slate-400">Current Score</p>
          <p className="text-xs sm:text-sm font-black font-mono leading-tight">{score}</p>
        </div>

        <div className={`p-1.5 sm:p-2 rounded-xl border flex flex-col justify-center items-center ${
          isLightTheme ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/40 border-slate-800'
        }`}>
          <p className="text-[7px] sm:text-[8px] uppercase tracking-wider font-mono text-slate-400">Personal Best</p>
          <p className="text-xs sm:text-sm font-black font-mono leading-tight text-emerald-500">{bestScore}</p>
        </div>

        <div className={`p-1.5 sm:p-2 rounded-xl border flex flex-col justify-center items-center ${
          isLightTheme ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/40 border-slate-800'
        }`}>
          <p className="text-[7px] sm:text-[8px] uppercase tracking-wider font-mono text-slate-400">Moves Played</p>
          <p className="text-xs sm:text-sm font-black font-mono leading-tight">{moveHistory.length}</p>
        </div>

        <div className={`p-1.5 sm:p-2 rounded-xl border flex flex-col justify-center items-center ${
          isLightTheme ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/40 border-slate-800'
        }`}>
          <p className="text-[7px] sm:text-[8px] uppercase tracking-wider font-mono text-slate-400">Game State</p>
          <p className={`text-[10px] sm:text-xs font-black font-mono leading-tight flex items-center gap-1 ${
            gameState === 'victory' 
              ? 'text-emerald-500' 
              : gameState === 'blocked' 
              ? 'text-rose-500 animate-pulse' 
              : 'text-indigo-400'
          }`}>
            {gameState === 'victory' && 'Cleared!'}
            {gameState === 'blocked' && 'Gridlocked!'}
            {gameState === 'playing' && 'Active'}
          </p>
        </div>
      </div>

      {/* Action triggers */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 border-b pb-3.5 mb-4 border-slate-200 dark:border-[#101921]/60">
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={triggerHint}
            disabled={gameState === 'victory'}
            className={`flex items-center gap-1 sm:gap-1.5 text-[9px] sm:text-[10px] font-bold px-2 sm:px-3 py-1.5 rounded-lg border transition cursor-pointer select-none disabled:opacity-50 ${
              isLightTheme 
                ? 'bg-indigo-50 hover:bg-indigo-100 border-indigo-100 text-indigo-700' 
                : 'bg-indigo-950/40 hover:bg-indigo-900/40 border-indigo-900/60 text-indigo-400'
            }`}
            title="Highlight a matching pair"
          >
            <Lightbulb className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">Find Hint</span>
            <span className="xs:hidden">Hint</span>
          </button>

          <button
            onClick={shuffleRemaining}
            disabled={gameState === 'victory' || remainingTilesCount === 0}
            className={`flex items-center gap-1 sm:gap-1.5 text-[9px] sm:text-[10px] font-bold px-2 sm:px-3 py-1.5 rounded-lg border transition cursor-pointer select-none disabled:opacity-50 ${
              isLightTheme 
                ? 'bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-700' 
                : 'bg-amber-950/45 hover:bg-amber-900/40 border-amber-900/40 text-amber-400'
            }`}
            title="Scramble remaining tiles to resolve gridlocks"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">Shuffle Remaining</span>
            <span className="xs:hidden">Shuffle</span>
          </button>

          <button
            onClick={undoLastMove}
            disabled={moveHistory.length === 0}
            className={`flex items-center gap-1 sm:gap-1.5 text-[9px] sm:text-[10px] font-bold px-2 sm:px-3 py-1.5 rounded-lg border transition cursor-pointer select-none disabled:opacity-40 ${
              isLightTheme 
                ? 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700' 
                : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
            }`}
            title="Restore last matched tiles pair"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">Undo Match</span>
            <span className="xs:hidden">Undo</span>
          </button>
        </div>

        <div className="flex items-center gap-2 border-t sm:border-t-0 pt-2 sm:pt-0">
          <span className="text-[9px] sm:text-[10px] font-mono font-bold uppercase text-slate-400">Mobile Zoom:</span>
          <div className="flex rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 p-0.5 bg-slate-100/60 dark:bg-slate-950">
            {[1.0, 1.25, 1.5].map((zoom) => (
              <button
                key={zoom}
                onClick={() => setTileZoomFactor(zoom)}
                className={`px-2 py-1 text-[9px] font-bold rounded cursor-pointer border-0 transition-all ${
                  tileZoomFactor === zoom
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white bg-transparent'
                }`}
              >
                {zoom === 1.0 ? 'Fit' : `${zoom}x`}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={initBoard}
          className={`flex items-center gap-1 text-[9px] sm:text-[10px] font-bold px-2 sm:px-2.5 py-1.5 rounded-lg border hover:scale-103 active:scale-97 transition cursor-pointer select-none ${
            isLightTheme 
              ? 'bg-rose-50 hover:bg-rose-100 border-rose-100 text-rose-600' 
              : 'bg-rose-950/20 hover:bg-rose-900/20 border-rose-900/40 text-rose-400'
          }`}
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Reset</span>
        </button>
      </div>

      {/* Main Alert Message Strip */}
      {feedbackMessage && (
        <div className={`p-2 mb-4 rounded-lg flex items-center gap-2 border text-[10px] sm:text-[11px] animate-fade-in ${
          feedbackMessage.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-650 dark:text-emerald-400'
            : feedbackMessage.type === 'error'
            ? 'bg-rose-500/10 border-rose-500/30 text-rose-650 dark:text-rose-400'
            : 'bg-slate-50 border-slate-200 dark:bg-slate-800/40 dark:border-slate-800 text-slate-500 dark:text-slate-300'
        }`}>
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{feedbackMessage.text}</span>
        </div>
      )}

      {/* Grid Canvas Game Area - Dynamically Scalable for flawless Mobile compatibility */}
      <div ref={containerRef} className="w-full relative overflow-x-auto overflow-y-auto flex justify-start sm:justify-center py-2 px-1 scrollbar-thin">
        <div
          style={{
            width: `${512 * boardScale}px`,
            height: `${384 * boardScale}px`,
            position: 'relative',
            flexShrink: 0
          }}
        >
          <div 
            className={`relative select-none transition-all duration-150 rounded-2xl border-4 shadow-inner overflow-hidden shrink-0 ${
              isLightTheme 
                ? 'bg-gradient-to-tr from-emerald-50 to-emerald-100/70 border-slate-300 shadow-emerald-950/5' 
                : 'bg-gradient-to-tr from-[#0a1f14] to-[#040e09] border-[#113a23]/60 shadow-black/80'
            }`}
            style={{
              width: '512px',
              height: '384px',
              transform: `scale(${boardScale})`,
              transformOrigin: 'top left',
              position: 'absolute',
              top: 0,
              left: 0
            }}
          >
        
        {/* Felt Mat Grid texture lines details */}
        <div className="absolute inset-0 border border-emerald-800/10 rounded-xl m-0.5 sm:m-1 grid grid-cols-8 grid-rows-8 opacity-10 pointer-events-none" />

        {/* Board status overlays */}
        {gameState === 'blocked' && (
          <div className="absolute inset-x-1 sm:inset-x-3 inset-y-1 sm:inset-y-3 bg-slate-950/90 backdrop-blur-md rounded-xl flex flex-col items-center justify-center p-4 text-center z-40 animate-fade-in">
            <AlertCircle className="w-8 h-8 sm:w-12 sm:h-12 text-rose-500 mb-1.5 sm:mb-2 animate-bounce" />
            <p className="text-xs sm:text-sm font-black text-rose-500 uppercase tracking-wider">No Matches Remaining</p>
            <p className="text-[10px] sm:text-xs text-slate-300 max-w-xs mb-3.5 sm:mb-5 leading-relaxed">
              Every unblocked tile has a different symbol. Reshuffle to continue your session!
            </p>
            <div className="flex gap-2.5">
              <button
                onClick={shuffleRemaining}
                className="bg-amber-600 hover:bg-amber-500 text-white font-bold py-1.5 sm:py-2 px-3 sm:px-5 rounded-xl text-[10px] sm:text-xs flex items-center gap-1.5 transition select-none cursor-pointer active:scale-95 shadow-md"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Shuffle Board</span>
              </button>
              <button
                onClick={initBoard}
                className="bg-slate-800 hover:bg-slate-700 text-white font-bold py-1.5 sm:py-2 px-3 sm:px-5 rounded-xl text-[10px] sm:text-xs transition cursor-pointer select-none"
              >
                Reset
              </button>
            </div>
          </div>
        )}

        {gameState === 'victory' && (
          <div className="absolute inset-x-1 sm:inset-x-3 inset-y-1 sm:inset-y-3 bg-emerald-950/95 backdrop-blur-md rounded-xl flex flex-col items-center justify-center p-4 text-center z-40 animate-fade-in">
            <Trophy className="w-12 h-12 sm:w-16 sm:h-16 text-yellow-500 fill-yellow-400 mb-2 sm:mb-3 animate-pulse" />
            <p className="text-sm sm:text-base font-black text-emerald-400 uppercase tracking-widest mb-1">Board Restored!</p>
            <p className="text-[10px] sm:text-xs text-emerald-100/90 max-w-xs mb-3.5 sm:mb-4 font-mono">
              Completed! Your score of <strong className="text-white">{score}</strong> is saved.
            </p>
            <button
              onClick={initBoard}
              className="bg-emerald-600 hover:bg-emerald-500 hover:scale-105 text-white font-bold py-2 sm:py-2.5 px-5 sm:px-7 rounded-xl text-[10px] sm:text-xs flex items-center gap-1.5 transition select-none cursor-pointer active:scale-95 shadow-lg"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Next Session</span>
            </button>
          </div>
        )}

        {/* Tiles Board layer mapping */}
        {tiles.map((tile) => {
          if (tile.matched) return null;

          const isSelected = selectedId === tile.id;
          const isFree = isTileFree(tile.id, tiles);
          const isHighlighted = highlightedIds.includes(tile.id);
          const def = defDict[tile.typeId];

          // 100% perfectly fluid centering formula built on the stable 4:3 canvas aspect ratio:
          const xPercent = 4.25 + tile.x * 11.5;
          const yPercent = 7.0 + (tile.y - 1) * 13.0;

          // Elevation styling for 3D stacks
          const translateStyle = {
            left: `${xPercent}%`,
            top: `${yPercent}%`,
            transform: `translate(${-tile.z * 4}px, ${-tile.z * 4}px)`,
            zIndex: 10 + tile.z
          };

          return (
            <div
              key={tile.id}
              onClick={() => handleTileClick(tile.id)}
              className={`absolute w-[11%] aspect-[3/4] rounded-lg transition-all duration-150 relative border flex flex-col items-center justify-center ${
                isSelected
                  ? 'bg-gradient-to-b from-indigo-50 to-indigo-100 border-indigo-600 text-indigo-900 border-b-[3.5px] border-r-[3.5px] border-indigo-700 shadow-lg scale-105 ring-2 ring-indigo-500/30 font-semibold cursor-pointer'
                  : isHighlighted
                  ? 'bg-gradient-to-b from-rose-50 to-rose-100 border-rose-500 text-rose-950 border-b-[3.5px] border-r-[3.5px] border-rose-600 animate-pulse scale-105 ring-2 ring-rose-500/30 cursor-pointer font-semibold'
                  : !isFree
                  ? isLightTheme
                    ? 'bg-[#ebe4d2] border-[#dfd4b7] border-b-[3px] border-r-[3px] border-[#c0b596] text-slate-400 opacity-55 cursor-not-allowed shadow-inner'
                    : 'bg-slate-800/80 border-slate-700 border-b-[3px] border-r-[3px] border-slate-900 text-slate-500 opacity-40 cursor-not-allowed shadow-inner hover:scale-100'
                  : isLightTheme
                  ? 'bg-gradient-to-b from-[#fdfbf7] to-[#f4ecd8] border-[#dfd3b6] border-b-[4px] border-r-[4px] border-emerald-800 hover:from-[#ffffff] hover:to-[#faf6eb] hover:border-b-[5px] hover:border-r-[5px] hover:border-emerald-700 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer shadow-md'
                  : 'bg-gradient-to-b from-slate-700 to-slate-800 border-slate-600 border-b-[4px] border-r-[4px] border-emerald-950 hover:from-slate-650 hover:to-slate-750 hover:border-b-[5px] hover:border-r-[5px] hover:border-emerald-800 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer shadow-md'
              }`}
              style={{
                ...translateStyle,
                // Combine a solid backing shadow to simulate thick genuine bamboo/ivory Mahjong tile pieces
                boxShadow: !tile.matched && isFree
                  ? `${tile.z + 1}px ${tile.z + 2}px ${tile.z + 4}px rgba(0, 0, 0, ${0.15 + (tile.z * 0.05)})`
                  : undefined
              }}
            >
              {/* Backing Beveling Border for 3D Depth */}
              <div 
                className="absolute inset-0 rounded-lg pointer-events-none border-b-[2px] border-r-[2px] border-emerald-950/20" 
                style={{ zIndex: -1 }}
              />

              {/* Symbol */}
              {def && (
                <div className="flex flex-col items-center justify-center w-full h-full p-0.5 pointer-events-none text-center">
                  <span className={`text-[21px] font-black leading-none ${def.colorClass}`}>
                    {def.symbol}
                  </span>
                  
                  {/* Category label */}
                  <span className={`text-[7.5px] font-mono uppercase tracking-tighter opacity-80 leading-none mt-1 ${
                    isLightTheme ? 'text-slate-500' : 'text-slate-400'
                  }`}>
                    {def.category.substring(0, 3)}
                  </span>
                </div>
              )}

              {/* Free tile glow */}
              {isFree && !isSelected && !isHighlighted && (
                <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-500 ring-1 ring-white dark:ring-slate-900 shadow-sm animate-pulse" title="Unblocked Tile" />
              )}
            </div>
          );
        })}
        </div>
        </div>
      </div>

      {/* Guide text under the board */}
      <p className="text-center font-mono text-[9px] text-slate-400 mt-4 leading-relaxed max-w-md mx-auto">
        ● Tiles with green indicators (<span className="w-1.5 h-1.5 inline-block rounded-full bg-emerald-500" />) are unblocked (free). Match pairs of free tiles to clear.
        <br />
        ● Locked tiles can be freed by removing neighbor tiles to their direct left or right. Use shuffle to clear locks.
      </p>
    </div>
  );
}
