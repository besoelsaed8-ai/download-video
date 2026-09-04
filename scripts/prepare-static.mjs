#!/usr/bin/env node
// يجهّز مجلد dist/ للنشر الثابت (Netlify / GitHub Pages / Cloudflare Pages).
// الاستخدام:
//   SITE_URL=https://example.com/ node scripts/prepare-static.mjs
// ملاحظة: النسخة الثابتة تدعم روابط تيك توك فقط من المتصفح؛
// إنستغرام والمواقع الأخرى والدمج عالي الجودة تحتاج الخادم (Render).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const src = path.join(root, 'public');
const out = path.join(root, 'dist');
const siteUrl = (process.env.SITE_URL || 'https://download-video.example/').trim();
const token = '__SITE_URL__';

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

let files = 0;
function copyDir(from, to) {
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const s = path.join(from, entry.name);
    const d = path.join(to, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(d, { recursive: true });
      copyDir(s, d);
    } else {
      let buf = fs.readFileSync(s);
      const text = buf.toString('utf8');
      if (text.includes(token)) buf = Buffer.from(text.split(token).join(siteUrl), 'utf8');
      fs.writeFileSync(d, buf);
      files += 1;
    }
  }
}
copyDir(src, out);
console.log(`dist/ ready (${files} files) with SITE_URL = ${siteUrl}`);
