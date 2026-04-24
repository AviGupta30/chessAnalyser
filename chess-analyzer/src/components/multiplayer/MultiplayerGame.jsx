import React, { useState, useCallback, useRef } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';

const STD_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const UNICODE_PIECES = {
    wQ: '♕', wR: '♖', wB: '♗', wN: '♘',
    bQ: '♛', bR: '♜', bB: '♝', bN: '♞'
};

// ── WAITING ROOM SCREEN ──────────────────────────────────────────────────────
function WaitingRoom({ gameCode, myColor, theme, onLeave }) {
    const [copied, setCopied] = useState(false);
    const text = theme?.global?.text || '#fff';
    const accent = theme?.global?.accent || '#3b82f6';
    const border = theme?.global?.border || '#334155';

    const copyCode = () => {
        navigator.clipboard.writeText(gameCode).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
            <div style={{ textAlign: 'center', maxWidth: '420px' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem', animation: 'pulse 2s infinite' }}>⏳</div>
                <h2 style={{ color: text, margin: '0 0 0.5rem', fontSize: '1.6rem', fontWeight: '800' }}>
                    Waiting for Opponent…
                </h2>
                <p style={{ color: text, opacity: 0.55, marginBottom: '2rem' }}>
                    You are playing as <strong style={{ color: accent }}>{myColor === 'white' ? '♔ White' : '♚ Black'}</strong>
                </p>

                {/* Game Code Card */}
                <div style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${border}`, borderRadius: '14px', padding: '2rem', marginBottom: '1.5rem' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: '700', color: text, opacity: 0.45, textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '0.75rem' }}>
                        Share this code with your friend
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', justifyContent: 'center' }}>
                        <div style={{ fontFamily: 'monospace', fontSize: '2.5rem', fontWeight: '900', letterSpacing: '0.6rem', color: accent, background: 'rgba(59,130,246,0.1)', padding: '0.5rem 1.5rem', borderRadius: '10px', border: `1px solid ${accent}44` }}>
                            {gameCode}
                        </div>
                        <button
                            id="btn-copy-code"
                            onClick={copyCode}
                            title="Copy code"
                            style={{ background: copied ? '#22c55e22' : 'rgba(255,255,255,0.08)', border: `1px solid ${copied ? '#22c55e' : border}`, borderRadius: '8px', padding: '0.6rem 0.8rem', cursor: 'pointer', color: copied ? '#22c55e' : text, fontSize: '1.2rem', transition: 'all 0.2s' }}
                        >
                            {copied ? '✓' : '⧉'}
                        </button>
                    </div>
                </div>

                {/* Spinner dots */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginBottom: '2rem' }}>
                    {[0, 1, 2].map(i => (
                        <div key={i} style={{ width: '8px', height: '8px', borderRadius: '50%', background: accent, animation: `dotBounce 1.2s ${i * 0.2}s infinite ease-in-out` }} />
                    ))}
                </div>

                <button
                    onClick={onLeave}
                    style={{ background: 'transparent', border: `1px solid ${border}`, color: text, opacity: 0.6, borderRadius: '8px', padding: '0.5rem 1.5rem', cursor: 'pointer', fontSize: '0.9rem' }}
                >
                    Cancel
                </button>
            </div>
        </div>
    );
}

// ── GAME OVER OVERLAY ────────────────────────────────────────────────────────
function GameOverOverlay({ message, onLeave, theme }) {
    const accent = theme?.global?.accent || '#3b82f6';
    const surface = theme?.global?.surface || '#1e293b';
    const text = theme?.global?.text || '#fff';
    const border = theme?.global?.border || '#334155';

    return (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 30, display: 'flex', justifyContent: 'center', alignItems: 'center', borderRadius: '4px' }}>
            <div style={{ background: surface, color: accent, padding: '2rem 3rem', borderRadius: '16px', fontSize: '1.8rem', fontWeight: '800', border: `2px solid ${border}`, boxShadow: '0 10px 40px rgba(0,0,0,0.6)', textAlign: 'center', maxWidth: '360px' }}>
                <div style={{ marginBottom: '1.5rem' }}>{message}</div>
                <button
                    id="btn-back-to-lobby"
                    onClick={onLeave}
                    style={{ fontSize: '1rem', fontWeight: '700', background: accent, color: '#fff', border: 'none', borderRadius: '10px', padding: '0.75rem 2rem', cursor: 'pointer', transition: 'opacity 0.2s' }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                    onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                >
                    Back to Lobby
                </button>
            </div>
        </div>
    );
}

// ── PROMOTION DIALOG ─────────────────────────────────────────────────────────
function PromotionDialog({ promotionMove, onPromote, onCancel, theme, wizardPieceComponents }) {
    const surface = theme?.global?.surface || '#1e293b';
    const text = theme?.global?.text || '#fff';
    const border = theme?.global?.border || '#334155';
    const light = theme?.board?.light || '#ebecd0';
    const isWizard = theme?.pieces === 'wizard';

    return (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 20, display: 'flex', justifyContent: 'center', alignItems: 'center', borderRadius: '4px' }}>
            <div style={{ background: surface, padding: '2rem', borderRadius: '14px', border: `1px solid ${border}`, boxShadow: '0 10px 30px rgba(0,0,0,0.5)', textAlign: 'center' }}>
                <h3 style={{ marginTop: 0, marginBottom: '1.5rem', color: text }}>Promote Pawn To:</h3>
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                    {['q', 'r', 'b', 'n'].map(p => {
                        const pieceKey = `${promotionMove.color}${p.toUpperCase()}`;
                        const PieceComp = wizardPieceComponents?.[pieceKey];
                        return (
                            <div
                                key={p}
                                onClick={() => onPromote(p)}
                                style={{ width: '70px', height: '70px', cursor: 'pointer', background: light, borderRadius: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center', transition: 'transform 0.2s', border: `2px solid ${border}` }}
                                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
                                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                            >
                                {isWizard && PieceComp
                                    ? <PieceComp />
                                    : <span style={{ fontSize: '3rem', color: '#000' }}>{UNICODE_PIECES[pieceKey]}</span>
                                }
                            </div>
                        );
                    })}
                </div>
                <button onClick={onCancel} style={{ marginTop: '1.5rem', padding: '0.5rem 2rem', cursor: 'pointer', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '1rem', fontWeight: 'bold' }}>
                    Cancel
                </button>
            </div>
        </div>
    );
}

// ── PLAYER BANNER ─────────────────────────────────────────────────────────────
function PlayerBanner({ color, isMyTurn, myColor, theme }) {
    const text = theme?.global?.text || '#fff';
    const accent = theme?.global?.accent || '#3b82f6';
    const border = theme?.global?.border || '#334155';
    const isMe = color === myColor;

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 1rem', background: isMyTurn ? `${accent}18` : 'rgba(255,255,255,0.03)', borderRadius: '8px', border: `1px solid ${isMyTurn ? accent : border}`, transition: 'all 0.3s', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '1.4rem' }}>{color === 'white' ? '♔' : '♚'}</span>
            <span style={{ fontWeight: '700', color: text, fontSize: '0.95rem' }}>
                {isMe ? 'You' : 'Opponent'} ({color === 'white' ? 'White' : 'Black'})
            </span>
            {isMyTurn && (
                <span style={{ marginLeft: 'auto', fontSize: '0.75rem', fontWeight: '700', color: accent, animation: 'pulse 1.5s infinite' }}>
                    ● To Move
                </span>
            )}
        </div>
    );
}

// ── MAIN MULTIPLAYER GAME COMPONENT ──────────────────────────────────────────
export default function MultiplayerGame({
    fen, setFen, myColor, gameCode, phase, gameOverMessage,
    opponentConnected, sendMove, resign, leaveGame,
    theme, wizardPieceComponents
}) {
    const [moveFrom, setMoveFrom] = useState(null);
    const [promotionMove, setPromotionMove] = useState(null);
    const [invalidSquares, setInvalidSquares] = useState([]);
    const invalidTimerRef = useRef(null);

    const text = theme?.global?.text || '#fff';
    const accent = theme?.global?.accent || '#3b82f6';
    const border = theme?.global?.border || '#334155';
    const surface = theme?.global?.surface || '#1e293b';

    const chessRef = new Chess(fen);
    const turnColor = chessRef.turn() === 'w' ? 'white' : 'black';
    const isMyTurn = turnColor === myColor;

    const flashInvalid = (sq1, sq2) => {
        setInvalidSquares([sq1, sq2].filter(Boolean));
        clearTimeout(invalidTimerRef.current);
        invalidTimerRef.current = setTimeout(() => setInvalidSquares([]), 400);
    };

    const applyMove = useCallback((from, to) => {
        const chess = new Chess(fen);
        const possibleMoves = chess.moves({ verbose: true });
        const isPromotion = possibleMoves.some(m => m.from === from && m.to === to && m.flags.includes('p'));

        if (isPromotion) {
            const testMove = chess.move({ from, to, promotion: 'q' });
            if (!testMove) { flashInvalid(from, to); return false; }
            chess.undo();
            setPromotionMove({ from, to, color: chess.turn() });
            return true;
        }

        const move = chess.move({ from, to, promotion: 'q' });
        if (!move) { flashInvalid(from, to); return false; }

        const newFen = chess.fen();
        setFen(newFen);
        sendMove(newFen);
        setMoveFrom(null);
        return true;
    }, [fen, setFen, sendMove]);

    // ── DRAG & DROP ──
    const onDrop = useCallback(({ sourceSquare, targetSquare }) => {
        if (!isMyTurn || !targetSquare) return false;
        setMoveFrom(null);
        return applyMove(sourceSquare, targetSquare);
    }, [isMyTurn, applyMove]);

    // ── CLICK TO MOVE ──
    const onSquareClick = useCallback((square) => {
        if (!isMyTurn) return;
        const chess = new Chess(fen);

        if (!moveFrom) {
            const piece = chess.get(square);
            if (piece && piece.color === chess.turn()) setMoveFrom(square);
            return;
        }

        if (square === moveFrom) { setMoveFrom(null); return; }

        // Try clicking another own piece → switch selection
        const piece = chess.get(square);
        if (piece && piece.color === chess.turn()) {
            setMoveFrom(square);
            return;
        }

        applyMove(moveFrom, square);
    }, [isMyTurn, fen, moveFrom, applyMove]);

    // ── PROMOTION ──
    const executePromotion = (piece) => {
        if (!promotionMove) return;
        const chess = new Chess(fen);
        const move = chess.move({ from: promotionMove.from, to: promotionMove.to, promotion: piece });
        if (move) {
            const newFen = chess.fen();
            setFen(newFen);
            sendMove(newFen);
        }
        setPromotionMove(null);
    };

    // ── SQUARE STYLES ──
    const squareStyles = {};
    invalidSquares.forEach(sq => { squareStyles[sq] = { animation: 'errorFlash 0.4s ease-out forwards' }; });
    if (moveFrom) squareStyles[moveFrom] = { ...squareStyles[moveFrom], backgroundColor: 'rgba(255,255,0,0.4)' };

    // Highlight valid moves for selected piece
    if (moveFrom && isMyTurn) {
        const chess = new Chess(fen);
        chess.moves({ square: moveFrom, verbose: true }).forEach(m => {
            squareStyles[m.to] = {
                ...squareStyles[m.to],
                background: 'radial-gradient(circle, rgba(0,0,0,0.25) 25%, transparent 26%)',
            };
        });
    }

    const boardOptions = {
        id: 'multiplayer-board',
        position: fen || STD_FEN,
        onPieceDrop: onDrop,
        onSquareClick,
        boardOrientation: myColor || 'white',
        animationDurationInMs: 180,
        allowDragging: isMyTurn,
        darkSquareStyle: { backgroundColor: theme?.board?.dark || '#739552' },
        lightSquareStyle: { backgroundColor: theme?.board?.light || '#ebecd0' },
        customSquareStyles: squareStyles,
        boardStyle: { borderRadius: '4px', boxShadow: '0 4px 24px rgba(0,0,0,0.4)' },
    };

    if (theme?.pieces === 'wizard' && wizardPieceComponents) {
        boardOptions.pieces = wizardPieceComponents;
    }

    // ── WAITING STATE ──
    if (phase === 'waiting') {
        return <WaitingRoom gameCode={gameCode} myColor={myColor} theme={theme} onLeave={leaveGame} />;
    }

    return (
        <div style={{ display: 'flex', gap: '2rem', justifyContent: 'center', alignItems: 'flex-start', flexWrap: 'wrap', padding: '1rem' }}>

            {/* ── BOARD AREA ── */}
            <div style={{ width: '560px', maxWidth: '95vw' }}>
                {/* Opponent banner (top) */}
                <PlayerBanner
                    color={myColor === 'white' ? 'black' : 'white'}
                    isMyTurn={turnColor !== myColor}
                    myColor={myColor}
                    theme={theme}
                />

                <div style={{ position: 'relative' }}>
                    {gameOverMessage && (
                        <GameOverOverlay message={gameOverMessage} onLeave={leaveGame} theme={theme} />
                    )}
                    {promotionMove && (
                        <PromotionDialog
                            promotionMove={promotionMove}
                            onPromote={executePromotion}
                            onCancel={() => setPromotionMove(null)}
                            theme={theme}
                            wizardPieceComponents={wizardPieceComponents}
                        />
                    )}
                    <Chessboard options={boardOptions} />
                </div>

                {/* My banner (bottom) */}
                <PlayerBanner
                    color={myColor}
                    isMyTurn={isMyTurn}
                    myColor={myColor}
                    theme={theme}
                />
            </div>

            {/* ── SIDE PANEL ── */}
            <div style={{ width: '220px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Room Info */}
                <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: '12px', padding: '1.25rem' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: '700', color: text, opacity: 0.45, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.5rem' }}>Game Code</div>
                    <div style={{ fontFamily: 'monospace', fontSize: '1.5rem', fontWeight: '900', letterSpacing: '0.3rem', color: accent }}>{gameCode}</div>
                </div>

                {/* Status */}
                <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: '12px', padding: '1.25rem' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: '700', color: text, opacity: 0.45, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.5rem' }}>Status</div>
                    <div style={{ color: isMyTurn ? accent : text, fontWeight: '700', fontSize: '0.95rem' }}>
                        {isMyTurn ? '🟢 Your turn' : '⏳ Opponent\'s turn'}
                    </div>
                    <div style={{ color: text, opacity: 0.5, fontSize: '0.8rem', marginTop: '0.3rem' }}>
                        You: {myColor === 'white' ? '♔ White' : '♚ Black'}
                    </div>
                </div>

                {/* Turn indicator */}
                <div style={{ background: isMyTurn ? `${accent}18` : 'rgba(255,255,255,0.03)', border: `1px solid ${isMyTurn ? accent : border}`, borderRadius: '12px', padding: '1rem', textAlign: 'center', transition: 'all 0.4s', fontSize: '0.85rem', color: text, fontWeight: '600' }}>
                    {isMyTurn
                        ? <span style={{ color: accent }}>✦ Make your move!</span>
                        : <span style={{ opacity: 0.55 }}>Waiting for opponent…</span>
                    }
                </div>

                {/* Actions */}
                <button
                    id="btn-resign"
                    onClick={() => { if (window.confirm('Are you sure you want to resign?')) resign(); }}
                    style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.4)', color: '#f87171', borderRadius: '10px', padding: '0.75rem', cursor: 'pointer', fontWeight: '700', fontSize: '0.9rem', transition: 'all 0.2s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.2)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }}
                >
                    🏳️ Resign
                </button>

                <button
                    id="btn-leave-game"
                    onClick={leaveGame}
                    style={{ background: 'transparent', border: `1px solid ${border}`, color: text, opacity: 0.55, borderRadius: '10px', padding: '0.75rem', cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem' }}
                >
                    ← Back to Lobby
                </button>
            </div>
        </div>
    );
}
