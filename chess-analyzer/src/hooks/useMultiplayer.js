import { useState, useEffect, useRef, useCallback } from 'react';
import { Chess } from 'chess.js';
import { supabase } from '../lib/supabase';
import AbsorptionEngine from '../engine/variants/absorption/absorbtion';

const STD_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

// Cryptographically safe 6-char uppercase game code
const generateGameCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from(crypto.getRandomValues(new Uint8Array(6)))
        .map(b => chars[b % chars.length])
        .join('');
};

// Persistent player ID for this browser session
const getPlayerId = () => {
    let id = sessionStorage.getItem('chess_player_id');
    if (!id) {
        id = crypto.randomUUID();
        sessionStorage.setItem('chess_player_id', id);
    }
    return id;
};

const checkGameOver = (currentFen) => {
    try {
        const [fen, mode, capsStr] = (currentFen || '').split('|');
        let chess;
        if (mode === 'absorption') {
            chess = new AbsorptionEngine();
            chess.load(fen, capsStr ? JSON.parse(capsStr) : {});
        } else {
            chess = new Chess(fen || currentFen);
        }

        if (chess.isCheckmate()) {
            const winner = chess.turn() === 'w' ? 'Black' : 'White';
            return `🏆 Checkmate! ${winner} wins!`;
        }
        if (chess.isStalemate())            return "⚖️ Stalemate — it's a draw!";
        if ((chess.isInsufficientMaterial && chess.isInsufficientMaterial()) || (chess.chess && chess.chess.isInsufficientMaterial())) return '⚖️ Draw by insufficient material!';
        if ((chess.isThreefoldRepetition && chess.isThreefoldRepetition()) || (chess.chess && chess.chess.isThreefoldRepetition()))  return '⚖️ Draw by threefold repetition!';
        if ((chess.isDraw && chess.isDraw()) || (chess.chess && chess.chess.isDraw()))                 return '⚖️ Draw!';
    } catch (e) { /* ignore invalid FEN */ }
    return null;
};

