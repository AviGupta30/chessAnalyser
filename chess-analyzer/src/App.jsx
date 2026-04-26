import React, { useState, useMemo } from 'react';
import { fetchUserGames } from './services/chessApi';
import { useMultiplayer } from './hooks/useMultiplayer';
import MultiplayerLobby from './components/multiplayer/MultiplayerLobby';
import MultiplayerGame from './components/multiplayer/MultiplayerGame';
import AnalyzerGame from './components/analyzer/AnalyzerGame';

import wP_wiz from './assets/pieces/wizard/wP.png';
import wN_wiz from './assets/pieces/wizard/wN.png';
import wB_wiz from './assets/pieces/wizard/wB.png';
import wR_wiz from './assets/pieces/wizard/wR.png';
import wQ_wiz from './assets/pieces/wizard/wQ.png';
import wK_wiz from './assets/pieces/wizard/wK.png';
import bP_wiz from './assets/pieces/wizard/bP.png';
import bN_wiz from './assets/pieces/wizard/bN.png';
import bB_wiz from './assets/pieces/wizard/bB.png';
import bR_wiz from './assets/pieces/wizard/bR.png';
import bQ_wiz from './assets/pieces/wizard/bQ.png';
import bK_wiz from './assets/pieces/wizard/bK.png';

import bB_N_P_wiz from './assets/pieces/wizard/evolutions/bB_N_P.png';
import bB_N_wiz from './assets/pieces/wizard/evolutions/bB_N.png';
import bB_P_wiz from './assets/pieces/wizard/evolutions/bB_P.png';
import bN_P_wiz from './assets/pieces/wizard/evolutions/bN_P.png';
import bP_B_N_wiz from './assets/pieces/wizard/evolutions/bP_B_N.png';
import bP_B_wiz from './assets/pieces/wizard/evolutions/bP_B.png';
import bP_N_R_wiz from './assets/pieces/wizard/evolutions/bP_N_R.png';
import bP_N_wiz from './assets/pieces/wizard/evolutions/bP_N.png';
import bP_R_wiz from './assets/pieces/wizard/evolutions/bP_R.png';
import bQ_N_P_wiz from './assets/pieces/wizard/evolutions/bQ_N_P.png';
import bQ_N_wiz from './assets/pieces/wizard/evolutions/bQ_N.png';
import bQ_P_wiz from './assets/pieces/wizard/evolutions/bQ_P.png';
import bR_N_P_wiz from './assets/pieces/wizard/evolutions/bR_N_P.png';
import bR_N_wiz from './assets/pieces/wizard/evolutions/bR_N.png';
import bR_P_wiz from './assets/pieces/wizard/evolutions/bR_P.png';

import wB_N_P_wiz from './assets/pieces/wizard/evolutions/wB_N_P.png';
import wB_N_wiz from './assets/pieces/wizard/evolutions/wB_N.png';
import wB_P_wiz from './assets/pieces/wizard/evolutions/wB_P.png';
import wN_P_wiz from './assets/pieces/wizard/evolutions/wN_P.png';
import wP_B_N_wiz from './assets/pieces/wizard/evolutions/wP_B_N.png';
import wP_B_wiz from './assets/pieces/wizard/evolutions/wP_B.png';
import wP_N_R_wiz from './assets/pieces/wizard/evolutions/wP_N_R.png';
import wP_N_wiz from './assets/pieces/wizard/evolutions/wP_N.png';
import wP_R_wiz from './assets/pieces/wizard/evolutions/wP_R.png';
import wQ_N_P_wiz from './assets/pieces/wizard/evolutions/wQ_N_P.png';
import wQ_N_wiz from './assets/pieces/wizard/evolutions/wQ_N.png';
import wQ_P_wiz from './assets/pieces/wizard/evolutions/wQ_P.png';
import wR_N_P_wiz from './assets/pieces/wizard/evolutions/wR_N_P.png';
import wR_N_wiz from './assets/pieces/wizard/evolutions/wR_N.png';
import wR_P_wiz from './assets/pieces/wizard/evolutions/wR_P.png';

const THEMES = {
    classic: {
        name: 'Classic Standard',
        board: { light: '#ebecd0', dark: '#739552' },
        global: { bg: '#0b0f19', surface: '#1e293b', text: '#ffffff', accent: '#3b82f6', border: '#334155' },
        pieces: 'standard'
    },
    wizard: {
        name: 'Harry Potter (Wizard)',
        board: { light: '#a8a29e', dark: '#44403c' },
        global: { bg: '#1c1917', surface: '#292524', text: '#e7e5e4', accent: '#d97706', border: '#44403c' },
        pieces: 'wizard'
    }
};

