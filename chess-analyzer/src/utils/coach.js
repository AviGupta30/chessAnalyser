import { openingBook } from './openings';

export function cpToWinProb(cp, mate) {
    if (mate !== null) return mate > 0 ? 100 : 0;
    if (cp === null) return 50;
    return 100 / (1 + Math.exp(-cp / 150));
}

const PIECE_NAMES = { 'p': 'pawn', 'n': 'knight', 'b': 'bishop', 'r': 'rook', 'q': 'queen' };

export function classifyMoveSmart(
    prevEval, currentEval, isWhiteMove,
    playedMoveObj, prevBestMoveObj,
    currentSequence, prevSequence
) {
    const defaultProcessing = {
        type: 'Evaluating...', icon: '🤔', color: '#94a3b8',
        text: 'Analyzing position...', spokenText: '', isMutedState: true
    };
    if (!prevEval || !currentEval) return defaultProcessing;

    const prevProb = cpToWinProb(prevEval.cp, prevEval.mate);
    const currProb = cpToWinProb(currentEval.cp, currentEval.mate);
    const winProbShift = isWhiteMove ? (currProb - prevProb) : (prevProb - currProb);

    const cpDrop = isWhiteMove
        ? (prevEval.cp !== null && currentEval.cp !== null ? prevEval.cp - currentEval.cp : 0)
        : (prevEval.cp !== null && currentEval.cp !== null ? currentEval.cp - prevEval.cp : 0);

    const playedBestMove = playedMoveObj && prevBestMoveObj && playedMoveObj.san === prevBestMoveObj.san;
    const capturedPiece = playedMoveObj?.captured ? PIECE_NAMES[playedMoveObj.captured] : null;
    const missedCapture = prevBestMoveObj?.captured ? PIECE_NAMES[prevBestMoveObj.captured] : null;

    const suggestion = prevBestMoveObj ? ` Best was ${prevBestMoveObj.san}.` : '';

    // ── 1. OPENINGS ──
    const currentOpening = openingBook[currentSequence];
    if (currentOpening) {
        return {
            type: 'Book', icon: '📖', color: '#a78bfa',
            text: `Book: ${currentOpening.name}.`,
            spokenText: `Book move. The ${currentOpening.name}.`
        };
    }
    const prevOpening = openingBook[prevSequence];
    if (prevOpening) {
        return {
            type: 'Left Book', icon: '🧭', color: '#facc15',
            text: `Left theory.`,
            spokenText: `You left theory. Expected ${prevOpening.next.join(' or ')}.`
        };
    }

    // ── 2. MATES ──
    const hadMate = isWhiteMove ? prevEval.mate > 0 : prevEval.mate < 0;
    const lostMate = isWhiteMove ? (currentEval.mate === null || currentEval.mate < 0) : (currentEval.mate === null || currentEval.mate > 0);
    if (hadMate && lostMate) {
        return {
            type: 'Miss', icon: '❌', color: '#f97316',
            text: `Missed forced mate!${suggestion}`,
            spokenText: `You missed a forced checkmate.${suggestion}`
        };
    }

    const allowedMate = isWhiteMove ? currentEval.mate < 0 : currentEval.mate > 0;
    const didntHaveMate = isWhiteMove ? (prevEval.mate === null || prevEval.mate > 0) : (prevEval.mate === null || prevEval.mate < 0);
    if (allowedMate && didntHaveMate) {
        return {
            type: 'Blunder', icon: '??', color: '#ef4444',
            text: `Blunder! Allows forced mate.`,
            spokenText: `Blunder. This allows a forced checkmate.`
        };
    }

    // ── 3. GOOD MOVES ──
    if (playedBestMove || winProbShift >= -1.5) {
        let text = 'Best move.';
        let spokenText = 'Best move.';
        if (capturedPiece) {
            if (Math.abs(cpDrop) < 150) {
                text = 'Equal trade.';
                spokenText = 'An equal trade.';
            } else {
                text = `Won a free ${capturedPiece}!`;
                spokenText = `You win a ${capturedPiece}.`;
            }
        }
        return {
            type: playedBestMove ? 'Best Move' : 'Great',
            icon: playedBestMove ? '⭐' : '👍',
            color: playedBestMove ? '#4ade80' : '#60a5fa',
            text, spokenText
        };
    }

    if (winProbShift >= -5.0) {
        return {
            type: 'Good', icon: '✓', color: '#94a3b8',
            text: `Good move.${suggestion}`,
            spokenText: `Good move.`
        };
    }

    // ── 4. MISTAKES & BLUNDERS ──
    if (winProbShift >= -12.0) {
        return {
            type: 'Inaccuracy', icon: '?!', color: '#facc15',
            text: `Inaccuracy.${suggestion}`,
            spokenText: `Inaccuracy. Gives up your advantage.${suggestion}`
        };
    } else {
        const isBlunder = winProbShift < -25.0;
        const type = isBlunder ? 'Blunder' : 'Mistake';
        const icon = isBlunder ? '??' : '?';
        const color = isBlunder ? '#ef4444' : '#fb923c';

        let textReason = 'Worsens your position.';
        let spokenReason = 'This is a mistake.';

        if (capturedPiece) {
            textReason = 'Losing trade.';
            spokenReason = 'You lose material on this trade.';
        } else if (missedCapture) {
            textReason = `Missed free ${missedCapture}.`;
            spokenReason = `You missed a free ${missedCapture}.`;
        } else if (cpDrop >= 800) {
            textReason = 'Hung your Queen!';
            spokenReason = 'You blundered your queen.';
        } else if (cpDrop >= 400) {
            textReason = 'Hung a Rook / allowed fork.';
            spokenReason = 'You hung a rook or allowed a fork.';
        } else if (cpDrop >= 250) {
            textReason = 'Hung a piece.';
            spokenReason = 'You left a piece hanging.';
        } else if (cpDrop >= 100) {
            textReason = 'Hung a pawn.';
            spokenReason = 'You left a pawn unprotected.';
        }

        return {
            type, icon, color,
            text: `${type}! ${textReason}${suggestion}`,
            spokenText: `${isBlunder ? 'Blunder.' : 'Mistake.'} ${spokenReason}${suggestion}`
        };
    }
}