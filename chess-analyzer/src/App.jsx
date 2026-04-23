import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { useEngine } from './engine/useEngine';
import EvalBar from './components/EvalBar';
import GameSidebar from './components/GameSidebar';
import { fetchUserGames } from './services/chessApi';

// ── 1. EXPLICIT IMPORTS FOR IMAGES (Fixes missing pieces) ──
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

// ── 2. THEME CONFIGURATION ──
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

export default function App() {
    // ── YOUR EXACT ORIGINAL STATE ──
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

    // ── NEW THEME STATE ──
    const [currentThemeKey, setCurrentThemeKey] = useState('classic');
    const activeTheme = THEMES[currentThemeKey];

    const { engineState, analyzePosition, stopAnalysis } = useEngine();

    // ── YOUR EXACT ORIGINAL USE-EFFECTS ──
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
                    const activeColor = currentMove.fen.split(' ')[1];
                    let absMate = engineState.result.mate;
                    if (activeColor === 'b' && absMate !== null) absMate = -absMate;

                    newHistory[currentMoveIndex] = {
                        ...currentMove,
                        savedEval: { cp: engineState.result.cp, mate: absMate, bestMove: engineState.result.bestMove }
                    };
                }
                return newHistory;
            });
        }
    }, [engineState.status, engineState.result, currentMoveIndex]);

    useEffect(() => {
        if (isPracticeMode && engineState.status === 'ready' && engineState.result?.bestMove) {
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
                    }
                }, 600);

                return () => clearTimeout(botTimerRef.current);
            }
        }
    }, [isPracticeMode, engineState.status, engineState.result, displayFen, userPracticeColor, currentMoveIndex]);

    // ── YOUR EXACT ORIGINAL CALLBACKS ──
    const undoPracticeMove = useCallback(() => {
        if (!isPracticeMode) return;
        clearTimeout(botTimerRef.current);

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
            return newHistory;
        });
    }, [isPracticeMode, userPracticeColor, startFen]);

    const goToMove = useCallback((idx) => {
        if (history.length === 0 || isPracticeMode) return;
        const boundedIdx = Math.max(-1, Math.min(history.length - 1, idx));
        setCurrentMoveIndex(boundedIdx);
        setDisplayFen(boundedIdx === -1 ? startFen : history[boundedIdx].fen);
    }, [history, startFen, isPracticeMode]);

    const currentIdxRef = useRef(-1);
    useEffect(() => { currentIdxRef.current = currentMoveIndex; }, [currentMoveIndex]);

    useEffect(() => {
        const onKey = (e) => {
            if (['INPUT', 'TEXTAREA'].includes(e.target.tagName) || isPracticeMode) return;
            if (e.key === 'ArrowLeft') { e.preventDefault(); goToMove(currentIdxRef.current - 1); }
            else if (e.key === 'ArrowRight') { e.preventDefault(); goToMove(currentIdxRef.current + 1); }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [goToMove, isPracticeMode]);

    // v5: onPieceDrop receives { piece: { pieceType, ... }, sourceSquare, targetSquare }
    const onDrop = useCallback(({ sourceSquare, targetSquare }) => {
        if (!targetSquare) return false;
        try {
            const temp = new Chess(displayFen);
            if (isPracticeMode && temp.turn() !== userPracticeColor) return false;

            const move = temp.move({ from: sourceSquare, to: targetSquare, promotion: 'q' });
            if (!move) return false;

            const newFen = temp.fen();
            const newHistory = history.slice(0, currentMoveIndex + 1);
            newHistory.push({ ...move, fen: newFen });

            setHistory(newHistory);
            setCurrentMoveIndex(newHistory.length - 1);
            setDisplayFen(newFen);
            return true;
        } catch { return false; }
    }, [displayFen, history, currentMoveIndex, isPracticeMode, userPracticeColor]);

    const togglePractice = () => {
        if (isPracticeMode) {
            clearTimeout(botTimerRef.current);
            setIsPracticeMode(false);
        } else {
            setIsPracticeMode(true);
            setUserPracticeColor(new Chess(displayFen).turn());
        }
    };

    const loadGamePgn = useCallback((pgn) => {
        if (!pgn) return;
        try {
            stopAnalysis();
            setIsPracticeMode(false);
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
        } catch (err) { alert('Failed to load this game.'); }
    }, [stopAnalysis]);

    const reset = useCallback(() => {
        stopAnalysis();
        setIsPracticeMode(false);
        setStartFen(STD_FEN);
        setHistory([]);
        setCurrentMoveIndex(-1);
        setDisplayFen(STD_FEN);
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

    // ── 3. WIZARD PIECE COMPONENTS ──
    // Use width:100% + aspect-ratio:1/1 so the div derives its height from width
    // automatically — no height:100% needed (which resolves to 0 in flex chains).
    // background-size:contain shows the full portrait piece image without clipping.
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
            wP: pieceDiv(wP_wiz), wN: pieceDiv(wN_wiz), wB: pieceDiv(wB_wiz),
            wR: pieceDiv(wR_wiz), wQ: pieceDiv(wQ_wiz), wK: pieceDiv(wK_wiz),
            bP: pieceDiv(bP_wiz), bN: pieceDiv(bN_wiz), bB: pieceDiv(bB_wiz),
            bR: pieceDiv(bR_wiz), bQ: pieceDiv(bQ_wiz), bK: pieceDiv(bK_wiz),
        };
    }, []);

    const bestMove = engineState.result?.bestMove;

    // v5: arrows are { startSquare, endSquare, color } objects (NOT arrays)
    const arrowList = bestMove && bestMove.length >= 4 && !isPracticeMode
        ? [{ startSquare: bestMove.substring(0, 2), endSquare: bestMove.substring(2, 4), color: 'rgba(79,142,255,0.8)' }]
        : [];

    // ── 4. OPTIONS OBJECT — all prop names updated for react-chessboard v5 ──
    const boardOptions = {
        id: "analyzer-board",
        position: displayFen,
        onPieceDrop: onDrop,
        boardOrientation: boardOrientation,
        arrows: arrowList,                         // v5: was customArrows
        animationDurationInMs: 200,
        showAnimations: true,                      // v5: must be explicitly enabled
        allowDragging: isPracticeMode              // v5: was arePiecesDraggable
            ? (new Chess(displayFen).turn() === userPracticeColor)
            : true,
        boardStyle: { borderRadius: '4px', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }, // v5: was customBoardStyle
        darkSquareStyle:  { backgroundColor: activeTheme.board.dark },                 // v5: was customDarkSquareStyle
        lightSquareStyle: { backgroundColor: activeTheme.board.light },                // v5: was customLightSquareStyle
    };

    // Inject Harry Potter pieces ONLY when wizard theme is active
    // v5: prop is 'pieces' (was 'customPieces')
    if (activeTheme.pieces === 'wizard') {
        boardOptions.pieces = wizardPieceComponents;
    }

    return (
        <div style={{ minHeight: '100vh', background: activeTheme.global.bg, color: activeTheme.global.text, fontFamily: 'system-ui, sans-serif', padding: '1rem', transition: 'background 0.3s ease, color 0.3s ease' }}>

            {/* ── HEADER WITH THEME SELECTOR ── */}
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', paddingBottom: '1rem', borderBottom: `1px solid ${activeTheme.global.border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    <h2 style={{ margin: 0 }}>♞ Chess Analyzer</h2>
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
                </div>

                <form onSubmit={handleFetch} style={{ display: 'flex', gap: '0.5rem' }}>
                    <input type="text" placeholder="Chess.com Username" value={username} onChange={e => setUsername(e.target.value)} style={{ padding: '0.5rem', borderRadius: '4px', background: activeTheme.global.surface, border: `1px solid ${activeTheme.global.border}`, color: activeTheme.global.text }} />
                    <button type="submit" disabled={isFetching} style={{ padding: '0.5rem 1rem', background: activeTheme.global.accent, border: 'none', borderRadius: '4px', color: '#fff', cursor: 'pointer' }}>Fetch</button>
                </form>
                <div>
                    <button onClick={() => setOrientation(o => o === 'white' ? 'black' : 'white')} style={{ marginRight: '1rem', padding: '0.5rem', background: 'transparent', color: activeTheme.global.text, border: `1px solid ${activeTheme.global.border}`, borderRadius: '4px', cursor: 'pointer' }}>Flip</button>
                    <button onClick={reset} style={{ padding: '0.5rem', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Reset</button>
                </div>
            </header>

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
                    <EvalBar result={engineState.result} status={engineState.status} />
                    <div style={{ width: '600px', position: 'relative' }}>

                        {/* ── YOUR EXACT COMPONENT RENDER STRUCTURE ── */}
                        <Chessboard options={boardOptions} />

                        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '1rem', opacity: isPracticeMode ? 0.3 : 1, pointerEvents: isPracticeMode ? 'none' : 'auto' }}>
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
                />
            </main>
        </div>
    );
}