const WIZARD_IMAGES = {
    wP: wP_wiz, wN: wN_wiz, wB: wB_wiz, wR: wR_wiz, wQ: wQ_wiz, wK: wK_wiz,
    bP: bP_wiz, bN: bN_wiz, bB: bB_wiz, bR: bR_wiz, bQ: bQ_wiz, bK: bK_wiz,
    
    // Explicit evolutions
    bB_N_P: bB_N_P_wiz, bB_N: bB_N_wiz, bB_P: bB_P_wiz, bN_P: bN_P_wiz, bP_B_N: bP_B_N_wiz, bP_B: bP_B_wiz, bP_N_R: bP_N_R_wiz, bP_N: bP_N_wiz, bP_R: bP_R_wiz, bQ_N_P: bQ_N_P_wiz, bQ_N: bQ_N_wiz, bQ_P: bQ_P_wiz, bR_N_P: bR_N_P_wiz, bR_N: bR_N_wiz, bR_P: bR_P_wiz,
    wB_N_P: wB_N_P_wiz, wB_N: wB_N_wiz, wB_P: wB_P_wiz, wN_P: wN_P_wiz, wP_B_N: wP_B_N_wiz, wP_B: wP_B_wiz, wP_N_R: wP_N_R_wiz, wP_N: wP_N_wiz, wP_R: wP_R_wiz, wQ_N_P: wQ_N_P_wiz, wQ_N: wQ_N_wiz, wQ_P: wQ_P_wiz, wR_N_P: wR_N_P_wiz, wR_N: wR_N_wiz, wR_P: wR_P_wiz
};

