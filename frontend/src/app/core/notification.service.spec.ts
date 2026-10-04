import { TestBed } from '@angular/core/testing';
import { NotificationService } from './notification.service';

// T019 — traces US4 (plan start notification: in-app toast, browser notification when enabled + permitted)
// and US6 AS3 (browser permission denied → in-app notifications still work).

class FakeNotification {
  static permission: NotificationPermission = 'default';
  static requestPermission = vi.fn(async () => FakeNotification.permission);
  static instances: { title: string; options?: NotificationOptions }[] = [];
  constructor(title: string, options?: NotificationOptions) {
    FakeNotification.instances.push({ title, options });
  }
}

describe('NotificationService', () => {
  let service: NotificationService;
  const original = (globalThis as { Notification?: unknown }).Notification;

  beforeEach(() => {
    vi.useFakeTimers();
    FakeNotification.permission = 'default';
    FakeNotification.instances = [];
    FakeNotification.requestPermission.mockClear();
    (globalThis as { Notification?: unknown }).Notification = FakeNotification;
    TestBed.configureTestingModule({});
    service = TestBed.inject(NotificationService);
  });

  afterEach(() => {
    vi.useRealTimers();
    if (original === undefined) {
      delete (globalThis as { Notification?: unknown }).Notification;
    } else {
      (globalThis as { Notification?: unknown }).Notification = original;
    }
  });

  it('shows an in-app toast and auto-dismisses it after the default duration', () => {
    const id = service.notify('Plan started', { message: 'Morning focus' });
    expect(id).toBeGreaterThan(0);
    expect(service.toasts()).toEqual([{ id, kind: 'info', title: 'Plan started', message: 'Morning focus' }]);
    vi.advanceTimersByTime(NotificationService.DEFAULT_DURATION_MS - 1);
    expect(service.toasts().length).toBe(1);
    vi.advanceTimersByTime(1);
    expect(service.toasts()).toEqual([]);
  });

  it('suppresses in-app notify() when in-app notifications are disabled', () => {
    service.inAppEnabled.set(false);
    expect(service.notify('Plan started')).toBe(-1);
    expect(service.toasts()).toEqual([]);
  });

  it('toast() always shows feedback even when in-app notifications are disabled', () => {
    service.inAppEnabled.set(false);
    const id = service.toast('Saved');
    expect(service.toasts().map((t) => t.id)).toEqual([id]);
  });

  it('keeps a toast with durationMs 0 until dismissed', () => {
    const id = service.toast('Sticky', { durationMs: 0 });
    vi.advanceTimersByTime(60_000);
    expect(service.toasts().length).toBe(1);
    service.dismiss(id);
    expect(service.toasts()).toEqual([]);
  });

  it('success() and error() set the kind; error stays 8 s', () => {
    service.success('Done');
    service.error('Failed', 'Network');
    expect(service.toasts().map((t) => t.kind)).toEqual(['success', 'error']);
    vi.advanceTimersByTime(NotificationService.DEFAULT_DURATION_MS);
    expect(service.toasts().map((t) => t.kind)).toEqual(['error']);
    vi.advanceTimersByTime(3000);
    expect(service.toasts()).toEqual([]);
  });

  it('keeps at most MAX_TOASTS toasts, dropping the oldest', () => {
    const ids = [1, 2, 3, 4, 5, 6].map((n) => service.toast(`T${n}`));
    expect(service.toasts().map((t) => t.id)).toEqual(ids.slice(2));
    expect(service.toasts().length).toBe(NotificationService.MAX_TOASTS);
  });

  it('dismissing an unknown id is a no-op', () => {
    service.toast('A');
    service.dismiss(9999);
    expect(service.toasts().length).toBe(1);
  });

  it('raises a browser notification only when enabled and permission is granted', () => {
    FakeNotification.permission = 'granted';
    expect(service.browserNotify('Plan started')).toBe(false); // disabled by default
    service.browserEnabled.set(true);
    expect(service.browserNotify('Plan started', 'body')).toBe(true);
    expect(FakeNotification.instances).toEqual([
      { title: 'Plan started', options: { body: 'body', tag: 'quickflow-Plan started' } },
    ]);
  });

  it('denied browser permission still shows the in-app toast (US6 AS3)', () => {
    FakeNotification.permission = 'denied';
    service.browserEnabled.set(true);
    const id = service.notify('Plan started', { browser: true });
    expect(FakeNotification.instances).toEqual([]);
    expect(id).toBeGreaterThan(0);
    expect(service.toasts().length).toBe(1);
  });

  it('notify() with browser: true and permission granted raises both', () => {
    FakeNotification.permission = 'granted';
    service.browserEnabled.set(true);
    service.notify('Plan started', { browser: true, message: 'Now' });
    expect(FakeNotification.instances.length).toBe(1);
    expect(service.toasts().length).toBe(1);
  });

  it('returns false when the Notification constructor throws', () => {
    FakeNotification.permission = 'granted';
    service.browserEnabled.set(true);
    const throwing = class extends FakeNotification {
      constructor() {
        super('x');
        throw new Error('Illegal constructor');
      }
    };
    (globalThis as { Notification?: unknown }).Notification = throwing;
    expect(service.browserNotify('x')).toBe(false);
  });

  it('reports and requests browser permission', async () => {
    FakeNotification.permission = 'granted';
    expect(service.browserPermission()).toBe('granted');
    expect(await service.requestBrowserPermission()).toBe('granted');
    expect(FakeNotification.requestPermission).toHaveBeenCalledTimes(1);
  });

  it('reports unsupported when the Notification API is missing', async () => {
    delete (globalThis as { Notification?: unknown }).Notification;
    service.browserEnabled.set(true);
    expect(service.browserPermission()).toBe('unsupported');
    expect(await service.requestBrowserPermission()).toBe('unsupported');
    expect(service.browserNotify('x')).toBe(false);
  });
});
