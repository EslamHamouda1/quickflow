async (page) => {
  // TC-P8-E2E-001 (T106): UI search/filter response with ~1,000 seeded tasks. Run 2x normal + 2x reduced motion.
  await page.setViewportSize({ width: 1440, height: 900 });
  const out = [];
  for (const motion of ['no-preference', 'no-preference', 'reduce', 'reduce']) {
    await page.emulateMedia({ reducedMotion: motion });
    await page.goto('http://localhost:4200/tasks');
    await page.waitForFunction(() => document.querySelectorAll('app-task-item').length >= 1000, null, { timeout: 120000 });
    const total = await page.evaluate(() => document.querySelectorAll('app-task-item').length);
    await page.waitForTimeout(1000);
    await page.evaluate(() => {
      window.__lt = [];
      new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__lt.push(Math.round(e.duration)))).observe({ type: 'longtask' });
    });
    const count = () => page.evaluate(() => document.querySelectorAll('app-task-item').length);
    const step = async (label, act, pred) => {
      await page.evaluate(() => (window.__lt = []));
      const t0 = Date.now();
      await act();
      await page.waitForFunction(pred.fn, pred.arg, { timeout: 60000, polling: 'raf' });
      const ms = Date.now() - t0;
      const lt = await page.evaluate(() => window.__lt.slice());
      out.push({ motion, label, ms, rows: await count(), longtasks: lt, pass: ms < 500 });
      await page.waitForTimeout(800);
    };
    const eq = (n) => ({ fn: (n) => document.querySelectorAll('app-task-item').length === n, arg: n });
    const search = page.getByRole('searchbox', { name: 'Search tasks by title' });
    await step('search PERF8T 555', () => search.fill('PERF8T 555'), eq(1));
    await step('clear search', () => search.fill(''), eq(total));
    await step('status = Todo', () => page.locator('#filter-status').selectOption('TODO'), { fn: (n) => { const c = document.querySelectorAll('app-task-item').length; return c > 0 && c < n; }, arg: total });
    await step('status = All', () => page.locator('#filter-status').selectOption(''), eq(total));
    await step('priority = High', () => page.locator('#filter-priority').selectOption('HIGH'), { fn: (n) => { const c = document.querySelectorAll('app-task-item').length; return c > 0 && c < n; }, arg: total });
    await step('priority = All', () => page.locator('#filter-priority').selectOption(''), eq(total));
  }
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  return out;
}
