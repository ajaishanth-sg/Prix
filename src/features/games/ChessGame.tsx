import React, { useState, useEffect } from 'react';
import { 
  RefreshCw, 
  User, 
  Cpu, 
  Swords, 
  Award
} from 'lucide-react';

interface ChessPiece {
  type: 'p' | 'r' | 'n' | 'b' | 'q' | 'k';
  color: 'w' | 'b';
  id: string; // for consistent key mapping
}

type BoardState = (ChessPiece | null)[][];

const INITIAL_BOARD_LAYOUT: { type: 'p' | 'r' | 'n' | 'b' | 'q' | 'k'; color: 'w' | 'b' }[][] = [
  [
    { type: 'r', color: 'b' }, { type: 'n', color: 'b' }, { type: 'b', color: 'b' }, { type: 'q', color: 'b' },
    { type: 'k', color: 'b' }, { type: 'b', color: 'b' }, { type: 'n', color: 'b' }, { type: 'r', color: 'b' }
  ],
  Array(8).fill(null).map(() => ({ type: 'p', color: 'b' })),
  Array(8).fill(null),
  Array(8).fill(null),
  Array(8).fill(null),
  Array(8).fill(null),
  Array(8).fill(null).map(() => ({ type: 'p', color: 'w' })),
  [
    { type: 'r', color: 'w' }, { type: 'n', color: 'w' }, { type: 'b', color: 'w' }, { type: 'q', color: 'w' },
    { type: 'k', color: 'w' }, { type: 'b', color: 'w' }, { type: 'n', color: 'w' }, { type: 'r', color: 'w' }
  ]
];

// Render standard Unicode chess piece with vector styling inside SVG text node
const renderPieceSVG = (char: string, isWhite: boolean) => {
  return (
    <svg viewBox="0 0 100 100" className="w-4/5 h-4/5 filter drop-shadow select-none">
      <text
        x="50%"
        y="50%"
        dominantBaseline="central"
        textAnchor="middle"
        fontSize="75"
        fontWeight="normal"
        fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        fill={isWhite ? '#ffffff' : '#1e293b'}
        stroke={isWhite ? '#111827' : '#38bdf8'}
        strokeWidth="2.5"
      >
        {char}
      </text>
    </svg>
  );
};

// SVGs for modern standard chess pieces using vector-styled Unicode glyphs
const PIECE_SVGS: Record<string, React.ReactNode> = {
  // WHITE (solid traditional shape, colored white with black border)
  wp: renderPieceSVG('\u265F\uFE0E', true),
  wr: renderPieceSVG('\u265C\uFE0E', true),
  wn: renderPieceSVG('\u265E\uFE0E', true),
  wb: renderPieceSVG('\u265D\uFE0E', true),
  wq: renderPieceSVG('\u265B\uFE0E', true),
  wk: renderPieceSVG('\u265A\uFE0E', true),

  // BLACK (solid traditional shape, colored dark-slate with cyan border)
  bp: renderPieceSVG('\u265F\uFE0E', false),
  br: renderPieceSVG('\u265C\uFE0E', false),
  bn: renderPieceSVG('\u265E\uFE0E', false),
  bb: renderPieceSVG('\u265D\uFE0E', false),
  bq: renderPieceSVG('\u265B\uFE0E', false),
  bk: renderPieceSVG('\u265A\uFE0E', false)
};

