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

const fade = (value: number) => value * value * value * (value * (value * 6 - 15) + 10);
const lerp = (from: number, to: number, amount: number) => from + (to - from) * amount;

const makeValueNoise = (seed: number) => {
  const sample = (x: number, y: number) => {
    const mixed = hashString(`${seed}:${x}:${y}`);
    return (mixed / 4294967295) * 2 - 1;
  };
  return (x: number, y: number) => {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const tx = fade(x - x0);
    const ty = fade(y - y0);
    return lerp(
      lerp(sample(x0, y0), sample(x0 + 1, y0), tx),
      lerp(sample(x0, y0 + 1), sample(x0 + 1, y0 + 1), tx),
      ty,
    );
  };
};

type Point = [number, number];
type Segment = [Point, Point];

const interpolate = (a: Point, b: Point, av: number, bv: number, level: number): Point => {
  const amount = Math.abs(bv - av) < 0.00001 ? 0.5 : (level - av) / (bv - av);
  return [lerp(a[0], b[0], amount), lerp(a[1], b[1], amount)];
};

const marchingSegments = (field: number[][], level: number, stepX: number, stepY: number): Segment[] => {
  const segments: Segment[] = [];
  for (let row = 0; row < field.length - 1; row += 1) {
    for (let column = 0; column < field[row].length - 1; column += 1) {
      const tl = field[row][column];
      const tr = field[row][column + 1];
      const br = field[row + 1][column + 1];
      const bl = field[row + 1][column];
      const mask = (tl >= level ? 8 : 0) | (tr >= level ? 4 : 0) | (br >= level ? 2 : 0) | (bl >= level ? 1 : 0);
      if (mask === 0 || mask === 15) continue;

      const x = column * stepX;
      const y = row * stepY;
      const top = interpolate([x, y], [x + stepX, y], tl, tr, level);
      const right = interpolate([x + stepX, y], [x + stepX, y + stepY], tr, br, level);
      const bottom = interpolate([x, y + stepY], [x + stepX, y + stepY], bl, br, level);
      const left = interpolate([x, y], [x, y + stepY], tl, bl, level);
      const pairs: Record<number, Segment[]> = {
        1: [[left, bottom]], 2: [[bottom, right]], 3: [[left, right]], 4: [[top, right]],
        5: [[top, left], [bottom, right]], 6: [[top, bottom]], 7: [[top, left]],
        8: [[top, left]], 9: [[top, bottom]], 10: [[top, right], [left, bottom]],
        11: [[top, right]], 12: [[left, right]], 13: [[bottom, right]], 14: [[left, bottom]],
      };
      segments.push(...(pairs[mask] ?? []));
    }
  }
  return segments;
};

const pointKey = ([x, y]: Point) => `${x.toFixed(2)},${y.toFixed(2)}`;

const joinSegments = (segments: Segment[]): Point[][] => {
  const unused = new Set(segments.map((_, index) => index));
  const endpointMap = new Map<string, number[]>();
  segments.forEach((segment, index) => segment.forEach((point) => {
    const key = pointKey(point);
    endpointMap.set(key, [...(endpointMap.get(key) ?? []), index]);
  }));
  const paths: Point[][] = [];
  while (unused.size) {
    const first = unused.values().next().value as number;
    unused.delete(first);
    const path = [...segments[first]];
    let guard = segments.length + 1;
    while (guard > 0) {
      guard -= 1;
      const endKey = pointKey(path[path.length - 1]);
      const nextIndex = (endpointMap.get(endKey) ?? []).find((index) => unused.has(index));
      if (nextIndex === undefined) break;
      unused.delete(nextIndex);
      const next = segments[nextIndex];
      path.push(pointKey(next[0]) === endKey ? next[1] : next[0]);
    }
    if (path.length > 3) paths.push(path);
  }
  return paths;
};

export const generateTopographyPaths = ({ seed, contours, roughness }: TopographyOptions): string[] => {
  const seedHash = hashString(seed);
  const random = seededRandom(seedHash);
  const noise = makeValueNoise(seedHash);
  const columns = 64;
  const rows = 82;
  const scale = 2.15 + roughness * 0.22;
  const offsetX = random() * 50;
  const offsetY = random() * 50;
  const peaks = Array.from({ length: 4 }, () => ({
    x: random(), y: random(), radius: 0.14 + random() * 0.28, strength: 0.3 + random() * 0.65,
  }));
  const field = Array.from({ length: rows }, (_, row) => Array.from({ length: columns }, (_, column) => {
    const nx = column / (columns - 1);
    const ny = row / (rows - 1);
    let value = 0;
    let amplitude = 0.58;
    let frequency = scale;
    for (let octave = 0; octave < 4; octave += 1) {
      value += noise(offsetX + nx * frequency, offsetY + ny * frequency) * amplitude;
      frequency *= 1.92;
      amplitude *= 0.48;
    }
    peaks.forEach((peak) => {
      const distance = Math.hypot(nx - peak.x, ny - peak.y);
      value += Math.exp(-(distance * distance) / (2 * peak.radius * peak.radius)) * peak.strength;
    });
    return value;
  }));
  const values = field.flat();
  const min = Math.min(...values);
  const max = Math.max(...values);
  const lineCount = Math.max(7, Math.min(26, Math.round(contours)));
  const paths: string[] = [];
  for (let index = 1; index <= lineCount; index += 1) {
    const level = lerp(min, max, index / (lineCount + 1));
    joinSegments(marchingSegments(field, level, 600 / (columns - 1), 760 / (rows - 1))).forEach((points) => {
      const closed = pointKey(points[0]) === pointKey(points[points.length - 1]);
      const commands = points.map(([x, y], pointIndex) => `${pointIndex ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`);
      paths.push(`${commands.join(' ')}${closed ? ' Z' : ''}`);
    });
  }
  return paths;
};

export const pageSeed = (passportSeed: string, pageIndex: number): string =>
  `${passportSeed.trim().toLowerCase() || 'wander'}:${pageIndex}`;
