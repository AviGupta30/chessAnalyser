import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { useEngine } from '../../engine/useEngine';
import EvalBar from '../EvalBar';
import GameSidebar from '../GameSidebar';

// ── FIXED IMPORT TO MATCH YOUR EXACT FILE NAME ('absorbtion.js') ──
import AbsorptionEngine from '../../engine/variants/absorption/absorbtion';

const STD_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const UNICODE_PIECES = {
    wQ: '♕', wR: '♖', wB: '♗', wN: '♘',
    bQ: '♛', bR: '♜', bB: '♝', bN: '♞'
};

// ── HELPER: MAP CHESS SQUARES TO PIXEL GRID FOR THE OVERLAY ──
const getSquareCoords = (sq, orientation) => {
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const file = sq[0];
    const rank = parseInt(sq[1], 10);

    let x = files.indexOf(file);
    let y = 8 - rank;

    if (orientation === 'black') {
        x = 7 - x;
        y = 7 - y;
    }

    return { left: `${x * 12.5}%`, top: `${y * 12.5}%` };
};

// ── MATERIAL CALCULATOR FOR TRUE BRILLIANT DETECTION ──
const getMaterialScore = (fen) => {
    const chess = new Chess(fen);
    const board = chess.board();
    let whiteMaterial = 0; let blackMaterial = 0;
    const values = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
    board.forEach(row => {
        row.forEach(piece => {
            if (piece) {
                if (piece.color === 'w') whiteMaterial += values[piece.type];
                else blackMaterial += values[piece.type];
            }
        });
    });
    return { w: whiteMaterial, b: blackMaterial };
};

const calculateWinProb = (cp, mate) => {
    if (mate !== null && mate !== undefined) return mate > 0 ? 100 : 0;
    if (cp === undefined || cp === null) return 50;
    return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
};

