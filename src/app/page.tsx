'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';

export default function IgamingHome() {
    const [isLoading, setIsLoading] = useState(true);
    const [gameStarted, setGameStarted] = useState(false);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const musicStartedRef = useRef(false);

    useEffect(() => {
        const timer = setTimeout(() => setIsLoading(false), 1500);
        return () => clearTimeout(timer);
    }, []);

    const startMusic = () => {
        if (musicStartedRef.current) return;

        if (!audioCtxRef.current) {
            audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }

        const ctx = audioCtxRef.current;
        if (ctx.state === 'suspended') ctx.resume();

        musicStartedRef.current = true;

        const playLoop = () => {
            if (!musicStartedRef.current) return;
            const now = ctx.currentTime;

            // Kick
            const kick = ctx.createOscillator();
            const kGain = ctx.createGain();
            kick.frequency.setValueAtTime(180, now);
            kick.frequency.exponentialRampToValueAtTime(45, now + 0.15);
            kGain.gain.setValueAtTime(0.4, now);
            kGain.gain.linearRampToValueAtTime(0, now + 0.25);
            kick.connect(kGain);
            kGain.connect(ctx.destination);
            kick.start(); kick.stop(now + 0.25);

            // Hi-Hat
            if (Math.random() > 0.3) {
                const hGain = ctx.createGain();
                const hOsc = ctx.createOscillator();
                hOsc.type = 'square';
                hOsc.frequency.setValueAtTime(8000, now + 0.25);
                hGain.gain.setValueAtTime(0.02, now + 0.25);
                hGain.gain.linearRampToValueAtTime(0, now + 0.3);
                hOsc.connect(hGain);
                hGain.connect(ctx.destination);
                hOsc.start(now + 0.25); hOsc.stop(now + 0.3);
            }

            // Synth Pulse
            const synth = ctx.createOscillator();
            const sGain = ctx.createGain();
            synth.type = 'triangle';
            const notes = [110, 138, 164, 220];
            synth.frequency.value = notes[Math.floor(now % 4)];
            sGain.gain.setValueAtTime(0.08, now);
            sGain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
            synth.connect(sGain);
            sGain.connect(ctx.destination);
            synth.start(); synth.stop(now + 0.4);

            setTimeout(playLoop, 500);
        };
        playLoop();
    };

    const handlePlay = () => {
        startMusic();
        setGameStarted(true);
        // Sync with the login.html flow
        setTimeout(() => {
            window.location.href = '/login.html';
        }, 1500);
    };

    const handleGlobalClick = () => {
        startMusic();
    };

    return (
        <main
            onClick={handleGlobalClick}
            className="relative min-h-screen w-full overflow-hidden bg-black font-sans selection:bg-orange-500/30"
        >
            {/* Background Image */}
            <div className="absolute inset-0 z-0">
                <Image
                    src="https://images.unsplash.com/photo-1546519638-68e109498ffc?q=80&w=2090&auto=format&fit=crop"
                    alt="Cyber Basketball Court"
                    fill
                    className="object-cover object-center opacity-80"
                    priority
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/60" />
                <div className="absolute inset-0 bg-orange-900/10 mix-blend-overlay" />
            </div>

            {/* Grid Overlay */}
            <div className="absolute inset-0 z-0 pointer-events-none opacity-20"
                style={{
                    backgroundImage: 'linear-gradient(rgba(255, 107, 0, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 107, 0, 0.1) 1px, transparent 1px)',
                    backgroundSize: '40px 40px'
                }}
            />

            <AnimatePresence>
                {!gameStarted ? (
                    <motion.div
                        className="relative z-10 flex flex-col items-center justify-center min-h-screen p-4"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0, scale: 1.5, filter: 'blur(10px)' }}
                        transition={{ duration: 0.8 }}
                    >
                        <motion.div
                            animate={{
                                y: [0, -20, 0],
                                rotate: [0, 360],
                            }}
                            transition={{
                                y: { duration: 4, repeat: Infinity, ease: "easeInOut" },
                                rotate: { duration: 20, repeat: Infinity, ease: "linear" }
                            }}
                            className="relative w-48 h-48 md:w-64 md:h-64 mb-8"
                        >
                            <img
                                src="assets/basketball_new.png"
                                alt="Golden Basketball"
                                className="w-full h-full object-contain filter drop-shadow-[0_0_50px_rgba(255,165,0,0.6)]"
                            />
                        </motion.div>

                        <motion.h1
                            initial={{ y: 50, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.2 }}
                            className="text-6xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-500 mb-2 tracking-tighter uppercase drop-shadow-[0_0_15px_rgba(255,255,255,0.3)] text-center"
                        >
                            Basket<span className="text-orange-500">Bet</span>
                        </motion.h1>

                        <motion.p
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.4 }}
                            className="text-orange-200/60 text-sm md:text-base mb-12 font-bold tracking-[0.3em] text-center"
                        >
                            ARENA CIBERNÉTICA DE ALTA VOLTAGEM
                        </motion.p>

                        <motion.button
                            onClick={(e) => { e.stopPropagation(); handlePlay(); }}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.6 }}
                            className="px-12 py-5 bg-orange-600 text-white font-black text-xl rounded-2xl shadow-[0_0_30px_rgba(255,107,0,0.4)] hover:shadow-[0_0_50px_rgba(255,107,0,0.6)] transition-all uppercase tracking-widest border-b-4 border-orange-800"
                        >
                            ENTRAR NA ARENA
                        </motion.button>
                    </motion.div>
                ) : (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="relative z-10 flex flex-col items-center justify-center min-h-screen text-white"
                    >
                        <h2 className="text-4xl font-black mb-4 text-orange-500 italic">CONECTANDO...</h2>
                        <div className="w-64 h-2 bg-gray-900 rounded-full overflow-hidden border border-white/10">
                            <motion.div
                                className="h-full bg-gradient-to-r from-orange-400 to-orange-600"
                                initial={{ width: "0%" }}
                                animate={{ width: "100%" }}
                                transition={{ duration: 1.5 }}
                            />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="absolute bottom-0 w-full p-6 z-20 flex justify-center">
                <div className="text-[10px] text-gray-500 font-mono tracking-widest uppercase opacity-50">
                    Next Systems iGaming Division © 2026
                </div>
            </div>
        </main>
    );
}
