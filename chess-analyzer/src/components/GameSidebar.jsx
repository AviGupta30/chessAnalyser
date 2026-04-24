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
    startFen,
    activeTheme,
    showHint,
    setShowHint
}) {
    const { status, result } = engineState;
    const displayMoves = history.map(m => m.san);

    // Grab the mathematical classification calculated in App.jsx
    const currentMoveData = history[currentMoveIndex];
    const classification = currentMoveData?.savedEval?.classification;

    return (
        <aside style={{ width: '300px', background: activeTheme.global.surface, padding: '1rem', borderRadius: '8px', border: `1px solid ${activeTheme.global.border}`, display: 'flex', flexDirection: 'column', gap: '1.5rem', transition: 'all 0.3s ease' }}>

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

                {isPracticeMode && (
                    <button
                        onClick={onUndo}
                        style={{
                            width: '100%', padding: '0.75rem', fontSize: '0.9rem', fontWeight: 'bold',
                            background: activeTheme.global.bg, color: activeTheme.global.text,
                            border: `1px solid ${activeTheme.global.border}`, borderRadius: '8px', cursor: 'pointer',
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

            {/* ── 1. THE "WHY" COACH FEEDBACK ── */}
            {classification && (
                <div style={{
                    background: activeTheme.global.bg, padding: '1rem', borderRadius: '8px',
                    borderLeft: `4px solid ${classification.color}`, borderTop: `1px solid ${activeTheme.global.border}`,
                    borderRight: `1px solid ${activeTheme.global.border}`, borderBottom: `1px solid ${activeTheme.global.border}`
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <span style={{ background: classification.color, color: '#fff', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.8rem' }}>
                            {classification.icon} {classification.tag}
                        </span>
                    </div>
                    <div style={{ fontSize: '0.9rem', color: activeTheme.global.text, opacity: 0.9, lineHeight: '1.4' }}>
                        {classification.msg}
                    </div>
                </div>
            )}

            {/* ── 2. INTERACTIVE GRANDMASTER HINT TOGGLE ── */}
            {result?.bestMove && !isPracticeMode && (
                <div style={{ background: activeTheme.global.bg, padding: '1rem', borderRadius: '8px', border: `1px solid ${activeTheme.global.border}` }}>
                    <div style={{ fontSize: '0.8rem', color: activeTheme.global.text, opacity: 0.7, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Engine Evaluation</div>

                    {!showHint ? (
                        <button
                            onClick={() => setShowHint(true)}
                            style={{
                                width: '100%', padding: '0.75rem', background: activeTheme.global.accent,
                                color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer',
                                fontWeight: 'bold', transition: 'background 0.2s'
                            }}
                        >
                            💡 Reveal Best Move
                        </button>
                    ) : (
                        <div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: activeTheme.global.accent }}>{result.bestMove}</div>
                            {result.pv && (
                                <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: activeTheme.global.text, opacity: 0.8 }}>
                                    <strong>Line (d{result.depth}):</strong> {result.pv.slice(0, 5).join(' ')}...
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            <div style={{ flex: 1, overflowY: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontSize: '0.8rem', color: activeTheme.global.text, opacity: 0.7, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Move History</div>
                <MoveHistory moves={displayMoves} currentMoveIndex={currentMoveIndex} onMoveClick={onMoveClick} />
            </div>
        </aside>
    );
}