import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideRouter, withComponentInputBinding, withViewTransitions } from '@angular/router';

import { BASE_PATH } from './api';
import { routes } from './app.routes';
import { acceptHeaderInterceptor } from './core/accept-header.interceptor';
import { FocusRestorer } from './core/focus-restorer';
import { SettingsStore } from './core/settings.store';
import { environment } from '../environments/environment';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(
      routes,
      withViewTransitions({ skipInitialTransition: true }),
      withComponentInputBinding(),
    ),
    provideHttpClient(withFetch(), withInterceptors([acceptHeaderInterceptor])),
    { provide: BASE_PATH, useValue: environment.apiUrl },
    // Settings are loaded once before the first navigation (landing page, notification prefs).
    provideAppInitializer(() => inject(SettingsStore).load()),
    // Keeps keyboard focus on/near the used control after in-place actions (FR-034).
    provideAppInitializer(() => void inject(FocusRestorer)),
  ],
};
