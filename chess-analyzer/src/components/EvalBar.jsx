import React from 'react';
import { Loader2 } from 'lucide-react';

const CLAMP = 1000;

function cpToPercent(cp) {
    if (cp === null) return 50;
    const clamped = Math.max(-CLAMP, Math.min(CLAMP, cp));
    return 50 + (clamped / CLAMP) * 45;
}

function formatScore(cp, mate) {
    if (mate !== null) return mate > 0 ? `M${mate}` : `M${Math.abs(mate)}`;
    if (cp === null) return '0.0';
    return (cp / 100).toFixed(1);
}

export default function EvalBar({ result, status }) {
    const cp = result?.cp ?? null;
    const mate = result?.mate ?? null;

    let whitePercent;
    if (mate !== null) {
        whitePercent = mate > 0 ? 95 : 5;
    } else {
        whitePercent = cpToPercent(cp);
    }

    const blackPercent = 100 - whitePercent;
    const scoreLabel = formatScore(cp, mate);
    const isAnalysing = status === 'analysing';

    return (
        <div style={{ width: '30px', height: '100%', background: '#2d3748', borderRadius: '8px', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
            <div style={{ height: `${blackPercent}%`, background: '#1a202c', width: '100%', transition: 'height 0.3s ease' }} />
            <div style={{ height: `${whitePercent}%`, background: '#f7fafc', width: '100%', transition: 'height 0.3s ease' }} />

            <div style={{ position: 'absolute', bottom: '10px', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', color: whitePercent > 50 ? '#1a202c' : '#f7fafc', fontWeight: 'bold', fontSize: '0.75rem', textShadow: '0px 0px 3px rgba(0,0,0,0.3)' }}>
                {isAnalysing && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite', marginBottom: '4px' }} />}
                {scoreLabel}
            </div>
        </div>
    );
}