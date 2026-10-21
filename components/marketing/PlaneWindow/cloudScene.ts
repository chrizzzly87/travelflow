/**
 * Volumetric cloud bands for the plane window.
 *
 * This is an imperative port of drei's <Clouds>/<Cloud> (pmndrs/drei, MIT). It
 * cannot use drei or react-three-fiber directly: vite.config.ts aliases React to
 * preact/compat, which has no react-reconciler, so R3F mounts a canvas element
 * and then silently never attaches a renderer. Plain three.js is fine.
 *
 * The mechanism is the whole point, and it is what makes the loop invisible.
 * There is no keyframe and no repeating strip. Each cloud group walks left at
 * its own speed and wraps when it passes its own reset point, and every puff
 * inside it has its own seed, depth, rotation rate and breathing phase. Nothing
 * ever lines up again, so there is no seam for the eye to catch — which is
 * exactly what the old translateX(-50%) strip could not do.
 */
import * as THREE from 'three';

export interface CloudSceneHandle {
    canvas: HTMLCanvasElement;
    setPaused: (paused: boolean) => void;
    resize: (width: number, height: number) => void;
    dispose: () => void;
}

interface PuffState {
    ref: THREE.Group;
    position: THREE.Vector3;
    matrix: THREE.Matrix4;
    color: THREE.Color;
    rotation: number;
    rotationFactor: number;
    density: number;
    speed: number;
    volume: number;
    growth: number;
    opacity: number;
    fade: number;
    dist: number;
}

/** One cloud group: a bright body with a darker underside, drifting and wrapping. */
interface GroupSpec {
    position: [number, number, number];
    speed: number;
    opacity: number;
    segments: number;
    bounds: [number, number, number];
    volume: number;
    seed: number;
    resetX: number;
    color: string;
    shadowColor: string;
}

/**
 * The three depth bands. Far clouds barely move, near clouds tear past — that
 * parallax is what reads as altitude. Values follow the reference's own tuning.
 */
const GROUPS: GroupSpec[] = [
    // Far band.
    { position: [-1.5, -0.8, -16], speed: 0.04, opacity: 0.35, segments: 10, bounds: [1.5, 0.4, 0.4], volume: 0.4, seed: 1, resetX: 4, color: '#c8d8e8', shadowColor: '#4a6a8a' },
    { position: [0.5, -0.8, -16], speed: 0.03, opacity: 0.3, segments: 10, bounds: [1.8, 0.4, 0.4], volume: 0.4, seed: 2, resetX: 4, color: '#d0dce8', shadowColor: '#4a6a8a' },
    { position: [2.5, -0.8, -16], speed: 0.04, opacity: 0.32, segments: 10, bounds: [1.6, 0.4, 0.4], volume: 0.4, seed: 3, resetX: 4, color: '#c8d8e8', shadowColor: '#4a6a8a' },
    { position: [-3, -0.85, -16], speed: 0.03, opacity: 0.28, segments: 10, bounds: [1.4, 0.35, 0.35], volume: 0.35, seed: 10, resetX: 4, color: '#d0dce8', shadowColor: '#4a6a8a' },
    // Mid band.
    { position: [-1, -0.95, -9], speed: 0.08, opacity: 0.55, segments: 14, bounds: [2.2, 0.7, 0.7], volume: 0.7, seed: 4, resetX: 4, color: '#f0f4f8', shadowColor: '#8aa0b8' },
    { position: [1, -0.9, -9], speed: 0.07, opacity: 0.5, segments: 14, bounds: [2, 0.65, 0.65], volume: 0.65, seed: 5, resetX: 4, color: '#eef2f8', shadowColor: '#5a7898' },
    { position: [-3, -1, -9], speed: 0.09, opacity: 0.48, segments: 12, bounds: [1.8, 0.6, 0.6], volume: 0.6, seed: 6, resetX: 4, color: '#f0f4f8', shadowColor: '#5a7898' },
    { position: [3, -0.62, -9], speed: 0.08, opacity: 0.5, segments: 12, bounds: [2, 0.6, 0.6], volume: 0.6, seed: 11, resetX: 4, color: '#eef2f8', shadowColor: '#5a7898' },
    // Near band — these are the ones that sell the speed.
    { position: [0, -1.3, -2.5], speed: 0.48, opacity: 0.7, segments: 18, bounds: [3, 1, 1], volume: 1, seed: 7, resetX: 5, color: '#ffffff', shadowColor: '#7a8fa8' },
    { position: [-2, -1.4, -2.5], speed: 0.52, opacity: 0.65, segments: 16, bounds: [2.8, 0.9, 0.9], volume: 0.9, seed: 8, resetX: 5, color: '#fffef8', shadowColor: '#7a8fa8' },
    { position: [2, -1.5, -2.5], speed: 0.44, opacity: 0.6, segments: 16, bounds: [2.5, 0.9, 0.9], volume: 0.9, seed: 9, resetX: 5, color: '#ffffff', shadowColor: '#7a8fa8' },
    { position: [-4, -1.2, -2.5], speed: 0.5, opacity: 0.62, segments: 16, bounds: [2.6, 0.85, 0.85], volume: 0.85, seed: 12, resetX: 5, color: '#fffef8', shadowColor: '#7a8fa8' },
];

