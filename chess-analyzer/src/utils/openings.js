/**
 * A lightweight Opening Book mapping standard move sequences to their names 
 * and the expected theoretical responses.
 */
export const openingBook = {
    "e4": { name: "King's Pawn Opening", next: ["e5", "c5", "e6", "c6", "Nf6", "g6"] },
    "e4 e5": { name: "Open Game", next: ["Nf3", "Nc3", "f4", "Bc4"] },
    "e4 c5": { name: "Sicilian Defense", next: ["Nf3", "Nc3", "c3"] },
    "e4 e6": { name: "French Defense", next: ["d4"] },
    "e4 c6": { name: "Caro-Kann Defense", next: ["d4"] },
    "e4 e5 Nf3": { name: "King's Knight Opening", next: ["Nc6", "Nf6", "d6"] },
    "e4 e5 Nf3 Nc6": { name: "King's Knight Game", next: ["Bb5", "Bc4", "d4"] },
    "e4 e5 Nf3 Nc6 Bb5": { name: "Ruy Lopez", next: ["a6", "Nf6", "Bc5"] },
    "e4 e5 Nf3 Nc6 Bc4": { name: "Italian Game", next: ["Bc5", "Nf6"] },
    "e4 c5 Nf3": { name: "Sicilian Defense: Open", next: ["d6", "Nc6", "e6"] },
    "e4 c5 Nf3 d6": { name: "Sicilian Defense: Open", next: ["d4"] },
    "e4 c5 Nf3 d6 d4": { name: "Sicilian Defense: Open", next: ["cxd4"] },
    "e4 c5 Nf3 d6 d4 cxd4": { name: "Sicilian Defense: Open", next: ["Nxd4"] },
    "d4": { name: "Queen's Pawn Opening", next: ["d5", "Nf6", "f5"] },
    "d4 d5": { name: "Closed Game", next: ["c4", "Bf4", "Nf3"] },
    "d4 d5 c4": { name: "Queen's Gambit", next: ["e6", "c6", "dxc4"] },
    "d4 d5 c4 e6": { name: "Queen's Gambit Declined", next: ["Nc3", "Nf3"] },
    "d4 d5 c4 c6": { name: "Slav Defense", next: ["Nf3", "Nc3"] },
    "d4 Nf6": { name: "Indian Defense", next: ["c4", "Nf3"] },
    "d4 Nf6 c4": { name: "Indian Defense", next: ["e6", "g6"] },
    "d4 Nf6 c4 g6": { name: "King's Indian / Grünfeld", next: ["Nc3"] },
    "Nf3": { name: "Réti Opening", next: ["d5", "Nf6", "c5"] },
    "c4": { name: "English Opening", next: ["e5", "c5", "Nf6"] }
};