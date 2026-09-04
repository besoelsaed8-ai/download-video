/*
 * Download Video — free universal video downloader.
 * Zero npm dependencies; runs on any Node >= 18 with `node server.js`.
 *
 * NOTE: this file intentionally contains no backslash characters, which keeps
 * every regex/escape deterministic across tooling round-trips.
 *
 * Endpoints
 *   GET  /api/ping            -> { ok:true }
 *   POST /api/download        -> { ok:true, ...meta } | { ok:false, code, message }
 *        body: { url: "https://..." }
 *   GET  /stream?u=<enc>&name=<enc>[&t=<signed token>]   -> proxy remote media
 *   GET  /stream?k=<token>&name=<name>                   -> one-time merged file
 *
 * Engines (all free, no API keys):
 *   - TikTok    : public tikwm.com endpoint -> clean (no-watermark) file
 *   - Instagram : fetch of the public post page (optional IG_SESSIONID for
 *                 cloud IPs)
 *   - any other : yt-dlp (vendor/ytdlp or YTDLP_BIN) covering ~1800 sites;
 *                 audio/video-only streams are merged server-side with ffmpeg
 *                 and served once as a finished file.
 */

'use strict';

const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFile } = require('node:child_process');
const { Readable } = require('node:stream');

/* ------------------------------ constants ------------------------------ */

const PORT = Number.parseInt(process.env.PORT, 10) > 0 ? Number.parseInt(process.env.PORT, 10) : 8080;
// Public site URL (no trailing-path). Used for canonical, sitemap.xml and robots.txt.
const SITE_URL = (process.env.SITE_URL || 'https://download-video.example/').trim();
const SITE_TOKEN = '__SITE_URL__';
const PUBLIC_DIR = path.join(__dirname, 'public');
const VENDOR_YTDLP = path.join(__dirname, 'vendor', 'ytdlp');
const MAX_BODY = 64 * 1024;
const CACHE_TTL_MS = 15 * 60 * 1000;
const CACHE_MAX = 200;

const TMP_DIR = path.join(os.tmpdir(), 'download-video-files');
fs.mkdirSync(TMP_DIR, { recursive: true });
// one-time merged files: token -> { path, at }
const FILES = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of [...FILES]) {
    if (now - v.at > 20 * 60 * 1000 || FILES.size > 50) {
      try { fs.unlinkSync(v.path); } catch { /* gone */ }
      FILES.delete(k);
    }
  }
}, 10 * 60 * 1000).unref();

const STREAM_SECRET = (process.env.SIGNED_STREAM_SECRET || '').trim();
const TOKEN_TTL_MS = 30 * 60 * 1000;

const UA_DESKTOP =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

// Media hosts that may be proxied freely (TikTok / Instagram CDNs).
const MEDIA_HOST_SUFFIXES = [
  'tiktokcdn.com', 'tiktokcdn-us.com', 'tiktokcdn-eu.com', 'tiktokcdn-in.com',
  'tiktokcdn-sg.com', 'tiktokcdn-hk.com', 'tiktokcdn-ae.com', 'tiktokv.com',
  'muscdn.com', 'byteoversea.com', 'ibytedtos.com', 'cdninstagram.com', 'fbcdn.net',
];

/* ------------------------------ helpers ------------------------------ */

const BSLASH = 92; // backslash code point — never typed literally

function decodeJsonEscapes(s) {
  let out = '';
  let i = 0;
  const n = s.length;
  while (i < n) {
    const c = s.charCodeAt(i);
    if (c === BSLASH && i + 5 < n && s[i + 1] === 'u') {
      const hex = s.slice(i + 2, i + 6);
      if (/^[0-9a-fA-F]{4}$/.test(hex)) {
        out += String.fromCharCode(parseInt(hex, 16));
        i += 6;
        continue;
      }
    }
    if (c === BSLASH && i + 1 < n && s[i + 1] === '/') {
      out += '/';
      i += 2;
      continue;
    }
    if (c === BSLASH && i + 1 < n && s[i + 1] === 'u') {
      // already handled above; safety net
    }
    out += s[i];
    i += 1;
  }
  return out;
}

