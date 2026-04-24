import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { useEngine } from './engine/useEngine';
import EvalBar from './components/EvalBar';
import GameSidebar from './components/GameSidebar';
import { fetchUserGames } from './services/chessApi';
import { useMultiplayer } from './hooks/useMultiplayer';
import MultiplayerLobby from './components/multiplayer/MultiplayerLobby';
import MultiplayerGame from './components/multiplayer/MultiplayerGame';

// ── 1. EXPLICIT IMPORTS FOR IMAGES ──
import wP_wiz from './assets/pieces/wizard/wP.png';
import wN_wiz from './assets/pieces/wizard/wN.png';
import wB_wiz from './assets/pieces/wizard/wB.png';
import wR_wiz from './assets/pieces/wizard/wR.png';
import wQ_wiz from './assets/pieces/wizard/wQ.png';
import wK_wiz from './assets/pieces/wizard/wK.png';
import bP_wiz from './assets/pieces/wizard/bP.png';
import bN_wiz from './assets/pieces/wizard/bN.png';
import bB_wiz from './assets/pieces/wizard/bB.png';
import bR_wiz from './assets/pieces/wizard/bR.png';
import bQ_wiz from './assets/pieces/wizard/bQ.png';
import bK_wiz from './assets/pieces/wizard/bK.png';

const STD_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const THEMES = {
    classic: {
        name: 'Classic Standard',
        board: { light: '#ebecd0', dark: '#739552' },
        global: { bg: '#0b0f19', surface: '#1e293b', text: '#ffffff', accent: '#3b82f6', border: '#334155' },
        pieces: 'standard'
    },
    wizard: {
        name: 'Harry Potter (Wizard)',
        board: { light: '#a8a29e', dark: '#44403c' },
        global: { bg: '#1c1917', surface: '#292524', text: '#e7e5e4', accent: '#d97706', border: '#44403c' },
        pieces: 'wizard'
    }
};

const WIZARD_IMAGES = {
    wP: wP_wiz, wN: wN_wiz, wB: wB_wiz, wR: wR_wiz, wQ: wQ_wiz, wK: wK_wiz,
    bP: bP_wiz, bN: bN_wiz, bB: bB_wiz, bR: bR_wiz, bQ: bQ_wiz, bK: bK_wiz
};

const UNICODE_PIECES = {
    wQ: '♕', wR: '♖', wB: '♗', wN: '♘',
    bQ: '♛', bR: '♜', bB: '♝', bN: '♞'
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
        ? ` You played ${moveSan}, but the 3000-rated engine strongly preferred ${missedMoveSan}.`
        : '';

    if (isSacrifice && delta <= 3) {
        return { tag: 'Brilliant', color: '#22d3ee', icon: '!!', msg: `Brilliant! ${moveSan} is a spectacular piece sacrifice that breaks the enemy position open.` };
    }

    if (isTopEngineChoice) return { tag: 'Best', color: '#16a34a', icon: '★', msg: `Best move! ${moveSan} is exactly the optimal line the engine calculated.` };
    if (delta <= 2) return { tag: 'Excellent', color: '#4ade80', icon: '✓', msg: `Excellent choice. ${moveSan} is a top-tier move that maintains your advantage perfectly.${betterMoveText}` };
    if (delta <= 6) return { tag: 'Good', color: '#60a5fa', icon: '👍', msg: `Good move. ${moveSan} is solid and playable.${betterMoveText}` };
    if (delta <= 12) return { tag: 'Inaccuracy', color: '#facc15', icon: '?!', msg: `Inaccuracy. ${moveSan} misses a much more precise tactical idea.${betterMoveText}` };
    if (delta <= 20) return { tag: 'Mistake', color: '#f97316', icon: '?', msg: `Mistake. ${moveSan} gives away a significant chunk of your advantage.${betterMoveText}` };

    return { tag: 'Blunder', color: '#ef4444', icon: '??', msg: `A critical blunder! ${moveSan} drastically shifts the winning odds against you.${betterMoveText}` };
};

