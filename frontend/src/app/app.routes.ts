import { Routes } from '@angular/router';

import { defaultViewGuard } from './core/settings.store';

export const routes: Routes = [
  // Landing page comes from Settings → default view (US6); the guard always redirects.
  { path: '', pathMatch: 'full', canActivate: [defaultViewGuard], children: [] },
  {
    path: 'dashboard',
    title: 'Dashboard · QuickFlow',
    loadComponent: () => import('./features/dashboard/dashboard-page.component').then((m) => m.DashboardPageComponent),
  },
  {
    path: 'tasks',
    title: 'Tasks · QuickFlow',
    loadComponent: () => import('./features/tasks/tasks-page.component').then((m) => m.TasksPageComponent),
  },
  {
    path: 'habits',
    title: 'Habits · QuickFlow',
    loadComponent: () => import('./features/habits/habits-page.component').then((m) => m.HabitsPageComponent),
  },
  {
    path: 'learning',
    title: 'Learning Resources · QuickFlow',
    loadComponent: () => import('./features/learning/learning-page.component').then((m) => m.LearningPageComponent),
  },
  {
    path: 'plans',
    title: 'Todo Plans · QuickFlow',
    loadComponent: () => import('./features/plans/plans-page.component').then((m) => m.PlansPageComponent),
  },
  {
    path: 'settings',
    title: 'Settings · QuickFlow',
    loadComponent: () => import('./features/settings/settings-page.component').then((m) => m.SettingsPageComponent),
  },
  { path: '**', redirectTo: 'dashboard' },
];
