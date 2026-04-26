import { Chess } from 'chess.js';
import AbsorptionState from './stateManager.js';

class AbsorptionEngine {
  constructor(fen = undefined) {
    this.chess = new Chess(fen);
    this.absorptionState = new AbsorptionState();
  }

  reset() {
    this.chess.reset();
    this.absorptionState.reset();
  }

  /**
   * Load a position. Optionally restore saved absorption capabilities.
   * capabilitiesSnapshot should be a plain { square: [types] } object.
   */
  load(fen, capabilitiesSnapshot = {}) {
    try {
      this.chess.load(fen);
      this.absorptionState.reset();
      for (const [sq, caps] of Object.entries(capabilitiesSnapshot)) {
        if (Array.isArray(caps) && caps.length > 0) {
          this.absorptionState.capabilities[sq] = [...caps];
        }
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  fen() {
    return this.chess.fen();
  }

  turn() {
    return this.chess.turn();
  }

  isGameOver() {
    return this.isCheckmate() || this.isStalemate() || this.chess.isInsufficientMaterial() || this.chess.isThreefoldRepetition() || this.chess.isDraw();
  }

  isCheckmate() {
    return this.moves().length === 0 && this.isKingInCheck(this.chess.turn());
  }

  isStalemate() {
    return this.moves().length === 0 && !this.isKingInCheck(this.chess.turn());
  }

  get(square) {
    const piece = this.chess.get(square);
    if (!piece) return null;
    return {
      ...piece,
      capabilities: this.absorptionState.getCapabilities(square)
    };
  }

  /**
   * Returns a plain-object snapshot of the current engine state.
   * Used for save/restore during legal-move searching.
   */
  _snapshot() {
    return {
      fen: this.chess.fen(),
      caps: this.absorptionState.clone()
    };
  }

  _restore(snapshot) {
    this.chess.load(snapshot.fen);
    this.absorptionState = snapshot.caps.clone();
  }

  /**
   * Get all pseudo-legal squares a piece on `square` can move to,
   * taking into account absorbed abilities.
   * forceTurnColor allows us to check opponent pieces during check detection.
   */
  getPseudoLegalMovesForSquare(square, forceTurnColor = null) {
    const pieceInfo = this.get(square);
    if (!pieceInfo) return [];

    const moves = [];
    // The piece's own type + all absorbed types
    const uniqueTypes = [...new Set([pieceInfo.type, ...pieceInfo.capabilities])];

    let tempChess = new Chess(this.chess.fen());
    if (forceTurnColor) {
      // When checking attacks (isKingInCheck), we must prevent our own King from being in check,
      // otherwise chess.js will filter out our attacks. We do this by replacing all opponent pieces
      // (except their king) with our own knights, which preserves blocking logic but removes their attacks.
      const oppColor = forceTurnColor === 'w' ? 'b' : 'w';
      const board = tempChess.board();
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const p = board[r][c];
          if (p && p.color === oppColor && p.type !== 'k') {
            const sq = 'abcdefgh'[c] + (8 - r);
            tempChess.remove(sq);
            tempChess.put({ type: 'n', color: forceTurnColor }, sq);
          }
        }
      }
    }

    // Build a working FEN, optionally spoofing the turn colour
    let workingFen = tempChess.fen();
    if (forceTurnColor && tempChess.turn() !== forceTurnColor) {
      const tokens = workingFen.split(' ');
      tokens[1] = forceTurnColor;
      tokens[2] = '-'; // no castling rights in spoof
      tokens[3] = '-'; // no en-passant in spoof
      workingFen = tokens.join(' ');
    }

    for (const type of uniqueTypes) {
      // Pawns cannot exist on 1st or 8th rank — chess.js will crash with a BigInt error if we try to generate moves for them
      if (type === 'p' && (square[1] === '1' || square[1] === '8')) {
        continue;
      }

      // Clone, place the spoofed piece, ask chess.js for its moves
      const clone = new Chess(workingFen);
      clone.remove(square);
      clone.put({ type, color: pieceInfo.color }, square);

      const typeMoves = clone.moves({ square, verbose: true });

      for (const move of typeMoves) {
        // (Removed king capture safety net so that isKingInCheck can detect attacks on the king)

        // Skip castling moves — absorbed rook cannot grant castling rights
        if (move.flags && (move.flags.includes('k') || move.flags.includes('q'))) {
          // Only allow castling if this is the piece's natural king move
          if (type !== pieceInfo.type || pieceInfo.type !== 'k') continue;
        }

        const isDuplicate = moves.some(
          m => m.to === move.to && m.promotion === move.promotion
        );
        if (!isDuplicate) {
          moves.push({ ...move, piece: pieceInfo.type });
        }
      }
    }

    return moves;
  }

  /**
   * Custom check detection: checks if `color`'s king is attacked
   * by any opponent piece (considering all absorbed abilities).
   */
  isKingInCheck(color) {
    let kingSquare = null;
    const board = this.chess.board();

    outer:
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (p && p.type === 'k' && p.color === color) {
          kingSquare = 'abcdefgh'[c] + (8 - r);
          break outer;
        }
      }
    }

