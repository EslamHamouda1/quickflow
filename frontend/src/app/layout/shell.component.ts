import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { IconComponent } from '../shared/ui/icon.component';
import { ToastHostComponent } from '../shared/ui/toast-host.component';
import { ConfirmDialogComponent } from '../shared/ui/confirm-dialog.component';
import { PlanStartWatcher } from '../core/plan-start-watcher.service';

export interface NavItem {
  path: string;
  label: string;
  shortLabel: string;
  icon: string;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { path: '/dashboard', label: 'Dashboard', shortLabel: 'Dashboard', icon: 'dashboard' },
  { path: '/tasks', label: 'Tasks', shortLabel: 'Tasks', icon: 'tasks' },
  { path: '/habits', label: 'Habits', shortLabel: 'Habits', icon: 'habits' },
  { path: '/learning', label: 'Learning Resources', shortLabel: 'Learning', icon: 'learning' },
  { path: '/plans', label: 'Todo Plans', shortLabel: 'Plans', icon: 'plans' },
  { path: '/settings', label: 'Settings', shortLabel: 'Settings', icon: 'settings' },
];

interface IndicatorBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** App shell: skip link, persistent navigation (sidebar ≥ 900 px, top bar below), main outlet, toasts, confirm dialog. */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IconComponent, ToastHostComponent, ConfirmDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(window:resize)': 'measure()',
  },
  template: `
    <a class="skip-link" href="#main-content" (click)="skipToContent($event)">Skip to main content</a>

    <div class="shell">
      <header class="sidebar">
        <a class="brand" routerLink="/dashboard" aria-label="QuickFlow home">
          <span class="brand__mark"><app-icon name="bolt" [size]="18" /></span>
          <span class="brand__name">QuickFlow</span>
        </a>

        <nav class="nav" aria-label="Main navigation">
          <ul #navList class="nav__list" role="list">
            @if (indicator(); as box) {
              <li
                class="nav__indicator"
                aria-hidden="true"
                [style.transform]="'translate(' + box.x + 'px,' + box.y + 'px)'"
                [style.width.px]="box.w"
                [style.height.px]="box.h"
              ></li>
            }
            @for (item of navItems; track item.path) {
              <li class="nav__item">
                <a
                  class="nav__link"
                  [routerLink]="item.path"
                  routerLinkActive="is-active"
                  ariaCurrentWhenActive="page"
                  (isActiveChange)="onActiveChange($event, link)"
                  [attr.title]="item.label"
                  #link
                >
                  <app-icon class="nav__icon" [name]="item.icon" [size]="20" />
                  <span class="nav__label nav__label--long">{{ item.label }}</span>
                  <span class="nav__label nav__label--short" aria-hidden="true">{{ item.shortLabel }}</span>
                </a>
              </li>
            }
          </ul>
        </nav>
      </header>

      <main id="main-content" class="content" tabindex="-1" #main>
        <div class="content__inner">
          <router-outlet />
        </div>
      </main>
    </div>

    <p class="sr-only" aria-live="polite" aria-atomic="true">{{ routeAnnouncement() }}</p>
    <app-toast-host />
    <app-confirm-dialog />
  `,
  styles: `
    :host {
      display: block;
      min-height: 100vh;
    }

    .skip-link {
      position: fixed;
      top: var(--space-2);
      left: var(--space-2);
      z-index: calc(var(--z-toast) + 1);
      padding: var(--space-2) var(--space-4);
      border-radius: var(--radius-md);
      background: var(--primary);
      color: var(--on-primary);
      font-weight: var(--weight-semibold);
      text-decoration: none;
      transform: translateY(-200%);
      transition: transform var(--duration-fast) var(--ease-out);
    }
    .skip-link:focus,
    .skip-link:focus-visible {
      transform: translateY(0);
    }

    .shell {
      display: grid;
      grid-template-columns: var(--sidebar-width) minmax(0, 1fr);
      min-height: 100vh;
    }

    .sidebar {
      position: sticky;
      top: 0;
      height: 100vh;
      display: flex;
      flex-direction: column;
      gap: var(--space-6);
      padding: var(--space-5) var(--space-3);
      background: var(--bg-elevated);
      border-right: 1px solid var(--border);
      z-index: var(--z-nav);
    }

    .brand {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: 0 var(--space-3);
      color: var(--text);
      text-decoration: none;
      font-weight: var(--weight-bold);
      font-size: var(--text-lg);
      letter-spacing: -0.01em;
    }
    .brand__mark {
      display: grid;
      place-items: center;
      width: 32px;
      height: 32px;
      border-radius: var(--radius-md);
      background: linear-gradient(135deg, var(--primary), var(--accent));
      color: var(--on-primary);
      box-shadow: var(--shadow-2);
    }

    .nav__list {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
      padding: 0;
      list-style: none;
    }
    .nav__item {
      position: relative;
      z-index: 1;
    }
    .nav__indicator {
      position: absolute;
      top: 0;
      left: 0;
      z-index: 0;
      border-radius: var(--radius-md);
      background: var(--primary-soft);
      box-shadow: inset 3px 0 0 var(--primary);
      pointer-events: none;
      transition:
        transform var(--duration-slow) var(--ease-out),
        width var(--duration-slow) var(--ease-out),
        height var(--duration-slow) var(--ease-out);
    }
    .nav__link {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      min-height: 44px;
      padding: var(--space-2) var(--space-3);
      border-radius: var(--radius-md);
      color: var(--text-muted);
      text-decoration: none;
      font-weight: var(--weight-medium);
      font-size: var(--text-sm);
      transition: color var(--duration-fast) var(--ease-standard), background-color var(--duration-fast) var(--ease-standard);
    }
    .nav__link:hover {
      color: var(--text);
      background: color-mix(in srgb, var(--surface-hover) 60%, transparent);
    }
    .nav__link.is-active {
      color: var(--primary);
      font-weight: var(--weight-semibold);
    }
    .nav__link.is-active:hover {
      background: transparent;
    }
    .nav__icon {
      transition: transform var(--duration-base) var(--ease-spring);
    }
    .nav__link.is-active .nav__icon {
      transform: scale(1.1);
    }
    .nav__label--short {
      display: none;
    }

    .content {
      min-width: 0;
      outline: none;
    }
    .content__inner {
      max-width: var(--content-max);
      margin: 0 auto;
      padding: var(--space-8) var(--space-8) var(--space-12);
    }

    /* Narrow screens: top bar with a horizontally scrollable nav row. */
    @media (max-width: 899px) {
      .shell {
        grid-template-columns: minmax(0, 1fr);
        grid-template-rows: auto 1fr;
      }
      .sidebar {
        height: auto;
        flex-direction: column;
        gap: var(--space-2);
        padding: var(--space-3) var(--space-3) 0;
        border-right: none;
        border-bottom: 1px solid var(--border);
        box-shadow: var(--shadow-1);
      }
      .brand {
        min-height: 32px;
      }
      .nav__list {
        flex-direction: row;
        gap: 0;
        overflow-x: auto;
        scrollbar-width: none;
        padding-bottom: var(--space-2);
      }
      .nav__list::-webkit-scrollbar {
        display: none;
      }
      .nav__item {
        flex: 1 0 auto;
      }
      .nav__link {
        flex-direction: column;
        gap: 2px;
        min-height: 52px;
        min-width: 54px;
        padding: var(--space-1) 2px;
        font-size: var(--text-xs);
      }
      .nav__indicator {
        box-shadow: inset 0 -3px 0 var(--primary);
      }
      .nav__label--long {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip: rect(0 0 0 0);
        white-space: nowrap;
      }
      .nav__label--short {
        display: inline;
      }
      .content__inner {
        padding: var(--space-5) var(--space-4) var(--space-10);
      }
    }
  `,
})
export class ShellComponent {
  protected readonly navItems = NAV_ITEMS;
  protected readonly indicator = signal<IndicatorBox | null>(null);

