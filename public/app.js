/* Download Video front end — vanilla JS, no dependencies. */
(function () {
  'use strict';

  var $ = function (s) { return document.querySelector(s); };

  var STRINGS = {
    ar: {
      'brand.tag': 'حمّل واحفظ مجاناً',
      'hero.title': 'حمّل أي فيديو من الإنترنت — بدون علامة مائية',
      'hero.sub': 'تيك توك، إنستغرام، يوتيوب، فيسبوك، إكس وغيرها… الصق الرابط واحفظ الفيديو بجودته الأصلية — مجاناً وبدون تسجيل.',
      'input.ph': 'https://www.youtube.com/watch?v=… أو أي رابط فيديو آخر',
      'paste.title': 'لصق من الحافظة',
      go: 'تحميل / Download',
      'hero.hint': 'يدعم آلاف المواقع: TikTok · Instagram · YouTube · Facebook · X والمزيد',
      'loading.working': 'جاري جلب الفيديو…',
      'loading.long': 'بعض المواقع تستغرق وقتاً أطول — نعمل على ذلك…',
      'loading.done': 'تم! جهّزنا لك الفيديو 👇',
      'error.title': 'حدث خطأ',
      'error.retry': 'حاول مجدداً',
      'result.dl': 'تحميل بدون علامة مائية',
      'result.dlAny': 'تحميل الفيديو',
      'result.wm': 'تحميل بالعلامة المائية',
      'result.orig': 'فتح الفيديو الأصلي ↗',
      'result.directHint': 'يُفتح الملف في تبويب جديد — على الكمبيوتر اضغط بزر الفأرة الأيمن ثم «حفظ باسم»، وعلى الجوال اضغط مطولاً ثم «تنزيل».',
      'step1.t': 'انسخ الرابط', 'step1.d': 'من التطبيق أو الموقع: اضغط «مشاركة» ثم «نسخ الرابط».',
      'step2.t': 'الصق الرابط', 'step2.d': 'الصقه في المربع بالأعلى — يعمل مع الروابط الطويلة والقصيرة.',
      'step3.t': 'حمّل واحفظ', 'step3.d': 'اضغط «تحميل» وسيُحفظ الفيديو في جهازك — بدون علامة مائية.',
      'faq.title': 'أسئلة شائعة',
      'faq1.q': 'هل الموقع مجاني فعلاً؟', 'faq1.a': 'نعم. مجاني بالكامل، بدون تسجيل، وبدون الحاجة لتنزيل أي برنامج. لا نطلب بطاقات ولا بيانات شخصية.',
      'faq2.q': 'كيف تُزال العلامة المائية من تيك توك؟', 'faq2.a': 'نستخدم نسخة الفيديو النظيفة التي تقدمها المنصة نفسها للحسابات العامة، فنحصل على الملف الأصلي بدون شعار تيك توك وبدون أي تلاعب في الجودة.',
      'faq3.q': 'لماذا لا يعمل الرابط أحياناً؟', 'faq3.a': 'الفيديوهات الخاصة أو المحذوفة لا يمكن تحميلها. كما تفرض بعض المنصات حماية (تسجيل دخول، قيود مناطقية، أو تقسيم الصوت عن الصورة) — وفي هذه الحالة لا يمكن توفير ملف واحد.',
      'faq4.q': 'هل التحميل قانوني؟', 'faq4.a': 'احفظ المحتوى للاستخدام الشخصي فقط، واحترم حقوق النشر ولا تعِد نشر فيديوهات الآخرين دون إذن. الموقع لا يستضيف أي محتوى.',
      'faq5.q': 'هل تدعم يوتيوب وفيسبوك والمواقع الأخرى؟', 'faq5.a': 'نعم — نستخدم محرك yt-dlp مفتوح المصدر الذي يدعم آلاف المواقع. بعض المنصات تفرض تسجيل دخول أو حماية إقليمية أو تقطيع الصوت عن الصورة، فلا يمكن تحميل تلك الفيديوهات كملف واحد.',
      'footer.tag': 'مشروع مجاني مفتوح المصدر لتحميل الفيديو',
      'footer.fine': 'لا ننتمي إلى أي منصة. لا نستضيف أي محتوى. جميع الحقوق لأصحابها.',
      'ad.label': 'مساحة إعلانية · Google AdSense',
      'dl.started': 'بدأ التحميل ✓ — ابحث عن الملف في مجلد التنزيلات على جهازك.',
      'privacy.link': 'سياسة الخصوصية والكوكيز',
      'seo.aboutTitle': 'حمّل الفيديو الذي تريده — بسهولة وبجودة عالية',
      'seo.p1': 'موقع Download Video يتيح لك تحميل فيديو تيك توك بدون علامة مائية بجودة عالية HD، وكذلك تحميل فيديو انستقرام (ريلز) وفيديوهات يوتيوب وفيسبوك وتويتر — انسخ رابط الفيديو والصقه في الخانة أعلاه ثم اضغط زر التحميل.',
      'seo.p2': 'خدمة مجانية بالكامل، بدون تسجيل وبدون تثبيت برامج، وتعمل على الكمبيوتر والجوال. لا نخزن بياناتك ولا نستضيف أي محتوى؛ الملف يصل إليك مباشرة من المنصة الأصلية.',
      'err.invalid': 'الرابط غير صالح. الصق رابط فيديو كاملاً يبدأ بـ http:// أو https://',
      'err.unsupported_provider': 'لم نتمكن من معالجة هذا الرابط.',
      'err.video_unavailable': 'لم نعثر على الفيديو. ربما حُذف، أو أصبح خاصاً، أو أنه محمي بتسجيل دخول أو قيود منطقة.',
      'err.instagram_blocked': 'إنستغرام منع الوصول لهذا الفيديو من الخادم. تأكد أن المنشور عام (وليس خاصاً) — بعض خوادم الاستضافة محجوبة من إنستغرام، فجرّب مرة أخرى لاحقاً أو جرّب رابطاً آخر.',
      'err.no_extractor': 'هذا الموقع غير مدعوم من محرك التحميل، أو أن الصفحة محمية. تأكد من أن الرابط يؤدي مباشرة إلى فيديو.',
      'err.ytdlp_missing': 'محرك التحميل العام (yt-dlp) غير مثبت على الخادم. ثبّته لتفعيل التحميل من أي موقع (انظر README).',
      'err.merge_needed': 'هذا الفيديو متاح فقط كصوت وصورة منفصلين، ولا يمكن جمعهما في ملف واحد على هذا الخادم.',
      'err.playlist': 'هذا رابط قائمة تشغيل أو سلسلة. أرسل رابط فيديو واحداً فقط.',
      'err.rate_limited': 'طلبات كثيرة جداً في وقت قصير. انتظر دقيقة ثم أعد المحاولة.',
      'err.network': 'تعذر الوصول إلى الخادم. تحقق من اتصالك بالإنترنت وحاول مجدداً.',
      'err.server_error': 'حدث خطأ غير متوقع من الخادم. حاول مرة أخرى بعد لحظات.',
      'err.upstream_error': 'فشل جلب الملف من المنصة نفسها. حاول مجدداً بعد قليل.',
      'err.backend': 'هذه النسخة (استضافة ثابتة) تدعم روابط تيك توك فقط. شغّل الخادم (node server.js) لتفعيل التحميل من أي موقع.',
      'badge.tiktok': 'تيك توك',
      'badge.instagram': 'إنستغرام',
      'fallback.title': 'فيديو بدون عنوان',
      'fallback.author': 'مؤلف غير معروف',
      'video.title': 'فيديو'
    },
    en: {
      'brand.tag': 'Download & save, free',
      'hero.title': 'Download any video from the internet — no watermark',
      'hero.sub': 'TikTok, Instagram, YouTube, Facebook, X and more… paste the link and save the video at its original quality — free, no sign-up.',
      'input.ph': 'https://www.youtube.com/watch?v=… or any other video link',
      'paste.title': 'Paste from clipboard',
      go: 'Download',
      'hero.hint': 'Thousands of sites supported: TikTok · Instagram · YouTube · Facebook · X and more',
      'loading.working': 'Fetching video…',
      'loading.long': 'Some sites take longer — still working…',
      'loading.done': 'Done! Your video is ready 👇',
      'error.title': 'Something went wrong',
      'error.retry': 'Try again',
      'result.dl': 'Download without watermark',
      'result.dlAny': 'Download video',
      'result.wm': 'Download with watermark',
      'result.orig': 'Open original video ↗',
      'result.directHint': 'The file opens in a new tab — on desktop right-click and choose “Save link as…”, on mobile long-press and tap “Download”.',
      'step1.t': 'Copy the link', 'step1.d': 'In the app or site tap “Share” then “Copy link”.',
      'step2.t': 'Paste the link', 'step2.d': 'Paste it in the box above — long and short links both work.',
      'step3.t': 'Download & save', 'step3.d': 'Hit “Download” and the video is saved to your device — no watermark.',
      'faq.title': 'FAQ',
      'faq1.q': 'Is it really free?', 'faq1.a': 'Yes. Completely free, no sign-up, nothing to install. We never ask for payment or personal data.',
      'faq2.q': 'How is the TikTok watermark removed?', 'faq2.a': 'We fetch the clean video file that the platform itself serves for public accounts, so you get the original clip with no TikTok logo and no quality loss.',
      'faq3.q': 'Why does a link fail sometimes?', 'faq3.a': 'Private or deleted videos cannot be downloaded. Some platforms also apply protections (login walls, region locks, or split audio/video streams) that prevent a single-file download.',
      'faq4.q': 'Is downloading legal?', 'faq4.a': 'Save content for personal use only, respect copyright, and never repost other people’s videos without permission. We host no content.',
      'faq5.q': 'Do you support YouTube, Facebook and other sites?', 'faq5.a': 'Yes — we use the open-source yt-dlp engine, which supports thousands of sites. Some platforms require login, region locks, or split audio and video, so those videos cannot be provided as a single file.',
      'footer.tag': 'A free, open-source video downloader',
      'footer.fine': 'Not affiliated with any platform. We host no content. All rights belong to their owners.',
      'ad.label': 'Advertisement · Google AdSense',
      'dl.started': 'Download started ✓ — look for the file in your Downloads folder.',
      'privacy.link': 'Privacy & cookies policy',
      'seo.aboutTitle': 'Grab the video you want — easily, in high quality',
      'seo.p1': 'Download Video lets you save TikTok videos without watermark in HD, download Instagram Reels, and save YouTube, Facebook and Twitter videos — copy the link, paste it above and hit download.',
      'seo.p2': '100% free, no sign-up, nothing to install, works on desktop and mobile. We store no data and host no content; the file comes directly from the original platform.',
      'err.invalid': 'That link is not valid. Paste a full video URL starting with http:// or https://',
      'err.unsupported_provider': 'We could not process that link.',
      'err.video_unavailable': 'We could not find that video. It may have been removed, made private, or protected by a login wall or region lock.',
      'err.instagram_blocked': 'Instagram blocked fetching this video from the server. Make sure the post is public (not private) — some hosting IPs are blocked by Instagram, so retry later or try another link.',
      'err.no_extractor': 'This site is not supported by the download engine, or the page is protected. Make sure the link goes directly to a video.',
      'err.ytdlp_missing': 'The universal engine (yt-dlp) is not installed on the server. Install it to enable downloads from any site (see README).',
      'err.merge_needed': 'This video only exists as separate audio and video streams, which cannot be merged into one file on this server.',
      'err.playlist': 'That looks like a playlist or series — send a single video URL.',
      'err.rate_limited': 'Too many requests in a short time. Wait a minute and try again.',
      'err.network': 'Could not reach the server. Check your internet connection and retry.',
      'err.server_error': 'Unexpected server error. Please try again in a moment.',
      'err.upstream_error': 'Failed to fetch the file from the platform. Try again shortly.',
      'err.backend': 'This static copy only supports TikTok links. Run the server (node server.js) to enable downloads from any site.',
      'badge.tiktok': 'TikTok',
      'badge.instagram': 'Instagram',
      'fallback.title': 'Untitled video',
      'fallback.author': 'Unknown creator',
      'video.title': 'Video'
    }
  };

  var lang = 'ar';
  try { if (localStorage.getItem('savevid.lang') === 'en') lang = 'en'; } catch (e) {}
  var backend = null; // null = unknown, true = our server present
  var lastUrl = '';

  var els = {
    form: $('#form'),
    input: $('#urlInput'),
    go: $('#goBtn'),
    paste: $('#pasteBtn'),
    loading: $('#loading'),
    status: $('#statusText'),
    error: $('#error'),
    errText: $('#errText'),
    retry: $('#retryBtn'),
    result: $('#result'),
    cover: $('#rCover'),
    badge: $('#rBadge'),
    title: $('#rTitle'),
    author: $('#rAuthor'),
    dur: $('#rDur'),
    note: $('#rNote'),
    dl: $('#dlBtn'),
    wmWrap: $('#wmWrap'),
    wm: $('#wmBtn'),
    orig: $('#openOrig'),
    toggle: $('#langToggle'),
    toast: $('#toast')
  };

  function t(k) { return (STRINGS[lang] && STRINGS[lang][k]) || STRINGS.ar[k] || k; }

  function applyLang() {
    var root = document.documentElement;
    root.lang = lang;
    root.dir = lang === 'ar' ? 'rtl' : 'ltr';
    els.toggle.textContent = lang === 'ar' ? 'English' : 'العربية';
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    document.querySelectorAll('[data-i18n-ph]').forEach(function (el) {
      el.setAttribute('placeholder', t(el.getAttribute('data-i18n-ph')));
    });
    document.querySelectorAll('[data-i18n-title]').forEach(function (el) {
      el.setAttribute('title', t(el.getAttribute('data-i18n-title')));
    });
  }

  function detectBackend() {
    fetch('/api/ping', { cache: 'no-store' })
      .then(function (r) { backend = r.ok; })
      .catch(function () { backend = false; });
  }

  function platformOf(url) {
    if (/tiktok\.com/i.test(url)) return 'tiktok';
    if (/instagram\.com|instagr\.am/i.test(url)) return 'instagram';
    return null;
  }

  function looksLikeUrl(s) {
    return /^https?:\/\/[^\s]+\.[^\s]+/i.test(s);
  }

  function showPanel(which) {
    [els.loading, els.error, els.result].forEach(function (p) { p.hidden = p !== which; });
  }

  function showError(code, fallbackMsg) {
    showPanel(els.error);
    els.errText.textContent = t('err.' + code) || fallbackMsg || t('err.server_error');
    els.error.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function fmtDuration(sec) {
    if (!sec) return '';
    var m = Math.floor(sec / 60);
    var s = Math.round(sec % 60);
    return (m > 0 ? m + ':' : '') + (s < 10 ? '0' : '') + s;
  }

  function fileNameFor(title) {
    var base = (title || 'video')
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 70);
    return (base || 'video') + '.mp4';
  }

  function streamUrl(mediaUrl, name, token) {
    return '/stream?u=' + encodeURIComponent(mediaUrl) + '&name=' + encodeURIComponent(name) +
      (token ? '&t=' + encodeURIComponent(token) : '');
  }

  function badgeLabel(meta) {
    if (meta.provider === 'tiktok') return t('badge.tiktok');
    if (meta.provider === 'instagram') return t('badge.instagram');
    var map = { YouTube: 'يوتيوب', Facebook: 'فيسبوك', Twitter: 'إكس (تويتر)', X: 'إكس', Vimeo: 'Vimeo', Reddit: 'Reddit', Pinterest: 'Pinterest' };
    if (lang === 'ar' && map[meta.extractor]) return map[meta.extractor];
    return meta.extractor || 'فيديو';
  }

  function showResult(meta, sourceUrl, viaBackend) {
    var isTik = meta.provider === 'tiktok';
    els.badge.textContent = badgeLabel(meta);
    els.title.textContent = meta.title || t('fallback.title');
    els.author.textContent = meta.author && meta.author.name
      ? '@' + String(meta.author.name).replace(/^@/, '')
      : t('fallback.author');
    els.dur.textContent = fmtDuration(meta.duration);
    if (meta.cover) { els.cover.src = meta.cover; els.cover.hidden = false; } else { els.cover.hidden = true; }
    els.orig.href = meta.sourceUrl || sourceUrl;

    var name = fileNameFor(meta.title || (isTik ? 'tiktok' : meta.extractor || 'video'));

    els.dl.textContent = ''; // clear static label, set the right one below
    var labelEl = document.createElement('span');
    labelEl.textContent = t(isTik ? 'result.dl' : 'result.dlAny');
    labelEl.setAttribute('data-i18n', isTik ? 'result.dl' : 'result.dlAny');
    els.dl.appendChild(labelEl);

    // Decide how the file is delivered:
    //  - merged server file (fileToken)  -> one-time /stream?k= download
    //  - allow-listed host or signed URL -> /stream proxy (clean filename)
    //  - otherwise                       -> direct link in a new tab
    var proxiable = meta.proxiable === true || meta.provider === 'tiktok' || meta.provider === 'instagram';
    if (viaBackend && meta.fileToken) {
      els.dl.href = '/stream?k=' + encodeURIComponent(meta.fileToken) + '&name=' + encodeURIComponent(name);
      els.dl.setAttribute('download', name);
      els.dl.removeAttribute('target');
      els.note.hidden = true;
    } else if (viaBackend && (proxiable || meta.streamToken)) {
      els.dl.href = streamUrl(meta.url, name, proxiable ? '' : meta.streamToken);
      els.dl.setAttribute('download', name);
      els.dl.removeAttribute('target');
      els.note.hidden = true;
    } else {
      els.dl.href = meta.url || meta.sourceUrl || '#';
      els.dl.setAttribute('download', name);
      els.dl.target = '_blank';
      els.dl.rel = 'noopener';
      els.note.textContent = t('result.directHint');
      els.note.hidden = false;
    }

    if (meta.wmUrl) {
      els.wmWrap.hidden = false;
      els.wm.href = viaBackend ? streamUrl(meta.wmUrl, name.replace(/\.mp4$/, '-wm.mp4')) : meta.wmUrl;
      els.wm.setAttribute('download', name.replace(/\.mp4$/, '-wm.mp4'));
      if (!viaBackend) { els.wm.target = '_blank'; els.wm.rel = 'noopener'; }
    } else {
      els.wmWrap.hidden = true;
    }

    showPanel(els.result);
    els.result.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  async function directTikTok(url) {
    var resp = await fetch('https://tikwm.com/api/?url=' + encodeURIComponent(url), {
      headers: { accept: 'application/json, text/plain, */*' }
    });
    var body = await resp.json();
    if (!body || body.code !== 0 || !body.data) throw new Error('video_unavailable');
    var d = body.data;
    return {
      provider: 'tiktok',
      title: d.title,
      duration: d.duration,
      author: { name: d.author && (d.author.nickname || d.author.unique_id) },
      cover: d.cover,
      url: d.play || d.wmplay,
      wmUrl: d.wmplay && d.wmplay !== d.play ? d.wmplay : ''
    };
  }

  async function submit(raw) {
    var url = (raw || els.input.value || '').trim();
    lastUrl = url;
    if (!url || !looksLikeUrl(url)) {
      showError('invalid');
      return;
    }
    els.go.disabled = true;
    showPanel(els.loading);
    els.status.textContent = t('loading.working');
    els.loading.scrollIntoView({ behavior: 'smooth', block: 'center' });
    var longTimer = setTimeout(function () {
      if (!els.loading.hidden) els.status.textContent = t('loading.long');
    }, 7000);

    try {
      var viaBackend = false;
      var meta;
      if (backend !== false) {
        try {
          var r = await fetch('/api/download', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: url })
          });
          var data = await r.json();
          if (!r.ok || !data.ok) throw Object.assign(new Error(data.code || 'server_error'), { code: data.code });
          meta = data;
          viaBackend = true;
        } catch (err) {
          if (backend !== true && platformOf(url) === 'tiktok') {
            // static hosting fallback: call the public endpoint straight from the browser
            meta = await directTikTok(url);
          } else if (err.code) {
            throw err;
          } else if (backend === true) {
            throw Object.assign(new Error('network'), { code: 'network' });
          } else {
            throw Object.assign(new Error('backend'), { code: 'backend' });
          }
        }
      } else if (platformOf(url) === 'tiktok') {
        meta = await directTikTok(url);
      } else {
        throw Object.assign(new Error('backend'), { code: 'backend' });
      }

      clearTimeout(longTimer);
      els.status.textContent = t('loading.done');
      setTimeout(function () {
        showResult(meta, url, viaBackend);
        els.go.disabled = false;
      }, 250);
    } catch (err) {
      clearTimeout(longTimer);
      els.go.disabled = false;
      var code = err.code || (err instanceof TypeError ? 'network' : 'server_error');
      showError(code, err.message);
    }
  }

  els.form.addEventListener('submit', function (ev) { ev.preventDefault(); submit(); });

  els.paste.addEventListener('click', function () {
    if (navigator.clipboard && navigator.clipboard.readText) {
      navigator.clipboard.readText().then(function (v) { if (v) els.input.value = v.trim(); }).catch(function () { els.input.focus(); });
    } else { els.input.focus(); }
  });

  els.retry.addEventListener('click', function () {
    showPanel(els.loading); // hidden again by submit()
    submit(lastUrl);
  });

  els.toggle.addEventListener('click', function () {
    lang = lang === 'ar' ? 'en' : 'ar';
    try { localStorage.setItem('savevid.lang', lang); } catch (e) {}
    applyLang();
  });

  /* ----- download-started feedback ----- */
  var toastTimer = null;
  function hideToast() {
    els.toast.classList.remove('show');
    setTimeout(function () { els.toast.hidden = true; }, 280);
  }
  function showToast(key) {
    els.toast.textContent = t(key);
    els.toast.hidden = false;
    clearTimeout(toastTimer);
    setTimeout(function () { els.toast.classList.add('show'); }, 20);
    toastTimer = setTimeout(hideToast, 6500);
  }
  [els.dl, els.wm].forEach(function (a) {
    a.addEventListener('click', function () {
      if (a.getAttribute('href')) {
        setTimeout(function () { showToast('dl.started'); }, 400);
      }
    });
  });

  applyLang();
  detectBackend();
})();
