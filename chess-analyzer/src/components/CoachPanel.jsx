import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Chess } from 'chess.js';
import { classifyMoveSmart } from '../utils/coach';

const COACH_PERSONAS = {
    gm: { name: 'The Grandmaster', pitchMod: 0.8, rateMod: 1.15, preferVoice: ['Google UK English Male', 'Daniel', 'Natural'] },
    hype: { name: 'The Hypeman', pitchMod: 1.2, rateMod: 1.45, preferVoice: ['Google US English', 'Samantha', 'Alex'] },
    tactician: { name: 'The Tactician', pitchMod: 1.1, rateMod: 1.3, preferVoice: ['Google UK English Female', 'Victoria', 'Karen'] }
};

export default function CoachPanel({ history, currentMoveIndex, currentEngineState, startFen }) {
    const [isVoiceEnabled, setIsVoiceEnabled] = useState(false);
    const [availableVoices, setAvailableVoices] = useState([]);
    const [selectedCoach, setSelectedCoach] = useState('gm');

    // ── ANTI-REPETITION GUARD ──
    const lastSpokenRef = useRef('');

    useEffect(() => {
        const synth = window.speechSynthesis;
        const loadVoices = () => setAvailableVoices(synth.getVoices());
        loadVoices();
        if (synth.onvoiceschanged !== undefined) synth.onvoiceschanged = loadVoices;
    }, []);

    const feedback = useMemo(() => {
        if (currentMoveIndex < 0) return { type: 'Ready', icon: '🧠', color: '#3b82f6', text: 'Make a move to begin.', spokenText: '', isMutedState: true };
        if (currentEngineState.status === 'analysing') return { type: 'Thinking...', icon: '🤔', color: '#94a3b8', text: 'Evaluating...', spokenText: '', isMutedState: true };
        if (!currentEngineState.result) return { type: 'Waiting...', icon: '⏳', color: '#94a3b8', text: 'Loading engine...', spokenText: '', isMutedState: true };

        const currentMoveObj = history[currentMoveIndex];
        const prevMoveObj = currentMoveIndex > 0 ? history[currentMoveIndex - 1] : null;

        const activeColor = currentMoveObj.fen.split(' ')[1];
        let absMate = currentEngineState.result.mate;
        if (activeColor === 'b' && absMate !== null) absMate = -absMate;

        const currentEval = { cp: currentEngineState.result.cp, mate: absMate };
        const prevEval = prevMoveObj?.savedEval ?? { cp: 0, mate: null, bestMove: null };

        let prevBestMoveObj = null;
        if (prevEval.bestMove) {
            try {
                const temp = new Chess(prevMoveObj ? prevMoveObj.fen : startFen);
                prevBestMoveObj = temp.move({
                    from: prevEval.bestMove.substring(0, 2),
                    to: prevEval.bestMove.substring(2, 4),
                    promotion: prevEval.bestMove.length === 5 ? prevEval.bestMove[4] : undefined
                });
            } catch (e) { }
        }

        const isWhiteMove = currentMoveIndex % 2 === 0;
        const currentSequence = history.slice(0, currentMoveIndex + 1).map(m => m.san).join(' ');
        const prevSequence = history.slice(0, currentMoveIndex).map(m => m.san).join(' ');

        return classifyMoveSmart(prevEval, currentEval, isWhiteMove, currentMoveObj, prevBestMoveObj, currentSequence, prevSequence);
    }, [history, currentMoveIndex, currentEngineState, startFen]);

    const getDynamicTone = (type, persona) => {
        let emotionPitch = 1.0;
        let emotionRate = 1.0;
        if (type === 'Blunder' || type === 'Miss') { emotionPitch = 0.8; emotionRate = 0.95; }
        else if (type === 'Best Move' || type === 'Great') { emotionPitch = 1.15; emotionRate = 1.05; }
        return { pitch: persona.pitchMod * emotionPitch, rate: persona.rateMod * emotionRate };
    };

    useEffect(() => {
        if (isVoiceEnabled && feedback && !feedback.isMutedState && feedback.spokenText && availableVoices.length > 0) {

            let cleanText = feedback.spokenText.replace(/[\u{1F600}-\u{1F6FF}\u{2700}-\u{27BF}\u{1F300}-\u{1F5FF}]/gu, '');

            // ── CHECK IF WE ALREADY SPOKE THIS LINE ──
            const uniquePhraseIdentifier = cleanText + currentMoveIndex;
            if (lastSpokenRef.current === uniquePhraseIdentifier) return;
            lastSpokenRef.current = uniquePhraseIdentifier;

            const synth = window.speechSynthesis;
            synth.cancel();

            const utterance = new SpeechSynthesisUtterance(cleanText);
            const persona = COACH_PERSONAS[selectedCoach];
            let chosenVoice = availableVoices.find(v => persona.preferVoice.some(pref => v.name.includes(pref)));
            if (!chosenVoice) chosenVoice = availableVoices.find(v => v.lang.startsWith('en')) || availableVoices[0];

            utterance.voice = chosenVoice;
            const tone = getDynamicTone(feedback.type, persona);
            utterance.pitch = tone.pitch;
            utterance.rate = tone.rate;

            synth.speak(utterance);
        }
    }, [feedback, isVoiceEnabled, availableVoices, selectedCoach, currentMoveIndex]);

    return (
        <div style={{ background: '#1e293b', borderRadius: '8px', padding: '1rem', borderLeft: `4px solid ${feedback.color}`, boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', marginBottom: '1rem', position: 'relative' }}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <select
                    value={selectedCoach}
                    onChange={(e) => setSelectedCoach(e.target.value)}
                    style={{ background: '#0f1117', color: '#cbd5e1', border: '1px solid #334155', borderRadius: '4px', padding: '0.2rem', fontSize: '0.8rem', outline: 'none', cursor: 'pointer' }}
                >
                    {Object.entries(COACH_PERSONAS).map(([key, data]) => (
                        <option key={key} value={key}>{data.name}</option>
                    ))}
                </select>

                <button
                    onClick={() => {
                        if (isVoiceEnabled) window.speechSynthesis.cancel();
                        setIsVoiceEnabled(!isVoiceEnabled);
                    }}
                    style={{ background: isVoiceEnabled ? '#3b82f6' : '#334155', border: 'none', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                    {isVoiceEnabled ? '🔊' : '🔇'}
                </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <div style={{ background: `${feedback.color}20`, color: feedback.color, padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.9rem' }}>
                    {feedback.icon} {feedback.type}
                </div>
            </div>

            <p style={{ margin: 0, color: '#cbd5e1', fontSize: '0.9rem', lineHeight: '1.4' }}>
                {feedback.text}
            </p>
        </div>
    );
}