const MAX_PUFFS = 420;
const GROWTH = 4;
const FADE = 10;

/**
 * Deterministic per-seed random, so a given cloud looks the same on every load
 * and across reloads. Math.random() here would make the scene jitter between
 * visits for no benefit.
 */
const makeRandom = (seed: number) => {
    let s = seed;
    return () => {
        const x = Math.sin(s++) * 10000;
        return x - Math.floor(x);
    };
};

/**
 * The puff sprite, drawn once into a canvas rather than downloaded.
 *
 * drei ships cloud.png for this, but it is a soft blob with a little internal
 * structure and we can produce that here for nothing — no request, no asset to
 * keep in sync, no CDN hotlink. Layered radial gradients give it a lit top and
 * a denser core so it does not read as a plain airbrush dot.
 */
const createPuffTexture = (): THREE.CanvasTexture => {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.CanvasTexture(canvas);

    const blob = (cx: number, cy: number, r: number, alpha: number) => {
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0, `rgba(255,255,255,${alpha})`);
        g.addColorStop(0.45, `rgba(255,255,255,${alpha * 0.72})`);
        g.addColorStop(0.75, `rgba(255,255,255,${alpha * 0.25})`);
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
    };

    ctx.clearRect(0, 0, size, size);
    blob(size * 0.5, size * 0.52, size * 0.48, 0.85);
    blob(size * 0.38, size * 0.44, size * 0.3, 0.5);
    blob(size * 0.62, size * 0.48, size * 0.27, 0.45);
    blob(size * 0.5, size * 0.38, size * 0.22, 0.4);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
};

/**
 * drei's material patch, ported. The stock material has one opacity for the whole
 * instanced mesh; clouds need it per puff so individual puffs can fade with
 * distance. A vertex attribute carries it and the fragment shader multiplies the
 * final alpha by it.
 */
const createCloudMaterial = (map: THREE.Texture): THREE.MeshLambertMaterial => {
    const material = new THREE.MeshLambertMaterial({
        map,
        transparent: true,
        depthWrite: false,
    });
    material.onBeforeCompile = (shader) => {
        shader.vertexShader = `attribute float cloudOpacity;\nvarying float vOpacity;\n${shader.vertexShader}`.replace(
            '#include <fog_vertex>',
            '#include <fog_vertex>\n  vOpacity = cloudOpacity;',
        );
        shader.fragmentShader = `varying float vOpacity;\n${shader.fragmentShader}`.replace(
            '#include <opaque_fragment>',
            '#include <opaque_fragment>\n  gl_FragColor = vec4(outgoingLight, diffuseColor.a * vOpacity);',
        );
    };
    return material;
};

