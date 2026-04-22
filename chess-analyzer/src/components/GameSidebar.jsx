import React from 'react';
import MoveHistory from './MoveHistory';
import CoachPanel from './CoachPanel';

export default function GameSidebar({
    engineState,
    history,
    currentMoveIndex,
    onMoveClick,
    isPracticeMode,
    onTogglePractice,
    onUndo,
    startFen
}) {
    const { status, result } = engineState;
    const displayMoves = history.map(m => m.san);

    return (
        <aside style={{ width: '300px', background: '#0f1117', padding: '1rem', borderRadius: '8px', border: '1px solid #1e293b', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

            {/* ── PRACTICE MODE CONTROLS ── */}
            <div style={{ display: 'flex', gap: '0.5rem', flexDirection: 'column' }}>
                <button
                    onClick={onTogglePractice}
                    style={{
                        width: '100%', padding: '1rem', fontSize: '1rem', fontWeight: 'bold',
                        background: isPracticeMode ? '#ef4444' : '#10b981', color: '#fff',
                        border: 'none', borderRadius: '8px', cursor: 'pointer',
                        boxShadow: '0 4px 15px rgba(0,0,0,0.3)', transition: 'all 0.2s',
                    }}
                >
                    {isPracticeMode ? '🛑 Stop Practice' : '🎯 Practice vs Coach'}
                </button>

                {/* NEW UNDO BUTTON */}
                {isPracticeMode && (
                    <button
                        onClick={onUndo}
                        style={{
                            width: '100%', padding: '0.75rem', fontSize: '0.9rem', fontWeight: 'bold',
                            background: '#334155', color: '#f8fafc',
                            border: '1px solid #475569', borderRadius: '8px', cursor: 'pointer',
                            transition: 'all 0.2s',
                        }}
                    >
                        ⎌ Undo Move
                    </button>
                )}
            </div>

            <CoachPanel
                history={history}
                currentMoveIndex={currentMoveIndex}
                currentEngineState={engineState}
                startFen={startFen}
            />

            <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: status === 'ready' ? '#4ade80' : '#f5b942', fontWeight: 'bold' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: status === 'ready' ? '#4ade80' : '#f5b942' }} />
                    {status.toUpperCase()}
                </div>
            </div>

            {result?.bestMove && !isPracticeMode && (
                <div style={{ background: '#1e293b', padding: '1rem', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase' }}>Best Move</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#60a5fa' }}>{result.bestMove}</div>
                    {result.pv && (
                        <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#cbd5e1' }}>
                            <strong>Line (d{result.depth}):</strong> {result.pv.slice(0, 5).join(' ')}...
                        </div>
                    )}
                </div>
            )}

            <div style={{ flex: 1, overflowY: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Move History</div>
                <MoveHistory moves={displayMoves} currentMoveIndex={currentMoveIndex} onMoveClick={onMoveClick} />
            </div>
        </aside>
    );
}