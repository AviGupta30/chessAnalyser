class AudioManager {
    playMoveSound(moveDetails, themePieces, isCheck, isCheckmate, isMuted, piecePowers = []) {
        if (isMuted) return;

        const play = (path) => new Audio(path).play().catch(() => {});

        // Fallback for piecePowers if not provided (like in standard mode)
        if (piecePowers.length === 0 && moveDetails.piece) {
            piecePowers = [moveDetails.piece.toLowerCase()];
        }

        if (themePieces === 'wizard') {
            if (isCheckmate) {
                if (moveDetails.color === 'w') {
                    play('/sounds/wizard/expecto-patronum.mp3');
                } else {
                    play('/sounds/wizard/avada-kedavra.mp3');
                }
            } else if (moveDetails.captured) {
                // 1. Captured piece with queen moves (satisfying capture)
                const capturedPowers = moveDetails.capturedPowers || [moveDetails.captured.toLowerCase()];
                if (capturedPowers.includes('q')) {
                    play('/sounds/wizard/that-felt-good.mp3');
                } 
                // 2. Captured with diagonal move (Bishop power)
                else if (moveDetails.usedPower === 'b' || (!moveDetails.usedPower && moveDetails.piece === 'b')) {
                    play('/sounds/wizard/diagonally.mp3');
                } 
                // 3. Captured with rook move (Rook power)
                else if (moveDetails.usedPower === 'r' || (!moveDetails.usedPower && moveDetails.piece === 'r')) {
                    play('/sounds/wizard/bloody-hell.mp3');
                } 
                // Default capture
                else {
                    play('/sounds/wizard/capture.mp3');
                }
            } else if (isCheck) {
                play('/sounds/wizard/check.mp3');
            } else {
                play('/sounds/wizard/move.mp3');
            }
        } else {
            if (isCheckmate || isCheck) {
                play('/sounds/standard/check.mp3');
            } else if (moveDetails.captured) {
                play('/sounds/standard/capture.mp3');
            } else {
                play('/sounds/standard/move.mp3');
            }
        }
    }
}

export default new AudioManager();
