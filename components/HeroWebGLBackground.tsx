import React from 'react';

interface HeroWebGLBackgroundProps {
    className?: string;
}

// Temporary fallback while WebGL background is deactivated for performance.
export const HeroWebGLBackground: React.FC<HeroWebGLBackgroundProps> = ({ className = '' }) => {
    return (
        <div className={`absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
            <div
                className="absolute inset-0"
                style={{
                    background:
                        'radial-gradient(circle at 15% 20%, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.38) 38%, rgba(255,255,255,0.14) 62%, rgba(255,255,255,0) 78%), linear-gradient(145deg, rgba(214,232,255,0.55) 0%, rgba(233,245,255,0.62) 35%, rgba(220,245,236,0.45) 100%)',
                }}
            />
            <div
                className="absolute inset-0"
                style={{
                    background:
                        'radial-gradient(circle at 86% 18%, rgba(143,191,255,0.24) 0%, rgba(143,191,255,0) 42%), radial-gradient(circle at 12% 86%, rgba(150,224,195,0.16) 0%, rgba(150,224,195,0) 48%)',
                }}
            />
        </div>
    );
};