export function useMultiplayer() {
    const [phase, setPhase]                   = useState('lobby');
    const [myColor, setMyColor]               = useState(null);
    const [gameCode, setGameCode]             = useState('');
    const [fen, setFen]                       = useState(STD_FEN);
    const [gameOverMessage, setGameOverMessage] = useState(null);
    const [opponentConnected, setOpponentConnected] = useState(false);
    const [error, setError]                   = useState(null);
    const [isLoading, setIsLoading]           = useState(false);
    const [lastMove, setLastMove]             = useState(null);

    const channelRef         = useRef(null);
    const pollTimerRef       = useRef(null);
    const disconnectTimerRef = useRef(null);
    const myIdRef            = useRef(getPlayerId());
    const gameCodeRef        = useRef('');
    const phaseRef           = useRef('lobby');

    // Keep refs in sync so closures are always current
    useEffect(() => { gameCodeRef.current  = gameCode; },  [gameCode]);
    useEffect(() => { phaseRef.current     = phase; },     [phase]);

    // ── CLEANUP ──────────────────────────────────────────────────────────────
    const cleanup = useCallback(() => {
        if (channelRef.current) {
            supabase.removeChannel(channelRef.current);
            channelRef.current = null;
        }
        clearInterval(pollTimerRef.current);
        clearTimeout(disconnectTimerRef.current);
    }, []);

    useEffect(() => () => cleanup(), [cleanup]);

    // ── SUBSCRIBE TO BROADCAST CHANNEL ───────────────────────────────────────
    // We use Supabase Realtime BROADCAST (not postgres_changes) for moves.
    // This is instant (<100ms) and requires zero DB config beyond enabling Realtime.
    const subscribeToChannel = useCallback((code) => {
        if (channelRef.current) {
            supabase.removeChannel(channelRef.current);
        }

        const channel = supabase.channel(`chess:${code}`, {
            config: { broadcast: { self: false } }
        });

        channel
            // Opponent move
            .on('broadcast', { event: 'move' }, ({ payload }) => {
                console.log('[MP] Received move:', payload.fen);
                setFen(payload.fen);
                if (payload.move) {
                    setLastMove({ ...payload.move, capturedPowers: payload.capturedPowers || [] });
                }
                const over = checkGameOver(payload.fen);
                if (over) { setGameOverMessage(over); setPhase('finished'); }
            })
            // Game started (sent by joiner to wake up creator)
            .on('broadcast', { event: 'opponent_joined' }, ({ payload }) => {
                console.log('[MP] Opponent joined:', payload);
                setOpponentConnected(true);
                setPhase('playing');
                clearInterval(pollTimerRef.current);
            })
            // Game over broadcast
            .on('broadcast', { event: 'game_over' }, ({ payload }) => {
                console.log('[MP] Game over:', payload.message);
                setGameOverMessage(payload.message);
                setPhase('finished');
            })
            // Presence: detect disconnects
            .on('presence', { event: 'sync' }, () => {
                const count = Object.keys(channel.presenceState()).length;
                if (count >= 2) {
                    clearTimeout(disconnectTimerRef.current);
                    setOpponentConnected(true);
                    if (phaseRef.current === 'waiting') setPhase('playing');
                }
            })
            .on('presence', { event: 'leave' }, () => {
                const count = Object.keys(channel.presenceState()).length;
                if (count < 2 && phaseRef.current === 'playing') {
                    disconnectTimerRef.current = setTimeout(() => {
                        setGameOverMessage('⚡ Opponent disconnected. You win!');
                        setPhase('finished');
                    }, 10000);
                }
            })
            .subscribe(async (status, err) => {
                console.log('[MP] Channel status:', status, err || '');
                if (status === 'SUBSCRIBED') {
                    await channel.track({
                        player_id: myIdRef.current,
                        online_at: new Date().toISOString(),
                    });
                }
            });

        channelRef.current = channel;
        return channel;
    }, []);

    // ── POLL FOR OPPONENT (creator side) ─────────────────────────────────────
    // Instead of relying on postgres_changes (which needs REPLICA IDENTITY FULL),
    // we poll the DB every 2 seconds until the room status becomes 'active'.
    const startPollingForOpponent = useCallback((code) => {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = setInterval(async () => {
            if (phaseRef.current !== 'waiting') {
                clearInterval(pollTimerRef.current);
                return;
            }
            try {
                const { data, error: err } = await supabase
                    .from('game_rooms')
                    .select('status, white_player_id, black_player_id')
                    .eq('game_code', code)
                    .single();

                if (err) { console.error('[MP] Poll error:', err); return; }

                if (data?.status === 'active') {
                    clearInterval(pollTimerRef.current);
                    setOpponentConnected(true);
                    setPhase('playing');
                    // Notify joiner via broadcast that creator is ready
                    channelRef.current?.send({
                        type: 'broadcast',
                        event: 'opponent_joined',
                        payload: { message: 'game_active' }
                    });
                }
            } catch (e) { console.error('[MP] Poll exception:', e); }
        }, 2000);
    }, []);

    // ── CREATE GAME ──────────────────────────────────────────────────────────
    const createGame = useCallback(async (chosenColor, mode = 'standard') => {
        setIsLoading(true);
        setError(null);
        console.log('[MP] Creating game, color:', chosenColor, 'mode:', mode);

        try {
            const code = generateGameCode();
            const actualColor = chosenColor === 'random'
                ? (Math.random() < 0.5 ? 'white' : 'black')
                : chosenColor;

            const initialFen = `${STD_FEN}|${mode}|{}`;

            const payload = {
                game_code: code,
                fen: initialFen,
                status: 'waiting',
                white_player_id: actualColor === 'white' ? myIdRef.current : null,
                black_player_id: actualColor === 'black' ? myIdRef.current : null,
            };

            console.log('[MP] Inserting room:', payload);
            const { data, error: dbErr } = await supabase
                .from('game_rooms')
                .insert(payload)
                .select()
                .single();

            if (dbErr) {
                console.error('[MP] Insert error:', dbErr);
                setError(`DB Error: ${dbErr.message}. Check your Supabase setup.`);
                setIsLoading(false);
                return;
            }

            console.log('[MP] Room created:', data);

            setGameCode(code);
            setMyColor(actualColor);
            setFen(initialFen);
            setPhase('waiting');       // ← triggers WaitingRoom (now correctly routed)
            setIsLoading(false);

            subscribeToChannel(code);
            startPollingForOpponent(code);

        } catch (e) {
            console.error('[MP] Unexpected error in createGame:', e);
            setError(`Unexpected error: ${e.message}`);
            setIsLoading(false);
        }
    }, [subscribeToChannel, startPollingForOpponent]);

    // ── JOIN GAME ────────────────────────────────────────────────────────────
    const joinGame = useCallback(async (code) => {
        setIsLoading(true);
        setError(null);
        const upperCode = code.trim().toUpperCase();
        console.log('[MP] Joining game:', upperCode);

        try {
            // 1. Fetch the room
            const { data: room, error: fetchErr } = await supabase
                .from('game_rooms')
                .select('*')
                .eq('game_code', upperCode)
                .single();

            if (fetchErr || !room) {
                console.error('[MP] Fetch error:', fetchErr);
                setError('Game not found. Double-check the code.');
                setIsLoading(false);
                return;
            }

            if (room.status !== 'waiting') {
                setError('This game is already active or finished.');
                setIsLoading(false);
                return;
            }

            // 2. Assign the opposite color
            const joinColor = room.white_player_id ? 'black' : 'white';
            const updatePayload = {
                status: 'active',
                [joinColor === 'white' ? 'white_player_id' : 'black_player_id']: myIdRef.current,
            };

            const { error: updateErr } = await supabase
                .from('game_rooms')
                .update(updatePayload)
                .eq('game_code', upperCode);

            if (updateErr) {
                console.error('[MP] Update error:', updateErr);
                setError(`Failed to join: ${updateErr.message}`);
                setIsLoading(false);
                return;
            }

            console.log('[MP] Joined as:', joinColor);

            setGameCode(upperCode);
            setMyColor(joinColor);
            setFen(room.fen || `${STD_FEN}|standard|{}`);
            setOpponentConnected(true);
            setPhase('playing');
            setIsLoading(false);

            // Subscribe and immediately broadcast to wake up the creator's poll
            const channel = subscribeToChannel(upperCode);
            // Give the subscription a moment to establish before broadcasting
            setTimeout(() => {
                channel.send({
                    type: 'broadcast',
                    event: 'opponent_joined',
                    payload: { color: joinColor }
                });
            }, 500);

        } catch (e) {
            console.error('[MP] Unexpected error in joinGame:', e);
            setError(`Unexpected error: ${e.message}`);
            setIsLoading(false);
        }
    }, [subscribeToChannel]);

    // ── SEND MOVE ────────────────────────────────────────────────────────────
    const sendMove = useCallback(async (newFen, moveObj, capturedPowers = []) => {
        if (!channelRef.current) return;
        console.log('[MP] Sending move:', newFen);

        const enhancedMove = { ...moveObj, capturedPowers };
        setLastMove(enhancedMove);

        // Broadcast to opponent instantly
        channelRef.current.send({
            type: 'broadcast',
            event: 'move',
            payload: { fen: newFen, move: moveObj, capturedPowers }
        });

        // Persist to DB (fire-and-forget; non-blocking)
        supabase.from('game_rooms')
            .update({ fen: newFen })
            .eq('game_code', gameCodeRef.current)
            .then(({ error }) => { if (error) console.warn('[MP] FEN persist error:', error); });

        // Check for game over
        const overMsg = checkGameOver(newFen);
        if (overMsg) {
            channelRef.current.send({
                type: 'broadcast',
                event: 'game_over',
                payload: { message: overMsg }
            });
            setGameOverMessage(overMsg);
            setPhase('finished');
        }
    }, []);

    // ── RESIGN ───────────────────────────────────────────────────────────────
    const resign = useCallback(() => {
        const winner = myColor === 'white' ? 'Black' : 'White';
        const msg = `🏳️ ${myColor === 'white' ? 'White' : 'Black'} resigned. ${winner} wins!`;
        channelRef.current?.send({
            type: 'broadcast',
            event: 'game_over',
            payload: { message: msg }
        });
        setGameOverMessage(msg);
        setPhase('finished');
        supabase.from('game_rooms')
            .update({ status: 'finished', winner: winner.toLowerCase() })
            .eq('game_code', gameCodeRef.current)
            .then(() => {});
    }, [myColor]);

    // ── LEAVE / RESET ────────────────────────────────────────────────────────
    const leaveGame = useCallback(() => {
        cleanup();
        setPhase('lobby');
        setMyColor(null);
        setGameCode('');
        setFen(`${STD_FEN}|standard|{}`);
        setGameOverMessage(null);
        setOpponentConnected(false);
        setError(null);
    }, [cleanup]);

    return {
        phase,
        myColor,
        gameCode,
        fen,
        setFen,
        gameOverMessage,
        opponentConnected,
        error,
        isLoading,
        createGame,
        joinGame,
        sendMove,
        resign,
        leaveGame,
        lastMove
    };
}