export default function App() {
    // ── APP MODE: 'analyzer' | 'multiplayer' ──
    const [appMode, setAppMode] = useState('analyzer');

    // ── MULTIPLAYER HOOK ──
    const {
        phase, myColor, gameCode, fen: mpFen, setFen: setMpFen,
        gameOverMessage, opponentConnected,
        error: mpError, isLoading: mpLoading,
        createGame, joinGame, sendMove, resign, leaveGame,
    } = useMultiplayer();

    const [displayFen, setDisplayFen] = useState(STD_FEN);
    const [startFen, setStartFen] = useState(STD_FEN);
    const [history, setHistory] = useState([]);
    const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);

    const [isPracticeMode, setIsPracticeMode] = useState(false);
    const [userPracticeColor, setUserPracticeColor] = useState('w');
    const botTimerRef = useRef(null);

    const [boardOrientation, setOrientation] = useState('white');
    const [username, setUsername] = useState('');
    const [fetchedGames, setFetchedGames] = useState([]);
    const [isFetching, setIsFetching] = useState(false);

    const [currentThemeKey, setCurrentThemeKey] = useState('classic');
    const activeTheme = THEMES[currentThemeKey];

    const [promotionMove, setPromotionMove] = useState(null);
    const [showHint, setShowHint] = useState(false);
    const [isAutoPlaying, setIsAutoPlaying] = useState(false);

    // ── CLICK-TO-MOVE STATE ──
    const [moveFrom, setMoveFrom] = useState(null);

    // ── OVERLAY RED FLASH STATE ──
    const [invalidSquares, setInvalidSquares] = useState([]);
    const invalidTimeoutRef = useRef(null);

    const { engineState, analyzePosition, stopAnalysis } = useEngine();

    const gameStatus = useMemo(() => {
        const chess = new Chess(displayFen);
        if (chess.isCheckmate()) return 'Checkmate!';
        if (chess.isStalemate()) return 'Stalemate!';
        if (chess.isInsufficientMaterial()) return 'Draw by Insufficient Material';
        if (chess.isThreefoldRepetition()) return 'Draw by Repetition';
        if (chess.isDraw()) return 'Draw!';
        return null;
    }, [displayFen]);

    useEffect(() => {
        if (displayFen && (engineState.status === 'ready' || engineState.status === 'analysing')) {
            analyzePosition(displayFen, isPracticeMode ? 14 : 18);
        }
    }, [displayFen, engineState.status, analyzePosition, isPracticeMode]);

    useEffect(() => {
        if (engineState.status === 'ready' && engineState.result && currentMoveIndex >= 0) {
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
    }, [engineState.status, engineState.result, currentMoveIndex, startFen]);

    useEffect(() => {
        if (isPracticeMode && engineState.status === 'ready' && engineState.result?.bestMove && !isAutoPlaying) {
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
    }, [isPracticeMode, engineState.status, engineState.result, displayFen, userPracticeColor, currentMoveIndex, isAutoPlaying]);

    const playContinuation = useCallback(() => {
        const pv = engineState.result?.pv;
        if (!pv || pv.length === 0 || isAutoPlaying) return;

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

    }, [engineState.result, displayFen, history, currentMoveIndex, isAutoPlaying]);

    const undoPracticeMove = useCallback(() => {
        if (!isPracticeMode || isAutoPlaying) return;
        clearTimeout(botTimerRef.current);
        setMoveFrom(null);

        setHistory(prev => {
            const currentFen = prev.length > 0 ? prev[prev.length - 1].fen : startFen;
            const temp = new Chess(currentFen);
            const isOurTurn = temp.turn() === userPracticeColor;
            const dropCount = isOurTurn ? 2 : 1;

            if (prev.length < dropCount) return prev;

            const newHistory = prev.slice(0, prev.length - dropCount);
            const newFen = newHistory.length > 0 ? newHistory[newHistory.length - 1].fen : startFen;

            setDisplayFen(newFen);
            setCurrentMoveIndex(newHistory.length - 1);
            setShowHint(false);
            return newHistory;
        });
    }, [isPracticeMode, userPracticeColor, startFen, isAutoPlaying]);

    const goToMove = useCallback((idx) => {
        if (history.length === 0 || isPracticeMode || isAutoPlaying) return;
        const boundedIdx = Math.max(-1, Math.min(history.length - 1, idx));
        setCurrentMoveIndex(boundedIdx);
        setDisplayFen(boundedIdx === -1 ? startFen : history[boundedIdx].fen);
        setShowHint(false);
        setMoveFrom(null);
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

    // ── THE BYPASS: FLASH OVERLAY ENGINE ──
    const flashInvalidMove = (source, target) => {
        setInvalidSquares([source, target]);
        if (invalidTimeoutRef.current) clearTimeout(invalidTimeoutRef.current);
        invalidTimeoutRef.current = setTimeout(() => setInvalidSquares([]), 400);
    };

    const onDrop = useCallback(({ sourceSquare, targetSquare }) => {
        if (!targetSquare || isAutoPlaying) return false;

        setMoveFrom(null); // Clear click state if they decide to drag instead

        try {
            const temp = new Chess(displayFen);
            if (isPracticeMode && temp.turn() !== userPracticeColor) return false;

            const possibleMoves = temp.moves({ verbose: true });
            const isPromotion = possibleMoves.some(m => m.from === sourceSquare && m.to === targetSquare && m.flags.includes('p'));

            if (isPromotion) {
                const testMove = temp.move({ from: sourceSquare, to: targetSquare, promotion: 'q' });
                if (!testMove) {
                    flashInvalidMove(sourceSquare, targetSquare);
                    return false;
                }
                temp.undo();
                setPromotionMove({ from: sourceSquare, to: targetSquare, color: temp.turn() });
                return true;
            }

            const move = temp.move({ from: sourceSquare, to: targetSquare, promotion: 'q' });

            if (!move) {
                flashInvalidMove(sourceSquare, targetSquare);
                return false;
            }

            const newFen = temp.fen();
            const newHistory = history.slice(0, currentMoveIndex + 1);
            newHistory.push({ ...move, fen: newFen });

            setHistory(newHistory);
            setCurrentMoveIndex(newHistory.length - 1);
            setDisplayFen(newFen);
            setShowHint(false);
            return true;
        } catch {
            return false;
        }
    }, [displayFen, history, currentMoveIndex, isPracticeMode, userPracticeColor, isAutoPlaying]);

    // ── NEW: CLICK TO MOVE LOGIC ──
    const onSquareClick = useCallback((square) => {
        if (isAutoPlaying) return;

        const temp = new Chess(displayFen);

        if (isPracticeMode && temp.turn() !== userPracticeColor) {
            setMoveFrom(null);
            return;
        }

        // 1. If no square is selected yet, check if they clicked their own piece
        if (!moveFrom) {
            const piece = temp.get(square);
            if (piece && piece.color === temp.turn()) {
                setMoveFrom(square);
            }
            return;
        }

        // 2. If they click the same square again, deselect it
        if (square === moveFrom) {
            setMoveFrom(null);
            return;
        }

        // 3. Attempt the move
        try {
            const possibleMoves = temp.moves({ verbose: true });
            const isPromotion = possibleMoves.some(m => m.from === moveFrom && m.to === square && m.flags.includes('p'));

            if (isPromotion) {
                const testMove = temp.move({ from: moveFrom, to: square, promotion: 'q' });
                if (!testMove) {
                    flashInvalidMove(moveFrom, square);
                    setMoveFrom(null);
                    return;
                }
                temp.undo();
                setPromotionMove({ from: moveFrom, to: square, color: temp.turn() });
                setMoveFrom(null);
                return;
            }

            const move = temp.move({ from: moveFrom, to: square, promotion: 'q' });

            if (!move) {
                // If invalid move, check if they clicked another piece of their own color to switch selection
                const piece = temp.get(square);
                if (piece && piece.color === temp.turn()) {
                    setMoveFrom(square);
                } else {
                    flashInvalidMove(moveFrom, square);
                    setMoveFrom(null);
                }
                return;
            }

            // Valid Move
            const newFen = temp.fen();
            const newHistory = history.slice(0, currentMoveIndex + 1);
            newHistory.push({ ...move, fen: newFen });

            setHistory(newHistory);
            setCurrentMoveIndex(newHistory.length - 1);
            setDisplayFen(newFen);
            setShowHint(false);
            setMoveFrom(null);
        } catch {
            setMoveFrom(null);
        }
    }, [moveFrom, displayFen, history, currentMoveIndex, isPracticeMode, userPracticeColor, isAutoPlaying]);

    const executePromotion = (promoteTo) => {
        if (!promotionMove) return;
        const temp = new Chess(displayFen);
        const move = temp.move({ from: promotionMove.from, to: promotionMove.to, promotion: promoteTo });

        if (move) {
            const newFen = temp.fen();
            const newHistory = history.slice(0, currentMoveIndex + 1);
            newHistory.push({ ...move, fen: newFen });
            setHistory(newHistory);
            setCurrentMoveIndex(newHistory.length - 1);
            setDisplayFen(newFen);
            setShowHint(false);
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

    const reset = useCallback(() => {
        stopAnalysis();
        setIsPracticeMode(false);
        setStartFen(STD_FEN);
        setHistory([]);
        setCurrentMoveIndex(-1);
        setDisplayFen(STD_FEN);
        setShowHint(false);
        setMoveFrom(null);
    }, [stopAnalysis]);

    const handleFetch = async (e) => {
        e.preventDefault();
        if (!username.trim()) return;
        setIsFetching(true);
        try {
            const games = await fetchUserGames(username.trim());
            setFetchedGames(games);
        } catch (err) { alert(err.message); } finally { setIsFetching(false); }
    };

    const wizardPieceComponents = useMemo(() => {
        const pieceDiv = (src) => () => (
            <div style={{
                width: '100%',
                aspectRatio: '1 / 1',
                backgroundImage: `url(${src})`,
                backgroundSize: 'contain',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'center',
            }} />
        );
        return {
            wP: pieceDiv(WIZARD_IMAGES.wP), wN: pieceDiv(WIZARD_IMAGES.wN), wB: pieceDiv(WIZARD_IMAGES.wB),
            wR: pieceDiv(WIZARD_IMAGES.wR), wQ: pieceDiv(WIZARD_IMAGES.wQ), wK: pieceDiv(WIZARD_IMAGES.wK),
            bP: pieceDiv(WIZARD_IMAGES.bP), bN: pieceDiv(WIZARD_IMAGES.bN), bB: pieceDiv(WIZARD_IMAGES.bB),
            bR: pieceDiv(WIZARD_IMAGES.bR), bQ: pieceDiv(WIZARD_IMAGES.bQ), bK: pieceDiv(WIZARD_IMAGES.bK),
        };
    }, []);

    const bestMove = engineState.result?.bestMove;

    const arrowList = showHint && bestMove && bestMove.length >= 4 && !isPracticeMode
        ? [{ startSquare: bestMove.substring(0, 2), endSquare: bestMove.substring(2, 4), color: 'rgba(79,142,255,0.8)' }]
        : [];

    // ── INJECT DYNAMIC CSS CLASSES & HIGHLIGHTS ──
    const dynamicSquareStyles = invalidSquares.reduce((acc, sq) => {
        acc[sq] = { animation: 'errorFlash 0.4s ease-out forwards' };
        return acc;
    }, {});

    // Highlight the currently selected square
    if (moveFrom) {
        dynamicSquareStyles[moveFrom] = {
            ...dynamicSquareStyles[moveFrom],
            backgroundColor: 'rgba(255, 255, 0, 0.4)',
        };
    }

    const boardOptions = {
        id: "analyzer-board",
        position: displayFen,
        onPieceDrop: onDrop,
        onSquareClick: onSquareClick, // <--- New Prop
        boardOrientation: boardOrientation,
        arrows: arrowList,
        animationDurationInMs: 200,
        showAnimations: true,
        allowDragging: isPracticeMode
            ? (new Chess(displayFen).turn() === userPracticeColor)
            : !isAutoPlaying,
        boardStyle: { borderRadius: '4px', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' },
        darkSquareStyle: { backgroundColor: activeTheme.board.dark },
        lightSquareStyle: { backgroundColor: activeTheme.board.light },
        customSquareStyles: dynamicSquareStyles // <--- Combines the red flash & yellow highlight
    };

    if (activeTheme.pieces === 'wizard') {
        boardOptions.pieces = wizardPieceComponents;
    }

    return (
        <div style={{ minHeight: '100vh', background: activeTheme.global.bg, color: activeTheme.global.text, fontFamily: 'system-ui, sans-serif', padding: '1rem', transition: 'background 0.3s ease, color 0.3s ease' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', paddingBottom: '1rem', borderBottom: `1px solid ${activeTheme.global.border}`, flexWrap: 'wrap', gap: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <h2 style={{ margin: 0, fontSize: '1.2rem' }}>♞ Chess Analyzer</h2>

                    {/* ── MODE SWITCHER ── */}
                    <div style={{ display: 'flex', background: activeTheme.global.surface, border: `1px solid ${activeTheme.global.border}`, borderRadius: '8px', overflow: 'hidden' }}>
                        <button
                            id="btn-mode-analyzer"
                            onClick={() => setAppMode('analyzer')}
                            style={{ padding: '0.4rem 0.9rem', border: 'none', cursor: 'pointer', fontWeight: '700', fontSize: '0.8rem', background: appMode === 'analyzer' ? activeTheme.global.accent : 'transparent', color: appMode === 'analyzer' ? '#fff' : activeTheme.global.text, transition: 'all 0.2s' }}
                        >
                            📊 Analyzer
                        </button>
                        <button
                            id="btn-mode-multiplayer"
                            onClick={() => setAppMode('multiplayer')}
                            style={{ padding: '0.4rem 0.9rem', border: 'none', cursor: 'pointer', fontWeight: '700', fontSize: '0.8rem', background: appMode === 'multiplayer' ? activeTheme.global.accent : 'transparent', color: appMode === 'multiplayer' ? '#fff' : activeTheme.global.text, transition: 'all 0.2s' }}
                        >
                            ♟️ Play vs Friend
                        </button>
                    </div>

                    {appMode === 'analyzer' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: activeTheme.global.surface, padding: '0.5rem 1rem', borderRadius: '8px', border: `1px solid ${activeTheme.global.border}` }}>
                            <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: activeTheme.global.text, opacity: 0.8, fontWeight: 'bold' }}>Theme:</span>
                            <select
                                value={currentThemeKey}
                                onChange={(e) => setCurrentThemeKey(e.target.value)}
                                style={{ background: 'transparent', color: activeTheme.global.text, border: 'none', outline: 'none', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold' }}
                            >
                                {Object.entries(THEMES).map(([key, theme]) => (
                                    <option key={key} value={key} style={{ background: '#1e293b' }}>{theme.name}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

                {appMode === 'analyzer' && (
                    <>
                        <form onSubmit={handleFetch} style={{ display: 'flex', gap: '0.5rem' }}>
                            <input type="text" placeholder="Chess.com Username" value={username} onChange={e => setUsername(e.target.value)} style={{ padding: '0.5rem', borderRadius: '4px', background: activeTheme.global.surface, border: `1px solid ${activeTheme.global.border}`, color: activeTheme.global.text }} />
                            <button type="submit" disabled={isFetching} style={{ padding: '0.5rem 1rem', background: activeTheme.global.accent, border: 'none', borderRadius: '4px', color: '#fff', cursor: 'pointer' }}>Fetch</button>
                        </form>
                        <div>
                            <button onClick={() => setOrientation(o => o === 'white' ? 'black' : 'white')} style={{ marginRight: '1rem', padding: '0.5rem', background: 'transparent', color: activeTheme.global.text, border: `1px solid ${activeTheme.global.border}`, borderRadius: '4px', cursor: 'pointer' }}>Flip</button>
                            <button onClick={reset} style={{ padding: '0.5rem', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Reset</button>
                        </div>
                    </>
                )}
            </header>

            {/* ── MULTIPLAYER MODE ── */}
            {appMode === 'multiplayer' && phase === 'lobby' && (
                <MultiplayerLobby
                    onCreateGame={createGame}
                    onJoinGame={joinGame}
                    isLoading={mpLoading}
                    error={mpError}
                    theme={activeTheme}
                />
            )}
            {appMode === 'multiplayer' && (phase === 'waiting' || phase === 'playing' || phase === 'finished') && (
                <MultiplayerGame
                    fen={mpFen}
                    setFen={setMpFen}
                    myColor={myColor}
                    gameCode={gameCode}
                    phase={phase}
                    gameOverMessage={gameOverMessage}
                    opponentConnected={opponentConnected}
                    sendMove={sendMove}
                    resign={resign}
                    leaveGame={leaveGame}
                    theme={activeTheme}
                    wizardPieceComponents={activeTheme.pieces === 'wizard' ? wizardPieceComponents : null}
                />
            )}

            {/* ── ANALYZER MODE ── */}
            <main style={{ display: appMode === 'analyzer' ? 'flex' : 'none', gap: '2rem', justifyContent: 'center', alignItems: 'flex-start' }}>
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
                    <EvalBar result={engineState.result} status={engineState.status} />
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
                                            const isWizard = activeTheme.pieces === 'wizard';
                                            const imgSrc = isWizard ? WIZARD_IMAGES[pieceKey] : null;
                                            const unicodeChar = UNICODE_PIECES[pieceKey];
                                            return (
                                                <div key={p} onClick={() => executePromotion(p)} style={{ width: '70px', height: '70px', cursor: 'pointer', background: activeTheme.board.light, borderRadius: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center', transition: 'transform 0.2s', border: `2px solid ${activeTheme.global.border}` }} onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'} onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}>
                                                    {isWizard ? <img src={imgSrc} alt={pieceKey} style={{ width: '80%', height: '80%', objectFit: 'contain' }} /> : <span style={{ fontSize: '3rem', color: '#000' }}>{unicodeChar}</span>}
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <button onClick={cancelPromotion} style={{ marginTop: '1.5rem', padding: '0.5rem 2rem', cursor: 'pointer', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '1rem', fontWeight: 'bold' }}>Cancel</button>
                                </div>
                            </div>
                        )}

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
        </div>
    );
}