'use client';

import {
    useEffect,
    useRef,
    useState,
    ReactNode,
    TouchEvent,
    WheelEvent,
} from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';

interface ScrollExpandMediaProps {
    mediaType?: 'video' | 'image';
    mediaSrc: string;
    posterSrc?: string;
    bgImageSrc: string;
    title?: string;
    date?: string;
    scrollToExpand?: string;
    textBlend?: boolean;
    children?: ReactNode;
}

const ScrollExpandMedia = ({
    mediaType = 'video',
    mediaSrc,
    posterSrc,
    bgImageSrc,
    title,
    date,
    scrollToExpand,
    textBlend,
    children,
}: ScrollExpandMediaProps) => {
    const [scrollProgress, setScrollProgress] = useState<number>(0);
    const [showContent, setShowContent] = useState<boolean>(false);
    const [mediaFullyExpanded, setMediaFullyExpanded] = useState<boolean>(false);
    const [touchStartY, setTouchStartY] = useState<number>(0);
    const [isMobileState, setIsMobileState] = useState<boolean>(false);

    const sectionRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        setScrollProgress(0);
        setShowContent(false);
        setMediaFullyExpanded(false);
    }, [mediaType]);

    useEffect(() => {
        const handleWheel = (e: WheelEvent) => {
            if (mediaFullyExpanded && e.deltaY < 0 && window.scrollY <= 5) {
                setMediaFullyExpanded(false);
                e.preventDefault();
            } else if (!mediaFullyExpanded) {
                e.preventDefault();
                const scrollDelta = e.deltaY * 0.0009;
                const newProgress = Math.min(
                    Math.max(scrollProgress + scrollDelta, 0),
                    1
                );
                setScrollProgress(newProgress);

                if (newProgress >= 1) {
                    setMediaFullyExpanded(true);
                    setShowContent(true);
                } else if (newProgress < 0.75) {
                    setShowContent(false);
                }
            }
        };

        const handleTouchStart = (e: TouchEvent) => {
            setTouchStartY(e.touches[0].clientY);
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (!touchStartY) return;

            const touchY = e.touches[0].clientY;
            const deltaY = touchStartY - touchY;

            if (mediaFullyExpanded && deltaY < -20 && window.scrollY <= 5) {
                setMediaFullyExpanded(false);
                e.preventDefault();
            } else if (!mediaFullyExpanded) {
                e.preventDefault();
                const scrollFactor = deltaY < 0 ? 0.008 : 0.005;
                const scrollDelta = deltaY * scrollFactor;
                const newProgress = Math.min(
                    Math.max(scrollProgress + scrollDelta, 0),
                    1
                );
                setScrollProgress(newProgress);

                if (newProgress >= 1) {
                    setMediaFullyExpanded(true);
                    setShowContent(true);
                } else if (newProgress < 0.75) {
                    setShowContent(false);
                }

                setTouchStartY(touchY);
            }
        };

        const handleTouchEnd = (): void => {
            setTouchStartY(0);
        };

        const handleScroll = (): void => {
            if (!mediaFullyExpanded) {
                window.scrollTo(0, 0);
            }
        };

        window.addEventListener('wheel', handleWheel as unknown as EventListener, {
            passive: false,
        });
        window.addEventListener('scroll', handleScroll as EventListener);
        window.addEventListener(
            'touchstart',
            handleTouchStart as unknown as EventListener,
            { passive: false }
        );
        window.addEventListener(
            'touchmove',
            handleTouchMove as unknown as EventListener,
            { passive: false }
        );
        window.addEventListener('touchend', handleTouchEnd as EventListener);

        return () => {
            window.removeEventListener(
                'wheel',
                handleWheel as unknown as EventListener
            );
            window.removeEventListener('scroll', handleScroll as EventListener);
            window.removeEventListener(
                'touchstart',
                handleTouchStart as unknown as EventListener
            );
            window.removeEventListener(
                'touchmove',
                handleTouchMove as unknown as EventListener
            );
            window.removeEventListener('touchend', handleTouchEnd as EventListener);
        };
    }, [scrollProgress, mediaFullyExpanded, touchStartY]);

    useEffect(() => {
        const checkIfMobile = (): void => {
            setIsMobileState(window.innerWidth < 768);
        };

        checkIfMobile();
        window.addEventListener('resize', checkIfMobile);

        return () => window.removeEventListener('resize', checkIfMobile);
    }, []);

    const textTranslateX = scrollProgress * (isMobileState ? 180 : 150);

    const firstWord = title ? title.split(' ')[0] : '';
    const restOfTitle = title ? title.split(' ').slice(1).join(' ') : '';

    return (
        <div
            ref={sectionRef}
            className='transition-colors duration-700 ease-in-out overflow-x-hidden'
        >
            <section className='relative flex flex-col items-center justify-start min-h-[100dvh]'>
                <div className='relative w-full flex flex-col items-center min-h-[100dvh]'>
                    <motion.div
                        className='absolute inset-0 z-0 h-full'
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 - scrollProgress }}
                        transition={{ duration: 0.1 }}
                    >
                        <Image
                            src={bgImageSrc}
                            alt='Background'
                            width={1920}
                            height={1080}
                            className='w-screen h-screen'
                            style={{
                                objectFit: 'cover',
                                objectPosition: 'center',
                            }}
                            priority
                        />
                        <div className='absolute inset-0 bg-black/10' />

                        {/* Tech Scanlines Effect */}
                        <motion.div
                            className='absolute inset-0 pointer-events-none'
                            style={{
                                backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(34, 197, 94, 0.03) 2px, rgba(34, 197, 94, 0.03) 4px)',
                                opacity: scrollProgress * 0.5,
                            }}
                        />

                        {/* Animated Grid Overlay */}
                        <motion.div
                            className='absolute inset-0 pointer-events-none'
                            style={{
                                backgroundImage: `
                                    linear-gradient(to right, rgba(34, 197, 94, 0.05) 1px, transparent 1px),
                                    linear-gradient(to bottom, rgba(34, 197, 94, 0.05) 1px, transparent 1px)
                                `,
                                backgroundSize: '50px 50px',
                                opacity: scrollProgress * 0.6,
                            }}
                        />

                        {/* Radial Glow Effect */}
                        <motion.div
                            className='absolute inset-0 pointer-events-none'
                            style={{
                                background: `radial-gradient(circle at 50% 50%, rgba(34, 197, 94, ${scrollProgress * 0.15}) 0%, transparent 70%)`,
                            }}
                        />

                        {/* Particle Lines */}
                        {[...Array(8)].map((_, i) => (
                            <motion.div
                                key={i}
                                className='absolute h-px bg-gradient-to-r from-transparent via-green-400 to-transparent'
                                style={{
                                    top: `${10 + i * 12}%`,
                                    left: 0,
                                    right: 0,
                                    opacity: scrollProgress * 0.3,
                                }}
                                animate={{
                                    scaleX: [0, 1, 0],
                                    x: ['-100%', '0%', '100%'],
                                }}
                                transition={{
                                    duration: 3 + i * 0.5,
                                    repeat: Infinity,
                                    delay: i * 0.3,
                                    ease: 'linear',
                                }}
                            />
                        ))}
                    </motion.div>

                    <div className='container mx-auto flex flex-col items-center justify-start relative z-10'>
                        <div className='flex flex-col items-center justify-center w-full h-[100dvh] relative gap-12'>
                            {/* 3D Cube - Static, no rotation */}
                            <div
                                className='relative z-20'
                                style={{
                                    width: `${200 + scrollProgress * 100}px`,
                                    height: `${200 + scrollProgress * 100}px`,
                                    opacity: 1 - scrollProgress * 0.8,
                                }}
                            >
                                <div className='relative w-full h-full'>
                                    <Image
                                        src='/assets/cube.png'
                                        alt='3D Cube'
                                        width={300}
                                        height={300}
                                        className='w-full h-full object-contain drop-shadow-[0_0_30px_rgba(34,197,94,0.6)]'
                                        style={{
                                            filter: `brightness(${1 + scrollProgress * 0.3})`,
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Scroll prompt and logo - Below the cube */}
                            <div className='relative z-30 flex flex-col items-center gap-6'>
                                {scrollToExpand && (
                                    <motion.p
                                        className='text-sm md:text-base font-light tracking-[0.3em] text-white uppercase'
                                        animate={{
                                            opacity: [0.5, 1, 0.5],
                                        }}
                                        transition={{
                                            duration: 2,
                                            repeat: Infinity,
                                            ease: 'easeInOut',
                                        }}
                                    >
                                        {scrollToExpand}
                                    </motion.p>
                                )}

                                {/* Next Systems Logo */}
                                <motion.div
                                    animate={{
                                        opacity: [0.6, 0.9, 0.6],
                                    }}
                                    transition={{
                                        duration: 3,
                                        repeat: Infinity,
                                        ease: 'easeInOut',
                                    }}
                                >
                                    <Image
                                        src='/assets/logo-next.png'
                                        alt='Next Systems'
                                        width={120}
                                        height={40}
                                        className='object-contain opacity-80'
                                    />
                                </motion.div>
                            </div>
                        </div>

                        <div
                            className={`flex items-center justify-center text-center gap-4 w-full relative z-10 transition-none flex-col ${textBlend ? 'mix-blend-difference' : 'mix-blend-normal'
                                }`}
                        >
                            <motion.h2
                                className='text-4xl md:text-5xl lg:text-6xl font-bold text-green-400 transition-none'
                                style={{ transform: `translateX(-${textTranslateX}vw)` }}
                            >
                                {firstWord}
                            </motion.h2>
                            <motion.h2
                                className='text-4xl md:text-5xl lg:text-6xl font-bold text-center text-green-400 transition-none'
                                style={{ transform: `translateX(${textTranslateX}vw)` }}
                            >
                                {restOfTitle}
                            </motion.h2>
                        </div>

                        <motion.section
                            className='flex flex-col w-full px-8 py-10 md:px-16 lg:py-20'
                            initial={{ opacity: 0 }}
                            animate={{ opacity: showContent ? 1 : 0 }}
                            transition={{ duration: 0.7 }}
                        >
                            {children}
                        </motion.section>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default ScrollExpandMedia;