  private readonly main = viewChild.required<ElementRef<HTMLElement>>('main');
  private activeLink: HTMLElement | null = null;

  constructor() {
    // Plan start notifications run on every page (FR-023).
    inject(PlanStartWatcher).start();
    afterNextRender(() => this.measure());

    // Announce in-app page changes to screen readers (the initial load is announced by the browser).
    let first = true;
    const sub = inject(Router).events.subscribe((e) => {
      if (!(e instanceof NavigationEnd)) {
        return;
      }
      if (first) {
        first = false;
        return;
      }
      // The title strategy updates document.title at the end of navigation; read it on the next task.
      setTimeout(() => this.routeAnnouncement.set(`${document.title.split(' · ')[0]} page`));
    });
    inject(DestroyRef).onDestroy(() => sub.unsubscribe());
  }

  /** Text of the polite live region that announces route changes. */
  protected readonly routeAnnouncement = signal('');

  protected onActiveChange(active: boolean, link: HTMLElement): void {
    if (active) {
      this.activeLink = link;
      this.measure();
      this.revealInNavRow(link);
    } else if (this.activeLink === link) {
      this.activeLink = null;
      this.indicator.set(null);
    }
  }

  /** Positions the animated active indicator on the active link (re-run on resize). */
  measure(): void {
    const link = this.activeLink;
    if (!link || !link.offsetParent) {
      return;
    }
    const item = link.parentElement as HTMLElement;
    this.indicator.set({ x: item.offsetLeft, y: item.offsetTop, w: item.offsetWidth, h: item.offsetHeight });
  }

  /**
   * Keeps the active link visible in the horizontally scrolling top-bar nav. Adjusts scrollLeft
   * directly (not scrollIntoView) so the browser's sequential focus starting point is untouched
   * and the first Tab still reaches the skip link.
   */
  private revealInNavRow(link: HTMLElement): void {
    const item = link.parentElement as HTMLElement | null;
    const list = item?.parentElement as HTMLElement | null;
    if (!item || !list || list.scrollWidth <= list.clientWidth) {
      return;
    }
    const left = item.offsetLeft;
    const right = left + item.offsetWidth;
    if (left < list.scrollLeft) {
      list.scrollLeft = left;
    } else if (right > list.scrollLeft + list.clientWidth) {
      list.scrollLeft = right - list.clientWidth;
    }
  }

  protected skipToContent(event: Event): void {
    event.preventDefault();
    const main = this.main().nativeElement;
    main.focus();
    main.scrollIntoView({ block: 'start' });
  }
}
