import React, { useState } from 'react';
import { isSupabaseConfigured } from '../../lib/supabase';

const glassCard = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '16px',
    backdropFilter: 'blur(12px)',
    padding: '2rem',
};

const btnBase = {
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    fontWeight: '700',
    fontSize: '1rem',
    transition: 'all 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    justifyContent: 'center',
};

const COLOR_OPTIONS = [
    { value: 'white', label: 'White', icon: '♔', desc: 'Move first' },
    { value: 'black', label: 'Black', icon: '♚', desc: 'Move second' },
    { value: 'random', label: 'Random', icon: '🎲', desc: 'Surprise me!' },
];

export default function MultiplayerLobby({ onCreateGame, onJoinGame, isLoading, error, theme }) {
    const [view, setView] = useState('menu');         // menu | create | join
    const [selectedColor, setSelectedColor] = useState('random');
    const [selectedVariant, setSelectedVariant] = useState('standard');
    const [joinCode, setJoinCode] = useState('');

    const bg = theme?.global?.bg || '#0b0f19';
    const surface = theme?.global?.surface || '#1e293b';
    const accent = theme?.global?.accent || '#3b82f6';
    const text = theme?.global?.text || '#ffffff';
    const border = theme?.global?.border || '#334155';

    if (!isSupabaseConfigured) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
                <div style={{ ...glassCard, maxWidth: '520px', textAlign: 'center', border: '1px solid #f97316' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚙️</div>
                    <h2 style={{ color: '#f97316', margin: '0 0 1rem' }}>Setup Required</h2>
                    <p style={{ color: text, opacity: 0.8, lineHeight: 1.7 }}>
                        Multiplayer requires a free Supabase project. Fill in your credentials in <code style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px' }}>.env</code>:
                    </p>
                    <div style={{ background: 'rgba(0,0,0,0.4)', borderRadius: '8px', padding: '1rem', textAlign: 'left', marginTop: '1rem', fontFamily: 'monospace', fontSize: '0.85rem', color: '#4ade80' }}>
                        <div>VITE_SUPABASE_URL=https://xxx.supabase.co</div>
                        <div>VITE_SUPABASE_ANON_KEY=your_anon_key</div>
                    </div>
                    <p style={{ color: text, opacity: 0.6, fontSize: '0.85rem', marginTop: '1rem' }}>
                        Create a free project at <strong>supabase.com</strong> → Settings → API
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '70vh', padding: '2rem' }}>
            <div style={{ width: '100%', maxWidth: '480px' }}>

                {/* ── MAIN MENU ── */}
                {view === 'menu' && (
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '4rem', marginBottom: '0.5rem', filter: 'drop-shadow(0 0 20px rgba(59,130,246,0.5))' }}>♟️</div>
                        <h1 style={{ color: text, fontSize: '2rem', fontWeight: '800', margin: '0 0 0.5rem' }}>Play vs Friend</h1>
                        <p style={{ color: text, opacity: 0.55, marginBottom: '2.5rem', fontSize: '1rem' }}>
                            Create a private game or join one with a code
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <button
                                id="btn-create-game"
                                onClick={() => setView('create')}
                                style={{ ...btnBase, padding: '1.1rem 2rem', background: `linear-gradient(135deg, ${accent}, #6366f1)`, color: '#fff', boxShadow: `0 4px 24px ${accent}44`, fontSize: '1.1rem' }}
                                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                                onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                            >
                                <span style={{ fontSize: '1.3rem' }}>✦</span>
                                Create a Game
                            </button>

                            <button
                                id="btn-join-game"
                                onClick={() => setView('join')}
                                style={{ ...btnBase, padding: '1.1rem 2rem', background: 'rgba(255,255,255,0.07)', color: text, border: `1px solid ${border}`, fontSize: '1.1rem' }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                            >
                                <span style={{ fontSize: '1.3rem' }}>🔑</span>
                                Join a Game
                            </button>
                        </div>
                    </div>
                )}

                {/* ── CREATE GAME ── */}
                {view === 'create' && (
                    <div style={{ ...glassCard }}>
                        <button onClick={() => setView('menu')} style={{ ...btnBase, background: 'transparent', color: text, opacity: 0.6, padding: '0.25rem 0', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                            ← Back
                        </button>
                        <h2 style={{ color: text, margin: '0 0 0.25rem', fontSize: '1.5rem', fontWeight: '800' }}>Create Game</h2>
                        <p style={{ color: text, opacity: 0.55, marginBottom: '2rem', fontSize: '0.9rem' }}>Choose your color, then share the code</p>

                        {/* Color Picker */}
                        <div style={{ marginBottom: '2rem' }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: '700', color: text, opacity: 0.5, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.75rem' }}>
                                Play as
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                                {COLOR_OPTIONS.map(opt => (
                                    <button
                                        key={opt.value}
                                        id={`color-${opt.value}`}
                                        onClick={() => setSelectedColor(opt.value)}
                                        style={{
                                            ...btnBase,
                                            flexDirection: 'column',
                                            padding: '1rem 0.5rem',
                                            background: selectedColor === opt.value
                                                ? `linear-gradient(135deg, ${accent}33, ${accent}11)`
                                                : 'rgba(255,255,255,0.04)',
                                            border: `2px solid ${selectedColor === opt.value ? accent : border}`,
                                            color: text,
                                            gap: '0.25rem',
                                        }}
                                    >
                                        <span style={{ fontSize: '1.8rem' }}>{opt.icon}</span>
                                        <span style={{ fontSize: '0.85rem', fontWeight: '700' }}>{opt.label}</span>
                                        <span style={{ fontSize: '0.7rem', opacity: 0.55, fontWeight: '400' }}>{opt.desc}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Variant Picker */}
                        <div style={{ marginBottom: '2rem' }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: '700', color: text, opacity: 0.5, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.75rem' }}>
                                Game Variant
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
                                <button
                                    onClick={() => setSelectedVariant('standard')}
                                    style={{
                                        ...btnBase,
                                        padding: '0.75rem',
                                        background: selectedVariant === 'standard' ? `linear-gradient(135deg, ${accent}33, ${accent}11)` : 'rgba(255,255,255,0.04)',
                                        border: `2px solid ${selectedVariant === 'standard' ? accent : border}`,
                                        color: text,
                                    }}
                                >
                                    Standard
                                </button>
                                <button
                                    onClick={() => setSelectedVariant('absorption')}
                                    style={{
                                        ...btnBase,
                                        padding: '0.75rem',
                                        background: selectedVariant === 'absorption' ? `linear-gradient(135deg, ${accent}33, ${accent}11)` : 'rgba(255,255,255,0.04)',
                                        border: `2px solid ${selectedVariant === 'absorption' ? accent : border}`,
                                        color: text,
                                    }}
                                >
                                    Absorption
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div style={{ background: '#ef444422', border: '1px solid #ef4444', borderRadius: '8px', padding: '0.75rem 1rem', color: '#fca5a5', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                                {error}
                            </div>
                        )}

                        <button
                            id="btn-confirm-create"
                            onClick={() => onCreateGame(selectedColor, selectedVariant)}
                            disabled={isLoading}
                            style={{ ...btnBase, width: '100%', padding: '1rem', background: `linear-gradient(135deg, ${accent}, #6366f1)`, color: '#fff', boxShadow: `0 4px 24px ${accent}44`, opacity: isLoading ? 0.6 : 1 }}
                        >
                            {isLoading ? '⏳ Creating...' : '✦ Create Game'}
                        </button>
                    </div>
                )}

                {/* ── JOIN GAME ── */}
                {view === 'join' && (
                    <div style={{ ...glassCard }}>
                        <button onClick={() => setView('menu')} style={{ ...btnBase, background: 'transparent', color: text, opacity: 0.6, padding: '0.25rem 0', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                            ← Back
                        </button>
                        <h2 style={{ color: text, margin: '0 0 0.25rem', fontSize: '1.5rem', fontWeight: '800' }}>Join Game</h2>
                        <p style={{ color: text, opacity: 0.55, marginBottom: '2rem', fontSize: '0.9rem' }}>Enter the 6-character code your friend shared</p>

                        <input
                            id="input-join-code"
                            type="text"
                            value={joinCode}
                            onChange={e => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
                            onKeyDown={e => e.key === 'Enter' && joinCode.length === 6 && onJoinGame(joinCode)}
                            placeholder="e.g. XK92PL"
                            maxLength={6}
                            style={{
                                width: '100%',
                                padding: '1rem',
                                fontSize: '1.8rem',
                                fontWeight: '800',
                                letterSpacing: '0.5rem',
                                textAlign: 'center',
                                textTransform: 'uppercase',
                                background: 'rgba(0,0,0,0.3)',
                                border: `2px solid ${joinCode.length === 6 ? accent : border}`,
                                borderRadius: '10px',
                                color: text,
                                outline: 'none',
                                marginBottom: '1.5rem',
                                boxSizing: 'border-box',
                                transition: 'border-color 0.2s',
                                fontFamily: 'monospace',
                            }}
                        />

                        {error && (
                            <div style={{ background: '#ef444422', border: '1px solid #ef4444', borderRadius: '8px', padding: '0.75rem 1rem', color: '#fca5a5', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                                {error}
                            </div>
                        )}

                        <button
                            id="btn-confirm-join"
                            onClick={() => onJoinGame(joinCode)}
                            disabled={isLoading || joinCode.length < 6}
                            style={{ ...btnBase, width: '100%', padding: '1rem', background: joinCode.length === 6 ? `linear-gradient(135deg, ${accent}, #6366f1)` : 'rgba(255,255,255,0.07)', color: '#fff', opacity: (isLoading || joinCode.length < 6) ? 0.5 : 1, boxShadow: joinCode.length === 6 ? `0 4px 24px ${accent}44` : 'none' }}
                        >
                            {isLoading ? '⏳ Joining...' : '🔑 Join Game'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
