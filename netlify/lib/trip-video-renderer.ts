import { loadVideoOutlineFonts, outlineVideoSvgText } from './trip-video-font-outlines.ts';
import sharp from 'sharp';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { once } from 'node:events';
import { buildTripOgSummary, buildTripVideoMap, escapeHtml, type TripPayload } from '../edge-lib/trip-og-data.ts';
import type { TripVideoRouteCache } from './trip-video-map.ts';
import { TRIP_VIDEO, type TripVideoStyle, type TripVideoRouteMode, type TripVideoFormat, tripVideoLayout } from '../../shared/tripOgVideo.ts';

const require = createRequire(import.meta.url);
export const getVideoEncoderPath = (platform: string = process.platform): string =>
  platform === 'linux' ? require.resolve('@ffmpeg-installer/linux-x64/ffmpeg') : (process.env.FFMPEG_PATH || 'ffmpeg');
const escape = (value: string) => escapeHtml(value);
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const smooth = (n: number) => { const t = clamp(n); return t * t * (3 - 2 * t); };

export const buildVideoFrameSvg = (data: {
  format?: TripVideoFormat;
  title: string; description: string; badge: string; mapDataUri: string; style: TripVideoStyle;
  points: { x: number; y: number; label: string; hidden?: boolean; excursion?: boolean; color?: string }[]; color: string;
  legs?: { x: number; y: number }[][];
  legStyles?: { color: string; dashed: boolean }[];
}, progress: number) => {
  const layout = tripVideoLayout(data.format);
  const { width, height, mapX, mapWidth, mapHeight, imageX, imageY, imageWidth, imageHeight, titleWidth, textWidth } = layout;
  const dark = data.style === 'dark';
  const points = data.points.map(point => ({ ...point, x: imageX + point.x * imageWidth, y: imageY + point.y * imageHeight }));
  const travel = smooth((progress - 0.08) / 0.72) * Math.max(1, points.length - 1);
  const legs = (data.legs || data.points.slice(1).map((point, index) => [data.points[index], point]))
    .map(leg => leg.map(point => ({ x: imageX + point.x * imageWidth, y: imageY + point.y * imageHeight })));
  const lengths = legs.map(leg => leg.slice(1).reduce((sum, point, index) => sum + Math.hypot(point.x - leg[index].x, point.y - leg[index].y), 0));
  const routes = legs.map((leg, index) => {
    const d = leg.map((point, n) => `${n ? 'L' : 'M'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
    const color = data.legStyles?.[index]?.color || data.color;
    const dashed = data.legStyles?.[index]?.dashed;
    const reveal = lengths[index] * clamp(travel - index);
    const dash = dashed ? 'stroke-dasharray="8 7"' : '';
    return `<path d="${d}" fill="none" stroke="${color}" stroke-opacity="0.16" stroke-width="5" ${dash}/><mask id="leg-${index}" maskUnits="userSpaceOnUse" x="${mapX}" y="28" width="${mapWidth}" height="${mapHeight}"><path d="${d}" fill="none" stroke="white" stroke-width="14" stroke-dasharray="${reveal.toFixed(2)} ${lengths[index] + 1}"/></mask><g mask="url(#leg-${index})"><path d="${d}" fill="none" stroke="white" stroke-width="8" ${dash} stroke-linecap="round"/><path d="${d}" fill="none" stroke="${color}" stroke-width="4" ${dash} stroke-linecap="round"/></g>`;
  }).join('');
  const titleWords = data.title.slice(0, 120).split(/\s+/);
  const lines: string[] = [''];
  for (const word of titleWords) {
    const last = lines.length - 1;
    if (lines[last].length + word.length > Math.floor(textWidth / 29) && lines[last] && lines.length < 4) lines.push(word);
    else lines[last] += `${lines[last] ? ' ' : ''}${word}`;
  }
  const markers = points.map((point, index) => {
    if (point.hidden) return '';
    const reveal = smooth((travel - index + 0.3) / 0.3);
    if (reveal <= 0) return '';
    const labelOnLeft = point.x > imageX + imageWidth / 2;
    const labelWidth = Math.min(imageWidth - 20, point.label.length * 8.5);
    const labelX = labelOnLeft ? Math.max(imageX + 5 + labelWidth, point.x - 15) : Math.min(imageX + imageWidth - 5 - labelWidth, point.x + 15);
    const labelY = Math.max(56, Math.min(height - 76, point.y - 14));
    const markerColor = point.color || data.color;
    const symbol = point.excursion ? `<path data-role="day-trip-compass" d="M${point.x + 3} ${point.y - 5}L${point.x + 1} ${point.y + 1}L${point.x - 3} ${point.y + 5}L${point.x - 1} ${point.y - 1}Z" fill="white"/>` : `<circle cx="${point.x}" cy="${point.y}" r="2.5" fill="white"/>`;
    return `<g opacity="${reveal.toFixed(3)}"><circle cx="${point.x}" cy="${point.y}" r="${(point.excursion ? 8 : 13 - 5 * reveal).toFixed(1)}" fill="${markerColor}" stroke="white" stroke-width="3"/>${symbol}<text x="${labelX}" y="${labelY}" text-anchor="${labelOnLeft ? 'end' : 'start'}" font-size="15" font-weight="700" fill="${dark ? '#fff' : '#0f172a'}" stroke="${dark ? '#111827' : '#fff'}" stroke-width="4" paint-order="stroke" stroke-linejoin="round">${escape(point.label)}</text></g>`;
  }).join('');
  const legIndex = Math.min(points.length - 2, Math.floor(travel));
  const cursorLeg = legs[Math.max(0, legIndex)] || [];
  let remaining = (lengths[Math.max(0, legIndex)] || 0) * clamp(travel - legIndex);
  let cursorPoint = cursorLeg[0];
  for (let index = 1; index < cursorLeg.length; index++) {
    const from = cursorLeg[index - 1], to = cursorLeg[index];
    const segment = Math.hypot(to.x - from.x, to.y - from.y);
    if (remaining <= segment) { const t = segment ? remaining / segment : 0; cursorPoint = { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t }; break; }
    remaining -= segment; cursorPoint = to;
  }
  const cursor = cursorPoint && progress < 0.82 ? `<circle cx="${cursorPoint.x}" cy="${cursorPoint.y}" r="5" fill="white" stroke="${data.legStyles?.[Math.max(0, legIndex)]?.color || data.color}" stroke-width="3"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="${dark ? '#0f172a' : '#f8fafc'}"/><stop offset="1" stop-color="${dark ? '#312e81' : '#e0e7ff'}"/></linearGradient><clipPath id="map"><rect x="${mapX}" y="28" width="${mapWidth}" height="${mapHeight}" rx="28"/></clipPath><clipPath id="title"><rect x="68" y="130" width="${textWidth}" height="310"/></clipPath></defs><rect width="${width}" height="${height}" fill="url(#bg)"/><rect x="28" y="28" width="${titleWidth}" height="${mapHeight}" rx="28" fill="${dark ? '#1e293b' : '#fff'}"/><g font-family="Bricolage Grotesque, Noto Sans, Vazirmatn, sans-serif"><rect x="68" y="68" width="110" height="34" rx="17" fill="${dark ? '#4338ca' : '#eef2ff'}"/><text x="123" y="91" text-anchor="middle" fill="${dark ? '#fff' : '#4f46e5'}" font-size="16" font-weight="700">${escape(data.badge)}</text><g clip-path="url(#title)">${lines.map((line, index) => `<text x="68" y="${190 + index * 64}" fill="${dark ? '#fff' : '#0f172a'}" font-size="54" font-weight="800" ${line.length > Math.floor(textWidth / 28) ? `textLength="${textWidth}" lengthAdjust="spacingAndGlyphs"` : ''}>${escape(line)}</text>`).join('')}</g><text x="68" y="470" fill="${dark ? '#cbd5e1' : '#64748b'}" font-size="20">${escape(data.description)}</text><rect x="68" y="526" width="34" height="34" rx="10" fill="#4f46e5"/><path d="M77 544l17-8-5 16-4-6-8-2z" fill="white"/><text x="114" y="553" fill="${dark ? '#fff' : '#0f172a'}" font-size="27" font-weight="700">TravelFlow</text><g clip-path="url(#map)"><rect x="${mapX}" y="28" width="${mapWidth}" height="${mapHeight}" fill="${dark ? '#1b2230' : '#f9f9f9'}"/><image x="${imageX}" y="${imageY}" width="${imageWidth}" height="${imageHeight}" preserveAspectRatio="xMidYMid meet" xlink:href="${data.mapDataUri}"/>${routes}${cursor}${markers}</g></g></svg>`;
};

export const renderTripVideo = async (trip: TripPayload, style: TripVideoStyle, routeMode: TripVideoRouteMode = 'simple', routeCache: TripVideoRouteCache = [], format: TripVideoFormat = 'wide') => {
  const fonts = await loadVideoOutlineFonts();
  const textCache = new Map<string, string>();
  const outlinedFrame = (progress: number) => outlineVideoSvgText(buildVideoFrameSvg(frameData, progress), fonts, textCache);
  const map = await buildTripVideoMap(trip, style, routeMode, routeCache, format);
  if (!map.mapUrl || map.points.length === 0) throw new Error('Trip has no renderable map.');
  const response = await fetch(map.mapUrl, { signal: AbortSignal.timeout(12_000) });
  if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) throw new Error('Basemap unavailable.');
  const mapBytes = Buffer.from(await response.arrayBuffer());
  if (mapBytes.length > 4 * 1024 * 1024) throw new Error('Basemap exceeds input limit.');
  const summary = await buildTripOgSummary(trip, { includeMapImage: false });
  const frameData = { format, title: summary.title, description: [summary.monthsLabel, summary.dayTripsLabel?.split(' · ')[0]].filter(Boolean).join(' · '), badge: summary.weeksLabel, mapDataUri: `data:image/png;base64,${mapBytes.toString('base64')}`, style, points: map.points, legs: map.legs, legStyles: map.legStyles, color: map.color };
  const directory = await mkdtemp(join(tmpdir(), 'trip-video-'));
  const output = join(directory, 'preview.mp4');
  const binary = getVideoEncoderPath();
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
      const png = await sharp(Buffer.from(outlinedFrame(frame / (TRIP_VIDEO.fps * TRIP_VIDEO.seconds - 1)))).png().toBuffer();
      if (!child.stdin.write(png)) await Promise.race([once(child.stdin, 'drain'), completion.then(() => { throw new Error('Encoder stopped early.'); })]);
    }
    child.stdin.end();
    await completion;
    const video = await readFile(output);
    if (video.length > TRIP_VIDEO.maxBytes) throw new Error('Video exceeds the 2 MB limit.');
    const poster = await sharp(Buffer.from(outlinedFrame(1))).jpeg({ quality: 82 }).toBuffer();
    return { video, poster };
  } finally {
    clearTimeout(timer);
    child.kill('SIGKILL');
    await completion.catch(() => {});
    await rm(directory, { recursive: true, force: true });
  }
};
