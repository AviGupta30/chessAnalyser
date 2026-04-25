class AudioManager {
    playMoveSound(moveDetails, themePieces, isCheck, isCheckmate, isMuted) {
        if (isMuted) return;

        const play = (path) => new Audio(path).play().catch(() => {});

        if (themePieces === 'wizard') {
            if (isCheckmate) {
                // If White delivered mate, the current turn is now 'b' (but we can use moveDetails.color which is the color that just moved)
                if (moveDetails.color === 'w') {
                    play('/sounds/wizard/expecto-patronum.mp3');
                } else {
                    play('/sounds/wizard/avada-kedavra.mp3');
                }
            } else if (moveDetails.captured) {
                // If Queen is captured, play that-felt-good
                if (moveDetails.captured === 'q') play('/sounds/wizard/that-felt-good.mp3');
                // If the piece *doing the capturing* is a Bishop, play diagonally
                else if (moveDetails.piece === 'b') play('/sounds/wizard/diagonally.mp3');
                // If the piece *doing the capturing* is a Rook, play bloody-hell
                else if (moveDetails.piece === 'r') play('/sounds/wizard/bloody-hell.mp3');
                else play('/sounds/wizard/capture.mp3');
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
