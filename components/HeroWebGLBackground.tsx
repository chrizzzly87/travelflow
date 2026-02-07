import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface HeroWebGLBackgroundProps {
    className?: string;
}

const vertexShader = `
    varying vec2 vUv;

    void main() {
        vUv = uv;
        gl_Position = vec4(position, 1.0);
    }
`;

const fragmentShader = `
    varying vec2 vUv;

    uniform vec2 uResolution;
    uniform float uTime;

    float hash(vec2 p) {
        p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
        return -1.0 + 2.0 * fract(sin(p.x + p.y) * 43758.5453123);
    }

    float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);

        return mix(
            mix(dot(hash(i + vec2(0.0, 0.0)), f - vec2(0.0, 0.0)), dot(hash(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
            mix(dot(hash(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)), dot(hash(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x),
            u.y
        ) * 0.5 + 0.5;
    }

    float fbm(vec2 p) {
        float value = 0.0;
        float amplitude = 0.52;
        for (int i = 0; i < 6; i++) {
            value += amplitude * noise(p);
            p *= 2.0;
            amplitude *= 0.5;
        }
        return value;
    }

    void main() {
        vec2 uv = (vUv - 0.5) * vec2(uResolution.x / uResolution.y, 1.0);
        float t = uTime * 0.42;

        float waveField = sin(uv.x * 4.0 + t) + sin(uv.y * 5.2 - t * 0.8) + sin((uv.x + uv.y) * 2.9 + t * 0.55);
        float n = fbm(uv * 2.2 + vec2(t * 0.24, -t * 0.21));
        float blend = smoothstep(-1.0, 1.8, waveField * 0.32 + n * 1.3);

        vec3 baseA = vec3(0.90, 0.95, 0.99);
        vec3 baseB = vec3(0.66, 0.82, 0.98);
        vec3 baseC = vec3(0.67, 0.92, 0.83);
        vec3 color = mix(baseA, baseB, blend);
        color = mix(color, baseC, smoothstep(0.4, 0.95, n));

        vec2 orb1Pos = vec2(sin(t * 0.45) * 0.33, cos(t * 0.37) * 0.25 - 0.12);
        vec2 orb2Pos = vec2(cos(t * 0.34) * 0.29 - 0.25, sin(t * 0.5) * 0.2 + 0.12);
        float orb1 = smoothstep(0.52, 0.0, length(uv - orb1Pos));
        float orb2 = smoothstep(0.45, 0.0, length(uv - orb2Pos));
        color += orb1 * vec3(0.15, 0.10, 0.14);
        color += orb2 * vec3(0.05, 0.10, 0.16);

        float vignette = smoothstep(1.08, 0.2, length(uv));
        color *= vignette + 0.14;

        float grain = fract(sin(dot(gl_FragCoord.xy + uTime * 40.0, vec2(12.9898, 78.233))) * 43758.5453123);
        color += (grain - 0.5) * 0.02;

        gl_FragColor = vec4(color, 0.96);
    }
`;

export const HeroWebGLBackground: React.FC<HeroWebGLBackgroundProps> = ({ className = '' }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const parent = canvas.parentElement;
        if (!parent) return;

        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        let renderer: THREE.WebGLRenderer | null = null;
        try {
            renderer = new THREE.WebGLRenderer({
                canvas,
                alpha: true,
                antialias: true,
                powerPreference: 'high-performance'
            });
        } catch {
            return;
        }

        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        const uniforms = {
            uTime: { value: 0 },
            uResolution: { value: new THREE.Vector2(1, 1) }
        };

        const geometry = new THREE.PlaneGeometry(2, 2);
        const material = new THREE.ShaderMaterial({
            uniforms,
            vertexShader,
            fragmentShader,
            transparent: true
        });

        const mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);

        const resize = () => {
            if (!renderer) return;
            const width = parent.clientWidth || window.innerWidth;
            const height = parent.clientHeight || window.innerHeight;
            renderer.setSize(width, height, false);
            uniforms.uResolution.value.set(width, height);
        };

        resize();
        const resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(parent);

        const clock = new THREE.Clock();
        let rafId: number | null = null;

        const animate = () => {
            if (!renderer) return;
            uniforms.uTime.value = clock.getElapsedTime();
            renderer.render(scene, camera);
            rafId = window.requestAnimationFrame(animate);
        };

        if (prefersReducedMotion) {
            uniforms.uTime.value = 9;
            renderer.render(scene, camera);
        } else {
            animate();
        }

        return () => {
            if (rafId !== null) {
                window.cancelAnimationFrame(rafId);
            }
            resizeObserver.disconnect();
            geometry.dispose();
            material.dispose();
            renderer?.dispose();
        };
    }, []);

    return (
        <div className={`absolute inset-0 overflow-hidden ${className}`}>
            <canvas ref={canvasRef} className="h-full w-full" aria-hidden="true" />
            <div
                className="absolute inset-0"
                style={{
                    background:
                        'radial-gradient(circle at 12% 12%, rgba(255,255,255,0.74) 0%, rgba(255,255,255,0) 42%), radial-gradient(circle at 88% 20%, rgba(143,191,255,0.26) 0%, rgba(143,191,255,0) 44%)'
                }}
            />
        </div>
    );
};