export default function ChessGame({ isLightTheme = false }: { isLightTheme?: boolean }) {
  // Initialize board with stable UUIDs inline to avoid empty board on first render
  const generateInitialBoard = (): BoardState => {
    let pieceCounter = 0;
    return INITIAL_BOARD_LAYOUT.map((row) =>
      row.map((item) => {
        if (!item) return null;
        pieceCounter++;
        return {
          type: item.type,
          color: item.color,
          id: `${item.color}${item.type}-${pieceCounter}`
        };
      })
    );
  };

  const [board, setBoard] = useState<BoardState>(generateInitialBoard);
  const [turn, setTurn] = useState<'w' | 'b'>('w');
  const [selectedCell, setSelectedCell] = useState<{ r: number; c: number } | null>(null);
  const [validMoves, setValidMoves] = useState<{ r: number; c: number }[]>([]);
  const [gameMode, setGameMode] = useState<'pvp' | 'ai'>('ai');
  const [aiDifficulty, setAiDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [capturedPieces, setCapturedPieces] = useState<{ w: ChessPiece[]; b: ChessPiece[] }>({ w: [], b: [] });
  const [status, setStatus] = useState<string>('Your Turn (White)');
  const [moveLog, setMoveLog] = useState<string[]>([]);
  const [isCheck, setIsCheck] = useState<boolean>(false);
  const [isCheckmate, setIsCheckmate] = useState<boolean>(false);
  const [isDraw, setIsDraw] = useState<boolean>(false);
  const [promotionPending, setPromotionPending] = useState<{ r: number; c: number } | null>(null);

  // Synchronized state reference container to securely bypass closure staleness
  const stateRef = React.useRef({
    board,
    turn,
    isCheckmate,
    isDraw,
    promotionPending,
    aiDifficulty,
    gameMode
  });
  stateRef.current = {
    board,
    turn,
    isCheckmate,
    isDraw,
    promotionPending,
    aiDifficulty,
    gameMode
  };

  // Initialize board with stable UUIDs
  const initBoard = () => {
    setBoard(generateInitialBoard());
    setTurn('w');
    setSelectedCell(null);
    setValidMoves([]);
    setCapturedPieces({ w: [], b: [] });
    setStatus('Your turn (White)');
    setMoveLog([]);
    setIsCheck(false);
    setIsCheckmate(false);
    setIsDraw(false);
    setPromotionPending(null);
  };

  useEffect(() => {
    initBoard();
  }, []);

  // Internal movement rules calculator
  const calculateValidMoves = (r: number, c: number, currentBoard: BoardState, ignoreTurnCheckState = false): { r: number; c: number }[] => {
    const piece = currentBoard[r]?.[c];
    if (!piece) return [];

    const moves: { r: number; c: number }[] = [];
    const color = piece.color;
    const enemyColor = color === 'w' ? 'b' : 'w';

    const isOccupiedByAlly = (tr: number, tc: number): boolean => {
      const p = currentBoard[tr]?.[tc];
      return p !== null && p !== undefined && p.color === color;
    };

    const isOccupiedByEnemy = (tr: number, tc: number): boolean => {
      const p = currentBoard[tr]?.[tc];
      return p !== null && p !== undefined && p.color === enemyColor;
    };

    const isEmpty = (tr: number, tc: number): boolean => {
      return currentBoard[tr]?.[tc] === null;
    };

    const addMoveIfLegal = (tr: number, tc: number) => {
      if (tr >= 0 && tr < 8 && tc >= 0 && tc < 8) {
        if (!isOccupiedByAlly(tr, tc)) {
          moves.push({ r: tr, c: tc });
          return true; // was added
        }
      }
      return false;
    };

    switch (piece.type) {
      case 'p': {
        const direction = color === 'w' ? -1 : 1;
        const startRow = color === 'w' ? 6 : 1;

        // One step forward / Two steps forward are only legal moves, not attacks!
        if (!ignoreTurnCheckState) {
          if (r + direction >= 0 && r + direction < 8) {
            if (isEmpty(r + direction, c)) {
              moves.push({ r: r + direction, c });
              // Two steps forward if on start row
              if (r === startRow && r + 2 * direction >= 0 && r + 2 * direction < 8 && isEmpty(r + 2 * direction, c)) {
                moves.push({ r: r + 2 * direction, c });
              }
            }
          }
        }

        // Diagonal attacks
        const targetRow = r + direction;
        if (targetRow >= 0 && targetRow < 8) {
          if (ignoreTurnCheckState) {
            // Pawns threaten diagonal squares regardless of occupancy
            if (c - 1 >= 0) moves.push({ r: targetRow, c: c - 1 });
            if (c + 1 < 8) moves.push({ r: targetRow, c: c + 1 });
          } else {
            // For active legal moves, diagonal capture requires an enemy piece
            if (c - 1 >= 0 && isOccupiedByEnemy(targetRow, c - 1)) {
              moves.push({ r: targetRow, c: c - 1 });
            }
            if (c + 1 < 8 && isOccupiedByEnemy(targetRow, c + 1)) {
              moves.push({ r: targetRow, c: c + 1 });
            }
          }
        }
        break;
      }

      case 'n': {
        const jumpCoords = [
          { r: -2, c: -1 }, { r: -2, c: 1 },
          { r: -1, c: -2 }, { r: -1, c: 2 },
          { r: 1, c: -2 }, { r: 1, c: 2 },
          { r: 2, c: -1 }, { r: 2, c: 1 }
        ];
        jumpCoords.forEach(offset => {
          addMoveIfLegal(r + offset.r, c + offset.c);
        });
        break;
      }

      case 'b': {
        const diagonals = [
          { r: -1, c: -1 }, { r: -1, c: 1 },
          { r: 1, c: -1 }, { r: 1, c: 1 }
        ];
        diagonals.forEach(dir => {
          let step = 1;
          while (true) {
            const tr = r + dir.r * step;
            const tc = c + dir.c * step;
            if (tr < 0 || tr >= 8 || tc < 0 || tc >= 8) break;

            if (isEmpty(tr, tc)) {
              moves.push({ r: tr, c: tc });
            } else if (isOccupiedByEnemy(tr, tc)) {
              moves.push({ r: tr, c: tc });
              break; // block sliding path after taking enemy
            } else {
              break; // blocked by ally
            }
            step++;
          }
        });
        break;
      }

      case 'r': {
        const files = [
          { r: -1, c: 0 }, { r: 1, c: 0 },
          { r: 0, c: -1 }, { r: 0, c: 1 }
        ];
        files.forEach(dir => {
          let step = 1;
          while (true) {
            const tr = r + dir.r * step;
            const tc = c + dir.c * step;
            if (tr < 0 || tr >= 8 || tc < 0 || tc >= 8) break;

            if (isEmpty(tr, tc)) {
              moves.push({ r: tr, c: tc });
            } else if (isOccupiedByEnemy(tr, tc)) {
              moves.push({ r: tr, c: tc });
              break;
            } else {
              break;
            }
            step++;
          }
        });
        break;
      }

      case 'q': {
        const directions = [
          { r: -1, c: -1 }, { r: -1, c: 1 },
          { r: 1, c: -1 }, { r: 1, c: 1 },
          { r: -1, c: 0 }, { r: 1, c: 0 },
          { r: 0, c: -1 }, { r: 0, c: 1 }
        ];
        directions.forEach(dir => {
          let step = 1;
          while (true) {
            const tr = r + dir.r * step;
            const tc = c + dir.c * step;
            if (tr < 0 || tr >= 8 || tc < 0 || tc >= 8) break;

            if (isEmpty(tr, tc)) {
              moves.push({ r: tr, c: tc });
            } else if (isOccupiedByEnemy(tr, tc)) {
              moves.push({ r: tr, c: tc });
              break;
            } else {
              break;
            }
            step++;
          }
        });
        break;
      }

      case 'k': {
        const kingDirs = [
          [-1, -1], [-1, 0], [-1, 1],
          [0, -1],           [0, 1],
          [1, -1],  [1, 0],  [1, 1]
        ];
        kingDirs.forEach(([dr, dc]) => {
          addMoveIfLegal(r + dr, c + dc);
        });
        break;
      }
    }

    // Secondary filter: Ensure that this move does NOT leave or put our own king under check!
    if (!ignoreTurnCheckState) {
      return moves.filter(move => {
        // Create hypothetical board state
        const tempBoard = currentBoard.map(row => [...row]);
        const currentMovingPiece = tempBoard[r][c];
        tempBoard[move.r][move.c] = currentMovingPiece;
        tempBoard[r][c] = null;

        // Find the king of the current player moving
        let kingPos = { r: -1, c: -1 };
        for (let tr = 0; tr < 8; tr++) {
          for (let tc = 0; tc < 8; tc++) {
            const p = tempBoard[tr][tc];
            if (p && p.type === 'k' && p.color === color) {
              kingPos = { r: tr, c: tc };
              break;
            }
          }
        }

        // If the King is captured or missing (unlikely, but safe check), treat as illegal
        if (kingPos.r === -1) return false;

        // Now see if any enemy piece can attack this king pos on the hypothetical board
        for (let er = 0; er < 8; er++) {
          for (let ec = 0; ec < 8; ec++) {
            const enemyPiece = tempBoard[er][ec];
            if (enemyPiece && enemyPiece.color === enemyColor) {
              // Calculate threat vector (using ignoreTurnCheckState = true to bypass infinite recursion)
              const enemyMoves = calculateValidMoves(er, ec, tempBoard, true);
              if (enemyMoves.some(em => em.r === kingPos.r && em.c === kingPos.c)) {
                return false; // Enemy attacks king; illegal hypothetical state
              }
            }
          }
        }
        return true;
      });
    }

    return moves;
  };

  // Find if currently under check
  const checkKingInDanger = (colorToCheck: 'w' | 'b', currentBoard: BoardState): boolean => {
    let kingPos = { r: -1, c: -1 };
    const enemyColor = colorToCheck === 'w' ? 'b' : 'w';

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = currentBoard[r][c];
        if (p && p.type === 'k' && p.color === colorToCheck) {
          kingPos = { r, c };
          break;
        }
      }
    }

    if (kingPos.r === -1) return false;

    // Is there any enemy move targeting this king?
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = currentBoard[r][c];
        if (p && p.color === enemyColor) {
          const attacks = calculateValidMoves(r, c, currentBoard, true);
          if (attacks.some(m => m.r === kingPos.r && m.c === kingPos.c)) {
            return true;
          }
        }
      }
    }
    return false;
  };

  // Check if no moves possible (Checkmate or Stalemate)
  const isNoMovesPossible = (colorToCheck: 'w' | 'b', currentBoard: BoardState): boolean => {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = currentBoard[r][c];
        if (p && p.color === colorToCheck) {
          const legalMoves = calculateValidMoves(r, c, currentBoard, false);
          if (legalMoves.length > 0) {
            return false;
          }
        }
      }
    }
    return true;
  };

  const handlePromotionSelect = (type: 'q' | 'r' | 'b' | 'n') => {
    if (!promotionPending) return;
    const { r, c } = promotionPending;
    
    const nextBoard = board.map(row => [...row]);
    const current = nextBoard[r]?.[c];
    if (current) {
      nextBoard[r][c] = {
        ...current,
        type: type
      };
    }

    setBoard(nextBoard);
    setPromotionPending(null);

    // Swap turns now that promotion is processed
    const nextTurn = turn === 'w' ? 'b' : 'w';
    setTurn(nextTurn);
    finalizeStatusAndAICheck(nextTurn, nextBoard);
  };

  // Core movement logic handler
  const movePiece = (fromR: number, fromC: number, toR: number, toC: number) => {
    const movingPiece = board[fromR]?.[fromC];
    if (!movingPiece) return;

    const captured = board[toR]?.[toC];
    const newBoard = board.map(row => [...row]);

    // Record Captured Items
    if (captured) {
      setCapturedPieces(prev => ({
        ...prev,
        [captured.color]: [...prev[captured.color], captured]
      }));
    }

    // Settle move
    newBoard[toR][toC] = movingPiece;
    newBoard[fromR][fromC] = null;

    // Check for Pawn Promotion (reached end of the board)
    const isPawnPromotion = movingPiece.type === 'p' && (toR === 0 || toR === 7);

    // Logging string
    const filesLabel = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const rankLabel = ['8', '7', '6', '5', '4', '3', '2', '1'];
    const originLabel = `${filesLabel[fromC]}${rankLabel[fromR]}`;
    const targetLabel = `${filesLabel[toC]}${rankLabel[toR]}`;
    const moveStr = `${movingPiece.type.toUpperCase()}:${originLabel}→${targetLabel}${captured ? '✀' : ''}`;
    setMoveLog(prev => [moveStr, ...prev].slice(0, 50));

    // Handle AI pawn promotion automatically to Queen to prevent blocking/freezing the handshakes
    if (isPawnPromotion && movingPiece.color === 'b' && gameMode === 'ai') {
      newBoard[toR][toC] = {
        ...movingPiece,
        type: 'q'
      };
      setBoard(newBoard);
      setSelectedCell(null);
      setValidMoves([]);
      const nextTurn = movingPiece.color === 'w' ? 'b' : 'w';
      setTurn(nextTurn);
      finalizeStatusAndAICheck(nextTurn, newBoard);
      return;
    }

    setBoard(newBoard);
    setSelectedCell(null);
    setValidMoves([]);

    if (isPawnPromotion) {
      setPromotionPending({ r: toR, c: toC });
      setStatus('🛡️ Cyber Link Signal: Select pawn promotion cipher!');
      return;
    }

    const nextTurn = movingPiece.color === 'w' ? 'b' : 'w';
    setTurn(nextTurn);
    finalizeStatusAndAICheck(nextTurn, newBoard);
  };

  const finalizeStatusAndAICheck = (currentTurn: 'w' | 'b', latestBoard: BoardState) => {
    const kingThreatened = checkKingInDanger(currentTurn, latestBoard);
    const noMoves = isNoMovesPossible(currentTurn, latestBoard);

    setIsCheck(kingThreatened);

    if (noMoves) {
      if (kingThreatened) {
        setIsCheckmate(true);
        setStatus(`CHECKMATE! Winner: ${currentTurn === 'w' ? 'Black (b)' : 'White (w)'}`);
        if (currentTurn === 'b' && gameMode === 'ai') {
          try {
            const currentWins = Number(localStorage.getItem('cyber_chess_wins') || '0');
            localStorage.setItem('cyber_chess_wins', String(currentWins + 1));
            window.dispatchEvent(new Event('cyber_game_stats_updated'));
          } catch (e) {
            console.warn("Failed to save chess wins:", e);
          }
        }
      } else {
        setIsDraw(true);
        setStatus('DRAW: Stalemate (No legal ciphers left).');
      }
    } else {
      setStatus(
        currentTurn === 'w' 
          ? kingThreatened ? '⚠️ White King is in CHECK!' : 'Your turn: White' 
          : kingThreatened ? '⚠️ Black King is in CHECK!' : 'Opponent turn: Black'
      );
    }
  };

  // Simple MiniMax AI Engine
  const executeAIMove = () => {
    const { isCheckmate: currentCheckmate, isDraw: currentDraw, promotionPending: currentPromo, aiDifficulty: currentDiff, board: currentBoard } = stateRef.current;
    if (currentCheckmate || currentDraw || currentPromo) return;

    // Step 1: Collect all valid black moves
    const allAiMoves: { from: { r: number; c: number }; to: { r: number; c: number }; value: number }[] = [];

    const getPieceValue = (type: 'p' | 'r' | 'n' | 'b' | 'q' | 'k'): number => {
      switch (type) {
        case 'p': return 10;
        case 'n': return 30;
        case 'b': return 30;
        case 'r': return 50;
        case 'q': return 90;
        case 'k': return 9000;
      }
    };

    // Calculate all legal moves for AI (color 'b')
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = currentBoard[r]?.[c];
        if (p && p.color === 'b') {
          const targets = calculateValidMoves(r, c, currentBoard, false);
          targets.forEach(target => {
            // Assess moving benefits
            let valueEvaluated = 0;

            // Captured enemy value
            const enemy = currentBoard[target.r]?.[target.c];
            if (enemy) {
              valueEvaluated += getPieceValue(enemy.type) * 10;
            }

            // Position adjustments: Pawns move down, pieces occupy center
            if (p.type === 'p') {
              valueEvaluated += target.r * 1.5; // push pawns forward
            } else if (p.type === 'n' || p.type === 'b') {
              // Prefer centers
              if (target.c >= 2 && target.c <= 5 && target.r >= 2 && target.r <= 5) {
                valueEvaluated += 2;
              }
            }

            allAiMoves.push({
              from: { r, c },
              to: target,
              value: valueEvaluated
            });
          });
        }
      }
    }

    if (allAiMoves.length === 0) {
      // Stalemate or Checkmate
      return;
    }

    // Difficulty-based chess play Selector
    let chosenMove = allAiMoves[0];

    if (currentDiff === 'easy') {
      // Pick a random legal move
      chosenMove = allAiMoves[Math.floor(Math.random() * allAiMoves.length)];
    } else if (currentDiff === 'medium') {
      // Sort and optionally pick top moves randomly to avoid complete predictability
      allAiMoves.sort((x, y) => y.value - x.value);
      const topSet = allAiMoves.slice(0, Math.min(3, allAiMoves.length));
      chosenMove = topSet[Math.floor(Math.random() * topSet.length)];
    } else {
      // Hard: Always do best direct value action
      allAiMoves.sort((x, y) => y.value - x.value);
      chosenMove = allAiMoves[0];
    }

    // Delay move slightly for realistic thinking illusion!
    setTimeout(() => {
      const { turn: latestTurn, gameMode: latestMode } = stateRef.current;
      // Re-verify that it is still Black's AI turn before executing
      if (latestTurn === 'b' && latestMode === 'ai') {
        movePiece(chosenMove.from.r, chosenMove.from.c, chosenMove.to.r, chosenMove.to.c);
      }
    }, 450);
  };

  // Trigger AI if black's turn & match mode is against AI
  useEffect(() => {
    if (turn === 'b' && gameMode === 'ai') {
      executeAIMove();
    }
  }, [turn, gameMode]);

  const onCellClick = (r: number, c: number) => {
    if (isCheckmate || isDraw || promotionPending) return;

    // AI is thinking block
    if (turn === 'b' && gameMode === 'ai') return;

    const piece = board[r]?.[c];

    // Clicked target matching active moves list?
    const isTargetingMove = validMoves.some(m => m.r === r && m.c === c);

    if (selectedCell && isTargetingMove) {
      // Perform genuine chess move action!
      movePiece(selectedCell.r, selectedCell.c, r, c);
    } else {
      // Attempt selection/re-selection
      if (piece && piece.color === turn) {
        setSelectedCell({ r, c });
        const possible = calculateValidMoves(r, c, board, false);
        setValidMoves(possible);
      } else {
        // Clearing selection
        setSelectedCell(null);
        setValidMoves([]);
      }
    }
  };

  return (
    <div className={`space-y-5 rounded-2xl border p-4 sm:p-5 shadow-2xl transition-all ${
      isLightTheme 
        ? 'bg-white border-slate-200 text-slate-800 shadow-slate-100' 
        : 'bg-[#182533] border-[#101921] text-white'
    }`}>
      
      {/* Game Mode Selector Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3 border-slate-200 dark:border-[#101921]">
        <div>
          <h3 className={`text-sm font-bold flex items-center gap-1.5 uppercase tracking-wide ${
            isLightTheme ? 'text-slate-900' : 'text-white'
          }`}>
            <Swords className="w-4 h-4 text-[#2481cc]" />
            <span>Tactical Binary Chess</span>
          </h3>
          <p className="text-[10px] text-slate-400 font-mono mt-0.5">Disguised Secure Handshake Match</p>
        </div>

        <div className="flex items-center gap-2">
          {/* PVP / AI toggle */}
          <div className="bg-slate-100 dark:bg-[#101921] p-1 rounded-xl flex gap-1 border border-slate-200 dark:border-[#101921]/40">
            <button
              onClick={() => { setGameMode('ai'); initBoard(); }}
              className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer ${
                gameMode === 'ai' 
                  ? 'bg-[#2481cc] text-white shadow-sm' 
                  : 'text-slate-400 hover:text-slate-350'
              }`}
            >
              <Cpu className="w-3 h-3" />
              AI Play
            </button>
            <button
              onClick={() => { setGameMode('pvp'); initBoard(); }}
              className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer ${
                gameMode === 'pvp' 
                  ? 'bg-[#2481cc] text-white shadow-sm' 
                  : 'text-slate-400 hover:text-slate-350'
              }`}
            >
              <User className="w-3 h-3" />
              PVP
            </button>
          </div>

          <button
            onClick={initBoard}
            className={`p-1.5 rounded-lg border transition duration-150 cursor-pointer ${
              isLightTheme 
                ? 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600' 
                : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-400 dark:bg-[#101921]'
            }`}
            title="Reset Game"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* AI Difficulty settings if AI selected */}
      {gameMode === 'ai' && (
        <div className="flex items-center justify-between bg-slate-50 dark:bg-[#101921]/30 p-2 border border-slate-200 dark:border-[#101921]/20 rounded-xl select-none">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Threat AI Difficulty:</span>
          <div className="flex gap-1.5">
            {(['easy', 'medium', 'hard'] as const).map((diff) => (
              <button
                key={diff}
                onClick={() => setAiDifficulty(diff)}
                className={`px-2.5 py-1 text-[9px] font-black uppercase rounded-lg transition cursor-pointer border ${
                  aiDifficulty === diff
                    ? 'bg-amber-600 border-amber-500 text-white shadow-sm'
                    : 'bg-transparent border-transparent text-slate-450 hover:text-slate-300'
                }`}
              >
                {diff}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Captured area - BLACK */}
      <div className="flex items-center gap-2 overflow-x-auto min-h-[30px] p-1.5 border border-slate-100/50 dark:border-slate-850 bg-[#101921]/5 dark:bg-[#101921]/30 rounded-xl">
        <span className="text-[8px] font-mono font-bold uppercase tracking-wider text-slate-400 mr-2">Captured:</span>
        <div className="flex gap-0.5">
          {capturedPieces.w.map((p, idx) => (
            <div key={idx} className="w-6 h-6 grayscale flex items-center justify-center opacity-80" bg-slate-100="true">
              {PIECE_SVGS[`w${p.type}`]}
            </div>
          ))}
        </div>
      </div>

      {/* CHESSBOARD GRID */}
      <div className="relative w-full max-w-[95vw] sm:max-w-[400px] md:max-w-[480px] lg:max-w-[540px] aspect-square mx-auto border-2 border-slate-300 dark:border-[#101921] rounded-2xl overflow-hidden shadow-xl select-none">
        <div className="grid grid-cols-8 grid-rows-8 h-full">
          {Array(8).fill(null).map((_, r) => {
            return Array(8).fill(null).map((_, c) => {
              const piece = board[r]?.[c];
              const isDarkCell = (r + c) % 2 === 1;
              const isSelected = selectedCell?.r === r && selectedCell?.c === c;
              const isValidDestination = validMoves.some(m => m.r === r && m.c === c);

              // Highlights
              let cellBg = isDarkCell 
                ? (isLightTheme ? 'bg-slate-300' : 'bg-[#182533]') 
                : (isLightTheme ? 'bg-slate-50' : 'bg-[#243343]/60');

              if (isSelected) {
                cellBg = 'bg-indigo-600/30 ring-2 ring-indigo-500 ring-inset';
              } else if (isValidDestination) {
                cellBg = isDarkCell ? 'bg-[#2481cc]/25' : 'bg-[#2481cc]/15';
              }

              // Is there a piece?
              const pieceEl = piece ? PIECE_SVGS[`${piece.color}${piece.type}`] : null;

              return (
                <div
                  key={`${r}-${c}`}
                  onClick={() => onCellClick(r, c)}
                  className={`relative flex items-center justify-center cursor-pointer transition-all ${cellBg}`}
                >
                  {/* Grid piece render */}
                  {pieceEl}

                  {/* Dot overlay guide for movement destination */}
                  {isValidDestination && !piece && (
                    <div className="w-2.5 h-2.5 rounded-full bg-[#38bdf8]/75 shadow shadow-[#38bdf8]/40 animate-pulse" />
                  )}

                  {/* Ring overlay when capturing */}
                  {isValidDestination && piece && (
                    <div className="absolute inset-0 border-2 border-dashed border-rose-500 rounded animate-pulse" />
                  )}

                  {/* Selected outline */}
                  {isSelected && (
                    <div className="absolute inset-0 border border-indigo-400 rounded" />
                  )}
                </div>
              );
            });
          })}
        </div>

        {/* PROMOTION SELECTOR POPUP MODAL */}
        {promotionPending && (
          <div className="absolute inset-0 bg-[#101921]/95 backdrop-blur-md flex flex-col items-center justify-center p-4 text-center z-20">
            <Award className="w-8 h-8 text-amber-500 animate-bounce mb-2" />
            <p className="text-xs font-black text-white uppercase tracking-widest mb-1">Decoupled Binary Upgrade</p>
            <p className="text-[10px] text-slate-400 mb-5">Select a polymorphic cipher target to promote pawn:</p>
            <div className="flex gap-3 justify-center">
              {(['q', 'r', 'b', 'n'] as const).map((type) => {
                const mapIconLabel: Record<string, string> = { q: 'Queen', r: 'Rook', b: 'Bishop', n: 'Knight' };
                return (
                  <button
                    key={type}
                    onClick={() => handlePromotionSelect(type)}
                    className="p-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl flex flex-col items-center gap-1.5 transition active:scale-90 scale-95 border border-indigo-400 cursor-pointer text-white"
                  >
                    <div className="w-9 h-9">
                      {PIECE_SVGS[`w${type}`]}
                    </div>
                    <span className="text-[9px] font-bold font-mono">{mapIconLabel[type]}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* CHECKMATE OR DRAW SCREEN OVERLAYS */}
        {(isCheckmate || isDraw) && (
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-4 text-center z-10 animate-fade-in text-white">
            <Swords className="w-9 h-9 text-rose-500 fill-rose-950 mb-3" />
            <h4 className="text-sm font-black uppercase tracking-widest text-rose-500">{isCheckmate ? 'COMPILATION CRITICAL CHECKMATE' : 'CIPHER EXHAUSTION'}</h4>
            <p className="text-xs text-slate-300 font-mono mt-1 mb-5">{status}</p>
            <button
              onClick={initBoard}
              className="bg-[#2481cc] hover:bg-[#1c6fae] text-white font-mono text-xs font-bold py-2.5 px-6 rounded-xl flex items-center gap-1.5 select-none active:scale-95 transition cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Initiate Rescan Connection</span>
            </button>
          </div>
        )}
      </div>

      {/* Captured area - WHITE */}
      <div className="flex items-center gap-2 overflow-x-auto min-h-[30px] p-1.5 border border-slate-100/50 dark:border-slate-850 bg-[#101921]/5 dark:bg-[#101921]/30 rounded-xl">
        <span className="text-[8px] font-mono font-bold uppercase tracking-wider text-slate-400 mr-2">Captured:</span>
        <div className="flex gap-0.5">
          {capturedPieces.b.map((p, idx) => (
            <div key={idx} className="w-6 h-6 flex items-center justify-center opacity-85">
              {PIECE_SVGS[`b${p.type}`]}
            </div>
          ))}
        </div>
      </div>

      {/* LOG & LIVE STATUS */}
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2 p-2 rounded-xl bg-slate-50 dark:bg-[#101921]/40 border border-slate-200 dark:border-[#101921]/30">
          <p className="text-[8px] font-mono text-slate-400 uppercase tracking-widest select-none">Tunnel Handshake State</p>
          <p className={`text-xs font-black truncate mt-1 ${isCheck ? 'text-rose-500 animate-pulse' : ''}`}>
            {status}
          </p>
        </div>

        <div className="p-2 rounded-xl bg-slate-50 dark:bg-[#101921]/40 border border-slate-200 dark:border-[#101921]/30 text-center flex flex-col justify-center">
          <p className="text-[8px] font-mono text-slate-400 uppercase tracking-widest select-none">Active Turn</p>
          <span className="text-xs font-mono font-bold mt-0.5 uppercase">
            {turn === 'w' ? '⚪ WHITE' : '🔵 BLACK AI'}
          </span>
        </div>
      </div>

      {/* MOVE HISTORY LOG */}
      {moveLog.length > 0 && (
        <div className="p-3 bg-[#101921]/15 dark:bg-[#101921]/40 border border-slate-200 dark:border-[#101921]/10 rounded-xl space-y-1.5 max-h-[102px] overflow-y-auto">
          <p className="text-[8px] font-mono text-slate-450 uppercase tracking-wider select-none font-bold">Encapsulated Chess Log Vector</p>
          <div className="flex flex-wrap gap-1">
            {moveLog.map((log, index) => (
              <span
                key={index}
                className="text-[8px] font-mono bg-slate-100 dark:bg-[#101921] border border-slate-200 dark:border-[#101921]/50 px-1.5 py-0.5 rounded text-slate-400 hover:text-white transition"
              >
                {log}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
