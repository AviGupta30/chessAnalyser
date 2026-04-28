import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { useEngine } from '../../engine/useEngine';
import EvalBar from '../EvalBar';
import GameSidebar from '../GameSidebar';
import AbsorptionEngine from '../../engine/variants/absorption/absorbtion';
import AudioManager from '../../utils/audioManager';

const STD_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

// Responsive board width: full viewport on mobile, 600px cap on desktop
const useResponsiveBoardWidth = () => {
    const getBoardWidth = () => {
        const vw = window.innerWidth;
        if (vw <= 768) return vw; // full width on mobile
        if (vw <= 1100) return Math.min(vw * 0.5, 520); // ~50vw on tablet
        return 600; // desktop
    };
    const [boardWidth, setBoardWidth] = useState(getBoardWidth);
    useEffect(() => {
        const onResize = () => setBoardWidth(getBoardWidth());
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);
    return boardWidth;
};

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

const getCapturedPieces = (fen) => {
    const board = fen.split(' ')[0];
    const initialCounts = { P: 8, N: 2, B: 2, R: 2, Q: 1, p: 8, n: 2, b: 2, r: 2, q: 1 };
    const currentCounts = { P: 0, N: 0, B: 0, R: 0, Q: 0, p: 0, n: 0, b: 0, r: 0, q: 0 };
    for (let char of board) {
        if (currentCounts[char] !== undefined) currentCounts[char]++;
    }

    const capturedByWhite = [];
    const capturedByBlack = [];
    const pieces = ['q', 'r', 'b', 'n', 'p'];
    
    pieces.forEach(p => {
        const diff = initialCounts[p] - currentCounts[p];
        if (diff > 0) {
            for (let i = 0; i < diff; i++) capturedByWhite.push(p);
        }
    });

    pieces.forEach(p => {
        const upper = p.toUpperCase();
        const diff = initialCounts[upper] - currentCounts[upper];
        if (diff > 0) {
            for (let i = 0; i < diff; i++) capturedByBlack.push(p);
        }
    });

    const mat = getMaterialScore(fen);
    const whiteAdvantage = mat.w - mat.b;
    const blackAdvantage = mat.b - mat.w;

    return {
        white: { pieces: capturedByWhite, adv: whiteAdvantage > 0 ? whiteAdvantage : 0 },
        black: { pieces: capturedByBlack, adv: blackAdvantage > 0 ? blackAdvantage : 0 }
    };
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

    const isCapture = moveSan.includes('x');
    const isCheck = moveSan.includes('+');
    const isMate = moveSan.includes('#');
    const isCastle = moveSan === 'O-O' || moveSan === 'O-O-O';
    const isPromotion = moveSan.includes('=');

    // Generate highly smart, contextual commentary like chess.com
    let contextCommentary = '';
    
    if (isMate) {
        contextCommentary = ' This move delivers checkmate! An outstanding conclusion to the game.';
    } else if (isSacrifice && delta <= 3) {
        contextCommentary = ' You sacrificed material, but the engine sees the brilliance in your positional or tactical compensation.';
    } else if (isCastle) {
        if (delta <= 6) contextCommentary = ' Securing the King and bringing the Rook into the game is almost always a wise choice.';
        else contextCommentary = ' Castling here is questionable, perhaps leaving key squares vulnerable or ignoring a more pressing threat.';
    } else if (isPromotion) {
        contextCommentary = ' Promoting the pawn secures a massive material advantage.';
    } else if (isCapture) {
        if (delta <= 6) contextCommentary = ' A solid capture that eliminates an opponent\'s active piece or pawn.';
        else contextCommentary = ' This capture actually loses the advantage, perhaps due to a tactical trap or a poor recapture.';
    } else if (isCheck) {
        if (delta <= 6) contextCommentary = ' Forcing the opponent\'s King to react gives you the initiative.';
        else contextCommentary = ' A spite check. This check actually helps your opponent improve their piece coordination or King safety.';
    }

    if (!contextCommentary) {
        if (isTopEngineChoice) {
            contextCommentary = ' You found the absolute best continuation in this position.';
        } else if (delta <= 6) {
            contextCommentary = ' A solid, developing move that improves your position.';
        }
    }

    const betterMoveText = (!isTopEngineChoice && missedMoveSan)
        ? ` The engine preferred ${missedMoveSan} here.`
        : '';

    // Assign categories based on win probability delta
    if (isSacrifice && delta <= 3) {
        return { tag: 'Brilliant', color: '#22d3ee', icon: '!!', msg: `Brilliant! ${moveSan} is a spectacular sacrifice.${contextCommentary}` };
    }
    
    if (isTopEngineChoice && isMate) return { tag: 'Best', color: '#16a34a', icon: '★', msg: `Best move! ${moveSan} is forced mate.${contextCommentary}` };

    if (isTopEngineChoice && (isCapture || isCheck) && delta <= 1) {
        return { tag: 'Great', color: '#3b82f6', icon: '!', msg: `Great move! ${moveSan} is very strong.${contextCommentary}` };
    }

    if (isTopEngineChoice) return { tag: 'Best', color: '#16a34a', icon: '★', msg: `Best move. ${moveSan} is the optimal line.${contextCommentary}` };
    if (delta <= 2) return { tag: 'Excellent', color: '#4ade80', icon: '👍', msg: `An excellent choice.${contextCommentary}${betterMoveText}` };
    if (delta <= 6) return { tag: 'Good', color: '#60a5fa', icon: '✔️', msg: `Good move.${contextCommentary}${betterMoveText}` };
    
    if (delta <= 12) return { tag: 'Inaccuracy', color: '#facc15', icon: '?!', msg: `Inaccuracy.${contextCommentary || ' This move allows your opponent to equalize.'}${betterMoveText}` };
    if (delta <= 20) return { tag: 'Mistake', color: '#f97316', icon: '?', msg: `Mistake.${contextCommentary || ' This hands the initiative over to your opponent.'}${betterMoveText}` };

    return { tag: 'Blunder', color: '#ef4444', icon: '??', msg: `Blunder!${contextCommentary || ' This drastically worsens your position or hangs material.'}${betterMoveText}` };
};

export default function AnalyzerGame({
    activeTheme,
    wizardPieceComponents,
    wizardImages,
    gameMode,
    fetchedGames,
    boardOrientation,
    isMuted
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

    const dynamicWizardPieces = useMemo(() => {
        const buildPieceComponent = (basePiece) => ({ square }) => {
            let src = wizardImages[basePiece];
            if (gameMode === 'absorption' && absorptionCapabilities[square]) {
                const caps = absorptionCapabilities[square] || [];
                const color = basePiece[0]; // 'w' or 'b'
                const trueBase = basePiece[1]; // 'P', 'N', 'B', 'R', 'Q', 'K'
                
                let allPowers = Array.from(new Set([...caps, trueBase.toLowerCase()]));

                // 2. Auto-Queen Rule
                if (allPowers.includes('r') && allPowers.includes('b')) {
                    allPowers = allPowers.filter(p => p !== 'r' && p !== 'b');
                    if (!allPowers.includes('q')) allPowers.push('q');
                }

                let visualBase = trueBase;

                // 3 & 4. Alias Rules: Queen dominates all. Knight submits to Majors.
                if (allPowers.includes('q')) {
                    visualBase = 'Q';
                    // Queen subsumes Rook and Bishop
                    allPowers = allPowers.filter(p => p !== 'r' && p !== 'b');
                } else if (trueBase === 'N') {
                    if (allPowers.includes('r')) visualBase = 'R';
                    else if (allPowers.includes('b')) visualBase = 'B';
                }

                // Gather remaining powers, exclude the visual base, sort alphabetically
                let remainingPowers = allPowers.filter(p => p !== visualBase.toLowerCase());
                remainingPowers.sort();

                // 1. Build the exact key: Base is always first letter
                let idealKey = `${color}${visualBase}`;
                if (remainingPowers.length > 0) {
                    idealKey += `_${remainingPowers.map(p => p.toUpperCase()).join('_')}`;
                }

                if (wizardImages[idealKey]) {
                    src = wizardImages[idealKey];
                }
            }
            
            // Calculate dynamic z-index based on rank and board orientation
            const rank = parseInt(square[1], 10);
            const zIndex = boardOrientation === 'black' ? rank : (10 - rank);

            const isPawn = basePiece[1] === 'P';
            const imgHeight = isPawn ? '100%' : '115%';
            const imgBottom = isPawn ? '0%' : '5%';

            return (
                <div style={{ 
                    width: '100%', 
                    aspectRatio: '1 / 1', 
                    position: 'relative',
                    zIndex: zIndex,
                    overflow: 'visible'
                }}>
                    <img 
                        src={src} 
                        alt={basePiece}
                        style={{
                            position: 'absolute',
                            bottom: imgBottom,
                            left: '0',
                            width: '100%',
                            height: imgHeight,
                            objectFit: 'contain',
                            filter: 'drop-shadow(2px 4px 5px rgba(0,0,0,0.5))',
                            pointerEvents: 'none',
                            display: 'block'
                        }}
                    />
                </div>
            );
        };

        return {
            wP: buildPieceComponent('wP'), wN: buildPieceComponent('wN'), wB: buildPieceComponent('wB'),
            wR: buildPieceComponent('wR'), wQ: buildPieceComponent('wQ'), wK: buildPieceComponent('wK'),
            bP: buildPieceComponent('bP'), bN: buildPieceComponent('bN'), bB: buildPieceComponent('bB'),
            bR: buildPieceComponent('bR'), bQ: buildPieceComponent('bQ'), bK: buildPieceComponent('bK'),
        };
    }, [wizardImages, gameMode, absorptionCapabilities, boardOrientation]);

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

    const capturedData = useMemo(() => getCapturedPieces(displayFen), [displayFen]);

    const renderCapturedPieces = (color) => {
        const data = color === 'white' ? capturedData.white : capturedData.black;
        if (data.pieces.length === 0 && data.adv === 0) return <div style={{ height: '24px' }} />;
        
        return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', height: '24px', opacity: 0.9 }}>
                {data.pieces.map((p, i) => {
                    const pieceKey = color === 'white' ? `b${p.toUpperCase()}` : `w${p.toUpperCase()}`;
                    const isWizard = activeTheme.pieces === 'wizard' && wizardImages;
                    return isWizard ? (
                        <img key={i} src={wizardImages[pieceKey]} alt={p} style={{ width: '20px', height: '20px', objectFit: 'contain' }} />
                    ) : (
                        <span key={i} style={{ fontSize: '1.2rem', color: color === 'white' ? '#000' : '#fff', filter: color === 'white' ? 'none' : 'drop-shadow(0 0 1px rgba(0,0,0,0.5))' }}>
                            {UNICODE_PIECES[pieceKey]}
                        </span>
                    );
                })}
                {data.adv > 0 && <span style={{ marginLeft: '0.3rem', fontSize: '0.8rem', fontWeight: 'bold', color: activeTheme.global.text }}>+{data.adv}</span>}
            </div>
        );
    };

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

                // Ensure the engine result actually corresponds to the current move's fen!
                if (currentMove && currentMove.savedEval === undefined && engineState.fen === currentMove.fen) {
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
                                promotion: missedMoveUci.length === 5 ? missedMoveUci[4] : undefined
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
            const actualPiece = temp.get(sourceSquare);

            if (gameMode === 'absorption') {
                possibleMoves = temp.getLegalMoves(sourceSquare);
                isPromotion = possibleMoves.some(
                    m => m.to === targetSquare &&
                    actualPiece && actualPiece.type === 'p' &&
                    (targetSquare[1] === '8' || targetSquare[1] === '1')
                );
            } else {
                possibleMoves = temp.moves({ verbose: true });
                isPromotion = possibleMoves.some(
                    m => m.from === sourceSquare && m.to === targetSquare && m.flags.includes('p') && actualPiece && actualPiece.type === 'p'
                );
            }

            if (isPromotion) {
                let validPromotion;
                if (gameMode === 'absorption') {
                    // In absorption, ANY legal move by a pawn to the 8th/1st rank is a valid promotion,
                    // even if it used a Knight/Rook jump (which wouldn't have 'q' in its pseudo move).
                    validPromotion = possibleMoves.find(
                        m => (m.from ? m.from === sourceSquare : true) && m.to === targetSquare
                    );
                } else {
                    validPromotion = possibleMoves.find(
                        m => (m.from ? m.from === sourceSquare : true) &&
                        m.to === targetSquare &&
                        (m.promotion === 'q' || m.flags?.includes('p'))
                    );
                }

                if (!validPromotion) {
                    flashInvalidMove(sourceSquare, targetSquare);
                    return false;
                }
                const temp2 = getActiveEngine();
                const capturedPiece = temp2.get(targetSquare) || null;
                if (capturedPiece && gameMode === 'absorption') {
                    capturedPiece.powers = temp2.absorptionState.capabilities[targetSquare] || [];
                }
                setPromotionMove({ from: sourceSquare, to: targetSquare, color: temp.turn(), capturedPiece });
                return true;
            }

            // Re-sync before actually executing so we work on a clean state
            const temp2 = getActiveEngine();
            const capturedPiece = temp2.get(targetSquare) || null;
            if (capturedPiece && gameMode === 'absorption') {
                capturedPiece.powers = temp2.absorptionState.capabilities[targetSquare] || [];
            }
            const move = temp2.move({ from: sourceSquare, to: targetSquare });

            if (!move) {
                flashInvalidMove(sourceSquare, targetSquare);
                return false;
            }

            const newFen = temp2.fen();
            const currentCaps = gameMode === 'absorption'
                ? { ...temp2.absorptionState.capabilities }
                : {};

            const newHistory = history.slice(0, currentMoveIndex + 1);
            newHistory.push({ ...move, fen: newFen, capabilities: currentCaps, capturedPiece });

            setHistory(newHistory);
            setCurrentMoveIndex(newHistory.length - 1);
            setDisplayFen(newFen);
            setShowHint(false);
            setLegalMoveDots([]);
            if (gameMode === 'absorption') setAbsorptionCapabilities(currentCaps);

            const isCheckmate = gameMode === 'absorption' ? temp2.isCheckmate() : temp2.isCheckmate();
            const isCheck = gameMode === 'absorption' ? temp2.isKingInCheck(temp2.turn()) : temp2.inCheck();
            const piecePowers = gameMode === 'absorption' ? [...(currentCaps[move.to] || []), move.piece.toLowerCase()] : [move.piece.toLowerCase()];
            AudioManager.playMoveSound(move, activeTheme.pieces, isCheck, isCheckmate, isMuted, capturedPiece);

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

            const isCheckmate = gameMode === 'absorption' ? temp.isCheckmate() : temp.isCheckmate();
            const isCheck = gameMode === 'absorption' ? temp.isKingInCheck(temp.turn()) : temp.inCheck();
            AudioManager.playMoveSound(move, activeTheme.pieces, isCheck, isCheckmate, isMuted, promotionMove?.capturedPiece || null);
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

    const boardWidth = useResponsiveBoardWidth();

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
        boardStyle: { borderRadius: '4px', boxShadow: '0 4px 20px rgba(0,0,0,0.3)', width: '100%', overflow: 'visible' },
        customBoardStyle: { borderRadius: '4px', boxShadow: '0 4px 20px rgba(0,0,0,0.3)', overflow: 'visible' },
        darkSquareStyle: { backgroundColor: activeTheme.board.dark },
        lightSquareStyle: { backgroundColor: activeTheme.board.light },
        squareStyles: dynamicSquareStyles,
        boardWidth: boardWidth
    };

    if (activeTheme.pieces === 'wizard') {
        boardOptions.pieces = dynamicWizardPieces;
    }

    const [mobileTab, setMobileTab] = useState('moves'); // 'moves' | 'coach' | 'engine'

    return (
        <main className="analyzer-layout" style={{ display: 'flex', gap: '2rem', justifyContent: 'center', alignItems: 'flex-start' }}>
            {fetchedGames.length > 0 && (
                <div className="games-list-panel" style={{ width: '250px', maxHeight: '70vh', overflowY: 'auto', background: activeTheme.global.surface, padding: '1rem', borderRadius: '8px', border: `1px solid ${activeTheme.global.border}` }}>
                    <h3 style={{ marginTop: 0 }}>Games</h3>
                    {fetchedGames.map((g, i) => (
                        <div key={i} onClick={() => loadGamePgn(g.pgn)} style={{ padding: '0.5rem', marginBottom: '0.5rem', background: activeTheme.global.bg, borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>
                            {g.pgn.match(/\[White "([^"]+)"\]/)?.[1]} vs {g.pgn.match(/\[Black "([^"]+)"\]/)?.[1]}
                        </div>
                    ))}
                </div>
            )}

            <div className="board-column" style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                <div className="eval-bar-wrapper">
                    <EvalBar result={engineState.result} status={gameMode === 'absorption' ? 'disabled' : engineState.status} />
                </div>
                <div className="board-wrapper" style={{ position: 'relative', width: boardWidth, flexShrink: 0, marginTop: '20px' }}>

                    {gameStatus && (
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', zIndex: 10, display: 'flex', justifyContent: 'center', alignItems: 'center', pointerEvents: 'none', borderRadius: '4px' }}>
                            <div style={{ background: activeTheme.global.surface, color: activeTheme.global.accent, padding: '1rem 2rem', borderRadius: '12px', fontSize: 'clamp(1.2rem, 5vw, 2.5rem)', fontWeight: 'bold', border: `2px solid ${activeTheme.global.border}`, boxShadow: '0 10px 30px rgba(0,0,0,0.5)', textTransform: 'uppercase', letterSpacing: '2px', textAlign: 'center' }}>
                                {gameStatus}
                            </div>
                        </div>
                    )}

                    {promotionMove && (
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 20, display: 'flex', justifyContent: 'center', alignItems: 'center', borderRadius: '4px' }}>
                            <div style={{ background: activeTheme.global.surface, padding: '1.5rem', borderRadius: '12px', border: `1px solid ${activeTheme.global.border}`, boxShadow: '0 10px 30px rgba(0,0,0,0.5)', textAlign: 'center' }}>
                                <h3 style={{ marginTop: 0, marginBottom: '1rem', color: activeTheme.global.text, fontSize: 'clamp(0.9rem, 3vw, 1.2rem)' }}>Promote Pawn To:</h3>
                                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                                    {['q', 'r', 'b', 'n'].map(p => {
                                        const pieceKey = `${promotionMove.color}${p.toUpperCase()}`;
                                        const imgSrc = activeTheme.pieces === 'wizard' ? wizardImages[pieceKey] : null;
                                        return (
                                            <div key={p} onClick={() => executePromotion(p)} style={{ width: 'clamp(52px, 13vw, 70px)', height: 'clamp(52px, 13vw, 70px)', cursor: 'pointer', background: activeTheme.board.light, borderRadius: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center', transition: 'transform 0.2s', border: `2px solid ${activeTheme.global.border}` }} onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'} onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}>
                                                {activeTheme.pieces === 'wizard' ? <img src={imgSrc} alt={pieceKey} style={{ width: '80%', height: '80%', objectFit: 'contain' }} /> : <span style={{ fontSize: 'clamp(1.8rem, 6vw, 3rem)', color: '#000' }}>{UNICODE_PIECES[pieceKey]}</span>}
                                            </div>
                                        );
                                    })}
                                </div>
                                <button onClick={cancelPromotion} style={{ marginTop: '1rem', padding: '0.5rem 2rem', cursor: 'pointer', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '1rem', fontWeight: 'bold' }}>Cancel</button>
                            </div>
                        </div>
                    )}

                    <div style={{ marginBottom: '0.5rem', display: 'flex', justifyContent: 'flex-start' }}>
                        {renderCapturedPieces(boardOrientation === 'white' ? 'black' : 'white')}
                    </div>

                    <Chessboard options={boardOptions} />

                    <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'flex-start' }}>
                        {renderCapturedPieces(boardOrientation === 'white' ? 'white' : 'black')}
                    </div>

                    <div className="move-controls" style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '1rem', color: activeTheme.global.text, opacity: (isPracticeMode || isAutoPlaying) ? 0.3 : 1, pointerEvents: (isPracticeMode || isAutoPlaying) ? 'none' : 'auto' }}>
                        <button onClick={() => goToMove(-1)} style={{ background: 'transparent', color: activeTheme.global.text, border: 'none', cursor: 'pointer', fontSize: '1.3rem' }}>⏮</button>
                        <button onClick={() => goToMove(currentMoveIndex - 1)} style={{ background: 'transparent', color: activeTheme.global.text, border: 'none', cursor: 'pointer', fontSize: '1.3rem' }}>◀</button>
                        <button onClick={() => goToMove(currentMoveIndex + 1)} style={{ background: 'transparent', color: activeTheme.global.text, border: 'none', cursor: 'pointer', fontSize: '1.3rem' }}>▶</button>
                        <button onClick={() => goToMove(history.length - 1)} style={{ background: 'transparent', color: activeTheme.global.text, border: 'none', cursor: 'pointer', fontSize: '1.3rem' }}>⏭</button>
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
                mobileTab={mobileTab}
            />

            {/* Mobile Bottom Nav */}
            <nav className="mobile-bottom-nav" style={{ background: activeTheme.global.surface }}>
                <button className={mobileTab === 'moves' ? 'active' : ''} onClick={() => setMobileTab('moves')} style={{ color: mobileTab === 'moves' ? activeTheme.global.accent : 'rgba(255,255,255,0.6)' }}>
                    <span className="icon">📋</span>
                    Moves
                </button>
                <button className={mobileTab === 'coach' ? 'active' : ''} onClick={() => setMobileTab('coach')} style={{ color: mobileTab === 'coach' ? activeTheme.global.accent : 'rgba(255,255,255,0.6)' }}>
                    <span className="icon">🎓</span>
                    Coach
                </button>
                <button className={mobileTab === 'engine' ? 'active' : ''} onClick={() => setMobileTab('engine')} style={{ color: mobileTab === 'engine' ? activeTheme.global.accent : 'rgba(255,255,255,0.6)' }}>
                    <span className="icon">⚡</span>
                    Engine
                </button>
                <button onClick={togglePractice} style={{ color: isPracticeMode ? '#ef4444' : 'rgba(255,255,255,0.6)' }}>
                    <span className="icon">{isPracticeMode ? '🛑' : '🤖'}</span>
                    {isPracticeMode ? 'Stop' : 'Practice'}
                </button>
            </nav>
        </main>
    );
}