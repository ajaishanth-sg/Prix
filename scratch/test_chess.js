// Simulate ChessGame functions with movement to verify checks
const INITIAL_BOARD_LAYOUT = [
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

const generateInitialBoard = () => {
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

const calculateValidMoves = (r, c, currentBoard, ignoreTurnCheckState = false) => {
  const piece = currentBoard[r]?.[c];
  if (!piece) return [];

  const moves = [];
  const color = piece.color;
  const enemyColor = color === 'w' ? 'b' : 'w';

  const isOccupiedByAlly = (tr, tc) => {
    const p = currentBoard[tr]?.[tc];
    return p && p.color === color;
  };

  const isOccupiedByEnemy = (tr, tc) => {
    const p = currentBoard[tr]?.[tc];
    return p && p.color === enemyColor;
  };

  const isEmpty = (tr, tc) => {
    return currentBoard[tr]?.[tc] === null;
  };

  const addMoveIfLegal = (tr, tc) => {
    if (tr >= 0 && tr < 8 && tc >= 0 && tc < 8) {
      if (!isOccupiedByAlly(tr, tc)) {
        moves.push({ r: tr, c: tc });
        return true;
      }
    }
    return false;
  };

  switch (piece.type) {
    case 'p': {
      const direction = color === 'w' ? -1 : 1;
      const startRow = color === 'w' ? 6 : 1;

      if (!ignoreTurnCheckState) {
        if (r + direction >= 0 && r + direction < 8) {
          if (isEmpty(r + direction, c)) {
            moves.push({ r: r + direction, c });
            if (r === startRow && r + 2 * direction >= 0 && r + 2 * direction < 8 && isEmpty(r + 2 * direction, c)) {
              moves.push({ r: r + 2 * direction, c });
            }
          }
        }
      }

      const targetRow = r + direction;
      if (targetRow >= 0 && targetRow < 8) {
        if (ignoreTurnCheckState) {
          if (c - 1 >= 0) moves.push({ r: targetRow, c: c - 1 });
          if (c + 1 < 8) moves.push({ r: targetRow, c: c + 1 });
        } else {
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
            break;
          } else {
            break;
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

  if (!ignoreTurnCheckState) {
    return moves.filter(move => {
      const tempBoard = currentBoard.map(row => [...row]);
      const currentMovingPiece = tempBoard[r][c];
      tempBoard[move.r][move.c] = currentMovingPiece;
      tempBoard[r][c] = null;

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

      if (kingPos.r === -1) return false;

      for (let er = 0; er < 8; er++) {
        for (let ec = 0; ec < 8; ec++) {
          const enemyPiece = tempBoard[er][ec];
          if (enemyPiece && enemyPiece.color === enemyColor) {
            const enemyMoves = calculateValidMoves(er, ec, tempBoard, true);
            if (enemyMoves.some(em => em.r === kingPos.r && em.c === kingPos.c)) {
              return false;
            }
          }
        }
      }
      return true;
    });
  }

  return moves;
};

const checkKingInDanger = (colorToCheck, currentBoard) => {
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

const isNoMovesPossible = (colorToCheck, currentBoard) => {
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

// RUN SIMULATION
try {
  console.log("Initializing chess board...");
  let board = generateInitialBoard();

  // Move White Pawn e2 to e4
  console.log("Simulating move: White Pawn from 6,4 to 4,4...");
  const movingPiece = board[6][4];
  board[4][4] = movingPiece;
  board[6][4] = null;

  console.log("Checking if Black has moves after White's pawn move...");
  const noBlackMoves = isNoMovesPossible('b', board);
  console.log("No Black moves:", noBlackMoves); // Expect false

  console.log("Checking if Black King is in danger...");
  const blackKingInDanger = checkKingInDanger('b', board);
  console.log("Black King in danger:", blackKingInDanger); // Expect false

  // Move Black Pawn e7 to e5
  console.log("Simulating move: Black Pawn from 1,4 to 3,4...");
  const blackPawn = board[1][4];
  board[3][4] = blackPawn;
  board[1][4] = null;

  console.log("Checking if White has moves after Black's pawn move...");
  const noWhiteMoves = isNoMovesPossible('w', board);
  console.log("No White moves:", noWhiteMoves); // Expect false

  console.log("Checking if White King is in danger...");
  const whiteKingInDanger = checkKingInDanger('w', board);
  console.log("White King in danger:", whiteKingInDanger); // Expect false

} catch (e) {
  console.error("CRASH ERROR:", e);
}
