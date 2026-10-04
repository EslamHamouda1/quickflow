async (page) => {
  // Continuation of p8-e2e-prd11.js from step 6b (plan already created in the UI by step 6).
  const UI = 'http://localhost:4200', API = 'http://localhost:8080/api';
  const shots = 'loops/loop-3-testing/outputs/screenshots/';
  const api = async (p) => (await page.request.get(API + p)).json();
  const steps = []; const ids = { plan: (await api('/plans')).find((p) => p.title === 'P8E2E plan').id };
  const step = (name, ok, info) => steps.push(`${ok ? 'PASS' : 'FAIL'} ${name}${info !== undefined ? ' — ' + JSON.stringify(info) : ''}`);
  const go = async (p) => { await page.goto(`${UI}/${p}`); await page.waitForLoadState('networkidle'); await page.waitForTimeout(500); };
  const errors = []; page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  await page.setViewportSize({ width: 1440, height: 900 });
  try {
    await go('plans');
    let plan = await api('/plans/' + ids.plan);
    const card = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: 'P8E2E plan', level: 3 }) }).last();
    const restShown = await card.innerText();
    step('6b plan In Progress with rest time shown', plan.status === 'IN_PROGRESS' && /left|rest|remaining|:\d\d/i.test(restShown), restShown.replace(/\s+/g, ' ').slice(0, 160));
    await page.screenshot({ path: shots + 'phase-8-e2e-4-plan-in-progress.png' });
    // 7. mark plan items done
    for (const n of [/^Task: ?P8E2E plan task/, /^Habit: ?P8E2E habit/, /^Learning: ?P8E2E card/]) {
      await card.getByRole('checkbox', { name: n }).check(); await page.waitForTimeout(500);
    }
    await page.waitForTimeout(800);
    plan = await api('/plans/' + ids.plan);
    const cardText = (await page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: 'P8E2E plan', level: 3 }) }).last().innerText()).replace(/\s+/g, ' ');
    step('7 mark all plan items done in UI → plan Completed (achieved)', plan.status === 'COMPLETED' && plan.progressPercent === 100 && /Completed/i.test(cardText), { status: plan.status, progress: plan.progressPercent, ui: cardText.slice(0, 160) });
    await page.screenshot({ path: shots + 'phase-8-e2e-5-plan-completed.png' });
    // 8. dashboard reflects
    await go('dashboard');
    const d = await api('/dashboard');
    const main = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
    const expectTasks = `${d.tasks.doneCount} of ${d.tasks.totalActive}`;
    step('8 dashboard UI shows updated numbers equal to API', main.includes(`${d.tasks.completionPercent}%`) && main.includes(expectTasks) && main.includes(`${d.plans.completedCount} completed`) && main.includes(`${d.habits.completedTodayCount} / ${d.habits.activeCount}`) && main.includes(`${d.learning.milestonesDone} / ${d.learning.milestonesTotal}`), { api: { pct: d.tasks.completionPercent, done: expectTasks, habits: `${d.habits.completedTodayCount}/${d.habits.activeCount}`, plansCompleted: d.plans.completedCount, milestones: `${d.learning.milestonesDone}/${d.learning.milestonesTotal}` } });
    await page.screenshot({ path: shots + 'phase-8-e2e-6-dashboard.png', fullPage: true });
  } catch (e) { steps.push('ERROR ' + e.message.split('\n')[0] + ' @ ' + page.url()); }
  return { steps, ids, consoleErrors: errors };
}
