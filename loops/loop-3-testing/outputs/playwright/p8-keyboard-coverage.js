async (page) => {
  // T105: Tab reachability + visible focus on all six pages; create dialogs opened by keyboard:
  // validation announced, focus inside dialog, Esc returns focus to the opener; controls clickable during dialog animation.
  const UI = 'http://localhost:4200';
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 1440, height: 900 });
  const key = () => page.evaluate(() => {
    const a = document.activeElement; if (!a || a === document.body) return null;
    if (!a.dataset.p8k) a.dataset.p8k = String(Math.random()).slice(2);
    const cs = getComputedStyle(a);
    const ring = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || (cs.boxShadow && cs.boxShadow !== 'none');
    return { id: a.dataset.p8k, name: (a.getAttribute('aria-label') || a.textContent || a.value || '').trim().slice(0, 40), tag: a.tagName, ring };
  });
  const coverage = [];
  for (const p of ['dashboard', 'tasks', 'habits', 'learning', 'plans', 'settings']) {
    await page.goto(`${UI}/${p}`); await page.waitForLoadState('networkidle'); await page.waitForTimeout(500);
    const all = await page.evaluate(() => {
      const sel = 'a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
      return [...document.querySelectorAll(sel)].filter((e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return (r.width > 0 && r.height > 0 && cs.visibility !== 'hidden') || e.matches('a[href="#main-content"]'); })
        .map((e) => { e.dataset.p8all = '1'; return (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 40); });
    });
    const seen = new Map(); let noRing = [];
    await page.locator('body').click({ position: { x: 1, y: 1 } }).catch(() => {});
    await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); });
    for (let i = 0; i < all.length + 15; i++) {
      await page.keyboard.press('Tab');
      const k = await key(); if (!k) continue;
      if (seen.has(k.id)) { if (seen.size >= all.length) break; continue; }
      seen.set(k.id, k); if (!k.ring) noRing.push(k.name);
    }
    const unreached = await page.evaluate((ids) => [...document.querySelectorAll('[data-p8all]')].filter((e) => !ids.includes(e.dataset.p8k)).map((e) => (e.getAttribute('aria-label') || e.textContent || e.tagName).trim().slice(0, 50)), [...seen.keys()]);
    coverage.push({ page: p, focusable: all.length, reachedByTab: seen.size, unreached, noFocusRing: noRing });
  }
  // Dialogs via keyboard
  const dialogs = [];
  const tabTo = async (name, max = 200) => { for (let i = 0; i < max; i++) { await page.keyboard.press('Tab'); const k = await page.evaluate(() => (document.activeElement?.getAttribute('aria-label') || document.activeElement?.textContent || '').trim()); if (k === name) return true; } return false; };
  for (const [p, opener, submit] of [['tasks', 'Add Task', 'Add task'], ['habits', 'Add Habit', 'Add habit'], ['learning', 'Add Learning Card', 'Add card'], ['plans', 'Create Plan', 'Next'], ['dashboard', 'Add Task', 'Add task']]) {
    await page.goto(`${UI}/${p}`); await page.waitForLoadState('networkidle'); await page.waitForTimeout(400);
    await page.evaluate(() => document.activeElement?.blur());
    const reached = await tabTo(opener);
    const openerId = await page.evaluate(() => { document.activeElement.dataset.opener = '1'; return true; });
    await page.keyboard.press('Enter');
    // clickable during the open animation: the Close button is hit-testable right away
    const duringAnim = await page.evaluate(() => { const d = document.querySelector('dialog[open],[role=dialog]'); if (!d) return 'no dialog'; const b = [...d.querySelectorAll('button')].find((x) => /close/i.test(x.getAttribute('aria-label') || x.textContent)); if (!b) return 'no close'; const r = b.getBoundingClientRect(); const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return { running: document.getAnimations().length, hittable: b.contains(hit), pointerEvents: getComputedStyle(d).pointerEvents }; });
    await page.waitForTimeout(400);
    const dlg = page.getByRole('dialog');
    const focusInside = await page.evaluate(() => !!document.activeElement?.closest('dialog,[role=dialog]'));
    const label = await dlg.getAttribute('aria-labelledby').catch(() => null) || await dlg.getAttribute('aria-label').catch(() => null);
    // focus trap: 30 tabs stay inside
    let escaped = 0; for (let i = 0; i < 30; i++) { await page.keyboard.press('Tab'); if (!(await page.evaluate(() => !!document.activeElement?.closest('dialog,[role=dialog]')))) escaped++; }
    // submit empty by keyboard
    const submitReached = await tabTo(submit, 40);
    const pressedOn = await page.evaluate(() => (document.activeElement?.getAttribute('aria-label') || document.activeElement?.textContent || '').trim().slice(0, 30));
    await page.keyboard.press('Enter'); await page.waitForTimeout(400);
    const validation = await page.evaluate(() => {
      const d = document.querySelector('dialog[open],[role=dialog]');
      if (!d) return 'dialog closed';
      const alerts = [...d.querySelectorAll('[role=alert],[aria-live]')].map((a) => a.textContent.trim()).filter(Boolean);
      const invalid = [...d.querySelectorAll('[aria-invalid=true]')].map((f) => ({ field: f.id || f.name, describedBy: f.getAttribute('aria-describedby'), describedText: (f.getAttribute('aria-describedby') || '').split(' ').map((id) => document.getElementById(id)?.textContent.trim()).filter(Boolean).join(' | ') }));
      return { alerts, invalid };
    });
    await page.keyboard.press('Escape'); await page.waitForTimeout(400);
    const closed = (await page.getByRole('dialog').count()) === 0;
    const focusReturned = await page.evaluate(() => document.activeElement?.dataset.opener === '1');
    dialogs.push({ page: p, opener, reachedByTab: reached, duringAnim, labelled: !!label, focusInside, focusEscapes: escaped, submitReached, pressedOn, validation, closedByEsc: closed, focusReturned });
  }
  return { coverage, dialogs };
}
