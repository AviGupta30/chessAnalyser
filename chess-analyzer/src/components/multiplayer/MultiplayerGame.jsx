import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import AbsorptionEngine from '../../engine/variants/absorption/absorbtion';

const STD_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const FILES = ['a','b','c','d','e','f','g','h'];

function getEngine(localFen) {
    const [fen, mode, capsStr] = (localFen || '').split('|');
    if (mode === 'absorption') {
        const eng = new AbsorptionEngine();
        eng.load(fen, capsStr ? JSON.parse(capsStr) : {});
        return { eng, isAbsorption: true, baseFen: fen, mode, caps: capsStr ? JSON.parse(capsStr) : {} };
    } else {
        const eng = new Chess();
        try { eng.load(fen || STD_FEN); } catch {}
        return { eng, isAbsorption: false, baseFen: eng.fen(), mode: 'standard', caps: {} };
    }
}

function findKingSquare(chessObj, color) {
    const board = typeof chessObj.board === 'function' ? chessObj.board() : chessObj.chess.board();
    for (let r = 0; r < 8; r++)
        for (let c = 0; c < 8; c++) {
            const p = board[r][c];
            if (p && p.type === 'k' && p.color === color) return FILES[c] + (8 - r);
        }
    return null;
}

// ── Waiting Room ──────────────────────────────────────────────────────────────
function WaitingRoom({ gameCode, myColor, theme, onLeave }) {
    const [copied, setCopied] = useState(false);
    const t = theme?.global || {};
    const copy = () => navigator.clipboard.writeText(gameCode).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
    return (
        <div style={{ display:'flex', justifyContent:'center', alignItems:'center', minHeight:'60vh' }}>
            <div style={{ textAlign:'center', maxWidth:'420px' }}>
                <div style={{ fontSize:'3rem', marginBottom:'1rem' }}>⏳</div>
                <h2 style={{ color: t.text||'#fff', margin:'0 0 .5rem', fontSize:'1.6rem', fontWeight:'800' }}>Waiting for Opponent…</h2>
                <p style={{ color: t.text||'#fff', opacity:.55, marginBottom:'2rem' }}>
                    Playing as <strong style={{ color: t.accent||'#3b82f6' }}>{myColor === 'white' ? '♔ White' : '♚ Black'}</strong>
                </p>
                <div style={{ background:'rgba(255,255,255,.05)', border:`1px solid ${t.border||'#334155'}`, borderRadius:'14px', padding:'2rem', marginBottom:'1.5rem' }}>
                    <div style={{ fontSize:'.75rem', fontWeight:'700', color: t.text||'#fff', opacity:.45, textTransform:'uppercase', letterSpacing:'1.5px', marginBottom:'.75rem' }}>Share with your friend</div>
                    <div style={{ display:'flex', alignItems:'center', gap:'.75rem', justifyContent:'center' }}>
                        <div style={{ fontFamily:'monospace', fontSize:'2.5rem', fontWeight:'900', letterSpacing:'.6rem', color: t.accent||'#3b82f6', background:'rgba(59,130,246,.1)', padding:'.5rem 1.5rem', borderRadius:'10px' }}>{gameCode}</div>
                        <button id="btn-copy-code" onClick={copy} style={{ background: copied?'#22c55e22':'rgba(255,255,255,.08)', border:`1px solid ${copied?'#22c55e':t.border||'#334155'}`, borderRadius:'8px', padding:'.6rem .8rem', cursor:'pointer', color: copied?'#22c55e':t.text||'#fff', fontSize:'1.2rem' }}>{copied ? '✓' : '⧉'}</button>
                    </div>
                </div>
                <div style={{ display:'flex', justifyContent:'center', gap:'.5rem', marginBottom:'2rem' }}>
                    {[0,1,2].map(i => <div key={i} style={{ width:'8px', height:'8px', borderRadius:'50%', background: t.accent||'#3b82f6', animation:`dotBounce 1.2s ${i*.2}s infinite ease-in-out` }} />)}
                </div>
                <button onClick={onLeave} style={{ background:'transparent', border:`1px solid ${t.border||'#334155'}`, color: t.text||'#fff', opacity:.6, borderRadius:'8px', padding:'.5rem 1.5rem', cursor:'pointer' }}>Cancel</button>
            </div>
        </div>
    );
}