    if (!kingSquare) return false;

    const opponentColor = color === 'w' ? 'b' : 'w';

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const sq = 'abcdefgh'[c] + (8 - r);
        const p = this.chess.get(sq);
        if (p && p.color === opponentColor) {
          const oppMoves = this.getPseudoLegalMovesForSquare(sq, opponentColor);
          if (oppMoves.some(m => m.to === kingSquare)) return true;
        }
      }
    }
    return false;
  }

  /**
   * Executes a move on the internal board (mutates state).
   * Returns the move object on success, false on failure.
   *
   * Strategy: for each absorbed type, temporarily replace the piece with
   * that type and ask chess.js to make the move. If it accepts, we
   * fix the piece type back to the real type and update absorption state.
   */
  executeMoveSilently(from, to, promotion = 'q') {
    const movingPiece = this.chess.get(from);
    if (!movingPiece) return false;

    const targetPiece = this.chess.get(to);
    const capturedType = targetPiece ? targetPiece.type : null;
    const capturedCaps = targetPiece ? this.absorptionState.getCapabilities(to) : [];

    const uniqueTypes = [
      ...new Set([movingPiece.type, ...this.absorptionState.getCapabilities(from)])
    ];

    const savedFen = this.chess.fen();
    let successMove = null;
    let usedPromotion = null;

    for (const spoofType of uniqueTypes) {
      // Pawns cannot move from 1st or 8th rank — chess.js will crash
      if (spoofType === 'p' && (from[1] === '1' || from[1] === '8')) {
        continue;
      }

      // Put the spoofed piece (chess.js will now recognise its move pattern)
      this.chess.remove(from);
      this.chess.put({ type: spoofType, color: movingPiece.color }, from);

      try {
        const isPawnSpoof = spoofType === 'p';
        const promParam = isPawnSpoof ? (promotion || 'q') : undefined;
        
        successMove = this.chess.move({ from, to, promotion: promParam });
        if (successMove) {
          usedPromotion = successMove.promotion || null;
          break;
        }
      } catch (_) {
        // move rejected — restore and try next type
      }
      this.chess.load(savedFen);
    }

    if (!successMove) {
      // All spoof types failed — restore and bail
      this.chess.load(savedFen);
      return false;
    }

    // chess.js has now advanced the turn. The piece at `to` may be the wrong
    // type (spoofed). Fix it back to the real piece type.
    let finalType = movingPiece.type;
    let actualPromotion = undefined;

    if (movingPiece.type === 'p' && (to[1] === '8' || to[1] === '1')) {
      finalType = usedPromotion || promotion || 'q';
      actualPromotion = finalType;
    }

    // chess.js put the spoofed piece at `to` — overwrite with real type
    this.chess.put({ type: finalType, color: movingPiece.color }, to);

    // Update absorption capabilities
    if (movingPiece.type !== 'k') {
      // Kings don't absorb — and don't get castling from absorbed rooks
      this.absorptionState.movePiece(from, to, capturedType, capturedCaps);
    } else {
      // King moves: just relocate without absorbing
      this.absorptionState.movePiece(from, to, null, []);
    }

    const returnMove = { ...successMove, piece: movingPiece.type };
    if (actualPromotion) {
      returnMove.promotion = actualPromotion;
    } else {
      delete returnMove.promotion;
    }

    return returnMove;
  }

  /**
   * Returns all fully legal moves for the piece on `square`
   * (filters pseudo-legal moves that leave own king in check).
   */
  getLegalMoves(square) {
    const pieceInfo = this.get(square);
    if (!pieceInfo || pieceInfo.color !== this.chess.turn()) return [];

    const pseudoMoves = this.getPseudoLegalMovesForSquare(square);
    const legalMoves = [];

    const snapshot = this._snapshot();

    for (const move of pseudoMoves) {
      // Prevent capturing the king as a valid move (since we removed this from pseudo moves)
      const targetPiece = this.chess.get(move.to);
      if (targetPiece && targetPiece.type === 'k') continue;

      const result = this.executeMoveSilently(square, move.to, move.promotion || 'q');

      if (result !== false) {
        if (!this.isKingInCheck(pieceInfo.color)) {
          legalMoves.push(move);
        }
      }

      this._restore(snapshot);
    }

    return legalMoves;
  }

  /**
   * Returns all legal moves for the side to move.
   */
  moves() {
    const allMoves = [];
    const turn = this.chess.turn();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const sq = 'abcdefgh'[c] + (8 - r);
        const p = this.chess.get(sq);
        if (p && p.color === turn) {
          allMoves.push(...this.getLegalMoves(sq));
        }
      }
    }
    return allMoves;
  }

  /**
   * Public move API — validates and applies the move.
   * Returns the move object on success, null on failure.
   */
  move({ from, to, promotion = 'q' }) {
    // Validate first
    const legalMoves = this.getLegalMoves(from);
    const isValid = legalMoves.find(
      m => m.to === to && (!m.promotion || m.promotion === promotion)
    );
    if (!isValid) return null;

    const result = this.executeMoveSilently(from, to, promotion);
    return result || null;
  }
}

export default AbsorptionEngine;