function isForbiddenFilenameCode(c) {
  // / \ : * ? " < > | and control characters
  return (
    c === 47 || c === BSLASH || c === 58 || c === 42 || c === 63 ||
    c === 34 || c === 60 || c === 62 || c === 124 || c < 32
  );
}

function sanitizeFilename(name) {
  let cleaned = '';
  for (const ch of (name || '')) {
    if (!isForbiddenFilenameCode(ch.charCodeAt(0))) cleaned += ch;
  }
  cleaned = cleaned.trim();
  while (cleaned.length && cleaned.charCodeAt(0) === 46) cleaned = cleaned.slice(1); // leading dots
  while (cleaned.length && cleaned.charCodeAt(cleaned.length - 1) === 46) cleaned = cleaned.slice(0, -1); // trailing dots
  cleaned = cleaned.slice(0, 90);
  return (cleaned || 'video') + '.mp4';
}

function toAsciiOnly(s) {
  let out = '';
  for (const ch of s) {
    const c = ch.charCodeAt(0);
    out += c >= 32 && c <= 126 && c !== 34 ? ch : '_';
  }
  return out;
}

function runProc(cmd, args, opts) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 90000, maxBuffer: 64 * 1024 * 1024, windowsHide: true, ...opts }, (err, stdout, stderr) => {
      if (err) {
        err.stderr = String(stderr || '');
        return reject(err);
      }
      resolve(String(stdout || ''));
    });
  });
}

