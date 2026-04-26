class AudioManager {
    playMoveSound(moveDetails, themePieces, isCheck, isCheckmate, isMuted, capturedPiece = null) {
        if (isMuted) return;

        const play = (path) => new Audio(path).play().catch(() => {});

        // 1. Determine Move Geometry
        let isDiagonal = false;
        let isStraight = false;
        
        if (moveDetails && moveDetails.from && moveDetails.to) {
            const fromFile = moveDetails.from.charCodeAt(0);
            const fromRank = parseInt(moveDetails.from[1], 10);
            const toFile = moveDetails.to.charCodeAt(0);
            const toRank = parseInt(moveDetails.to[1], 10);
            
            const dx = Math.abs(toFile - fromFile);
            const dy = Math.abs(toRank - fromRank);
            
            if (dx === dy && dx !== 0) {
                isDiagonal = true;
            } else if ((dx === 0 && dy !== 0) || (dy === 0 && dx !== 0)) {
                isStraight = true;
            }
        }

        // 2. Wizard Theme Audio Rules
        if (themePieces === 'wizard') {
            // Rule A: Checkmate
            if (isCheckmate) {
                if (moveDetails.color === 'w') {
                    play('/sounds/wizard/expecto-patronum.mp3');
                } else {
                    play('/sounds/wizard/avada-kedavra.mp3');
                }
            } 
            // Captures
            else if (moveDetails.captured) {
                let hasQueenPower = false;
                
                if (capturedPiece) {
                    const baseType = capturedPiece.type ? capturedPiece.type.toLowerCase() : '';
                    const absorbedPowers = capturedPiece.powers || [];
                    const allPowers = [...absorbedPowers, baseType];
                    if (allPowers.includes('q') || (allPowers.includes('r') && allPowers.includes('b'))) {
                        hasQueenPower = true;
                    }
                } else if (moveDetails.captured.toLowerCase() === 'q') {
                    hasQueenPower = true;
                }

                // Rule B: Captured a Queen/Queen-powered piece
                if (hasQueenPower) {
                    play('/sounds/wizard/that-felt-good.mp3');
                } 
                // Rule C: Straight Capture
                else if (isStraight) {
                    play('/sounds/wizard/bloody-hell.mp3');
                } 
                // Rule D: Diagonal Capture
                else if (isDiagonal) {
                    play('/sounds/wizard/diagonally.mp3');
                } 
                // Rule E: Other Captures (e.g. Knight)
                else {
                    play('/sounds/wizard/capture.mp3');
                }
            } 
            // Rule F: Check
            else if (isCheck) {
                play('/sounds/wizard/check.mp3');
            } 
            // Rule G: Normal Move
            else {
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
