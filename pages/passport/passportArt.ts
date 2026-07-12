export interface TopographyOptions {
  seed: string;
  contours: number;
  roughness: number;
}

export const hashString = (value: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const seededRandom = (seed: number) => {
  let state = seed || 1;
  return () => {
    state = Math.imul(state ^ (state >>> 15), 1 | state);
    state ^= state + Math.imul(state ^ (state >>> 7), 61 | state);
    return ((state ^ (state >>> 14)) >>> 0) / 4294967296;
  };
};

export const generateTopographyPaths = ({ seed, contours, roughness }: TopographyOptions): string[] => {
  const random = seededRandom(hashString(seed));
  const peakCount = 3 + Math.floor(random() * 3);
  const peaks = Array.from({ length: peakCount }, () => ({
    x: 80 + random() * 440,
    y: 90 + random() * 580,
    rx: 48 + random() * 105,
    ry: 44 + random() * 120,
    phase: random() * Math.PI * 2,
  }));
  const paths: string[] = [];
  const lineCount = Math.max(5, Math.min(24, Math.round(contours)));

  peaks.forEach((peak, peakIndex) => {
    const perPeak = Math.max(3, Math.floor(lineCount / peakCount) + 2);
    for (let ring = 0; ring < perPeak; ring += 1) {
      const scale = 0.28 + (ring / perPeak) * 1.22;
      const points: string[] = [];
      const segments = 28;
      for (let segment = 0; segment <= segments; segment += 1) {
        const angle = (segment / segments) * Math.PI * 2;
        const wobble = Math.sin(angle * (3 + peakIndex) + peak.phase) * roughness * 3.2
          + Math.cos(angle * 5 - peak.phase) * roughness * 1.7;
        const x = peak.x + Math.cos(angle) * (peak.rx * scale + wobble);
        const y = peak.y + Math.sin(angle) * (peak.ry * scale + wobble);
        points.push(`${segment === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`);
      }
      paths.push(`${points.join(' ')} Z`);
    }
  });

  return paths;
};

export const pageSeed = (passportSeed: string, pageIndex: number): string =>
  `${passportSeed.trim().toLowerCase() || 'wander'}:${pageIndex}`;
