import createGlobe from "cobe";
import { useEffect, useRef } from "react";
import { motion } from "framer-motion";

export const SaaSGlobe: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let phi = 0;
    
    if (!canvasRef.current) return;

    // Using exact RGB decimals for visual consistency with Slate/Tailwind colors
    const globe = createGlobe(canvasRef.current, {
      devicePixelRatio: 2,
      width: 1200,
      height: 1200,
      phi: 0,
      theta: 0.2, // slightly tilt to show northern hemisphere gracefully
      dark: 0, 
      diffuse: 1.2,
      mapSamples: 24000, // Very dense dots
      mapBrightness: 3, // Very bright
      baseColor: [0.95, 0.95, 0.95], // Off-white/Slate-50
      markerColor: [0.1, 0.1, 0.1], // Very dark markers
      glowColor: [1, 1, 1], // Pure white glow
      markers: [
        { location: [35.6895, 139.6917], size: 0.1 }, // Tokyo
        { location: [48.8566, 2.3522], size: 0.1 }, // Paris
        { location: [40.7128, -74.0060], size: 0.1 }, // NYC
        { location: [-33.8688, 151.2093], size: 0.1 }, // Sydney
        { location: [51.5072, -0.1276], size: 0.1 }, // London
      ],
      onRender: (state) => {
        state.phi = phi;
        phi += 0.003;
      },
    });

    return () => {
      globe.destroy();
    };
  }, []);

  return (
    <motion.div 
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 1.5, ease: "easeOut" }}
        className="absolute inset-0 overflow-hidden flex items-center justify-end opacity-60 pointer-events-none z-0 mix-blend-multiply" 
    >
      <div className="relative w-[1100px] h-[1100px] translate-x-[25%] lg:translate-x-[15%]">
        {/* Soft radial fade to blend edges */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_40%,white_70%)] z-10" />
        <div className="absolute inset-0 bg-gradient-to-l from-white via-transparent to-transparent z-10" />
        <canvas
            ref={canvasRef}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </div>
    </motion.div>
  );
};
