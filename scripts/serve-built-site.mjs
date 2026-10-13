import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import sharp from 'sharp';

const root = process.env.RUNTIME_DIST_DIR
  ? path.resolve(process.env.RUNTIME_DIST_DIR)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const port = Number(process.env.PORT || 4183);
const types = {
  '.css': 'text/css', '.html': 'text/html', '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.js': 'text/javascript',
  '.json': 'application/json', '.mjs': 'text/javascript', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

export const resolveBuiltPath = async (pathname, distRoot = root) => {
  let decoded;
  try { decoded = decodeURIComponent(pathname); } catch { return null; }
  if (decoded.startsWith('/api/')) return null;
  const relative = decoded.replace(/^\/+/, '');
  const fallback = path.extname(relative) ? [] : ['spa.html'];
  const candidates = relative
    ? [relative, `${relative}.html`, path.join(relative, 'index.html'), ...fallback]
    : ['index.html'];

  for (const candidate of candidates) {
    const fullPath = path.resolve(distRoot, candidate);
    if (!fullPath.startsWith(`${distRoot}${path.sep}`)) continue;
    const info = await stat(fullPath).catch(() => null);
    if (info?.isFile()) return fullPath;
  }
  return null;
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const imageCache = new Map();
  createServer(async (request, response) => {
    const url = new URL(request.url || '/', 'http://localhost');
    const pathname = url.pathname;
    // The production image endpoint is local-file only in this test server.
    if (pathname === '/.netlify/images') {
      try {
        let body = imageCache.get(url.search);
        const format = url.searchParams.get('fm') === 'avif' ? 'avif' : 'webp';
        if (!body) {
          const source = await resolveBuiltPath(url.searchParams.get('url') || '');
          if (!source || !/\.(webp|png|jpe?g|avif)$/.test(source)) throw new Error('Missing image');
          const width = Number(url.searchParams.get('w')) || undefined;
          body = await sharp(source).resize({ width, withoutEnlargement: true })
            .toFormat(format, { quality: Number(url.searchParams.get('q')) || 66 }).toBuffer();
          imageCache.set(url.search, body);
        }
        response.writeHead(200, { 'Content-Type': `image/${format}`, 'Cache-Control': 'no-store' }).end(body);
      } catch { response.writeHead(404).end(); }
      return;
    }
    const target = await resolveBuiltPath(pathname);
    if (!target) {
      response.writeHead(404).end();
      return;
    }
    const compress = /\.(js|mjs|css|html|json)$/.test(target)
      && request.headers['accept-encoding']?.includes('gzip');
    response.writeHead(200, {
      'Content-Type': types[path.extname(target)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
      ...(compress ? { 'Content-Encoding': 'gzip' } : {}),
    });
    if (compress) response.end(gzipSync(await readFile(target)));
    else createReadStream(target).pipe(response);
  }).listen(port, '127.0.0.1', () => {
    console.log(`Serving the built site at http://127.0.0.1:${port}`);
  });
}
