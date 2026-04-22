import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { useEngine } from './engine/useEngine';
import EvalBar from './components/EvalBar';
import GameSidebar from './components/GameSidebar';
import { fetchUserGames } from './services/chessApi';

const STD_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export default function App() {
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

    const { engineState, analyzePosition, stopAnalysis } = useEngine();

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

    // ── THE NEW UNDO FUNCTION ──
    const undoPracticeMove = useCallback(() => {
        if (!isPracticeMode) return;
        clearTimeout(botTimerRef.current); // Stop the bot if it's thinking

        setHistory(prev => {
            const currentFen = prev.length > 0 ? prev[prev.length - 1].fen : startFen;
            const temp = new Chess(currentFen);
            const isOurTurn = temp.turn() === userPracticeColor;

            // If it's our turn, the bot just played. Undo the bot's move AND our move (drop 2).
            // If it's the bot's turn, it's still thinking. Just undo our move (drop 1).
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

    const onDrop = useCallback(({ sourceSquare, targetSquare, piece }) => {
        try {
            const temp = new Chess(displayFen);
            if (isPracticeMode && temp.turn() !== userPracticeColor) return false;

            const move = temp.move({ from: sourceSquare, to: targetSquare, promotion: piece?.[1]?.toLowerCase() ?? 'q' });
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
        } catch (err) {
            alert('Failed to load this game.');
        }
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

    const bestMove = engineState.result?.bestMove;
    const customArrows = bestMove && bestMove.length >= 4 && !isPracticeMode
        ? [[bestMove.substring(0, 2), bestMove.substring(2, 4), 'rgba(79,142,255,0.8)']] : [];

    const boardOptions = {
        id: "analyzer-board",
        position: displayFen,
        onPieceDrop: onDrop,
        boardOrientation: boardOrientation,
        customArrows: customArrows,
        animationDurationInMs: 200,
        arePiecesDraggable: isPracticeMode ? (new Chess(displayFen).turn() === userPracticeColor) : true,
        customBoardStyle: { borderRadius: '4px', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' },
        customDarkSquareStyle: { backgroundColor: '#739552' },
        customLightSquareStyle: { backgroundColor: '#ebecd0' }
    };

    return (
        <div style={{ minHeight: '100vh', background: '#0b0f19', color: '#fff', fontFamily: 'system-ui, sans-serif', padding: '1rem' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', paddingBottom: '1rem', borderBottom: '1px solid #1e293b' }}>
                <h2>♞ Chess Analyzer</h2>
                <form onSubmit={handleFetch} style={{ display: 'flex', gap: '0.5rem' }}>
                    <input type="text" placeholder="Chess.com Username" value={username} onChange={e => setUsername(e.target.value)} style={{ padding: '0.5rem', borderRadius: '4px', background: '#1e293b', border: '1px solid #334155', color: '#fff' }} />
                    <button type="submit" disabled={isFetching} style={{ padding: '0.5rem 1rem', background: '#3b82f6', border: 'none', borderRadius: '4px', color: '#fff', cursor: 'pointer' }}>Fetch</button>
                </form>
                <div>
                    <button onClick={() => setOrientation(o => o === 'white' ? 'black' : 'white')} style={{ marginRight: '1rem', padding: '0.5rem', background: 'transparent', color: '#fff', border: '1px solid #334155', borderRadius: '4px', cursor: 'pointer' }}>Flip</button>
                    <button onClick={reset} style={{ padding: '0.5rem', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Reset</button>
                </div>
            </header>

            <main style={{ display: 'flex', gap: '2rem', justifyContent: 'center', alignItems: 'flex-start' }}>
                {fetchedGames.length > 0 && (
                    <div style={{ width: '250px', maxHeight: '70vh', overflowY: 'auto', background: '#0f1117', padding: '1rem', borderRadius: '8px', border: '1px solid #1e293b' }}>
                        <h3 style={{ marginTop: 0 }}>Games</h3>
                        {fetchedGames.map((g, i) => (
                            <div key={i} onClick={() => loadGamePgn(g.pgn)} style={{ padding: '0.5rem', marginBottom: '0.5rem', background: '#1e293b', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>
                                {g.pgn.match(/\[White "([^"]+)"\]/)?.[1]} vs {g.pgn.match(/\[Black "([^"]+)"\]/)?.[1]}
                            </div>
                        ))}
                    </div>
                )}

                <div style={{ display: 'flex', gap: '1rem', height: '600px' }}>
                    <EvalBar result={engineState.result} status={engineState.status} />
                    <div style={{ width: '600px', position: 'relative' }}>
                        <Chessboard options={boardOptions} />
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '1rem', opacity: isPracticeMode ? 0.3 : 1, pointerEvents: isPracticeMode ? 'none' : 'auto' }}>
                            <button onClick={() => goToMove(-1)}>⏮</button>
                            <button onClick={() => goToMove(currentMoveIndex - 1)}>◀</button>
                            <button onClick={() => goToMove(currentMoveIndex + 1)}>▶</button>
                            <button onClick={() => goToMove(history.length - 1)}>⏭</button>
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
                />
            </main>
        </div>
    );
}