function json(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error('body_too_large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/* ------------------------------- cache ------------------------------- */

const metaCache = new Map(); // url -> { at, value }

function cacheGet(key) {
  const hit = metaCache.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    metaCache.delete(key);
    return undefined;
  }
  return hit.value;
}

function cacheSet(key, value) {
  if (metaCache.size >= CACHE_MAX) {
    const oldest = metaCache.keys().next().value;
    metaCache.delete(oldest);
  }
  metaCache.set(key, { at: Date.now(), value });
}

/* ------------------------------ parsing ------------------------------ */

function normalizeUrl(raw) {
  let s = (raw || '').trim();
  if (!s) return null;
  const lower = s.toLowerCase();
  if (!lower.startsWith('http://') && !lower.startsWith('https://')) s = 'https://' + s;
  try {
    return new URL(s);
  } catch {
    return null;
  }
}

function bareHost(hostname) {
  let h = String(hostname || '').toLowerCase();
  for (const prefix of ['www.', 'm.', 'vm.', 'vt.']) {
    if (h.startsWith(prefix)) {
      h = h.slice(prefix.length);
      break;
    }
  }
  return h;
}

function hostOf(rawUrl) {
  const u = normalizeUrl(rawUrl);
  return u ? bareHost(u.hostname) : '';
}

function isTikTok(rawUrl) {
  const h = hostOf(rawUrl);
  return h === 'tiktok.com' || h.endsWith('.tiktok.com');
}

function isInstagram(rawUrl) {
  const h = hostOf(rawUrl);
  return h === 'instagram.com' || h.endsWith('.instagram.com') || h === 'instagr.am';
}

function shortcodeFromInstagramUrl(u) {
  const seg = u.pathname.split('/').filter(Boolean);
  for (let i = 0; i < seg.length - 1; i += 1) {
    if (seg[i] === 'p' || seg[i] === 'reel' || seg[i] === 'reels' || seg[i] === 'tv') {
      return seg[i + 1] || '';
    }
  }
  return '';
}

/* ----------------------------- rate limit ---------------------------- */

const hits = new Map(); // ip:minute -> count

function rateLimited(ip) {
  const minute = Math.floor(Date.now() / 60000);
  const key = ip + ':' + minute;
  const n = (hits.get(key) || 0) + 1;
  if (n === 1) {
    hits.set(key, 1);
    if (hits.size > 5000) {
      for (const k of hits.keys()) {
        if (!k.endsWith(':' + minute) && !k.endsWith(':' + (minute - 1))) hits.delete(k);
      }
    }
  } else {
    hits.set(key, n);
  }
  return n > 40;
}

/* --------------------------- TikTok engine --------------------------- */

async function resolveTikTok(inputUrl) {
  const api = 'https://tikwm.com/api/?url=' + encodeURIComponent(inputUrl);
  const resp = await fetch(api, {
    headers: { 'user-agent': UA_DESKTOP, accept: 'application/json, text/plain, */*' },
    signal: AbortSignal.timeout(20000),
  });
  if (!resp.ok) throw new Error('tikwm_http_' + resp.status);
  const body = await resp.json();
  if (!body || body.code !== 0 || !body.data) throw new Error('video_unavailable');
  const d = body.data;
  return {
    ok: true,
    provider: 'tiktok',
    id: d.id || '',
    title: d.title || '',
    duration: Number(d.duration) || 0,
    author: { name: (d.author && (d.author.nickname || d.author.unique_id)) || '' },
    cover: d.cover || '',
    url: d.play || d.wmplay || '',
    wmUrl: d.wmplay && d.wmplay !== d.play ? d.wmplay : '',
    sourceUrl: inputUrl,
  };
}

/* ------------------------- Instagram engine -------------------------- */

// Extract a JSON-embedded field value from raw HTML without regex escapes:
// finds  "field":"VALUE"  with optional whitespace around the colon.
function extractJsonField(html, field) {
  const marker = '"' + field + '"';
  let idx = html.indexOf(marker);
  while (idx !== -1) {
    const after = idx + marker.length;
    const colon = html.indexOf(':', after);
    if (colon === -1 || colon - after > 8) return '';
    const open = html.indexOf('"', colon + 1);
    if (open === -1) return '';
    const close = html.indexOf('"', open + 1);
    if (close === -1) return '';
    return html.slice(open + 1, close);
  }
  return '';
}

function extractMetaContent(html, property) {
  const marker = 'property="' + property + '"';
  let idx = html.indexOf(marker);
  if (idx === -1) {
    // some pages put content before property
    const alt = 'content="';
    const k2 = html.indexOf('property="' + property + '"');
    idx = k2;
  }
  const contentMark = 'content="';
  const start = html.indexOf(contentMark, idx === -1 ? 0 : idx);
  if (start === -1) return '';
  const end = html.indexOf('"', start + contentMark.length);
  if (end === -1) return '';
  return html.slice(start + contentMark.length, end);
}

async function resolveInstagram(inputUrl) {
  let pageUrl = inputUrl;
  const shortcode = shortcodeFromInstagramUrl(new URL(pageUrl));
  if (shortcode) pageUrl = 'https://www.instagram.com/p/' + shortcode + '/';

  const headers = {
    'user-agent': UA_DESKTOP,
    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'accept-language': 'en-US,en;q=0.9',
  };
  const session = (process.env.IG_SESSIONID || '').trim();
  if (session) headers.cookie = 'sessionid=' + session;

  const page = await fetch(pageUrl, {
    headers,
    redirect: 'follow',
    signal: AbortSignal.timeout(20000),
  });

  const finalUrl = new URL(page.url);
  const finalHost = bareHost(finalUrl.hostname);
  const html = await page.text();

  if (finalUrl.pathname.indexOf('/accounts/login') !== -1) throw new Error('instagram_login');

  let videoUrl = decodeJsonEscapes(extractJsonField(html, 'video_url'));
  if (!videoUrl || !videoUrl.startsWith('https://')) {
    const og = extractMetaContent(html, 'og:video');
    const ogSec = extractMetaContent(html, 'og:video:secure_url');
    videoUrl = (ogSec || og || '').trim();
  }

  if (!videoUrl || !videoUrl.startsWith('https://')) {
    throw new Error(finalHost.includes('instagram') || !page.ok ? 'instagram_blocked' : 'video_unavailable');
  }

  const title = decodeJsonEscapes(extractMetaContent(html, 'og:title')).trim() || 'Instagram video';
  const cover = decodeJsonEscapes(extractJsonField(html, 'display_url')) || decodeJsonEscapes(extractMetaContent(html, 'og:image'));
  const author = decodeJsonEscapes(extractJsonField(html, 'username'));

  return {
    ok: true,
    provider: 'instagram',
    id: shortcode || '',
    title,
    duration: 0,
    author: { name: author },
    cover: cover || '',
    url: videoUrl,
    wmUrl: '',
    sourceUrl: inputUrl,
  };
}

/* ------------------------- Universal engine (yt-dlp) ----------------- */

let ytdlpReady = null;

function ytdlpCommand() {
  const bin = process.env.YTDLP_BIN;
  if (bin) return { cmd: bin, isBin: true };
  return { cmd: process.env.YTDLP_PYTHON || 'python', isBin: false };
}

async function ensureYtdlp() {
  if (ytdlpReady !== null) return ytdlpReady;
  const { cmd, isBin } = ytdlpCommand();
  const args = isBin ? ['--version'] : ['-m', 'yt_dlp', '--version'];
  const opts = isBin ? {} : { env: { ...process.env, PYTHONPATH: VENDOR_YTDLP } };
  try {
    if (!isBin && !fs.existsSync(path.join(VENDOR_YTDLP, 'yt_dlp'))) throw new Error('no vendor module');
    await runProc(cmd, args, opts);
    ytdlpReady = true;
  } catch {
    ytdlpReady = false;
  }
  return ytdlpReady;
}

function pickBestProgressive(info) {
  const list = Array.isArray(info.formats) ? info.formats : [];
  const videos = list.filter(
    (f) =>
      f.url &&
      f.url.startsWith('https://') &&
      f.vcodec && f.vcodec !== 'none' &&
      f.acodec && f.acodec !== 'none'
  );
  videos.sort((a, b) => (b.height || 0) - (a.height || 0) || (b.tbr || 0) - (a.tbr || 0));
  if (videos.length) return videos[0];
  if (
    info.url && info.url.startsWith('https://') &&
    info.vcodec && info.vcodec !== 'none' &&
    info.acodec && info.acodec !== 'none'
  ) {
    return info;
  }
  return null;
}

function extractorOf(info) {
  return info.extractor_key || (info.extractor ? String(info.extractor).split(':')[0] : '') || '';
}

async function resolveGeneric(inputUrl) {
  if (!(await ensureYtdlp())) throw new Error('ytdlp_missing');

  const { cmd, isBin } = ytdlpCommand();
  const baseArgs = ['--no-warnings', '--no-playlist', '--no-check-certificates'];
  const opts = isBin ? {} : { env: { ...process.env, PYTHONPATH: VENDOR_YTDLP } };
  const args = isBin ? [...baseArgs, '-J', '--', inputUrl] : ['-m', 'yt_dlp', ...baseArgs, '-J', '--', inputUrl];

  let stdout;
  try {
    stdout = await runProc(cmd, args, opts);
  } catch (err) {
    const stderr = String(err.stderr || '');
    if (/Unsupported URL|no supported extractor|is not a URL/i.test(stderr)) throw new Error('no_extractor');
    if (/playlist|is part of a playlist/i.test(stderr)) throw new Error('playlist');
    if (/timed out/i.test(stderr)) throw new Error('video_unavailable');
    const e = new Error('video_unavailable');
    e.detail = stderr.slice(0, 300);
    throw e;
  }

  let info;
  try {
    info = JSON.parse(stdout);
  } catch {
    throw new Error('video_unavailable');
  }
  if (!info || info._type === 'playlist' || Array.isArray(info.entries)) throw new Error('playlist');

  const meta = {
    ok: true,
    provider: 'generic',
    id: info.id || '',
    title: info.title || info.fulltitle || 'Video',
    duration: Number(info.duration) || 0,
    author: { name: info.uploader || info.uploader_id || info.channel || '' },
    cover: info.thumbnail || '',
    url: '',
    wmUrl: '',
    extractor: extractorOf(info),
    sourceUrl: info.webpage_url || inputUrl,
  };

  const chosen = pickBestProgressive(info);
  if (chosen) {
    meta.url = chosen.url;
  } else {
    // Split audio/video streams (typical for YouTube) — download best quality
    // and merge with ffmpeg, then serve once via /stream?k=<token>.
    const fileToken = await mergeDownload(inputUrl);
    if (!fileToken) throw new Error('merge_needed');
    meta.fileToken = fileToken;
  }
  return meta;
}

async function mergeDownload(inputUrl) {
  if (!(await ensureYtdlp())) throw new Error('ytdlp_missing');
  const token = crypto.randomBytes(12).toString('hex');
  const prefix = path.join(TMP_DIR, token);
  const { cmd, isBin } = ytdlpCommand();
  const opts = isBin ? {} : { env: { ...process.env, PYTHONPATH: VENDOR_YTDLP } };
  const baseArgs = ['--no-warnings', '--no-playlist', '--no-check-certificates', '--quiet', '--no-progress'];
  const args = isBin
    ? [...baseArgs, '-f', 'bv*+ba/b', '--merge-output-format', 'mp4', '-o', prefix + '.%(ext)s', '--', inputUrl]
    : ['-m', 'yt_dlp', ...baseArgs, '-f', 'bv*+ba/b', '--merge-output-format', 'mp4', '-o', prefix + '.%(ext)s', '--', inputUrl];

  try {
    await runProc(cmd, args, { ...opts, timeout: 600000 });
  } catch (err) {
    const stderr = String(err.stderr || '');
    if (/ffmpeg|postprocess|merge/i.test(stderr) && !/download/i.test(stderr)) throw new Error('merge_needed');
    if (/Unsupported URL/i.test(stderr)) throw new Error('no_extractor');
    const e = new Error('video_unavailable');
    e.detail = stderr.slice(0, 300);
    throw e;
  }

  let produced = '';
  try {
    const candidates = fs
      .readdirSync(TMP_DIR)
      .filter((f) => f.startsWith(token + '.') && !f.endsWith('.part'))
      .map((f) => ({ full: path.join(TMP_DIR, f), m: fs.statSync(path.join(TMP_DIR, f)).mtimeMs }))
      .sort((a, b) => b.m - a.m);
    if (candidates.length) produced = candidates[0].full;
  } catch { /* readdir race */ }
  if (!produced) return '';

  FILES.set(token, { path: produced, at: Date.now() });
  return token;
}

async function resolveVideo(inputUrl) {
  if (isTikTok(inputUrl)) return resolveTikTok(inputUrl);
  if (isInstagram(inputUrl)) return resolveInstagram(inputUrl);
  return resolveGeneric(inputUrl);
}

/* --------------------------- stream: remote -------------------------- */

function hostAllowed(hostname) {
  const h = String(hostname || '').toLowerCase();
  return MEDIA_HOST_SUFFIXES.some((s) => h === s || h.endsWith('.' + s));
}

function signFor(urlValue) {
  if (!STREAM_SECRET) return '';
  const exp = Date.now() + TOKEN_TTL_MS;
  const sig = crypto
    .createHmac('sha256', STREAM_SECRET)
    .update(urlValue + '|' + exp)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return sig + '.' + exp;
}

function tokenValid(urlValue, token) {
  if (!STREAM_SECRET || !token) return false;
  const dot = token.lastIndexOf('.');
  if (dot < 1) return false;
  const sig = token.slice(0, dot);
  const exp = Number(token.slice(dot + 1));
  if (!exp || exp < Date.now()) return false;
  const expected = crypto
    .createHmac('sha256', STREAM_SECRET)
    .update(urlValue + '|' + exp)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function stripTrailingExt(name, ext) {
  let base = String(name || 'video');
  const e = String(ext || '.mp4');
  if (e && base.toLowerCase().endsWith(e)) base = base.slice(0, base.length - e.length);
  return base || 'video';
}

async function handleStream(req, res, url) {
  const target = url.searchParams.get('u') || '';
  const name = url.searchParams.get('name') || '';
  const token = url.searchParams.get('t') || '';
  const parsed = normalizeUrl(target);
  const okHost = parsed && parsed.protocol === 'https:' && (hostAllowed(parsed.hostname) || tokenValid(parsed.toString(), token));
  if (!parsed || !okHost) {
    return json(res, 400, { ok: false, code: 'bad_stream_url', message: 'Blocked URL' });
  }
  try {
    const upstream = await fetch(parsed.toString(), {
      headers: {
        'user-agent': UA_DESKTOP,
        accept: 'video/mp4,video/*,*/*',
        referer: parsed.hostname.includes('tiktok') ? 'https://www.tiktok.com/' : 'https://' + parsed.hostname + '/',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(30000),
    });
    if (!upstream.ok || !upstream.body) {
      return json(res, 502, { ok: false, code: 'upstream_' + upstream.status, message: 'Media fetch failed' });
    }
    const finalName = sanitizeFilename(stripTrailingExt(name, '.mp4'));
    const ascii = toAsciiOnly(finalName);
    res.writeHead(200, {
      'Content-Type': upstream.headers.get('content-type') || 'video/mp4',
      'Content-Length': upstream.headers.get('content-length') || '',
      'Content-Disposition': 'attachment; filename="' + ascii + '"; filename*=UTF-8' + encodeURIComponent(finalName),
      'Cache-Control': 'private, max-age=3600',
      'Access-Control-Allow-Origin': '*',
    });
    Readable.fromWeb(upstream.body).pipe(res);
  } catch (err) {
    json(res, 502, { ok: false, code: 'upstream_error', message: String((err && err.message) || err) });
  }
}

/* ---------------------------- stream: local -------------------------- */

function streamLocalFile(res, url) {
  const token = url.searchParams.get('k') || '';
  const entry = FILES.get(token);
  if (!entry) return json(res, 410, { ok: false, code: 'file_gone', message: 'File expired — run the download again' });
  const ext = (path.extname(entry.path) || '.mp4').toLowerCase();
  const type = MIME[ext] || 'video/mp4';
  const finalName = sanitizeFilename(stripTrailingExt(url.searchParams.get('name') || 'video', ext));
  const ascii = toAsciiOnly(finalName);

  fs.stat(entry.path, (statErr, st) => {
    if (statErr || !st.isFile()) {
      FILES.delete(token);
      return json(res, 410, { ok: false, code: 'file_gone', message: 'File expired — run the download again' });
    }
    res.writeHead(200, {
      'Content-Type': type,
      'Content-Length': st.size,
      'Content-Disposition': 'attachment; filename="' + ascii + '"; filename*=UTF-8' + encodeURIComponent(finalName),
      'Cache-Control': 'private, max-age=3600',
      'Access-Control-Allow-Origin': '*',
    });
    const stream = fs.createReadStream(entry.path);
    stream.pipe(res);
    res.on('close', () => {
      FILES.delete(token);
      fs.unlink(entry.path, () => {});
    });
  });
}

/* ---------------------------- static files ---------------------------- */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

function serveStatic(req, res, url) {
  let pathname = '';
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    pathname = url.pathname;
  }
  if (pathname === '/') pathname = '/index.html';
  const filePath = path.normalize(path.join(PUBLIC_DIR, pathname));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (url.pathname === '/favicon.ico') {
        res.writeHead(204);
        return res.end();
      }
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('404 — Not found');
    }
    const type = MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    let out = data;
    if (type.indexOf('text') === 0 || filePath.endsWith('.xml')) {
      const text = data.toString('utf8');
      if (text.indexOf(SITE_TOKEN) !== -1) out = Buffer.from(text.split(SITE_TOKEN).join(SITE_URL), 'utf8');
    }
    res.writeHead(200, {
      'Content-Type': type,
      'Content-Length': out.length,
      'Cache-Control': pathname.startsWith('/assets/') ? 'public, max-age=86400' : 'no-cache',
    });
    res.end(out);
  });
}

