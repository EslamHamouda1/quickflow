async (page) => {
  // T105 keyboard-only walkthrough: every page action done with Tab / Shift+Tab / Enter / Space / arrows / typing only.
  // Each step is verified through the REST API (fetch from the Playwright process).
  const UI = 'http://localhost:4200', API = 'http://localhost:8080/api';
  const req = async (url, o = {}) => { const r = await page.request.fetch(url, { method: o.method || 'GET', headers: o.headers, data: o.body }); return { status: r.status(), json: () => r.json() }; };
  const get = async (p) => (await req(API + p)).json();
  const log = []; let failures = 0;
  const ok = (step, cond, info) => { if (!cond) failures++; log.push(`${cond ? 'PASS' : 'FAIL'} ${step}${info !== undefined ? ' — ' + JSON.stringify(info) : ''}`); };
  const label = () => page.evaluate(() => { const a = document.activeElement; return a ? (a.getAttribute('aria-label') || (a.labels && a.labels[0] && a.labels[0].textContent) || a.textContent || '').trim() : ''; });
  const tabTo = async (re, max = 250) => { if (re.test(await label())) return true; for (let i = 0; i < max; i++) { await page.keyboard.press('Tab'); if (re.test(await label())) return true; } throw new Error('not reachable by Tab: ' + re); };
  const go = async (p) => { await page.goto(`${UI}/${p}`); await page.waitForLoadState('networkidle'); await page.waitForTimeout(500); await page.evaluate(() => document.activeElement?.blur()); };
  const dialogOpen = () => page.evaluate(() => !!document.querySelector('dialog[open]'));
  const settle = (ms = 600) => page.waitForTimeout(ms);
  const focusLog = [];
  const focusAfter = async (action) => { await page.waitForTimeout(800); const f = await page.evaluate(() => { const a = document.activeElement; return a === document.body || !a ? 'BODY' : (a.getAttribute('aria-label') || a.textContent || a.tagName).trim().slice(0, 50); }); focusLog.push({ action, focusAfter: f, kept: f !== 'BODY' }); };
  const reset = () => page.evaluate(() => document.activeElement?.blur());
  const confirm = async () => { await settle(400); await tabTo(/^(Delete|Remove)$/, 10); await page.keyboard.press('Enter'); await settle(); };
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 1440, height: 900 });
  try {
  const T = 'P8KB task', H = 'P8KB habit', L = 'P8KB card', P = 'P8KB plan';

  // ---------- Tasks ----------
  await go('tasks');
  await tabTo(/^Add Task$/); await page.keyboard.press('Enter'); await settle(400);
  await page.keyboard.type(T); // focus starts in Title
  await page.keyboard.press('Tab'); await page.keyboard.type('created with keyboard only');
  await tabTo(/^Priority$/, 10); await page.keyboard.press('ArrowUp'); // Medium -> High
  await tabTo(/^Add task$/, 10); await page.keyboard.press('Enter'); await settle();
  let task = (await get('/tasks?q=' + encodeURIComponent(T)))[0];
  ok('tasks: create via keyboard', task && task.priority === 'HIGH' && !(await dialogOpen()), task && { id: task.id, priority: task.priority });
  await tabTo(new RegExp('^Mark as done: ' + T + '$')); await page.keyboard.press('Space'); await settle();
  ok('tasks: mark done with Space', (await get('/tasks/' + task.id)).status === 'DONE');
  await focusAfter('tasks: Mark as done (Space)');
  await reset(); await tabTo(new RegExp('^Mark as not done: ' + T + '$')); await page.keyboard.press('Space'); await settle();
  ok('tasks: mark not done with Space', (await get('/tasks/' + task.id)).status !== 'DONE');
  await go('tasks');
  await tabTo(new RegExp('^Edit task: ' + T + '$')); await page.keyboard.press('Enter'); await settle(400);
  await page.keyboard.press('ControlOrMeta+a'); await page.keyboard.type(T + ' edited'); await page.keyboard.press('Enter'); await settle();
  task = await get('/tasks/' + task.id);
  ok('tasks: edit title, submit with Enter', task.title === T + ' edited' && !(await dialogOpen()), task.title);
  await go('tasks');
  await tabTo(/^Search tasks by title$/); await page.keyboard.type('P8KB'); await settle(800);
  ok('tasks: search typed by keyboard', (await page.locator('app-task-item').count()) === 1);
  await tabTo(/^Status$/, 5); await page.keyboard.press('ArrowDown'); await settle(800); // All -> Todo
  ok('tasks: status filter by arrow key', (await page.locator('app-task-item').count()) === 1 && (await page.locator('#filter-status').inputValue()) === 'TODO');
  await page.keyboard.press('ArrowUp'); await settle(600);
  await tabTo(new RegExp('^Archive task: ' + T + ' edited$')); await page.keyboard.press('Enter'); await settle();
  ok('tasks: archive with Enter', (await get('/tasks/' + task.id)).archived === true);
  await focusAfter('tasks: archive (Enter)'); await reset();
  await tabTo(/^Show archived$/); await page.keyboard.press('Space'); await settle(800);
  await tabTo(new RegExp('^Restore task: ' + T + ' edited$')); await page.keyboard.press('Enter'); await settle();
  ok('tasks: show archived (Space) + restore (Enter)', (await get('/tasks/' + task.id)).archived === false);
  await go('tasks');
  await tabTo(new RegExp('^Delete task: ' + T + ' edited$')); await page.keyboard.press('Enter'); await confirm();
  ok('tasks: delete with Enter + confirm by keyboard', (await req(API + '/tasks/' + task.id)).status === 404);

  // ---------- Habits ----------
  await go('habits');
  await tabTo(/^Add Habit$/); await page.keyboard.press('Enter'); await settle(400);
  await page.keyboard.type(H);
  await tabTo(/^Daily$/, 10); await page.keyboard.press('ArrowRight'); // -> Weekly
  await tabTo(/^Add habit$/, 10); await page.keyboard.press('Enter'); await settle();
  let habit = (await get('/habits')).find((h) => h.name === H);
  ok('habits: create weekly habit via keyboard', habit && habit.frequency === 'WEEKLY', habit && habit.frequency);
  await tabTo(new RegExp('^Mark done for today: ' + H + '$')); await page.keyboard.press('Space'); await settle();
  ok('habits: complete with Space', (await get('/habits/' + habit.id + '/completions')).length === 1);
  await focusAfter('habits: Mark done for today (Space)');
  await reset(); await tabTo(new RegExp("^Undo today's completion: " + H + '$')); await page.keyboard.press('Enter'); await settle();
  ok('habits: undo completion with Enter', (await get('/habits/' + habit.id + '/completions')).length === 0);
  await go('habits');
  await tabTo(new RegExp('^Edit habit: ' + H + '$')); await page.keyboard.press('Enter'); await settle(400);
  await page.keyboard.press('ControlOrMeta+a'); await page.keyboard.type(H + ' edited');
  await tabTo(/^Save/, 10); await page.keyboard.press('Enter'); await settle();
  ok('habits: edit via keyboard', (await get('/habits/' + habit.id)).name === H + ' edited');
  await tabTo(new RegExp('^Deactivate habit: ' + H + ' edited$')); await page.keyboard.press('Enter'); await settle();
  ok('habits: deactivate with Enter', (await get('/habits/' + habit.id)).active === false);
  await focusAfter('habits: deactivate (Enter)');
  await go('habits');
  await tabTo(new RegExp('^Reactivate habit: ' + H + ' edited$')); await page.keyboard.press('Enter'); await settle();
  ok('habits: reactivate with Enter', (await get('/habits/' + habit.id)).active === true);
  await go('habits');
  await tabTo(new RegExp('^Remove habit: ' + H + ' edited$')); await page.keyboard.press('Enter'); await confirm();
  ok('habits: remove + confirm by keyboard', (await req(API + '/habits/' + habit.id)).status === 404);

  // ---------- Learning ----------
  await go('learning');
  await tabTo(/^Add Learning Card$/); await page.keyboard.press('Enter'); await settle(400);
  await page.keyboard.type(L);
  await tabTo(/^Add card$/, 10); await page.keyboard.press('Enter'); await settle();
  let card = (await get('/learning-cards')).find((c) => c.title === L);
  ok('learning: create card via keyboard', !!card);
  await tabTo(new RegExp('^Expand ' + L + '$')); await page.keyboard.press('Enter'); await settle(400);
  await tabTo(new RegExp('^New milestone title for ' + L + '$'), 10); await page.keyboard.type('P8KB milestone 1'); await page.keyboard.press('Enter'); await settle();
  await focusAfter('learning: add milestone (Enter)');
  await tabTo(new RegExp('^New milestone title for ' + L + '$'), 20);
  await page.keyboard.type('P8KB milestone 2'); await page.keyboard.press('Enter'); await settle();
  card = await get('/learning-cards/' + card.id);
  ok('learning: add 2 milestones with Enter', card.milestones.length === 2, card.milestones.map((m) => m.title));
  await go('learning');
  await tabTo(new RegExp('^Expand ' + L + '$')); await page.keyboard.press('Enter'); await settle(400);
  await tabTo(/P8KB milestone 1/, 20); await page.keyboard.press('Space'); await settle();
  await focusAfter('learning: toggle milestone (Space)');
  card = await get('/learning-cards/' + card.id);
  ok('learning: toggle milestone with Space', card.milestones.find((m) => m.title === 'P8KB milestone 1')?.done === true, card.milestones.map((m) => [m.title, m.done]));
  await tabTo(new RegExp('^New note for ' + L + '$'), 30); await page.keyboard.type('P8KB keyboard note'); await page.keyboard.press('Control+Enter'); await settle();
  card = await get('/learning-cards/' + card.id);
  ok('learning: add note with Ctrl+Enter', card.notes.length === 1);
  await go('learning');
  await tabTo(new RegExp('^Edit learning card: ' + L + '$')); await page.keyboard.press('Enter'); await settle(400);
  await page.keyboard.press('ControlOrMeta+a'); await page.keyboard.type(L + ' edited');
  await tabTo(/^Save/, 10); await page.keyboard.press('Enter'); await settle();
  ok('learning: edit card via keyboard', (await get('/learning-cards/' + card.id)).title === L + ' edited');

  // ---------- Plans ----------
  const seedTask = await (await req(API + '/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'P8KB plan item' }) })).json();
  await go('plans');
  await tabTo(/^Create Plan$/); await page.keyboard.press('Enter'); await settle(400);
  await tabTo(/^P8KB plan item/, 60); await page.keyboard.press('Space');
  await tabTo(/^Next$/, 60); await page.keyboard.press('Enter'); await settle(400);
  await tabTo(/^Title\b/, 15); await page.keyboard.type(P);
  await tabTo(/^Create plan$/, 60); await page.keyboard.press('Enter'); await settle();
  let plan = (await get('/plans')).find((p) => p.title === P);
  ok('plans: create plan from existing item via keyboard', plan && plan.items.length === 1 && plan.items[0].sourceId === seedTask.id, plan && plan.status);
  await go('plans');
  await tabTo(/^Task: ?P8KB plan item/, 150); await page.keyboard.press("Space"); await settle(1000);
  await focusAfter('plans: toggle plan item (Space)');
  plan = await get('/plans/' + plan.id);
  ok('plans: toggle plan item with Space', plan.items[0].done === true && plan.progressPercent === 100, { progress: plan.progressPercent, status: plan.status });
  await go('plans');
  await tabTo(new RegExp('^Remove plan: ' + P + '$'), 150); await page.keyboard.press('Enter'); await confirm();
  ok('plans: remove + confirm by keyboard', (await req(API + '/plans/' + plan.id)).status === 404);

  // ---------- Settings ----------
  const orig = await get('/settings');
  await go('settings');
  await tabTo(/^Display name/); await page.keyboard.press('ControlOrMeta+a'); await page.keyboard.type('P8KB Name');
  await tabTo(/^Browser notifications/, 10).catch(() => null);
  await tabTo(/^Landing page/, 10); await page.keyboard.press('ArrowDown');
  await tabTo(/^Save settings$/, 10); await page.keyboard.press('Enter'); await settle();
  const s = await get('/settings');
  ok('settings: change name + landing page, save with Enter', s.displayName === 'P8KB Name' && s.defaultView !== orig.defaultView, s);
  await go('settings');
  await tabTo(/^In-app notifications/); await page.keyboard.press('Space');
  await tabTo(/^Save settings$/, 10); await page.keyboard.press('Enter'); await settle();
  ok('settings: toggle switch with Space', (await get('/settings')).inAppNotifications === !orig.inAppNotifications);
  await req(API + '/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(orig) });

  // ---------- Dashboard ----------
  await go('dashboard');
  await tabTo(/^Add Habit$/); await page.keyboard.press('Enter'); await settle(400);
  await page.keyboard.type('P8KB dash habit'); await tabTo(/^Add habit$/, 10); await page.keyboard.press('Enter'); await settle(1000);
  const dh = (await get('/habits')).find((h) => h.name === 'P8KB dash habit');
  ok('dashboard: quick-add habit by keyboard', !!dh);
  await tabTo(/^Mark done for today: P8KB dash habit$/); await page.keyboard.press('Space'); await settle();
  await focusAfter('dashboard: habit checklist (Space)');
  ok('dashboard: complete habit from checklist with Space', (await get('/habits/' + dh.id + '/completions')).length === 1);
  const dt = await (await req(API + '/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'P8KB due today', dueDate: (await get('/dashboard')).today }) })).json();
  await go('dashboard');
  await tabTo(/^Complete task: P8KB due today$/); await page.keyboard.press('Enter'); await settle();
  await focusAfter('dashboard: complete due-today task (Enter)');
  ok('dashboard: complete due-today task with Enter', (await get('/tasks/' + dt.id)).status === 'DONE');
  await req(API + '/tasks/' + dt.id, { method: 'DELETE' });
  await go('dashboard');
  await tabTo(/^All tasks$/); await page.keyboard.press('Enter'); await settle();
  ok('dashboard: section link activated with Enter', page.url().endsWith('/tasks'), page.url());
  await go('dashboard');
  await tabTo(/^Skip to main content$/, 3); await page.keyboard.press('Enter');
  ok('shell: skip link moves focus to main', await page.evaluate(() => !!document.activeElement.closest('main') || document.activeElement.id === 'main-content'));

  // cleanup
  await req(API + '/habits/' + dh.id, { method: 'DELETE' });
  await req(API + '/learning-cards/' + card.id, { method: 'DELETE' });
  await req(API + '/tasks/' + seedTask.id, { method: 'DELETE' });
  } catch (e) { failures++; log.push('ERROR ' + e.message.split('\n')[0] + ' @ ' + page.url()); }
  return { failures, log, focusLog };
}