// ── UPGRADED EXPLICIT COACH ENGINE ──
const getMoveClassification = (delta, moveSan, missedMoveSan, isSacrifice) => {
    const cleanSan = (san) => san ? san.replace(/[\+#\!\?]/g, '') : '';
    const isTopEngineChoice = cleanSan(moveSan) === cleanSan(missedMoveSan);

    const betterMoveText = (!isTopEngineChoice && missedMoveSan)
        ? ` You played ${moveSan}, but the engine preferred ${missedMoveSan}.`
        : '';

    if (isSacrifice && delta <= 3) {
        return { tag: 'Brilliant', color: '#22d3ee', icon: '!!', msg: `Brilliant! ${moveSan} is a spectacular piece sacrifice.` };
    }

    if (isTopEngineChoice) return { tag: 'Best', color: '#16a34a', icon: '★', msg: `Best move! ${moveSan} is exactly the optimal line.` };
    if (delta <= 2) return { tag: 'Excellent', color: '#4ade80', icon: '✓', msg: `Excellent choice.${betterMoveText}` };
    if (delta <= 6) return { tag: 'Good', color: '#60a5fa', icon: '👍', msg: `Good move.${betterMoveText}` };
    if (delta <= 12) return { tag: 'Inaccuracy', color: '#facc15', icon: '?!', msg: `Inaccuracy.${betterMoveText}` };
    if (delta <= 20) return { tag: 'Mistake', color: '#f97316', icon: '?', msg: `Mistake.${betterMoveText}` };

    return { tag: 'Blunder', color: '#ef4444', icon: '??', msg: `A critical blunder!${betterMoveText}` };
};

export default function AnalyzerGame({
    activeTheme,
    wizardPieceComponents,
    wizardImages,
    gameMode,
    fetchedGames,
    boardOrientation
}) {
    const [displayFen, setDisplayFen] = useState(STD_FEN);
    const [startFen, setStartFen] = useState(STD_FEN);
    const [history, setHistory] = useState([]);
    const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);

    const absorptionEngineRef = useRef(new AbsorptionEngine());
    const [absorptionCapabilities, setAbsorptionCapabilities] = useState({});
    // Squares where the selected piece can move (shown as dots)
    const [legalMoveDots, setLegalMoveDots] = useState([]);

    const [isPracticeMode, setIsPracticeMode] = useState(false);
    const [userPracticeColor, setUserPracticeColor] = useState('w');
    const botTimerRef = useRef(null);

    const [promotionMove, setPromotionMove] = useState(null);
    const [showHint, setShowHint] = useState(false);
    const [isAutoPlaying, setIsAutoPlaying] = useState(false);
    const [moveFrom, setMoveFrom] = useState(null);

    const [invalidSquares, setInvalidSquares] = useState([]);
    const invalidTimeoutRef = useRef(null);

    const { engineState, analyzePosition, stopAnalysis } = useEngine();

    useEffect(() => {
        if (gameMode === 'absorption' && currentMoveIndex >= 0) {
            setAbsorptionCapabilities(history[currentMoveIndex].capabilities || {});
        } else if (currentMoveIndex === -1) {
            setAbsorptionCapabilities({});
        }
    }, [currentMoveIndex, gameMode, history]);

    const gameStatus = useMemo(() => {
        if (gameMode === 'absorption') {
            const eng = absorptionEngineRef.current;
            const caps = currentMoveIndex >= 0 && history[currentMoveIndex]
                ? (history[currentMoveIndex].capabilities || {})
                : {};
            eng.load(displayFen, caps);
            if (eng.isCheckmate()) return 'Checkmate!';
            if (eng.isStalemate()) return 'Stalemate!';
            if (eng.chess.isInsufficientMaterial()) return 'Draw by Insufficient Material';
            if (eng.chess.isThreefoldRepetition()) return 'Draw by Repetition';
            if (eng.chess.isDraw()) return 'Draw!';
            return null;
        } else {
            const chess = new Chess(displayFen);
            if (chess.isCheckmate()) return 'Checkmate!';
            if (chess.isStalemate()) return 'Stalemate!';
            if (chess.isInsufficientMaterial()) return 'Draw by Insufficient Material';
            if (chess.isThreefoldRepetition()) return 'Draw by Repetition';
            if (chess.isDraw()) return 'Draw!';
            return null;
        }
    }, [displayFen, gameMode, currentMoveIndex, history]);

    useEffect(() => {
        if (gameMode === 'standard' && displayFen && (engineState.status === 'ready' || engineState.status === 'analysing')) {
            analyzePosition(displayFen, isPracticeMode ? 14 : 18);
        } else if (gameMode === 'absorption') {
            stopAnalysis();
        }
    }, [displayFen, engineState.status, analyzePosition, isPracticeMode, gameMode, stopAnalysis]);

    useEffect(() => {
        if (gameMode === 'standard' && engineState.status === 'ready' && engineState.result && currentMoveIndex >= 0) {
            setHistory(prevHistory => {
                const newHistory = [...prevHistory];
                const currentMove = newHistory[currentMoveIndex];

                if (currentMove && currentMove.savedEval === undefined) {
                    const cp = engineState.result.cp;
                    const mate = engineState.result.mate;
                    const currentWinProb = calculateWinProb(cp, mate);

                    let prevWinProb = 50;
                    let missedMoveUci = null;
                    let fenBeforeMove = startFen;

                    if (currentMoveIndex > 0) {
                        const prevMove = newHistory[currentMoveIndex - 1];
                        fenBeforeMove = prevMove.fen;
                        if (prevMove && prevMove.savedEval) {
                            prevWinProb = prevMove.savedEval.winProb;
                            missedMoveUci = prevMove.savedEval.bestMove;
                        }
                    }

                    let missedMoveSan = null;
                    if (missedMoveUci) {
                        try {
                            const temp = new Chess(fenBeforeMove);
                            const m = temp.move({
                                from: missedMoveUci.substring(0, 2),
                                to: missedMoveUci.substring(2, 4),
                                promotion: missedMoveUci.length === 5 ? missedMoveUci[4] : 'q'
                            });
                            if (m) missedMoveSan = m.san;
                        } catch (e) { console.error(e); }
                    }

                    const matBefore = getMaterialScore(fenBeforeMove);
                    const matAfter = getMaterialScore(currentMove.fen);
                    const isWhiteMove = currentMove.color === 'w';
                    let isSacrifice = false;

                    if (isWhiteMove) {
                        const whiteDiff = matAfter.w - matBefore.w;
                        const blackDiff = matAfter.b - matBefore.b;
                        if (whiteDiff < blackDiff) isSacrifice = true;
                    } else {
                        const blackDiff = matAfter.b - matBefore.b;
                        const whiteDiff = matAfter.w - matBefore.w;
                        if (blackDiff < whiteDiff) isSacrifice = true;
                    }

                    const winProbDelta = isWhiteMove ? (prevWinProb - currentWinProb) : (currentWinProb - prevWinProb);
                    const classification = getMoveClassification(winProbDelta, currentMove.san, missedMoveSan, isSacrifice);

                    newHistory[currentMoveIndex] = {
                        ...currentMove,
                        savedEval: {
                            cp: cp,
                            mate: mate,
                            bestMove: engineState.result.bestMove,
                            winProb: currentWinProb,
                            classification: classification
                        }
                    };
                }
                return newHistory;
            });
        }
    }, [engineState.status, engineState.result, currentMoveIndex, startFen, gameMode]);

    useEffect(() => {
        if (gameMode === 'standard' && isPracticeMode && engineState.status === 'ready' && engineState.result?.bestMove && !isAutoPlaying) {
            const temp = new Chess(displayFen);

            if (temp.turn() !== userPracticeColor && !temp.isGameOver()) {
                botTimerRef.current = setTimeout(() => {
                    const uci = engineState.result.bestMove;
                    const move = temp.move({
                        from: uci.substring(0, 2),
                        to: uci.substring(2, 4),
                        promotion: uci.length === 5 ? uci[4] : undefined
                    });

                    if (move) {
                        const newFen = temp.fen();
                        setHistory(prev => {
                            const newHistory = prev.slice(0, currentMoveIndex + 1);
                            newHistory.push({ ...move, fen: newFen });
                            return newHistory;
                        });
                        setCurrentMoveIndex(prev => prev + 1);
                        setDisplayFen(newFen);
                        setShowHint(false);
                    }
                }, 600);

                return () => clearTimeout(botTimerRef.current);
            }
        }
    }, [isPracticeMode, engineState.status, engineState.result, displayFen, userPracticeColor, currentMoveIndex, isAutoPlaying, gameMode]);

    // ── FULLY RESTORED AUTO-PLAYER LOGIC ──
    const playContinuation = useCallback(() => {
        const pv = engineState.result?.pv;
        if (!pv || pv.length === 0 || isAutoPlaying || gameMode === 'absorption') return;

        setIsAutoPlaying(true);
        setShowHint(true);
        setMoveFrom(null);

        let currentIndex = 0;

        const playNextMove = (currentFen, histArr) => {
            if (currentIndex >= Math.min(pv.length, 5)) {
                setIsAutoPlaying(false);
                return;
            }

            const uci = pv[currentIndex];
            const tempBoard = new Chess(currentFen);

            try {
                const move = tempBoard.move({
                    from: uci.substring(0, 2),
                    to: uci.substring(2, 4),
                    promotion: uci.length === 5 ? uci[4] : 'q'
                });

                if (move) {
                    const newFen = tempBoard.fen();
                    const newHistory = [...histArr, { ...move, fen: newFen }];

                    setHistory(newHistory);
                    setCurrentMoveIndex(newHistory.length - 1);
                    setDisplayFen(newFen);

                    currentIndex++;
                    setTimeout(() => playNextMove(newFen, newHistory), 800);
                } else {
                    setIsAutoPlaying(false);
                }
            } catch {
                setIsAutoPlaying(false);
            }
        };

        playNextMove(displayFen, history.slice(0, currentMoveIndex + 1));
    }, [engineState.result, displayFen, history, currentMoveIndex, isAutoPlaying, gameMode]);

    /**
     * Returns an engine ready to evaluate/execute the CURRENT position.
     * For absorption: loads the live ref with the correct FEN + capabilities.
     * For standard: returns a fresh chess.js instance.
     */
    const getActiveEngine = useCallback(() => {
        if (gameMode === 'absorption') {
            const eng = absorptionEngineRef.current;
            const caps = currentMoveIndex >= 0 && history[currentMoveIndex]
                ? (history[currentMoveIndex].capabilities || {})
                : {};
            eng.load(displayFen, caps);
            return eng;
        }
        return new Chess(displayFen);
    }, [gameMode, displayFen, currentMoveIndex, history]);

    const flashInvalidMove = (source, target) => {
        setInvalidSquares([source, target]);
        if (invalidTimeoutRef.current) clearTimeout(invalidTimeoutRef.current);
        invalidTimeoutRef.current = setTimeout(() => setInvalidSquares([]), 400);
    };

    // Consolidated move logic — always uses a freshly-synced engine
    const processMoveAttempt = useCallback((sourceSquare, targetSquare) => {
        try {
            const temp = getActiveEngine();
            if (isPracticeMode && temp.turn() !== userPracticeColor) return false;

            let possibleMoves = [];
            let isPromotion = false;

            if (gameMode === 'absorption') {
                possibleMoves = temp.getLegalMoves(sourceSquare);
                isPromotion = possibleMoves.some(
                    m => m.to === targetSquare &&
                    m.piece === 'p' &&
                    (targetSquare[1] === '8' || targetSquare[1] === '1')
                );
            } else {
                possibleMoves = temp.moves({ verbose: true });
                isPromotion = possibleMoves.some(
                    m => m.from === sourceSquare && m.to === targetSquare && m.flags.includes('p')
                );
            }

            if (isPromotion) {
                const validPromotion = possibleMoves.find(
                    m => (m.from ? m.from === sourceSquare : true) &&
                    m.to === targetSquare &&
                    (m.promotion === 'q' || m.flags?.includes('p'))
                );
                if (!validPromotion) {
                    flashInvalidMove(sourceSquare, targetSquare);
                    return false;
                }
                setPromotionMove({ from: sourceSquare, to: targetSquare, color: temp.turn() });
                return true;
            }

            // Re-sync before actually executing so we work on a clean state
            const temp2 = getActiveEngine();
            const move = temp2.move({ from: sourceSquare, to: targetSquare, promotion: 'q' });

            if (!move) {
                flashInvalidMove(sourceSquare, targetSquare);
                return false;
            }

            const newFen = temp2.fen();
            const currentCaps = gameMode === 'absorption'
                ? { ...temp2.absorptionState.capabilities }
                : {};

            const newHistory = history.slice(0, currentMoveIndex + 1);
            newHistory.push({ ...move, fen: newFen, capabilities: currentCaps });

            setHistory(newHistory);
            setCurrentMoveIndex(newHistory.length - 1);
            setDisplayFen(newFen);
            setShowHint(false);
            setLegalMoveDots([]);
            if (gameMode === 'absorption') setAbsorptionCapabilities(currentCaps);
            return true;
        } catch (e) {
            console.error('processMoveAttempt error:', e);
            return false;
        }
    }, [getActiveEngine, gameMode, isPracticeMode, userPracticeColor, history, currentMoveIndex]);

    const onDrop = useCallback(({ sourceSquare, targetSquare }) => {
        if (!targetSquare || isAutoPlaying) return false;
        setMoveFrom(null);
        setLegalMoveDots([]);
        return processMoveAttempt(sourceSquare, targetSquare);
    }, [isAutoPlaying, processMoveAttempt]);

    const onSquareClick = useCallback(({ square } = {}) => {
        if (!square || isAutoPlaying) return;

        const temp = getActiveEngine();

        if (isPracticeMode && temp.turn() !== userPracticeColor) {
            setMoveFrom(null);
            setLegalMoveDots([]);
            return;
        }

        // No piece selected yet — try to select one
        if (!moveFrom) {
            const piece = temp.get(square);
            if (piece && piece.color === temp.turn()) {
                setMoveFrom(square);
                // Compute legal destinations and show dots
                const legalMoves = gameMode === 'absorption'
                    ? temp.getLegalMoves(square)
                    : temp.moves({ square, verbose: true });
                setLegalMoveDots(legalMoves.map(m => m.to));
            }
            return;
        }

        // Clicking the same square deselects
        if (square === moveFrom) {
            setMoveFrom(null);
            setLegalMoveDots([]);
            return;
        }

        // Try to move
        const moveSuccess = processMoveAttempt(moveFrom, square);
        if (!moveSuccess) {
            // Maybe user wants to select a different piece
            const piece = temp.get(square);
            if (piece && piece.color === temp.turn()) {
                setMoveFrom(square);
                const legalMoves = gameMode === 'absorption'
                    ? temp.getLegalMoves(square)
                    : temp.moves({ square, verbose: true });
                setLegalMoveDots(legalMoves.map(m => m.to));
            } else {
                setMoveFrom(null);
                setLegalMoveDots([]);
            }
        } else {
            setMoveFrom(null);
            setLegalMoveDots([]);
        }
    }, [moveFrom, getActiveEngine, isPracticeMode, userPracticeColor, isAutoPlaying, gameMode, processMoveAttempt]);

    const executePromotion = (promoteTo) => {
        if (!promotionMove) return;
        const temp = getActiveEngine();

        const move = temp.move({ from: promotionMove.from, to: promotionMove.to, promotion: promoteTo });

        if (move) {
            const newFen = temp.fen();
            const currentCaps = gameMode === 'absorption' ? temp.absorptionState.clone().capabilities : {};
            const newHistory = history.slice(0, currentMoveIndex + 1);
            newHistory.push({ ...move, fen: newFen, capabilities: currentCaps });

            setHistory(newHistory);
            setCurrentMoveIndex(newHistory.length - 1);
            setDisplayFen(newFen);
            setShowHint(false);
            if (gameMode === 'absorption') setAbsorptionCapabilities(currentCaps);
        }
        setPromotionMove(null);
    };

    const cancelPromotion = () => {
        setPromotionMove(null);
        setDisplayFen(prev => prev.endsWith(' ') ? prev.trim() : prev + ' ');
    };

    const togglePractice = () => {
        if (isPracticeMode) {
            clearTimeout(botTimerRef.current);
            setIsPracticeMode(false);
        } else {
            setIsPracticeMode(true);
            setUserPracticeColor(new Chess(displayFen).turn());
            setShowHint(false);
            setMoveFrom(null);
        }
    };

    const loadGamePgn = useCallback((pgn) => {
        if (!pgn) return;
        try {
            stopAnalysis();
            setIsPracticeMode(false);
            setMoveFrom(null);
            const loader = new Chess();
            loader.loadPgn(pgn);
            const baseFen = loader.header()?.FEN || STD_FEN;
            const rawHistory = loader.history({ verbose: true });

            const replayBoard = new Chess(baseFen);
            const enrichedHistory = rawHistory.map(move => {
                replayBoard.move(move.san);
                return { ...move, fen: replayBoard.fen() };
            });

            setStartFen(baseFen);
            setHistory(enrichedHistory);
            setCurrentMoveIndex(-1);
            setDisplayFen(baseFen);
            setShowHint(false);
        } catch (err) { alert('Failed to load this game.'); }
    }, [stopAnalysis]);

    const undoPracticeMove = useCallback(() => {
        if (!isPracticeMode || isAutoPlaying) return;
        clearTimeout(botTimerRef.current);
        setMoveFrom(null);

        setHistory(prev => {
            const currentFen = prev.length > 0 ? prev[prev.length - 1].fen : startFen;
            const temp = new Chess(currentFen);
            const isOurTurn = temp.turn() === userPracticeColor;

            const dropCount = (gameMode === 'standard' && isOurTurn) ? 2 : 1;

            if (prev.length < dropCount) return prev;

            const newHistory = prev.slice(0, prev.length - dropCount);
            const newFen = newHistory.length > 0 ? newHistory[newHistory.length - 1].fen : startFen;

            setDisplayFen(newFen);
            setCurrentMoveIndex(newHistory.length - 1);
            setShowHint(false);
            return newHistory;
        });
    }, [isPracticeMode, userPracticeColor, startFen, isAutoPlaying, gameMode]);

    const goToMove = useCallback((idx) => {
        if (history.length === 0 || isPracticeMode || isAutoPlaying) return;
        const boundedIdx = Math.max(-1, Math.min(history.length - 1, idx));
        setCurrentMoveIndex(boundedIdx);
        setDisplayFen(boundedIdx === -1 ? startFen : history[boundedIdx].fen);
        setShowHint(false);
        setMoveFrom(null);
        setLegalMoveDots([]);
    }, [history, startFen, isPracticeMode, isAutoPlaying]);

    const currentIdxRef = useRef(-1);
    useEffect(() => { currentIdxRef.current = currentMoveIndex; }, [currentMoveIndex]);

    useEffect(() => {
        const onKey = (e) => {
            if (['INPUT', 'TEXTAREA'].includes(e.target.tagName) || isPracticeMode || isAutoPlaying) return;
            if (e.key === 'ArrowLeft') { e.preventDefault(); goToMove(currentIdxRef.current - 1); }
            else if (e.key === 'ArrowRight') { e.preventDefault(); goToMove(currentIdxRef.current + 1); }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [goToMove, isPracticeMode, isAutoPlaying]);

    const dynamicSquareStyles = invalidSquares.reduce((acc, sq) => {
        acc[sq] = { animation: 'errorFlash 0.4s ease-out forwards' };
        return acc;
    }, {});

    // Highlight selected piece
    if (moveFrom) {
        dynamicSquareStyles[moveFrom] = {
            ...dynamicSquareStyles[moveFrom],
            backgroundColor: 'rgba(255, 255, 0, 0.45)',
            boxShadow: 'inset 0 0 0 3px rgba(255,200,0,0.9)',
        };
    }

    // Show legal move dots on destination squares
    legalMoveDots.forEach(sq => {
        const hasPiece = (() => {
            try { return !!new Chess(displayFen).get(sq); } catch { return false; }
        })();
        dynamicSquareStyles[sq] = {
            ...dynamicSquareStyles[sq],
            background: hasPiece
                ? 'radial-gradient(circle, rgba(255,60,60,0.55) 60%, transparent 65%)'
                : 'radial-gradient(circle, rgba(0,0,0,0.25) 28%, transparent 32%)',
            cursor: 'pointer',
        };
    });

    const boardOptions = {
        id: "analyzer-board",
        position: displayFen,
        onPieceDrop: onDrop,
        onSquareClick: onSquareClick,
        boardOrientation: boardOrientation,
        arrows: showHint && engineState.result?.bestMove && engineState.result.bestMove.length >= 4 && !isPracticeMode && gameMode === 'standard'
            ? [{ startSquare: engineState.result.bestMove.substring(0, 2), endSquare: engineState.result.bestMove.substring(2, 4), color: 'rgba(79,142,255,0.8)' }]
            : [],
        animationDurationInMs: 200,
        showAnimations: true,
        allowDragging: isAutoPlaying
            ? false
            : isPracticeMode
                ? (new Chess(displayFen).turn() === userPracticeColor)
                : true,
        boardStyle: { borderRadius: '4px', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' },
        darkSquareStyle: { backgroundColor: activeTheme.board.dark },
        lightSquareStyle: { backgroundColor: activeTheme.board.light },
        squareStyles: dynamicSquareStyles
    };

    if (activeTheme.pieces === 'wizard') {
        boardOptions.pieces = wizardPieceComponents;
    }

    return (
        <main style={{ display: 'flex', gap: '2rem', justifyContent: 'center', alignItems: 'flex-start' }}>
            {fetchedGames.length > 0 && (
                <div style={{ width: '250px', maxHeight: '70vh', overflowY: 'auto', background: activeTheme.global.surface, padding: '1rem', borderRadius: '8px', border: `1px solid ${activeTheme.global.border}` }}>
                    <h3 style={{ marginTop: 0 }}>Games</h3>
                    {fetchedGames.map((g, i) => (
                        <div key={i} onClick={() => loadGamePgn(g.pgn)} style={{ padding: '0.5rem', marginBottom: '0.5rem', background: activeTheme.global.bg, borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>
                            {g.pgn.match(/\[White "([^"]+)"\]/)?.[1]} vs {g.pgn.match(/\[Black "([^"]+)"\]/)?.[1]}
                        </div>
                    ))}
                </div>
            )}

            <div style={{ display: 'flex', gap: '1rem', height: '600px' }}>
                <EvalBar result={engineState.result} status={gameMode === 'absorption' ? 'disabled' : engineState.status} />
                <div style={{ width: '600px', position: 'relative' }}>

                    {gameStatus && (
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', zIndex: 10, display: 'flex', justifyContent: 'center', alignItems: 'center', pointerEvents: 'none', borderRadius: '4px' }}>
                            <div style={{ background: activeTheme.global.surface, color: activeTheme.global.accent, padding: '1.5rem 3rem', borderRadius: '12px', fontSize: '2.5rem', fontWeight: 'bold', border: `2px solid ${activeTheme.global.border}`, boxShadow: '0 10px 30px rgba(0,0,0,0.5)', textTransform: 'uppercase', letterSpacing: '2px', textAlign: 'center' }}>
                                {gameStatus}
                            </div>
                        </div>
                    )}

                    {promotionMove && (
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 20, display: 'flex', justifyContent: 'center', alignItems: 'center', borderRadius: '4px' }}>
                            <div style={{ background: activeTheme.global.surface, padding: '2rem', borderRadius: '12px', border: `1px solid ${activeTheme.global.border}`, boxShadow: '0 10px 30px rgba(0,0,0,0.5)', textAlign: 'center' }}>
                                <h3 style={{ marginTop: 0, marginBottom: '1.5rem', color: activeTheme.global.text }}>Promote Pawn To:</h3>
                                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                                    {['q', 'r', 'b', 'n'].map(p => {
                                        const pieceKey = `${promotionMove.color}${p.toUpperCase()}`;
                                        const imgSrc = activeTheme.pieces === 'wizard' ? wizardImages[pieceKey] : null;
                                        return (
                                            <div key={p} onClick={() => executePromotion(p)} style={{ width: '70px', height: '70px', cursor: 'pointer', background: activeTheme.board.light, borderRadius: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center', transition: 'transform 0.2s', border: `2px solid ${activeTheme.global.border}` }} onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'} onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}>
                                                {activeTheme.pieces === 'wizard' ? <img src={imgSrc} alt={pieceKey} style={{ width: '80%', height: '80%', objectFit: 'contain' }} /> : <span style={{ fontSize: '3rem', color: '#000' }}>{UNICODE_PIECES[pieceKey]}</span>}
                                            </div>
                                        );
                                    })}
                                </div>
                                <button onClick={cancelPromotion} style={{ marginTop: '1.5rem', padding: '0.5rem 2rem', cursor: 'pointer', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '1rem', fontWeight: 'bold' }}>Cancel</button>
                            </div>
                        </div>
                    )}

                    {gameMode === 'absorption' && Object.entries(absorptionCapabilities).map(([sq, caps]) => {
                        if (!caps || caps.length === 0) return null;
                        const coords = getSquareCoords(sq, boardOrientation);
                        return (
                            <div key={sq} style={{
                                position: 'absolute', left: coords.left, top: coords.top,
                                width: '12.5%', height: '12.5%', pointerEvents: 'none', zIndex: 12,
                                display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'flex-start', padding: '4px'
                            }}>
                                {caps.map((c, i) => (
                                    <span key={i} style={{ background: activeTheme.global.accent, color: '#fff', fontSize: '0.7rem', padding: '2px 4px', borderRadius: '4px', margin: '1px', fontWeight: 'bold', boxShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
                                        +{c.toUpperCase()}
                                    </span>
                                ))}
                            </div>
                        )
                    })}

                    <Chessboard options={boardOptions} />

                    <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '1rem', opacity: (isPracticeMode || isAutoPlaying) ? 0.3 : 1, pointerEvents: (isPracticeMode || isAutoPlaying) ? 'none' : 'auto' }}>
                        <button onClick={() => goToMove(-1)} style={{ background: 'transparent', color: activeTheme.global.text, border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}>⏮</button>
                        <button onClick={() => goToMove(currentMoveIndex - 1)} style={{ background: 'transparent', color: activeTheme.global.text, border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}>◀</button>
                        <button onClick={() => goToMove(currentMoveIndex + 1)} style={{ background: 'transparent', color: activeTheme.global.text, border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}>▶</button>
                        <button onClick={() => goToMove(history.length - 1)} style={{ background: 'transparent', color: activeTheme.global.text, border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}>⏭</button>
                    </div>
                </div>
            </div>

            <GameSidebar
                engineState={engineState}
                history={history}
                currentMoveIndex={currentMoveIndex}
                onMoveClick={goToMove}
                isPracticeMode={isPracticeMode}
                onTogglePractice={togglePractice}
                onUndo={undoPracticeMove}
                startFen={startFen}
                activeTheme={activeTheme}
                showHint={showHint}
                setShowHint={setShowHint}
                playContinuation={playContinuation}
                isAutoPlaying={isAutoPlaying}
            />
        </main>
    );
}