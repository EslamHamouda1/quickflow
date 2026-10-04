async (page) => {
  // Trial-1 regression copy (names P8R1E*). T107 PRD §11 end-to-end flow in the UI (mouse + typing). Data is checked afterwards with curl
  // (outputs/curl/phase-8-e2e-verify.sh); the API reads here only collect ids for that script.
  const UI = 'http://localhost:4200', API = 'http://localhost:8080/api';
  const shots = 'loops/loop-3-testing/outputs/screenshots/';
  const api = async (p) => (await page.request.get(API + p)).json();
  const steps = []; const ids = {};
  const step = (name, ok, info) => steps.push(`${ok ? 'PASS' : 'FAIL'} ${name}${info !== undefined ? ' — ' + JSON.stringify(info) : ''}`);
  const go = async (p) => { await page.goto(`${UI}/${p}`); await page.waitForLoadState('networkidle'); await page.waitForTimeout(500); };
  const errors = []; page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 1440, height: 900 });
  const today = (await api('/dashboard')).today;
  const pad = (n) => String(n).padStart(2, '0');
  const local = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  try {
    // 1. create task
    await go('tasks');
    await page.getByRole('button', { name: 'Add Task', exact: true }).click();
    const dlg = page.getByRole('dialog');
    await dlg.getByRole('textbox', { name: /^Title/ }).fill('P8R1E task');
    await dlg.getByRole('textbox', { name: /^Due date/ }).fill(today);
    await dlg.getByRole('button', { name: 'Add task' }).click();
    await page.getByRole('heading', { name: 'P8R1E task', level: 3 }).waitFor();
    ids.task = (await api('/tasks?q=P8R1E%20task'))[0].id;
    step('1 create task in UI (row visible)', true, ids.task);
    // 2. complete task
    await page.getByRole('button', { name: 'Mark as done: P8R1E task' }).click();
    await page.getByRole('button', { name: 'Mark as not done: P8R1E task' }).waitFor();
    step('2 complete task in UI (toggle shows done)', true);
    await page.screenshot({ path: shots + 'phase-8-t1-e2e-1-task-done.png' });
    // 3. create habit
    await go('habits');
    await page.getByRole('button', { name: 'Add Habit', exact: true }).click();
    await page.getByRole('dialog').getByRole('textbox', { name: /^Name/ }).fill('P8R1E habit');
    await page.getByRole('dialog').getByRole('button', { name: 'Add habit' }).click();
    await page.getByRole('heading', { name: 'P8R1E habit', level: 3 }).waitFor();
    ids.habit = (await api('/habits')).find((h) => h.name === 'P8R1E habit').id;
    step('3 create habit in UI', true, ids.habit);
    // 4. complete habit
    await page.getByRole('button', { name: 'Mark done for today: P8R1E habit' }).click();
    await page.getByRole('button', { name: "Undo today's completion: P8R1E habit" }).waitFor();
    step('4 complete habit in UI', true);
    await page.screenshot({ path: shots + 'phase-8-t1-e2e-2-habit-done.png' });
    // 5. learning card with 2 milestones
    await go('learning');
    await page.getByRole('button', { name: 'Add Learning Card', exact: true }).click();
    await page.getByRole('dialog').getByRole('textbox', { name: /^Title/ }).fill('P8R1E card');
    await page.getByRole('dialog').getByRole('button', { name: 'Add card' }).click();
    await page.getByRole('heading', { name: 'P8R1E card', level: 3 }).waitFor();
    await page.getByRole('button', { name: 'Expand P8R1E card' }).click();
    for (const m of ['P8R1E milestone A', 'P8R1E milestone B']) {
      await page.getByRole('textbox', { name: 'New milestone title for P8R1E card' }).fill(m);
      await page.getByRole('region', { name: 'P8R1E card' }).getByRole('button', { name: 'Add', exact: true }).click();
      await page.getByText(m).first().waitFor();
    }
    ids.card = (await api('/learning-cards')).find((c) => c.title === 'P8R1E card').id;
    step('5 add learning card with 2 milestones in UI', true, ids.card);
    await page.screenshot({ path: shots + 'phase-8-t1-e2e-3-learning.png' });
    // 6. build a plan from existing items (task + habit + learning card), running now
    const pt = await (await page.request.post(API + '/tasks', { data: { title: 'P8R1E plan task' } })).json(); ids.planTask = pt.id;
    await go('plans');
    await page.getByRole('button', { name: 'Create Plan' }).click();
    const b = page.getByRole('dialog');
    await b.getByRole('checkbox', { name: /^P8R1E plan task/ }).check();
    await b.getByRole('tab', { name: 'Habits' }).click();
    await b.getByRole('checkbox', { name: /^P8R1E habit/ }).check();
    await b.getByRole('tab', { name: 'Learning' }).click();
    await b.getByRole('checkbox', { name: /^P8R1E card/ }).check();
    await b.getByRole('button', { name: 'Next' }).click();
    await b.getByRole('textbox', { name: /^Title/ }).fill('P8R1E plan');
    const now = new Date();
    await b.locator('#plan-start').fill(local(new Date(now.getTime() - 5 * 60e3)));
    await b.locator('#plan-end').fill(local(new Date(now.getTime() + 55 * 60e3)));
    await b.getByRole('button', { name: 'Create plan' }).click();
    await page.waitForTimeout(800);
    const builderErr = await page.evaluate(() => [...document.querySelectorAll('dialog[open] [role=alert]')].map((a) => a.textContent.trim()));
    await page.getByRole('heading', { name: 'P8R1E plan', level: 3 }).waitFor({ timeout: 5000 });
    let plan = (await api('/plans')).find((p) => p.title === 'P8R1E plan'); ids.plan = plan.id;
    step('6 build plan from existing task + habit + learning card in UI', plan.items.length === 3, { status: plan.status, items: plan.items.map((i) => i.sourceType), builderErr });
    const card = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: 'P8R1E plan', level: 3 }) }).last();
    const restShown = await card.innerText();
    step('6b plan In Progress with rest time shown', plan.status === 'IN_PROGRESS' && /left|rest|remaining|:\d\d/i.test(restShown), restShown.replace(/\s+/g, ' ').slice(0, 160));
    await page.screenshot({ path: shots + 'phase-8-t1-e2e-4-plan-in-progress.png' });
    // 7. mark plan items done
    for (const n of [/^Task: ?P8R1E plan task/, /^Habit: ?P8R1E habit/, /^Learning: ?P8R1E card/]) {
      await card.getByRole('checkbox', { name: n }).check(); await page.waitForTimeout(500);
    }
    await page.waitForTimeout(800);
    plan = await api('/plans/' + ids.plan);
    const cardText = (await page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: 'P8R1E plan', level: 3 }) }).last().innerText()).replace(/\s+/g, ' ');
    step('7 mark all plan items done in UI → plan Completed (achieved)', plan.status === 'COMPLETED' && plan.progressPercent === 100 && /Completed/i.test(cardText), { status: plan.status, progress: plan.progressPercent, ui: cardText.slice(0, 160) });
    await page.screenshot({ path: shots + 'phase-8-t1-e2e-5-plan-completed.png' });
    // 8. dashboard reflects
    await go('dashboard');
    const d = await api('/dashboard');
    const main = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
    const expectTasks = `${d.tasks.doneCount} of ${d.tasks.totalActive}`;
    step('8 dashboard UI shows updated numbers equal to API', main.includes(`${d.tasks.completionPercent}%`) && main.includes(expectTasks) && main.includes(`${d.plans.completedCount} completed`) && main.includes(`${d.habits.completedTodayCount} / ${d.habits.activeCount}`) && main.includes(`${d.learning.milestonesDone} / ${d.learning.milestonesTotal}`), { api: { pct: d.tasks.completionPercent, done: expectTasks, habits: `${d.habits.completedTodayCount}/${d.habits.activeCount}`, plansCompleted: d.plans.completedCount, milestones: `${d.learning.milestonesDone}/${d.learning.milestonesTotal}` } });
    await page.screenshot({ path: shots + 'phase-8-t1-e2e-6-dashboard.png', fullPage: true });
  } catch (e) { steps.push('ERROR ' + e.message.split('\n')[0] + ' @ ' + page.url()); }
  return { steps, ids, consoleErrors: errors };
}
