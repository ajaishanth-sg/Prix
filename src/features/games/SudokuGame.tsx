import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw, Lightbulb, Edit3, Trash2, CheckCircle, Zap } from 'lucide-react';

type SudokuGrid = number[][];
type NotesGrid = string[][][]; // 9x9 array containing arrays of strings (pencil marks '1'-'9')

export default function SudokuGame({ isLightTheme = false }: { isLightTheme?: boolean }) {
  const [initialBoard, setInitialBoard] = useState<SudokuGrid>(Array(9).fill(null).map(() => Array(9).fill(0)));
  const [board, setBoard] = useState<SudokuGrid>(Array(9).fill(null).map(() => Array(9).fill(0)));
  const [solution, setSolution] = useState<SudokuGrid>(Array(9).fill(null).map(() => Array(9).fill(0)));
  const [notes, setNotes] = useState<NotesGrid>(Array(9).fill(null).map(() => Array(9).fill(null).map(() => [])));
  
  const [selectedCell, setSelectedCell] = useState<{ r: number; c: number } | null>(null);
  const [isPencilMode, setIsPencilMode] = useState<boolean>(false);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [mistakes, setMistakes] = useState<number>(0);
  const [maxMistakes] = useState<number>(5);
  const [isGameOver, setIsGameOver] = useState<boolean>(false);
  const [isGameWon, setIsGameWon] = useState<boolean>(false);

  // Timer states
  const [seconds, setSeconds] = useState<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Generate Sudoku core logic (backtracking solver & random starting boards)
  const isValid = (grid: SudokuGrid, r: number, c: number, num: number): boolean => {
    // Check row
    for (let col = 0; col < 9; col++) {
      if (grid[r][col] === num) return false;
    }
    // Check column
    for (let row = 0; row < 9; row++) {
      if (grid[row][c] === num) return false;
    }
    // Check 3x3 square
    const startRow = Math.floor(r / 3) * 3;
    const startCol = Math.floor(c / 3) * 3;
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        if (grid[startRow + row][startCol + col] === num) return false;
      }
    }
    return true;
  };

  const solveSudoku = (grid: SudokuGrid): boolean => {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (grid[r][c] === 0) {
          for (let num = 1; num <= 9; num++) {
            if (isValid(grid, r, c, num)) {
              grid[r][c] = num;
              if (solveSudoku(grid)) return true;
              grid[r][c] = 0;
            }
          }
          return false;
        }
      }
    }
    return true;
  };

  const fillDiagonalBlocks = (grid: SudokuGrid) => {
    for (let i = 0; i < 9; i += 3) {
      // Fill 3x3 sub-grid
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          let num = Math.floor(Math.random() * 9) + 1;
          while (!isValid(grid, i + r, i + c, num)) {
            num = Math.floor(Math.random() * 9) + 1;
          }
          grid[i + r][i + c] = num;
        }
      }
    }
  };

  const generateSudoku = () => {
    // 1. Create blank grid
    const fullGrid: SudokuGrid = Array(9).fill(null).map(() => Array(9).fill(0));
    
    // 2. Fill diagonal blocks first to provide variation initial states
    fillDiagonalBlocks(fullGrid);
    
    // 3. Backtrack-solve remaining empty blocks to formulate full completed board
    solveSudoku(fullGrid);
    
    // Guard clone solved output
    const solvedClone = fullGrid.map(row => [...row]);
    setSolution(solvedClone);

    // 4. Tear down cells based on difficulty
    const playableGrid = fullGrid.map(row => [...row]);
    let cellsToRemove = 36; // Easy default
    if (difficulty === 'medium') cellsToRemove = 46;
    if (difficulty === 'hard') cellsToRemove = 54;

    let removed = 0;
    while (removed < cellsToRemove) {
      const r = Math.floor(Math.random() * 9);
      const c = Math.floor(Math.random() * 9);
      if (playableGrid[r][c] !== 0) {
        playableGrid[r][c] = 0;
        removed++;
      }
    }

    setInitialBoard(playableGrid.map(row => [...row]));
    setBoard(playableGrid.map(row => [...row]));
    
    // Clear notes, mistakes, selection
    setNotes(Array(9).fill(null).map(() => Array(9).fill(null).map(() => [])));
    setSelectedCell(null);
    setMistakes(0);
    setIsGameOver(false);
    setIsGameWon(false);
    setSeconds(0);
  };

  // Launch initial generation
  useEffect(() => {
    generateSudoku();
  }, [difficulty]);

  // Keep digital active timer going
  useEffect(() => {
    if (isGameOver || isGameWon) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => {
      setSeconds(prev => prev + 1);
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isGameOver, isGameWon]);

  const formatTimer = (totSecond: number): string => {
    const mins = Math.floor(totSecond / 60);
    const secs = totSecond % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Check Game Win Condition
  const checkWinCondition = React.useCallback((currentBoard: SudokuGrid) => {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (currentBoard[r][c] !== solution[r][c]) {
          return; // Still mismatch or empty
        }
      }
    }
    setIsGameWon(true);

    try {
      const currentBest = localStorage.getItem('cyber_sudoku_best_time');
      if (!currentBest || seconds < parseInt(currentBest)) {
        localStorage.setItem('cyber_sudoku_best_time', seconds.toString());
        window.dispatchEvent(new Event('cyber_game_stats_updated'));
      }
    } catch (e) {
      console.warn("Failed to save Sudoku best time:", e);
    }
  }, [solution, seconds]);

  // Input Handler for number keys and physical keyboards
  const handleCellInput = React.useCallback((num: number) => {
    if (!selectedCell || isGameOver || isGameWon) return;
    const { r, c } = selectedCell;

    // Disallow altering static baseline template cells
    if (initialBoard[r][c] !== 0) return;

    if (isPencilMode) {
      // Toggle note inside cell
      setNotes(prevNotes => {
        const copy = prevNotes.map(row => row.map(cell => [...cell]));
        const currNotes = copy[r][c];
        const numStr = num.toString();
        if (currNotes.includes(numStr)) {
          copy[r][c] = currNotes.filter(n => n !== numStr);
        } else {
          copy[r][c] = [...currNotes, numStr].sort();
        }
        return copy;
      });
    } else {
      // Standard direct cell write
      setBoard(prevBoard => {
        const copy = prevBoard.map(row => [...row]);
        copy[r][c] = num;

        // Check if placed entry matches solution
        if (num !== solution[r][c]) {
          const nextMistakes = mistakes + 1;
          setMistakes(nextMistakes);
          if (nextMistakes >= maxMistakes) {
            setIsGameOver(true);
          }
        } else {
          // If correct, auto clear conflicting notes in same row/col/sector
          setNotes(prevNotes => {
            const notesCopy = prevNotes.map(row => row.map(cell => [...cell]));
            const numStr = num.toString();
            // Row & Col
            for (let i = 0; i < 9; i++) {
              notesCopy[r][i] = notesCopy[r][i].filter(n => n !== numStr);
              notesCopy[i][c] = notesCopy[i][c].filter(n => n !== numStr);
            }
            // 3x3 sector
            const sRow = Math.floor(r / 3) * 3;
            const sCol = Math.floor(c / 3) * 3;
            for (let sr = 0; sr < 3; sr++) {
              for (let sc = 0; sc < 3; sc++) {
                notesCopy[sRow + sr][sCol + sc] = notesCopy[sRow + sr][sCol + sc].filter(n => n !== numStr);
              }
            }
            return notesCopy;
          });
        }

        checkWinCondition(copy);
        return copy;
      });
    }
  }, [selectedCell, isGameOver, isGameWon, initialBoard, isPencilMode, solution, mistakes, maxMistakes, checkWinCondition]);

  // Erase/Clear Selected Cell
  const handleClearCell = React.useCallback(() => {
    if (!selectedCell || isGameOver || isGameWon) return;
    const { r, c } = selectedCell;
    if (initialBoard[r][c] !== 0) return;

    setBoard(prev => {
      const copy = prev.map(row => [...row]);
      copy[r][c] = 0;
      return copy;
    });

    setNotes(prev => {
      const copy = prev.map(row => row.map(cell => [...cell]));
      copy[r][c] = [];
      return copy;
    });
  }, [selectedCell, isGameOver, isGameWon, initialBoard]);

  // Single Cell Help Hint Solver
  const handleRevealHint = React.useCallback(() => {
    if (!selectedCell || isGameOver || isGameWon) return;
    const { r, c } = selectedCell;
    if (initialBoard[r][c] !== 0) return;

    const answerValue = solution[r][c];
    setBoard(prev => {
      const copy = prev.map(row => [...row]);
      copy[r][c] = answerValue;
      checkWinCondition(copy);
      return copy;
    });

    // Clear candidates note
    setNotes(prev => {
      const copy = prev.map(row => row.map(cell => [...cell]));
      copy[r][c] = [];
      return copy;
    });
  }, [selectedCell, isGameOver, isGameWon, initialBoard, solution, checkWinCondition]);

  // Bind key handlers
  useEffect(() => {
    const handlePhysicalKeys = (e: KeyboardEvent) => {
      if (['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9',
           'Numpad1', 'Numpad2', 'Numpad3', 'Numpad4', 'Numpad5', 'Numpad6', 'Numpad7', 'Numpad8', 'Numpad9'].includes(e.code)) {
        const value = parseInt(e.key);
        if (!isNaN(value)) handleCellInput(value);
      } else if (['Backspace', 'Delete'].includes(e.code)) {
        handleClearCell();
      }
    };
    window.addEventListener('keydown', handlePhysicalKeys);
    return () => window.removeEventListener('keydown', handlePhysicalKeys);
  }, [handleCellInput, handleClearCell]);

  return (
    <div className={`space-y-5 rounded-2xl border p-4 sm:p-5 shadow-2xl transition-all ${
      isLightTheme 
        ? 'bg-white border-slate-200 text-slate-800 shadow-slate-100' 
        : 'bg-[#182533] border-[#101921] text-white'
    }`}>
      
      {/* Game Mode Selector Header */}
      <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-[#101921]">
        <div>
          <h3 className={`text-sm font-bold flex items-center gap-1.5 uppercase tracking-wide ${
            isLightTheme ? 'text-slate-900' : 'text-white'
          }`}>
            <Zap className="w-4 h-4 text-emerald-500 animate-pulse shrink-0" />
            <span>Cyber Cryptic Sudoku</span>
          </h3>
          <p className="text-[10px] text-slate-400 font-mono mt-0.5">Solve grid checksum integrity vectors</p>
        </div>

        <button
          onClick={generateSudoku}
          className={`p-1.5 rounded-lg border transition duration-150 cursor-pointer ${
            isLightTheme 
              ? 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600' 
              : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-400 dark:bg-[#101921]'
          }`}
          title="Regenerate checksum grid"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Difficulty Subtabs */}
      <div className="flex gap-2 p-1 bg-slate-100/50 dark:bg-[#101921]/40 border border-slate-200 dark:border-[#101921]/15 rounded-xl text-center select-none">
        {(['easy', 'medium', 'hard'] as const).map((diff) => (
          <button
            key={diff}
            onClick={() => setDifficulty(diff)}
            className={`flex-1 py-1.5 text-[9px] uppercase tracking-wider font-extrabold rounded-lg transition cursor-pointer ${
              difficulty === diff
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-350 bg-transparent'
            }`}
          >
            {diff}
          </button>
        ))}
      </div>

      {/* Live Active Metadata Status Bar */}
      <div className="grid grid-cols-2 gap-3.5 select-none">
        <div className="p-2 bg-slate-50 dark:bg-[#101921]/20 border border-slate-200 dark:border-[#101921]/30 rounded-xl flex items-center justify-between">
          <span className="text-[9px] uppercase font-mono font-bold text-slate-400">Time Sector</span>
          <span className="text-xs font-mono font-bold text-[#2481cc]">{formatTimer(seconds)}</span>
        </div>
        <div className="p-2 bg-slate-50 dark:bg-[#101921]/20 border border-slate-200 dark:border-[#101921]/30 rounded-xl flex items-center justify-between">
          <span className="text-[9px] uppercase font-mono font-bold text-slate-400">Checksum Errors</span>
          <span className={`text-xs font-mono font-bold ${mistakes > 0 ? 'text-rose-500' : 'text-[#2481cc]'}`}>
            {mistakes} / {maxMistakes}
          </span>
        </div>
      </div>

      {/* SUDOKU GRID BOARD */}
      <div className="relative w-full max-w-[95vw] sm:max-w-[460px] md:max-w-[540px] lg:max-w-[620px] aspect-square mx-auto border-3 border-slate-400 dark:border-[#101921] rounded-2xl overflow-hidden shadow-lg select-none">
        <div className="grid grid-cols-9 grid-rows-9 w-full h-full">
          {board.flatMap((row, r) => {
            const borderBottom = (r === 2 || r === 5) 
              ? 'border-b-3 border-b-slate-400 dark:border-b-[#101921]' 
              : (r === 8 ? '' : 'border-b border-b-slate-200 dark:border-b-slate-800/40');

            return row.map((cellValue, c) => {
              const borderRight = (c === 2 || c === 5) 
                ? 'border-r-3 border-r-slate-400 dark:border-r-[#101921]' 
                : (c === 8 ? '' : 'border-r border-r-slate-200 dark:border-r-slate-800/40');

              const isStatic = initialBoard[r][c] !== 0;
              const isSelected = selectedCell?.r === r && selectedCell?.c === c;
              const isHighlighted = selectedCell && (selectedCell.r === r || selectedCell.c === c || (Math.floor(selectedCell.r / 3) === Math.floor(r / 3) && Math.floor(selectedCell.c / 3) === Math.floor(c / 3)));
              const isIncorrectValue = cellValue !== 0 && cellValue !== solution[r][c];

              // Grid cell color logic
              let cellBg = isLightTheme ? 'bg-white' : 'bg-[#182533]';

              if (isSelected) {
                cellBg = isLightTheme ? 'bg-indigo-100/80 ring-1 ring-inset ring-indigo-300' : 'bg-indigo-900/40 ring-1 ring-inset ring-[#2481cc]';
              } else if (isHighlighted) {
                cellBg = isLightTheme ? 'bg-slate-50' : 'bg-slate-800/20';
              }

              return (
                <div
                  key={`${r}-${c}`}
                  onClick={() => setSelectedCell({ r, c })}
                  className={`flex items-center justify-center cursor-pointer transition-all select-none aspect-square ${borderBottom} ${borderRight} ${cellBg}`}
                >
                  {cellValue !== 0 ? (
                    <span className={`text-base xs:text-lg sm:text-xl md:text-2xl lg:text-3xl font-extrabold ${
                      isIncorrectValue 
                        ? 'text-rose-500 animate-pulse' 
                        : isStatic 
                          ? (isLightTheme ? 'text-slate-800' : 'text-slate-400') 
                          : 'text-[#2481cc]'
                    }`}>
                      {cellValue}
                    </span>
                  ) : (
                    // Render pencil candidates notes
                    <div className="grid grid-cols-3 grid-rows-3 h-full w-full p-0.5 leading-none">
                      {Array(9).fill(null).map((_, nIdx) => {
                        const numStr = (nIdx + 1).toString();
                        return (
                          <div key={nIdx} className="text-[7.5px] xs:text-[8.5px] sm:text-[9.5px] md:text-[11px] lg:text-[12px] font-mono font-bold text-slate-500/75 flex items-center justify-center">
                            {notes[r][c].includes(numStr) ? numStr : ''}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            });
          })}
        </div>

        {/* CHECKSUM LOSS OVERLAY (GAME OVER) */}
        {isGameOver && (
          <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-center p-4 text-center z-10 animate-fade-in text-white">
            <Trash2 className="w-9 h-9 text-rose-500 mb-3" />
            <h4 className="text-sm font-black uppercase tracking-wider text-rose-500">CHECKSUM FAULT TIMEOUT</h4>
            <p className="text-xs text-slate-400 font-mono mt-1 mb-5">Integrity payload compromised by too many errors.</p>
            <button
              onClick={generateSudoku}
              className="bg-rose-600 hover:bg-rose-500 text-white font-mono text-xs font-bold py-2.5 px-6 rounded-xl flex items-center gap-1.5 select-none active:scale-95 transition cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Hard Reset Grid checksum</span>
            </button>
          </div>
        )}

        {/* COMPILING COMPLETE OVERLAY (GAME PROGRESS WON) */}
        {isGameWon && (
          <div className="absolute inset-0 bg-emerald-950/95 backdrop-blur-md flex flex-col items-center justify-center p-4 text-center z-10 animate-fade-in text-white">
            <CheckCircle className="w-9 h-9 text-emerald-450 text-emerald-400 mb-3 animate-bounce" />
            <h4 className="text-sm font-black uppercase tracking-widest text-emerald-405 text-emerald-405">COMPILATION SUCCESS</h4>
            <p className="text-xs text-slate-300 font-mono mt-1 mb-1">Time Elapsed: {formatTimer(seconds)}</p>
            <p className="text-[9px] text-slate-450 uppercase mb-5 tracking-widest">Grid Checksum matches cryptographic standard.</p>
            <button
              onClick={generateSudoku}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-bold py-2.5 px-6 rounded-xl flex items-center gap-1.5 select-none active:scale-95 transition cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Initiate New Block</span>
            </button>
          </div>
        )}
      </div>

      {/* SUDOKU CONTROLLER KEYPADS */}
      <div className="space-y-3 pt-1 select-none">
        
        {/* Number buttons 1-9 */}
        <div className="grid grid-cols-9 gap-1 w-full max-w-[95vw] sm:max-w-[460px] md:max-w-[540px] lg:max-w-[620px] mx-auto">
          {Array(9).fill(null).map((_, idx) => {
            const num = idx + 1;
            return (
              <button
                key={num}
                onClick={() => handleCellInput(num)}
                className={`aspect-square sm:p-2 rounded-xl border flex items-center justify-center font-black font-sans text-xs xs:text-sm sm:text-base md:text-lg lg:text-xl transition active:scale-90 shadow-sm cursor-pointer ${
                  isLightTheme
                    ? 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                    : 'bg-[#101921] hover:bg-[#182533] border-slate-800 text-white'
                }`}
              >
                {num}
              </button>
            );
          })}
        </div>

        {/* Option actions like eraser, candidates mode, hint solver */}
        <div className="grid grid-cols-3 gap-2 w-full max-w-[95vw] sm:max-w-[460px] md:max-w-[540px] lg:max-w-[620px] mx-auto">
          <button
            onClick={() => setIsPencilMode(!isPencilMode)}
            className={`py-2 px-3 rounded-xl border text-[9px] xs:text-[10px] sm:text-xs md:text-sm font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              isPencilMode
                ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm ring-2 ring-indigo-500'
                : isLightTheme
                  ? 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600'
                  : 'bg-slate-800 hover:bg-[#182533] border-slate-700 text-slate-400 dark:bg-[#101921]'
            }`}
            title="Toggle candidates pencil input notes"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Pencil Mode: {isPencilMode ? 'ON' : 'OFF'}</span>
          </button>

          <button
            onClick={handleClearCell}
            className={`py-2 px-3 rounded-xl border text-[9px] xs:text-[10px] sm:text-xs md:text-sm font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              isLightTheme
                ? 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600'
                : 'bg-slate-800 hover:bg-[#182533] border-slate-700 text-slate-400 dark:bg-[#101921]'
            }`}
            title="Erase cell entry"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-500" />
            <span>Erase Cell</span>
          </button>

          <button
            onClick={handleRevealHint}
            className={`py-2 px-3 rounded-xl border text-[9px] xs:text-[10px] sm:text-xs md:text-sm font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              isLightTheme
                ? 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600'
                : 'bg-slate-800 hover:bg-[#182533] border-slate-700 text-slate-400 dark:bg-[#101921]'
            }`}
            title="Solve cell instantly using quantum decrypters"
            disabled={!selectedCell}
            style={{ opacity: selectedCell ? 1 : 0.6 }}
          >
            <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
            <span>Cryptic Hint</span>
          </button>
        </div>
      </div>
    </div>
  );
}
