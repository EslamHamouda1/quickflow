async (page) => {
  // Phase 8 (T105) accessibility / motion / responsive audit: 6 pages x light/dark x 1440/375 px.
  const UI = 'http://localhost:4200';
  const pages = ['dashboard', 'tasks', 'habits', 'learning', 'plans', 'settings'];
  const shotDir = 'loops/loop-3-testing/outputs/screenshots/';
  const inPage = () => {
    const parse = (c) => { const m = c && c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
    const lum = ({ r, g, b }) => { const f = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const blend = (t, b) => ({ r: t.r * t.a + b.r * (1 - t.a), g: t.g * t.a + b.g * (1 - t.a), b: t.b * t.a + b.b * (1 - t.a), a: 1 });
    const bgOf = (el) => { const st = []; for (let e = el; e; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.backgroundImage !== 'none') return null; const c = parse(cs.backgroundColor); if (c && c.a > 0) { st.push(c); if (c.a >= 1) break; } } let base = parse(getComputedStyle(document.documentElement).backgroundColor) || { r: 255, g: 255, b: 255, a: 1 }; if (base.a < 1) base = { r: 255, g: 255, b: 255, a: 1 }; for (let i = st.length - 1; i >= 0; i--) base = blend(st[i], base); return base; };
    const opac = (el) => { let o = 1; for (let e = el; e; e = e.parentElement) o *= +getComputedStyle(e).opacity; return o; };
    const low = []; let checked = 0; let minRatio = 99;
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); const seen = new Set();
    while (w.nextNode()) {
      const el = w.currentNode.parentElement; if (!w.currentNode.textContent.trim() || !el || seen.has(el)) continue; seen.add(el);
      const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
      const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || el.closest('.sr-only,.visually-hidden,[aria-hidden="true"],[disabled],:disabled')) continue;
      const bg = bgOf(el); if (!bg) continue;
      const fg0 = parse(cs.color); if (!fg0) continue;
      const fg = blend({ ...fg0, a: fg0.a * opac(el) }, bg);
      const L1 = lum(fg), L2 = lum(bg); const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
      checked++; minRatio = Math.min(minRatio, ratio);
      if (ratio < 4.5) low.push({ text: w.currentNode.textContent.trim().slice(0, 40), ratio: +ratio.toFixed(2), fg: cs.color, bg: `rgb(${bg.r|0},${bg.g|0},${bg.b|0})` });
    }
    // motion
    const secs = (v) => v.split(',').map((s) => s.trim().endsWith('ms') ? parseFloat(s) / 1000 : parseFloat(s) || 0);
    let maxDur = 0; const slow = [];
    for (const el of document.querySelectorAll('*')) {
      const cs = getComputedStyle(el);
      const a = cs.animationName !== 'none' ? Math.max(...secs(cs.animationDuration)) : 0;
      const t = Math.max(...secs(cs.transitionDuration));
      const m = Math.max(a, t); if (m > maxDur) maxDur = m;
      if (m > 0.25) slow.push({ el: el.tagName.toLowerCase() + '.' + [...el.classList].join('.'), anim: cs.animationName, a, t });
    }
    const running = document.getAnimations().map((x) => x.effect?.getTiming?.().duration).filter((d) => typeof d === 'number');
    return {
      contrastChecked: checked, minRatio: +minRatio.toFixed(2), lowContrast: low.slice(0, 10),
      maxDurationS: maxDur, slow: slow.slice(0, 10), maxRunningAnimMs: running.length ? Math.max(...running) : 0,
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      main: document.querySelectorAll('main,[role=main]').length, h1: document.querySelectorAll('h1').length,
      banner: document.querySelectorAll('header,[role=banner]').length, nav: document.querySelectorAll('nav,[role=navigation]').length,
      navLinksVisible: [...document.querySelectorAll('nav a')].filter((a) => { const r = a.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.right <= innerWidth + 1 && r.left >= -1; }).length,
      skipLink: !!document.querySelector('a[href="#main-content"]'),
    };
  };
  const unnamed = (snap) => snap.split('\n').filter((l) => /^\s*- (button|link|textbox|searchbox|combobox|checkbox|switch|radio|slider|spinbutton|tab|menuitem|listbox)( \[|:|$)/.test(l));
  const results = [];
  for (const scheme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'no-preference' });
    for (const width of [1440, 375]) {
      await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
      for (const p of pages) {
        await page.goto(`${UI}/${p}`);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(700);
        const r = await page.evaluate(inPage);
        const snap = await page.locator('body').ariaSnapshot();
        const u = unnamed(snap);
        const regions = { headings: (snap.match(/- heading "/g) || []).length };
        const issues = [];
        if (r.lowContrast.length) issues.push('contrast');
        if (u.length) issues.push('unnamed-controls');
        if (r.maxDurationS > 0.25 || r.maxRunningAnimMs > 250) issues.push('slow-animation');
        if (r.overflowX > 0) issues.push('overflow-x');
        if (r.main !== 1 || r.h1 !== 1 || r.banner < 1 || r.nav < 1) issues.push('landmarks/headings');
        if (r.navLinksVisible < 6) issues.push('nav-not-usable');
        if (p === 'tasks' || p === 'dashboard') await page.screenshot({ path: `${shotDir}phase-8-a11y-${p}-${scheme}-${width}.png` });
        results.push({ page: p, scheme, width, issues, unnamed: u.slice(0, 5), ...regions, ...r });
      }
    }
  }
  // reduced motion
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 900 });
  const reduced = [];
  for (const p of pages) {
    await page.goto(`${UI}/${p}`); await page.waitForLoadState('networkidle'); await page.waitForTimeout(300);
    const r = await page.evaluate(inPage);
    reduced.push({ page: p, maxDurationS: r.maxDurationS, maxRunningAnimMs: r.maxRunningAnimMs, slow: r.slow.slice(0, 3) });
  }
  await page.emulateMedia({ colorScheme: null, reducedMotion: null });
  const summary = results.map((x) => `${x.page}/${x.scheme}/${x.width}: ${x.issues.length ? 'ISSUES ' + x.issues.join(',') : 'ok'} (contrast n=${x.contrastChecked} min=${x.minRatio}, maxDur=${x.maxDurationS}s, overflow=${x.overflowX}, main=${x.main}, h1=${x.h1}, headings=${x.headings}, navVisible=${x.navLinksVisible})`);
  return { summary, details: results.filter((x) => x.issues.length).map((x) => ({ page: x.page, scheme: x.scheme, width: x.width, lowContrast: x.lowContrast, unnamed: x.unnamed, slow: x.slow, overflowX: x.overflowX })), reduced };
}