// ── Game Over ─────────────────────────────────────────────────────────────────
function GameOverOverlay({ message, onLeave, theme }) {
    const t = theme?.global || {};
    return (
        <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,.65)', zIndex:30, display:'flex', justifyContent:'center', alignItems:'center', borderRadius:'4px' }}>
            <div style={{ background: t.surface||'#1e293b', color: t.accent||'#3b82f6', padding:'2rem 3rem', borderRadius:'16px', fontSize:'1.8rem', fontWeight:'800', border:`2px solid ${t.border||'#334155'}`, textAlign:'center', maxWidth:'360px' }}>
                <div style={{ marginBottom:'1.5rem' }}>{message}</div>
                <button id="btn-back-to-lobby" onClick={onLeave} style={{ fontSize:'1rem', fontWeight:'700', background: t.accent||'#3b82f6', color:'#fff', border:'none', borderRadius:'10px', padding:'.75rem 2rem', cursor:'pointer' }}>Back to Lobby</button>
            </div>
        </div>
    );
}

// ── Promotion ─────────────────────────────────────────────────────────────────
const UNI = { wQ:'♕', wR:'♖', wB:'♗', wN:'♘', bQ:'♛', bR:'♜', bB:'♝', bN:'♞' };
function PromotionDialog({ pm, onPromote, onCancel, theme, wizardImages }) {
    const t = theme?.global || {};
    return (
        <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,.65)', zIndex:20, display:'flex', justifyContent:'center', alignItems:'center', borderRadius:'4px' }}>
            <div style={{ background: t.surface||'#1e293b', padding:'2rem', borderRadius:'14px', border:`1px solid ${t.border||'#334155'}`, textAlign:'center' }}>
                <h3 style={{ marginTop:0, marginBottom:'1.5rem', color: t.text||'#fff' }}>Promote to:</h3>
                <div style={{ display:'flex', gap:'1rem', justifyContent:'center' }}>
                    {['q','r','b','n'].map(p => {
                        const pk = `${pm.color}${p.toUpperCase()}`;
                        const src = wizardImages?.[pk];
                        return (
                            <div key={p} onClick={() => onPromote(p)} style={{ width:'70px', height:'70px', cursor:'pointer', background: theme?.board?.light||'#ebecd0', borderRadius:'8px', display:'flex', justifyContent:'center', alignItems:'center', border:`2px solid ${t.border||'#334155'}` }}>
                                {src ? <div style={{width:'80%', height:'80%', backgroundImage:`url(${src})`, backgroundSize:'contain', backgroundRepeat:'no-repeat', backgroundPosition:'center'}} /> : <span style={{ fontSize:'3rem', color:'#000' }}>{UNI[pk]}</span>}
                            </div>
                        );
                    })}
                </div>
                <button onClick={onCancel} style={{ marginTop:'1.5rem', padding:'.5rem 2rem', cursor:'pointer', background:'#ef4444', color:'#fff', border:'none', borderRadius:'4px', fontWeight:'bold' }}>Cancel</button>
            </div>
        </div>
    );
}

// ── Player Banner ─────────────────────────────────────────────────────────────
function PlayerBanner({ color, isMyTurn, myColor, theme }) {
    const t = theme?.global || {};
    return (
        <div style={{ display:'flex', alignItems:'center', gap:'.75rem', padding:'.6rem 1rem', background: isMyTurn?`${t.accent||'#3b82f6'}18`:'rgba(255,255,255,.03)', borderRadius:'8px', border:`1px solid ${isMyTurn?t.accent||'#3b82f6':t.border||'#334155'}`, transition:'all .3s', marginBottom:'.5rem' }}>
            <span style={{ fontSize:'1.4rem' }}>{color==='white'?'♔':'♚'}</span>
            <span style={{ fontWeight:'700', color: t.text||'#fff', fontSize:'.95rem' }}>{color===myColor?'You':'Opponent'} ({color==='white'?'White':'Black'})</span>
            {isMyTurn && <span style={{ marginLeft:'auto', fontSize:'.75rem', fontWeight:'700', color: t.accent||'#3b82f6', animation:'pulse 1.5s infinite' }}>● To Move</span>}
        </div>
    );
}

