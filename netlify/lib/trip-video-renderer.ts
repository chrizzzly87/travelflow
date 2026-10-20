import sharp from 'sharp';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { buildTripOgSummary, buildTripVideoMap, escapeHtml, type TripPayload } from '../edge-lib/trip-og-data.ts';
import { TRIP_VIDEO, type TripVideoStyle } from '../../shared/tripOgVideo.ts';

const require = createRequire(import.meta.url);
const escape = (value: string) => escapeHtml(value);
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const smooth = (n: number) => { const t = clamp(n); return t * t * (3 - 2 * t); };

export const buildVideoFrameSvg = (data: {
  title: string; description: string; badge: string; mapDataUri: string; style: TripVideoStyle;
  points: { x: number; y: number; label: string }[]; color: string;
}, progress: number) => {
  const dark = data.style === 'dark';
  const points = data.points.map(point => ({ ...point, x: 648 + point.x * 514, y: 38 + point.y * 554 }));
  const travel = smooth((progress - 0.08) / 0.72) * Math.max(1, points.length - 1);
  const path = points.map((point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
  let length = 0;
  let visibleLength = 0;
  points.slice(1).forEach((point, index) => {
    const distance = Math.hypot(point.x - points[index].x, point.y - points[index].y);
    length += distance;
    visibleLength += distance * clamp(travel - index);
  });
  const titleWords = data.title.slice(0, 120).split(/\s+/);
  const lines: string[] = [''];
  for (const word of titleWords) {
    const last = lines.length - 1;
    if (lines[last].length + word.length > 17 && lines[last] && lines.length < 4) lines.push(word);
    else lines[last] += `${lines[last] ? ' ' : ''}${word}`;
  }
  const markers = points.map((point, index) => {
    const reveal = smooth((travel - index + 0.3) / 0.3);
    if (reveal <= 0) return '';
    const labelX = Math.min(1045, Math.max(653, point.x + 15));
    const labelY = Math.max(56, Math.min(554, point.y - 14));
    return `<g opacity="${reveal.toFixed(3)}"><circle cx="${point.x}" cy="${point.y}" r="${(13 - 5 * reveal).toFixed(1)}" fill="${data.color}" stroke="white" stroke-width="3"/><circle cx="${point.x}" cy="${point.y}" r="2.5" fill="white"/><text x="${labelX}" y="${labelY}" font-size="15" font-weight="700" fill="${dark ? '#fff' : '#0f172a'}" stroke="${dark ? '#111827' : '#fff'}" stroke-width="4" paint-order="stroke" stroke-linejoin="round">${escape(point.label)}</text></g>`;
  }).join('');
  const legIndex = Math.min(points.length - 2, Math.floor(travel));
  const from = points[Math.max(0, legIndex)];
  const to = points[Math.max(0, legIndex + 1)];
  const t = clamp(travel - legIndex);
  const cursor = from && to && progress < 0.82 ? `<circle cx="${from.x + (to.x - from.x) * t}" cy="${from.y + (to.y - from.y) * t}" r="5" fill="white" stroke="${data.color}" stroke-width="3"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1200" height="630" viewBox="0 0 1200 630"><defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="${dark ? '#0f172a' : '#f8fafc'}"/><stop offset="1" stop-color="${dark ? '#312e81' : '#e0e7ff'}"/></linearGradient><clipPath id="map"><rect x="638" y="28" width="534" height="574" rx="28"/></clipPath><clipPath id="title"><rect x="68" y="130" width="510" height="310"/></clipPath></defs><rect width="1200" height="630" fill="url(#bg)"/><rect x="28" y="28" width="590" height="574" rx="28" fill="${dark ? '#1e293b' : '#fff'}"/><g font-family="sans-serif"><rect x="68" y="68" width="110" height="34" rx="17" fill="${dark ? '#4338ca' : '#eef2ff'}"/><text x="123" y="91" text-anchor="middle" fill="${dark ? '#fff' : '#4f46e5'}" font-size="16" font-weight="700">${escape(data.badge)}</text><g clip-path="url(#title)">${lines.map((line, index) => `<text x="68" y="${190 + index * 64}" fill="${dark ? '#fff' : '#0f172a'}" font-size="54" font-weight="800" ${line.length > 18 ? 'textLength="500" lengthAdjust="spacingAndGlyphs"' : ''}>${escape(line)}</text>`).join('')}</g><text x="68" y="470" fill="${dark ? '#cbd5e1' : '#64748b'}" font-size="20">${escape(data.description)}</text><rect x="68" y="526" width="34" height="34" rx="10" fill="#4f46e5"/><path d="M77 544l17-8-5 16-4-6-8-2z" fill="white"/><text x="114" y="553" fill="${dark ? '#fff' : '#0f172a'}" font-size="27" font-weight="700">TravelFlow</text><g clip-path="url(#map)"><rect x="638" y="28" width="534" height="574" fill="${dark ? '#1b2230' : '#f9f9f9'}"/><image x="648" y="38" width="514" height="554" preserveAspectRatio="none" xlink:href="${data.mapDataUri}"/><path d="${path}" fill="none" stroke="${data.color}" stroke-opacity="0.16" stroke-width="5" stroke-linecap="round"/><path d="${path}" fill="none" stroke="white" stroke-width="8" stroke-dasharray="${visibleLength.toFixed(2)} ${length + 1}" stroke-linecap="round"/><path d="${path}" fill="none" stroke="${data.color}" stroke-width="4" stroke-dasharray="${visibleLength.toFixed(2)} ${length + 1}" stroke-linecap="round"/>${cursor}${markers}</g></g></svg>`;
};

export const renderTripVideo = async (trip: TripPayload, style: TripVideoStyle) => {
  const map = await buildTripVideoMap(trip, style);
  if (!map.mapUrl || map.points.length === 0) throw new Error('Trip has no renderable map.');
  const response = await fetch(map.mapUrl, { signal: AbortSignal.timeout(12_000) });
  if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) throw new Error('Basemap unavailable.');
  const mapBytes = Buffer.from(await response.arrayBuffer());
  if (mapBytes.length > 4 * 1024 * 1024) throw new Error('Basemap exceeds input limit.');
  const summary = await buildTripOgSummary(trip, { includeMapImage: false });
  const frameData = { title: summary.title, description: summary.monthsLabel, badge: summary.weeksLabel, mapDataUri: `data:image/png;base64,${mapBytes.toString('base64')}`, style, points: map.points, color: map.color };
  const directory = await mkdtemp(join(tmpdir(), 'trip-video-'));
  const output = join(directory, 'preview.mp4');
  const binary = process.platform === 'linux' ? require('@ffmpeg-installer/linux-x64').path : (process.env.FFMPEG_PATH || 'ffmpeg');
  const child = spawn(binary, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(TRIP_VIDEO.fps), '-i', 'pipe:0', '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '29', '-maxrate', '1100k', '-bufsize', '2200k', '-pix_fmt', 'yuv420p', '-threads', '1', '-movflags', '+faststart', output], { stdio: ['pipe', 'ignore', 'pipe'] });
  let stderr = '';
  child.stderr.on('data', data => { stderr = (stderr + data).slice(-1000); });
  const completion = new Promise<void>((resolve, reject) => {
    child.once('error', reject);
    child.once('close', code => code === 0 ? resolve() : reject(new Error(`Encoder failed (${code}): ${stderr}`)));
  });
  // Attach immediately so a failed process cannot create an unhandled rejection.
  completion.catch(() => {});
  child.stdin.on('error', () => {});
  const deadline = Date.now() + TRIP_VIDEO.renderTimeoutMs;
  const timer = setTimeout(() => child.kill('SIGKILL'), TRIP_VIDEO.renderTimeoutMs);
  try {
    for (let frame = 0; frame < TRIP_VIDEO.fps * TRIP_VIDEO.seconds; frame++) {
      if (Date.now() >= deadline || child.exitCode !== null || child.killed) throw new Error('Video render timed out or encoder stopped.');
      const png = await sharp(Buffer.from(buildVideoFrameSvg(frameData, frame / (TRIP_VIDEO.fps * TRIP_VIDEO.seconds - 1)))).png().toBuffer();
      if (!child.stdin.write(png)) await Promise.race([once(child.stdin, 'drain'), completion.then(() => { throw new Error('Encoder stopped early.'); })]);
    }
    child.stdin.end();
    await completion;
    const video = await readFile(output);
    if (video.length > TRIP_VIDEO.maxBytes) throw new Error('Video exceeds the 2 MB limit.');
    const poster = await sharp(Buffer.from(buildVideoFrameSvg(frameData, 1))).jpeg({ quality: 82 }).toBuffer();
    return { video, poster };
  } finally {
    clearTimeout(timer);
    child.kill('SIGKILL');
    await completion.catch(() => {});
    await rm(directory, { recursive: true, force: true });
  }
};