export default function App() {
    const [appMode, setAppMode] = useState('analyzer');
    const [gameMode, setGameMode] = useState('standard');
    const [currentThemeKey, setCurrentThemeKey] = useState('wizard');
    const activeTheme = THEMES[currentThemeKey];

    const [boardOrientation, setOrientation] = useState('white');
    const [username, setUsername] = useState('');
    const [fetchedGames, setFetchedGames] = useState([]);
    const [isFetching, setIsFetching] = useState(false);
    const [isMuted, setIsMuted] = useState(false);

    const { phase, myColor, gameCode, fen: mpFen, setFen: setMpFen, gameOverMessage, opponentConnected, error: mpError, isLoading: mpLoading, createGame, joinGame, sendMove, resign, leaveGame, lastMove } = useMultiplayer();

    const handleFetch = async (e) => {
        e.preventDefault();
        if (!username.trim()) return;
        setIsFetching(true);
        try {
            const games = await fetchUserGames(username.trim());
            setFetchedGames(games);
        } catch (err) { alert(err.message); } finally { setIsFetching(false); }
    };

    const wizardPieceComponents = useMemo(() => {
        const pieceDiv = (src) => () => (
            <div style={{ width: '100%', aspectRatio: '1 / 1', backgroundImage: `url(${src})`, backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center' }} />
        );
        return {
            wP: pieceDiv(WIZARD_IMAGES.wP), wN: pieceDiv(WIZARD_IMAGES.wN), wB: pieceDiv(WIZARD_IMAGES.wB),
            wR: pieceDiv(WIZARD_IMAGES.wR), wQ: pieceDiv(WIZARD_IMAGES.wQ), wK: pieceDiv(WIZARD_IMAGES.wK),
            bP: pieceDiv(WIZARD_IMAGES.bP), bN: pieceDiv(WIZARD_IMAGES.bN), bB: pieceDiv(WIZARD_IMAGES.bB),
            bR: pieceDiv(WIZARD_IMAGES.bR), bQ: pieceDiv(WIZARD_IMAGES.bQ), bK: pieceDiv(WIZARD_IMAGES.bK),
        };
    }, []);

    return (
        <div
            className="app-root"
            style={{ minHeight: '100vh', background: activeTheme.global.bg, color: activeTheme.global.text, fontFamily: 'system-ui, sans-serif', padding: '1rem', transition: 'background 0.3s ease, color 0.3s ease' }}
        >
            <header
                className="app-header"
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', paddingBottom: '1rem', borderBottom: `1px solid ${activeTheme.global.border}`, background: activeTheme.global.bg, flexWrap: 'wrap', gap: '0.75rem' }}
            >
                <div className="header-left" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <h2 className="header-title" style={{ margin: 0 }}>♞ Chess</h2>

                    <div style={{ display: 'flex', background: activeTheme.global.surface, border: `1px solid ${activeTheme.global.border}`, borderRadius: '8px', overflow: 'hidden' }}>
                        <button onClick={() => setAppMode('analyzer')} style={{ padding: '0.4rem 0.9rem', border: 'none', cursor: 'pointer', fontWeight: '700', fontSize: '0.8rem', background: appMode === 'analyzer' ? activeTheme.global.accent : 'transparent', color: appMode === 'analyzer' ? '#fff' : activeTheme.global.text }}>📊 Analyze</button>
                        <button onClick={() => setAppMode('multiplayer')} style={{ padding: '0.4rem 0.9rem', border: 'none', cursor: 'pointer', fontWeight: '700', fontSize: '0.8rem', background: appMode === 'multiplayer' ? activeTheme.global.accent : 'transparent', color: appMode === 'multiplayer' ? '#fff' : activeTheme.global.text }}>♟️ Play</button>
                    </div>

                    {appMode === 'analyzer' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: activeTheme.global.surface, padding: '0.4rem 0.75rem', borderRadius: '8px', border: `1px solid ${activeTheme.global.border}` }}>
                            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: activeTheme.global.text, opacity: 0.8, fontWeight: 'bold' }}>Mode:</span>
                            <select value={gameMode} onChange={(e) => setGameMode(e.target.value)} style={{ background: 'transparent', color: activeTheme.global.text, border: 'none', outline: 'none', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 'bold' }}>
                                <option value="standard" style={{ background: '#1e293b' }}>Standard</option>
                                <option value="absorption" style={{ background: '#1e293b' }}>Absorption</option>
                            </select>
                        </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: activeTheme.global.surface, padding: '0.4rem 0.75rem', borderRadius: '8px', border: `1px solid ${activeTheme.global.border}` }}>
                        <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: activeTheme.global.text, opacity: 0.8, fontWeight: 'bold' }}>Theme:</span>
                        <select value={currentThemeKey} onChange={(e) => setCurrentThemeKey(e.target.value)} style={{ background: 'transparent', color: activeTheme.global.text, border: 'none', outline: 'none', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 'bold' }}>
                            {Object.entries(THEMES).map(([key, theme]) => <option key={key} value={key} style={{ background: '#1e293b' }}>{theme.name}</option>)}
                        </select>
                    </div>

                    <button
                        onClick={() => setIsMuted(!isMuted)}
                        style={{ background: activeTheme.global.surface, border: `1px solid ${activeTheme.global.border}`, borderRadius: '8px', padding: '0.4rem 0.6rem', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1 }}
                        title={isMuted ? 'Unmute' : 'Mute'}
                    >
                        {isMuted ? '🔇' : '🔊'}
                    </button>
                </div>

                {appMode === 'analyzer' && (
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        <form onSubmit={handleFetch} style={{ display: 'flex', gap: '0.5rem' }}>
                            <input type="text" placeholder="Chess.com Username" value={username} onChange={e => setUsername(e.target.value)} style={{ padding: '0.4rem 0.6rem', borderRadius: '4px', background: activeTheme.global.surface, border: `1px solid ${activeTheme.global.border}`, color: activeTheme.global.text, fontSize: '0.9rem', minWidth: 0, width: '140px' }} />
                            <button type="submit" disabled={isFetching} style={{ padding: '0.4rem 0.75rem', background: activeTheme.global.accent, border: 'none', borderRadius: '4px', color: '#fff', cursor: 'pointer', fontSize: '0.9rem', whiteSpace: 'nowrap' }}>Fetch</button>
                        </form>
                        <button onClick={() => setOrientation(o => o === 'white' ? 'black' : 'white')} style={{ padding: '0.4rem 0.75rem', background: 'transparent', color: activeTheme.global.text, border: `1px solid ${activeTheme.global.border}`, borderRadius: '4px', cursor: 'pointer', fontSize: '0.9rem' }}>🔃 Flip</button>
                    </div>
                )}
            </header>

            {appMode === 'multiplayer' && phase === 'lobby' && <MultiplayerLobby onCreateGame={createGame} onJoinGame={joinGame} isLoading={mpLoading} error={mpError} theme={activeTheme} />}
            {appMode === 'multiplayer' && phase !== 'lobby' && <MultiplayerGame fen={mpFen} setFen={setMpFen} myColor={myColor} gameCode={gameCode} phase={phase} gameOverMessage={gameOverMessage} opponentConnected={opponentConnected} sendMove={sendMove} resign={resign} leaveGame={leaveGame} theme={activeTheme} wizardImages={activeTheme.pieces === 'wizard' ? WIZARD_IMAGES : null} isMuted={isMuted} lastMove={lastMove} />}

            {/* ── THE ISOLATED LOCAL GAME ENGINE ── */}
            {appMode === 'analyzer' && (
                <AnalyzerGame
                    key={gameMode}
                    activeTheme={activeTheme}
                    wizardPieceComponents={wizardPieceComponents}
                    wizardImages={activeTheme.pieces === 'wizard' ? WIZARD_IMAGES : null}
                    gameMode={gameMode}
                    fetchedGames={fetchedGames}
                    boardOrientation={boardOrientation}
                    isMuted={isMuted}
                />
            )}
        </div>
    );
}