export const createCloudScene = (width: number, height: number): CloudSceneHandle => {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(70, width / height, 0.1, 100);
    camera.position.set(0, 0, 3);

    scene.add(new THREE.AmbientLight(0xe8f4ff, 3));
    const sun = new THREE.DirectionalLight(0xfff8f0, 2);
    sun.position.set(5, 5, 5);
    scene.add(sun);

    const texture = createPuffTexture();
    const material = createCloudMaterial(texture);

    const geometry = new THREE.PlaneGeometry(1, 1);
    const opacities = new Float32Array(MAX_PUFFS).fill(1);
    geometry.setAttribute('cloudOpacity', new THREE.InstancedBufferAttribute(opacities, 1));

    const mesh = new THREE.InstancedMesh(geometry, material, MAX_PUFFS);
    mesh.matrixAutoUpdate = false;
    mesh.frustumCulled = false;
    scene.add(mesh);

    // Build the puffs.
    const groups: Array<{ group: THREE.Group; spec: GroupSpec }> = [];
    const puffs: PuffState[] = [];

    for (const spec of GROUPS) {
        const group = new THREE.Group();
        group.position.set(...spec.position);
        scene.add(group);
        groups.push({ group, spec });

        // Two layers per group, as the reference does: a bright body and a
        // dimmer, flatter underside that reads as the cloud's own shadow.
        const layers = [
            { count: spec.segments, color: spec.color, opacity: spec.opacity, bounds: spec.bounds, volume: spec.volume, offsetY: spec.bounds[1] * 0.15, seed: spec.seed },
            { count: Math.floor(spec.segments * 0.7), color: spec.shadowColor, opacity: spec.opacity * 0.7, bounds: [spec.bounds[0], spec.bounds[1] * 0.5, spec.bounds[2]] as [number, number, number], volume: spec.volume * 0.6, offsetY: -spec.bounds[1] * 0.25, seed: spec.seed + 100 },
        ];

        for (const layer of layers) {
            const random = makeRandom(layer.seed);
            const anchor = new THREE.Group();
            anchor.position.y = layer.offsetY;
            group.add(anchor);

            for (let i = 0; i < layer.count; i += 1) {
                if (puffs.length >= MAX_PUFFS) break;
                const position = new THREE.Vector3(
                    (random() * 2 - 1) * layer.bounds[0],
                    (random() * 2 - 1) * layer.bounds[1],
                    (random() * 2 - 1) * layer.bounds[2],
                );
                // Puffs nearer the middle of the bounding box are fatter, which
                // is what gives the group a body instead of a flat scatter.
                const ax = Math.abs(position.x / layer.bounds[0]);
                const ay = Math.abs(position.y / layer.bounds[1]);
                const az = Math.abs(position.z / layer.bounds[2]);
                const longest = Math.max(ax, ay, az);
                const inside = Math.max(0.25, 1 - longest);

                puffs.push({
                    ref: anchor,
                    position,
                    matrix: new THREE.Matrix4(),
                    color: new THREE.Color(layer.color),
                    rotation: i * (Math.PI / layer.count),
                    rotationFactor: Math.max(0.2, 0.5 * random()) * spec.speed,
                    density: Math.max(0.5, random()),
                    speed: spec.speed,
                    volume: inside * layer.volume,
                    growth: GROWTH,
                    opacity: layer.opacity,
                    fade: FADE,
                    dist: 0,
                });
            }
        }
    }

    mesh.count = puffs.length;

    // Scratch objects, reused every frame — allocating these per frame is the
    // classic way to make a small scene stutter.
    const parentInverse = new THREE.Matrix4();
    const camPos = new THREE.Vector3();
    const camQuat = new THREE.Quaternion();
    const camScale = new THREE.Vector3();
    const worldPos = new THREE.Vector3();
    const worldQuat = new THREE.Quaternion();
    const worldScale = new THREE.Vector3();
    const offset = new THREE.Vector3();
    const spin = new THREE.Quaternion();
    const axis = new THREE.Vector3(0, 0, 1);

    const clock = new THREE.Clock();
    let raf = 0;
    let paused = false;
    let disposed = false;

    const renderFrame = () => {
        if (disposed) return;
        const delta = Math.min(clock.getDelta(), 1 / 30);
        const elapsed = clock.getElapsedTime();

        // Drift and wrap. Each group owns its own reset point, so they never
        // resynchronise into a visible period.
        for (const { group, spec } of groups) {
            group.position.x -= delta * spec.speed;
            if (group.position.x < -spec.resetX) group.position.x = spec.resetX;
        }

        scene.updateMatrixWorld();
        mesh.updateMatrixWorld();
        parentInverse.copy(mesh.matrixWorld).invert();
        camera.matrixWorld.decompose(camPos, camQuat, camScale);

        for (const puff of puffs) {
            puff.ref.matrixWorld.decompose(worldPos, worldQuat, worldScale);
            worldPos.add(offset.copy(puff.position).applyQuaternion(worldQuat).multiply(worldScale));

            // Billboard toward the camera, then spin in the view plane so the
            // sprite does not read as a static decal.
            puff.rotation += delta * puff.rotationFactor;
            worldQuat.copy(camQuat).multiply(spin.setFromAxisAngle(axis, puff.rotation));

            // Breathe. Desynchronised by each puff's own density and speed.
            // This is drei's formula verbatim — the growth term dominates, and
            // scaling it down (as an earlier version did) collapses the clouds
            // into specks instead of volumes.
            const scale = puff.volume + ((1 + Math.sin(elapsed * puff.density * puff.speed)) / 2) * puff.growth;
            worldScale.setScalar(scale);

            puff.matrix.compose(worldPos, worldQuat, worldScale).premultiply(parentInverse);
            puff.dist = worldPos.distanceTo(camPos);
        }

        // Far puffs first, so nearer ones blend over them correctly. Without
        // depth writes, draw order is the only thing deciding this.
        puffs.sort((a, b) => b.dist - a.dist);

        for (let i = 0; i < puffs.length; i += 1) {
            const puff = puffs[i];
            opacities[i] = puff.opacity * (puff.dist < puff.fade - 1 ? puff.dist / puff.fade : 1);
            mesh.setMatrixAt(i, puff.matrix);
            mesh.setColorAt(i, puff.color);
        }

        geometry.attributes.cloudOpacity.needsUpdate = true;
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

        renderer.render(scene, camera);
    };

    const loop = () => {
        renderFrame();
        if (!paused && !disposed) raf = requestAnimationFrame(loop);
    };

    // Draw one frame synchronously before anything can pause us. Scheduling the
    // first frame with rAF instead means a caller that pauses immediately —
    // because the tab is hidden, or the shade starts closed — cancels it before
    // it ever runs, and the window shows an empty canvas with no way to recover
    // until something resumes the loop.
    renderFrame();
    raf = requestAnimationFrame(loop);

    return {
        canvas: renderer.domElement,
        setPaused: (next: boolean) => {
            if (paused === next) return;
            paused = next;
            if (!paused) {
                clock.getDelta(); // drop the gap so clouds do not jump on resume
                raf = requestAnimationFrame(loop);
            } else {
                cancelAnimationFrame(raf);
            }
        },
        resize: (w: number, h: number) => {
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h, false);
        },
        dispose: () => {
            disposed = true;
            cancelAnimationFrame(raf);
            geometry.dispose();
            material.dispose();
            texture.dispose();
            renderer.dispose();
        },
    };
};