// ── Main Game ─────────────────────────────────────────────────────────────────
export default function MultiplayerGame({ fen: fenProp, myColor, gameCode, phase, gameOverMessage, sendMove, resign, leaveGame, theme, wizardImages }) {
    const t = theme?.global || {};

    // Local FEN — instant updates, no prop roundtrip
    const [localFen, setLocalFen] = useState(fenProp || STD_FEN);
    useEffect(() => { setLocalFen(fenProp || STD_FEN); }, [fenProp]);

    const [moveFrom, setMoveFrom] = useState('');
    const [promotionMove, setPromotionMove] = useState(null);

    // Flash state
    const [flashSqs, setFlashSqs] = useState([]);
    const flashRef = useRef(null);
    const flashInvalid = (squares) => {
        setFlashSqs(squares.filter(Boolean));
        clearTimeout(flashRef.current);
        flashRef.current = setTimeout(() => setFlashSqs([]), 450);
    };

    // Derived state
    const { eng: chess, isAbsorption, baseFen, mode, caps: absorptionCapabilities } = useMemo(() => getEngine(localFen), [localFen]);
    const myChessColor = myColor === 'white' ? 'w' : 'b';
    const isMyTurn = chess.turn() === myChessColor;
    const inCheck = chess.inCheck ? chess.inCheck() : chess.isKingInCheck(chess.turn());
    const kingSquare = inCheck ? findKingSquare(chess, chess.turn()) : null;

    // Valid target dots for selected piece
    let validTargets = new Set();
    if (moveFrom && isMyTurn) {
        try {
            if (isAbsorption) {
                chess.getLegalMoves(moveFrom).forEach(m => validTargets.add(m.to));
            } else {
                chess.moves({ square: moveFrom, verbose: true }).forEach(m => validTargets.add(m.to));
            }
        } catch {}
    }

    // ── Core move execution (mirrors analyzer — try-catch around chess.js v1) ──
    const tryMove = (from, to) => {
        if (!from || !to || from === to) return false;
        try {
            const { eng: c, isAbsorption: isAbs, mode: cMode } = getEngine(localFen);
            
            let isProm = false;
            if (isAbs) {
                const p = c.get(from);
                isProm = p && p.type === 'p' && c.getLegalMoves(from).some(m => m.to === to && (to[1] === '8' || to[1] === '1'));
            } else {
                isProm = c.moves({ square: from, verbose: true }).some(m => m.to === to && m.flags.includes('p'));
            }

            if (isProm) {
                c.move({ from, to, promotion: 'q' }); // validate it works
                setPromotionMove({ from, to, color: c.turn() });
                setMoveFrom('');
                return true;
            }
            
            // Normal move
            const move = c.move({ from, to, promotion: 'q' });
            if (!move) throw new Error('invalid');
            
            const newBaseFen = c.fen();
            const newCaps = isAbs ? c.absorptionState.capabilities : {};
            const serializedFen = `${newBaseFen}|${cMode}|${JSON.stringify(newCaps)}`;
            
            setLocalFen(serializedFen);
            sendMove(serializedFen);
            setMoveFrom('');
            return true;
        } catch {
            const toFlash = [to];
            try { 
                const { eng: c2 } = getEngine(localFen); 
                const isChk = c2.inCheck ? c2.inCheck() : c2.isKingInCheck(c2.turn());
                if (isChk) toFlash.push(findKingSquare(c2, c2.turn())); 
            } catch {}
            flashInvalid(toFlash);
            setMoveFrom('');
            return false;
        }
    };

    // ── Drag & drop (mirrors analyzer exactly) ────────────────────────────────
    const onDrop = ({ sourceSquare, targetSquare } = {}) => {
        if (!isMyTurn || !targetSquare || sourceSquare === targetSquare) return false;
        setMoveFrom('');
        return tryMove(sourceSquare, targetSquare);
    };

    // ── Click to move (mirrors analyzer exactly) ──────────────────────────────
    const onSquareClick = ({ square } = {}) => {
        if (!square || !isMyTurn) return;
        const c = chess;

        // No piece selected yet
        if (!moveFrom) {
            const piece = c.get(square);
            if (piece && piece.color === c.turn()) {
                setMoveFrom(square);
            } else if (inCheck) {
                flashInvalid([kingSquare]);
            }
            return;
        }

        // Clicked same square → deselect
        if (square === moveFrom) { setMoveFrom(''); return; }

        // Clicked another own piece → switch selection
        const piece = c.get(square);
        if (piece && piece.color === c.turn()) { setMoveFrom(square); return; }

        // Attempt move
        tryMove(moveFrom, square);
    };

    // ── Promotion execution ───────────────────────────────────────────────────
    const doPromotion = (piece) => {
        if (!promotionMove) return;
        try {
            const { eng: c, isAbsorption: isAbs, mode: cMode } = getEngine(localFen);
            const move = c.move({ from: promotionMove.from, to: promotionMove.to, promotion: piece });
            if (move) { 
                const newBaseFen = c.fen();
                const newCaps = isAbs ? c.absorptionState.capabilities : {};
                const serializedFen = `${newBaseFen}|${cMode}|${JSON.stringify(newCaps)}`;
                setLocalFen(serializedFen); 
                sendMove(serializedFen); 
            }
        } catch {}
        setPromotionMove(null);
    };

    // ── Square styles ─────────────────────────────────────────────────────────
    const customSquareStyles = {};

    // Red flash
    flashSqs.forEach(sq => {
        if (sq) customSquareStyles[sq] = { animation: 'errorFlash 0.45s ease-out forwards' };
    });

    // Selected piece — yellow
    if (moveFrom) {
        customSquareStyles[moveFrom] = { ...customSquareStyles[moveFrom], backgroundColor: 'rgba(255,214,0,.45)' };
    }

    // Valid move dots
    validTargets.forEach(sq => {
        if (!customSquareStyles[sq]?.animation) {
            customSquareStyles[sq] = { background: 'radial-gradient(circle, rgba(0,0,0,.22) 28%, transparent 29%)' };
        }
    });

    // King in check — red glow
    if (kingSquare && !flashSqs.includes(kingSquare)) {
        customSquareStyles[kingSquare] = { backgroundColor: 'rgba(220,38,38,.55)', boxShadow: 'inset 0 0 12px rgba(220,38,38,.9)' };
    }

    const dynamicWizardPieces = useMemo(() => {
        if (!wizardImages) return null;
        const buildPieceComponent = (basePiece) => ({ square }) => {
            let src = wizardImages[basePiece];
            if (mode === 'absorption' && absorptionCapabilities[square]) {
                const caps = absorptionCapabilities[square];
                const color = basePiece[0]; // 'w' or 'b'
                const type = basePiece[1]; // 'P', 'N', 'B', 'R', 'Q', 'K'
                
                const allTypes = [...caps, type.toLowerCase()];
                const hasP = allTypes.includes('p');
                const hasR = allTypes.includes('r');
                const hasB = allTypes.includes('b');
                const hasN = allTypes.includes('n');
                const hasQ = allTypes.includes('q');
                
                const effectiveR = hasR || hasQ;
                const effectiveB = hasB || hasQ;
                const effectiveN = hasN;
                
                let keySuffix = null;
                if (effectiveR && effectiveB && effectiveN) {
                    keySuffix = 'Q_N';
                } else if (effectiveR && effectiveB) {
                    keySuffix = 'Q';
                } else if (hasP) {
                    if (effectiveR && effectiveN) keySuffix = 'P_N_R';
                    else if (effectiveB && effectiveN) keySuffix = 'P_B_N';
                    else if (effectiveR) keySuffix = 'P_R';
                    else if (effectiveB) keySuffix = 'P_B';
                    else if (effectiveN) keySuffix = 'P_N';
                } else {
                    if (effectiveR && effectiveN) keySuffix = 'R_N';
                    else if (effectiveB && effectiveN) keySuffix = 'B_N';
                }

                if (keySuffix) {
                    src = wizardImages[`${color}${keySuffix}`] || src;
                }
            }
            
            return (
                <div style={{ 
                    width: '100%', 
                    aspectRatio: '1 / 1', 
                    backgroundImage: `url(${src})`, 
                    backgroundSize: 'contain', 
                    backgroundRepeat: 'no-repeat', 
                    backgroundPosition: 'center' 
                }} />
            );
        };

        return {
            wP: buildPieceComponent('wP'), wN: buildPieceComponent('wN'), wB: buildPieceComponent('wB'),
            wR: buildPieceComponent('wR'), wQ: buildPieceComponent('wQ'), wK: buildPieceComponent('wK'),
            bP: buildPieceComponent('bP'), bN: buildPieceComponent('bN'), bB: buildPieceComponent('bB'),
            bR: buildPieceComponent('bR'), bQ: buildPieceComponent('bQ'), bK: buildPieceComponent('bK'),
        };
    }, [wizardImages, mode, absorptionCapabilities]);

    // ── Board options (plain object, mirrors analyzer) ─────────────────────────
    const boardOptions = {
        id: 'multiplayer-board',
        position: baseFen,
        onPieceDrop: onDrop,
        onSquareClick: onSquareClick,
        boardOrientation: myColor || 'white',
        animationDurationInMs: 100,
        allowDragging: isMyTurn,
        darkSquareStyle: { backgroundColor: theme?.board?.dark || '#739552' },
        lightSquareStyle: { backgroundColor: theme?.board?.light || '#ebecd0' },
        squareStyles: customSquareStyles,
        boardStyle: { borderRadius: '4px', boxShadow: '0 4px 24px rgba(0,0,0,.4)' },
    };
    if (theme?.pieces === 'wizard' && dynamicWizardPieces) boardOptions.pieces = dynamicWizardPieces;

    if (phase === 'waiting') return <WaitingRoom gameCode={gameCode} myColor={myColor} theme={theme} onLeave={leaveGame} />;

    return (
        <div style={{ display:'flex', gap:'2rem', justifyContent:'center', alignItems:'flex-start', flexWrap:'wrap', padding:'1rem' }}>
            <div style={{ width:'560px', maxWidth:'95vw' }}>
                <PlayerBanner color={myColor==='white'?'black':'white'} isMyTurn={!isMyTurn} myColor={myColor} theme={theme} />
                <div style={{ position:'relative' }}>
                    {gameOverMessage && <GameOverOverlay message={gameOverMessage} onLeave={leaveGame} theme={theme} />}
                    {promotionMove && <PromotionDialog pm={promotionMove} onPromote={doPromotion} onCancel={() => setPromotionMove(null)} theme={theme} wizardImages={wizardImages} />}
                    <Chessboard options={boardOptions} />
                </div>
                <PlayerBanner color={myColor} isMyTurn={isMyTurn} myColor={myColor} theme={theme} />
            </div>

            <div style={{ width:'220px', display:'flex', flexDirection:'column', gap:'1rem' }}>
                <div style={{ background: t.surface||'#1e293b', border:`1px solid ${t.border||'#334155'}`, borderRadius:'12px', padding:'1.25rem' }}>
                    <div style={{ fontSize:'.7rem', fontWeight:'700', color: t.text||'#fff', opacity:.45, textTransform:'uppercase', letterSpacing:'1px', marginBottom:'.5rem' }}>Game Code</div>
                    <div style={{ fontFamily:'monospace', fontSize:'1.5rem', fontWeight:'900', letterSpacing:'.3rem', color: t.accent||'#3b82f6' }}>{gameCode}</div>
                </div>

                <div style={{ background: t.surface||'#1e293b', border:`1px solid ${t.border||'#334155'}`, borderRadius:'12px', padding:'1.25rem' }}>
                    <div style={{ fontSize:'.7rem', fontWeight:'700', color: t.text||'#fff', opacity:.45, textTransform:'uppercase', letterSpacing:'1px', marginBottom:'.5rem' }}>Status</div>
                    <div style={{ color: isMyTurn ? t.accent||'#3b82f6' : t.text||'#fff', fontWeight:'700', fontSize:'.95rem' }}>
                        {inCheck && isMyTurn ? '⚠️ You are in check!' : isMyTurn ? '🟢 Your turn' : "⏳ Opponent's turn"}
                    </div>
                    <div style={{ color: t.text||'#fff', opacity:.5, fontSize:'.8rem', marginTop:'.3rem' }}>You: {myColor==='white'?'♔ White':'♚ Black'}</div>
                </div>

                <div style={{ background: isMyTurn?`${t.accent||'#3b82f6'}18`:'rgba(255,255,255,.03)', border:`1px solid ${isMyTurn?t.accent||'#3b82f6':t.border||'#334155'}`, borderRadius:'12px', padding:'1rem', textAlign:'center', fontSize:'.85rem', color: t.text||'#fff', fontWeight:'600' }}>
                    {moveFrom
                        ? <span style={{ color: t.accent||'#3b82f6' }}>Click a dot to move</span>
                        : isMyTurn
                            ? <span style={{ color: t.accent||'#3b82f6' }}>✦ Select a piece</span>
                            : <span style={{ opacity:.55 }}>Waiting for opponent…</span>}
                </div>

                <button id="btn-resign" onClick={() => { if (window.confirm('Resign?')) resign(); }}
                    style={{ background:'rgba(239,68,68,.1)', border:'1px solid rgba(239,68,68,.4)', color:'#f87171', borderRadius:'10px', padding:'.75rem', cursor:'pointer', fontWeight:'700', fontSize:'.9rem' }}>
                    🏳️ Resign
                </button>
                <button id="btn-leave-game" onClick={leaveGame}
                    style={{ background:'transparent', border:`1px solid ${t.border||'#334155'}`, color: t.text||'#fff', opacity:.55, borderRadius:'10px', padding:'.75rem', cursor:'pointer', fontWeight:'600', fontSize:'.9rem' }}>
                    ← Back to Lobby
                </button>
            </div>
        </div>
    );
}
