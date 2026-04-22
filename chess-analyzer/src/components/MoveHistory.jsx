import React, { useEffect, useRef } from 'react';

export default function MoveHistory({ moves, currentMoveIndex, onMoveClick }) {
    const listRef = useRef(null);

    useEffect(() => {
        if (listRef.current) {
            const active = listRef.current.querySelector('.active');
            active?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }, [currentMoveIndex]);

    if (!moves || moves.length === 0) {
        return <div style={{ color: '#64748b', fontSize: '0.9rem', padding: '1rem' }}>No moves yet.</div>;
    }

    const pairs = [];
    for (let i = 0; i < moves.length; i += 2) {
        pairs.push([moves[i], moves[i + 1] ?? null]);
    }

    return (
        <div ref={listRef} style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.2rem', paddingRight: '0.5rem' }}>
            {pairs.map((pair, i) => {
                const whiteIndex = i * 2;
                const blackIndex = i * 2 + 1;

                return (
                    <div key={i} style={{ display: 'flex', gap: '1rem', padding: '0.3rem', background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                        <span style={{ color: '#64748b', width: '20px' }}>{i + 1}.</span>
                        <span
                            onClick={() => onMoveClick(whiteIndex)}
                            className={currentMoveIndex === whiteIndex ? 'active' : ''}
                            style={{ flex: 1, cursor: 'pointer', color: currentMoveIndex === whiteIndex ? '#fff' : '#cbd5e1', fontWeight: currentMoveIndex === whiteIndex ? 'bold' : 'normal' }}
                        >
                            {pair[0]}
                        </span>
                        {pair[1] && (
                            <span
                                onClick={() => onMoveClick(blackIndex)}
                                className={currentMoveIndex === blackIndex ? 'active' : ''}
                                style={{ flex: 1, cursor: 'pointer', color: currentMoveIndex === blackIndex ? '#fff' : '#cbd5e1', fontWeight: currentMoveIndex === blackIndex ? 'bold' : 'normal' }}
                            >
                                {pair[1]}
                            </span>
                        )}
                    </div>
                );
            })}
        </div>
    );
}