/* ------------------------------- server ------------------------------- */

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const ip = req.socket.remoteAddress || 'unknown';

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  try {
    if (url.pathname === '/api/ping') {
      return json(res, 200, {
        ok: true,
        name: 'download-video',
        engines: ['tiktok', 'instagram', 'generic(yt-dlp)'],
        ytdlp: (await ensureYtdlp()) ? 'ready' : 'missing',
        proxyArbitrary: STREAM_SECRET ? 'signed' : 'off',
      });
    }

    if (url.pathname === '/api/download' && req.method === 'POST') {
      if (rateLimited(ip)) return json(res, 429, { ok: false, code: 'rate_limited', message: 'Too many requests' });
      const body = JSON.parse(await readBody(req));
      const inputUrl = (body && body.url) || '';
      const parsed = normalizeUrl(inputUrl);
      if (!parsed) {
        return json(res, 400, { ok: false, code: 'unsupported_provider', message: 'Provide a valid video URL' });
      }

      const cacheKey = crypto.createHash('sha1').update(inputUrl).digest('hex');
      const cached = cacheGet(cacheKey);
      if (cached) return json(res, 200, cached);

      let meta;
      try {
        meta = await resolveVideo(inputUrl);
      } catch (err) {
        const code = (err && err.message) || 'unknown';
        const status =
          code === 'instagram_blocked' || code === 'instagram_login' || code === 'ytdlp_missing' || code === 'merge_needed'
            ? 502
            : code === 'video_unavailable'
              ? 404
              : code === 'playlist'
                ? 400
                : 500;
        const friendly = {
          video_unavailable: 'Video not found — it may be private, region-locked, or removed',
          instagram_blocked:
            'Instagram blocked fetching this video from the server (public posts only; cloud IPs are often blocked). Retry later or set IG_SESSIONID.',
          instagram_login: 'Instagram redirected to a login wall. Set IG_SESSIONID (see README) or host on a residential IP.',
          no_extractor: 'This site is not supported by the download engine, or the page is protected.',
          ytdlp_missing: 'The universal engine (yt-dlp) is not installed on the server. See the README.',
          merge_needed: 'This video only exists as separate audio/video streams; enable ffmpeg merging on the server for it.',
          playlist: 'This looks like a playlist or series — send a single video URL.',
        }[code] || 'Could not resolve this video';
        const message = err.detail ? friendly + ' — ' + err.detail : friendly;
        return json(res, status, { ok: false, code, message, status: err.status });
      }

      let proxiable = false;
      if (meta.url) {
        proxiable = hostAllowed(new URL(meta.url).hostname) || meta.provider !== 'generic';
        if (!proxiable && STREAM_SECRET) meta.streamToken = signFor(meta.url);
      }
      meta.proxiable = proxiable;

      // merged files are single-use; never serve a stale token from cache
      if (!meta.fileToken) cacheSet(cacheKey, meta);
      return json(res, 200, meta);
    }

    if (url.pathname === '/stream' && req.method === 'GET') {
      if (url.searchParams.get('k')) return streamLocalFile(res, url);
      return handleStream(req, res, url);
    }

    if (req.method === 'GET' || req.method === 'HEAD') {
      return serveStatic(req, res, url);
    }

    json(res, 405, { ok: false, message: 'Method not allowed' });
  } catch (err) {
    json(res, 500, { ok: false, code: 'server_error', message: String((err && err.message) || err) });
  }
});

server.listen(PORT, () => {
  const addr = server.address();
  const actual = addr && typeof addr === 'object' ? addr.port : PORT;
  console.log('Download Video running → http://localhost:' + actual);
  console.log('Engines: TikTok (no watermark) · Instagram · universal (yt-dlp) — free, no API keys');
});
