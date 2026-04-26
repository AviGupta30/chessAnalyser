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
                // If White delivered mate, the current turn is now 'b' (but we can use moveDetails.color which is the color that just moved)
                if (moveDetails.color === 'w') {
                    play('/sounds/wizard/expecto-patronum.mp3');
                } else {
                    play('/sounds/wizard/avada-kedavra.mp3');
                }
            } else if (moveDetails.captured) {
                // that-felt-good if any piece capturing has the power of a queen
                if (piecePowers.includes('q')) {
                    play('/sounds/wizard/that-felt-good.mp3');
                } 
                // diagonally if any piece uses bishop's move to capture
                else if (moveDetails.usedPower === 'b' || (!moveDetails.usedPower && moveDetails.piece === 'b')) {
                    play('/sounds/wizard/diagonally.mp3');
                } 
                // bloody-hell if any piece captures with the power of a rook
                else if (piecePowers.includes('r')) {
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
