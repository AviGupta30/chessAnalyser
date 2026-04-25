class AbsorptionState {
  constructor() {
    // Maps square (e.g., 'e4') to an array of absorbed piece types (e.g., ['n', 'r'])
    this.capabilities = {};
  }

  // Clone state (useful for move validation / searching)
  clone() {
    const newState = new AbsorptionState();
    // Deep copy the capabilities
    for (const [square, caps] of Object.entries(this.capabilities)) {
      newState.capabilities[square] = [...caps];
    }
    return newState;
  }

  // Get the absorbed capabilities for a given square
  getCapabilities(square) {
    return this.capabilities[square] || [];
  }

  // When a piece moves from source to target, optionally capturing
  movePiece(source, target, capturedPieceType = null, capturedPieceCapabilities = []) {
    const movingCaps = this.getCapabilities(source);
    const newCaps = [...movingCaps];

    // If a piece was captured, absorb its capabilities (Kings cannot be absorbed)
    if (capturedPieceType && capturedPieceType !== 'k') {
      // Absorb the captured piece's base type
      if (!newCaps.includes(capturedPieceType)) {
        newCaps.push(capturedPieceType);
      }
      
      // Absorb any accumulated capabilities of the captured piece
      for (const cap of capturedPieceCapabilities) {
        if (!newCaps.includes(cap)) {
          newCaps.push(cap);
        }
      }
    }

    // Remove capabilities from the source square
    delete this.capabilities[source];
    
    // Assign new capabilities to the target square
    if (newCaps.length > 0) {
      this.capabilities[target] = newCaps;
    } else {
      delete this.capabilities[target];
    }
  }

  // Delete capabilities on a specific square
  clearCapabilities(square) {
    delete this.capabilities[square];
  }

  // Handle board resets
  reset() {
    this.capabilities = {};
  }
}

export default AbsorptionState;
