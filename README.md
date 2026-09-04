# Download Video ⬇

موقع صفحة واحدة لتحميل أي فيديو من الإنترنت — **بدون علامة مائية، مجاني 100%، بدون مفاتيح API مدفوعة**.

A single-page universal video downloader — TikTok, Instagram, YouTube, Facebook, X, Reddit, Vimeo, SoundCloud, Twitch and ~1,800 more sites. No watermark, no sign-up, no paid API keys. Zero npm dependencies.

## التشغيل محلياً / Run locally

```bash
# (مرة واحدة) ثبّت المحرك العام yt-dlp داخل المشروع — One-time: install the universal engine
python -m pip install --target vendor/ytdlp yt-dlp

# شغّل الخادم / Run the server
node server.js
# افتح / Open:  http://localhost:8080
```

لا حاجة لـ `npm install` إطلاقاً. (تتطلب Python مع ffmpeg على الخادم لدمج ملفات يوتيوب المقسّمة صوت/صورة.)

## كيف يعمل / How it works

| المنصة | الطريقة | التكلفة |
|---|---|---|
| TikTok | public endpoint `tikwm.com` → النسخة النظيفة بدون علامة مائية (`data.play`) | مجاني |
| Instagram | جلب صفحة المنشور العام واستخراج رابط الفيديو الأصلي (بدون علامة مائية) | مجاني |
| أي موقع آخر (YouTube, Facebook, X…) | محرك **yt-dlp** مفتوح المصدر يدعم ~1800 موقعاً. إن كان الفيديو مقسّماً (يوتيوب غالباً) يُحمَّل بأفضل جودة ويُدمج بـ ffmpeg ثم يُسلَّم مرة واحدة | مجاني |

- `POST /api/download` — يكتشف المنصة ويعيد بيانات الفيديو ورابط الملف.
- `GET /stream` — وسيط آمن: نطاقات مسموحة مسبقاً، أو رابط موقّع (HMAC) للملفات العامة، أو ملف مدمج يُسلم مرة واحدة ثم يُحذف.
- تخزين مؤقت 15 دقيقة + حد طلبات بسيط.

## خيارات البيئة / Environment variables

| متغير | الوظيفة |
|---|---|
| `PORT` | منفذ الخادم (افتراضي 8080) |
| `SITE_URL` | نطاقك العام مثل `https://example.com/` — يُستبدل تلقائياً في canonical و sitemap.xml و robots.txt (افتراضي `https://download-video.example/`) |
| `IG_SESSIONID` | اختياري: كعكة `sessionid` من حسابك المسجّل في إنستغرام — تجعل تحميل إنستغرام يعمل من خوادم الاستضافة المحجوبة |
| `SIGNED_STREAM_SECRET` | اختياري: سرّ لتوقيع وساطة ملفات أي نطاق (اسم ملف نظيف بدل التحميل المباشر) |
| `YTDLP_BIN` | مسار ثنائي yt-dlp جاهز إن لم تستخدم `vendor/ytdlp` |
| `YTDLP_PYTHON` | أمر بايثون المستخدم (افتراضي `python`) |

## النشر المجاني / Free deployment

**الخيار 1 — سيرفر Node مجاني (يُفضَّل):** Render / Railway / Fly.io / Oracle Always Free / أي VPS.
`npm start` أو `node server.js`، مع تثبيت yt-dlp في `vendor/` (خطوة pip أعلاه) — أو أضفها في build command.

**الخيار 2 — استضافة ثابتة فقط (GitHub Pages / Netlify / Cloudflare Pages):** ارفع مجلد `public/`.
روابط تيك توك تعمل مباشرة من المتصفح بدون خادم؛ لكن إنستغرام والمواقع الأخرى ودمج الجودة العالية تتطلب الخادم.

## ملاحظات صادقة / Honest limitations

- الفيديوهات **الخاصة، المحذوفة، الخاضعة لتسجيل دخول أو قيود مناطقية** لا يمكن تحميلها — قيود المنصات وليست قيود الموقع.
- إنستغرام يحجب غالباً عناوين IP الخاصة بالاستضافة (رسالة “Instagram blocked”): الحل `IG_SESSIONID` أو استضافة على IP سكني.
- المنصات تغيّر حماياتها باستمرار (ومنها tikwm) — الكود مقسوم في `server.js` ليسهل استبدال أي مزوّد.
- التحميل للاستخدام الشخصي فقط؛ رسمياً تخالف هذه الأدوات شروط استخدام المنصات (ToS). احترم حقوق النشر ولا تعِد نشر محتوى الآخرين.

## الإعلانات ومحركات البحث / Ads & SEO

- **مواضع الإعلانات** في `public/index.html`: ثلاث مساحات واضحة (adTop فوق الخطوات، adMid متوسط 300x250 بين الخطوات والأسئلة، adBottom فوق التذييل) — أفضل المواضع بعد لحظة الاستخدام (بعد الضغط على تحميل وأثناء التمرير) وتلتزم بسياسات AdSense. فعّل الإعلانات باتباع التعليقات داخل الصفحة، وضع `ads.txt` بمعرّف ناشرك في جذر النطاق.
- **سياسة الخصوصية**: صفحة `/privacy.html` مطلوبة للموافقة على AdSense وتشرح الكوكيز والإعلانات بالعربية والإنجليزية.
- **SEO جاهز**: عنوان ووصف وcanonical و OpenGraph، بيانات FAQ منظمة (FAQPage schema)، `robots.txt` و `sitemap.xml` — كلها تعتمد `SITE_URL`. بعد النشر سجّل الموقع في Google Search Console وارفع sitemap.

## الملفات / Files

```
server.js          خادم Node بدون اعتماديات (API + stream + دمج ffmpeg + استضافة)
public/index.html  الصفحة الرئيسية (عربي افتراضياً + English toggle) + مساحات الإعلانات و SEO
public/styles.css
public/app.js      منطق الواجهة والترجمة
public/privacy.html  سياسة الخصوصية والكوكيز (مطلوبة لـ AdSense)
public/robots.txt / sitemap.xml / ads.txt
vendor/ytdlp/      yt-dlp المثبّت محلياً (يُنشأ بأمر pip أعلاه)
```
