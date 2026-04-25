import { useState, useEffect, useCallback, useRef } from 'react';
import { engineService } from './EngineService';

function normaliseScore(cp, fen) {
    if (cp === null) return null;
    const activeColor = fen?.split(' ')[1];
    return activeColor === 'b' ? -cp : cp;
}

export function useEngine() {
    const [engineState, setEngineState] = useState({ status: 'idle', result: null, error: null });
    const requestIdRef = useRef(0);
    const lastFenRef = useRef(null);

    useEffect(() => {
        setEngineState(s => ({ ...s, status: 'initialising' }));
        engineService.init()
            .then(() => setEngineState(s => ({ ...s, status: 'ready' })))
            .catch(err => setEngineState({ status: 'error', result: null, error: String(err) }));
        return () => engineService.terminate();
    }, []);

    const analyzePosition = useCallback((fen, depth = 18) => {
        if (fen === lastFenRef.current) return;
        engineService.stop();
        const requestId = ++requestIdRef.current;
        lastFenRef.current = fen;

        setEngineState(s => ({ ...s, status: 'analysing', result: null, error: null }));

        engineService.evaluate(fen, depth)
            .then(result => {
                if (requestId !== requestIdRef.current) return;
                setEngineState({
                    status: 'ready',
                    result: { ...result, cp: normaliseScore(result.cp, fen) },
                    error: null,
                    fen: fen
                });
            })
            .catch(err => {
                if (requestId !== requestIdRef.current) return;
                const msg = String(err);
                if (msg.includes('not ready')) {
                    lastFenRef.current = null;
                    return;
                }
                if (!msg.includes('cancelled')) {
                    setEngineState(s => ({ ...s, status: 'ready', error: msg }));
                }
            });
    }, []);

    const stopAnalysis = useCallback(() => {
        requestIdRef.current++;
        lastFenRef.current = null;
        engineService.stop();
        setEngineState(s => ({ ...s, status: 'ready' }));
    }, []);

    return { engineState, analyzePosition, stopAnalysis };
}