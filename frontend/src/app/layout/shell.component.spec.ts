import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { NAV_ITEMS, ShellComponent } from './shell.component';
import { routes } from '../app.routes';

// T019 — traces US6 AS1 (persistent navigation with six links, current page highlighted, each link opens its page).

describe('ShellComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ShellComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter(routes)],
    }).compileComponents();
  });

  function links(root: HTMLElement): HTMLAnchorElement[] {
    return Array.from(root.querySelectorAll<HTMLAnchorElement>('nav[aria-label="Main navigation"] a.nav__link'));
  }

  it('declares the six navigation items in order', () => {
    expect(NAV_ITEMS.map((i) => i.label)).toEqual([
      'Dashboard',
      'Tasks',
      'Habits',
      'Learning Resources',
      'Todo Plans',
      'Settings',
    ]);
    expect(NAV_ITEMS.map((i) => i.path)).toEqual([
      '/dashboard',
      '/tasks',
      '/habits',
      '/learning',
      '/plans',
      '/settings',
    ]);
  });

  it('renders a skip link, a named navigation landmark with six labelled links, and a focusable main', async () => {
    const fixture = TestBed.createComponent(ShellComponent);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;

    const skip = el.querySelector<HTMLAnchorElement>('a.skip-link');
    expect(skip?.getAttribute('href')).toBe('#main-content');
    expect(skip?.textContent?.trim()).toBe('Skip to main content');

    const anchors = links(el);
    expect(anchors.length).toBe(6);
    expect(anchors.map((a) => a.getAttribute('href'))).toEqual(NAV_ITEMS.map((i) => i.path));
    expect(anchors.map((a) => a.getAttribute('title'))).toEqual(NAV_ITEMS.map((i) => i.label));
    anchors.forEach((a, i) => expect(a.textContent).toContain(NAV_ITEMS[i].label));

    const main = el.querySelector<HTMLElement>('main#main-content');
    expect(main?.getAttribute('tabindex')).toBe('-1');
    expect(el.querySelector('app-toast-host')).toBeTruthy();
    expect(el.querySelector('app-confirm-dialog')).toBeTruthy();
  });

  it('skip link moves focus to the main content', async () => {
    const fixture = TestBed.createComponent(ShellComponent);
    document.body.appendChild(fixture.nativeElement);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const main = el.querySelector<HTMLElement>('#main-content')!;
    main.scrollIntoView = vi.fn();
    const evt = new MouseEvent('click', { bubbles: true, cancelable: true });
    el.querySelector<HTMLAnchorElement>('a.skip-link')!.dispatchEvent(evt);
    expect(evt.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(main);
    expect(main.scrollIntoView).toHaveBeenCalled();
    fixture.nativeElement.remove();
  });

  it.each(NAV_ITEMS.map((item, index) => [item.path, index] as const))(
    'navigating to %s highlights exactly that link with aria-current="page"',
    async (path, index) => {
      const fixture = TestBed.createComponent(ShellComponent);
      await TestBed.inject(Router).navigateByUrl(path);
      await fixture.whenStable();
      const anchors = links(fixture.nativeElement);
      const active = anchors.filter((a) => a.getAttribute('aria-current') === 'page');
      expect(active.length).toBe(1);
      expect(active[0]).toBe(anchors[index]);
      expect(anchors[index].classList).toContain('is-active');
      expect(TestBed.inject(Router).url).toBe(path);
    },
  );

  it('clicking a nav link navigates to its page and renders the page heading', async () => {
    const fixture = TestBed.createComponent(ShellComponent);
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/dashboard');
    await fixture.whenStable();
    links(fixture.nativeElement)[1].click();
    await fixture.whenStable();
    expect(router.url).toBe('/tasks');
    const h1 = (fixture.nativeElement as HTMLElement).querySelector('main h1');
    expect(h1?.textContent).toContain('Tasks');
  });

  it('redirects the empty and unknown routes to /dashboard', async () => {
    const fixture = TestBed.createComponent(ShellComponent);
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/');
    await fixture.whenStable();
    expect(router.url).toBe('/dashboard');
    await router.navigateByUrl('/does-not-exist');
    await fixture.whenStable();
    expect(router.url).toBe('/dashboard');
  });

  it('measure() is safe without an active link', () => {
    const fixture = TestBed.createComponent(ShellComponent);
    expect(() => fixture.componentInstance.measure()).not.toThrow();
  });
});
