import { TestBed } from '@angular/core/testing';
import { NowService } from './now.service';

// T019 — traces US4 (live rest time driven by a 1 s clock signal).
describe('NowService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-03T10:00:00Z'));
    TestBed.configureTestingModule({});
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  it('starts at the current time', () => {
    const service = TestBed.inject(NowService);
    expect(service.now()).toBe(Date.parse('2026-10-03T10:00:00Z'));
    expect(service.date().toISOString()).toBe('2026-10-03T10:00:00.000Z');
  });

  it('ticks every second', () => {
    const service = TestBed.inject(NowService);
    const start = service.now();
    vi.advanceTimersByTime(999);
    expect(service.now()).toBe(start);
    vi.advanceTimersByTime(1);
    expect(service.now()).toBe(start + 1000);
    vi.advanceTimersByTime(3000);
    expect(service.now()).toBe(start + 4000);
    expect(service.date().getTime()).toBe(start + 4000);
  });

  it('exposes a 1000 ms tick constant', () => {
    expect(NowService.TICK_MS).toBe(1000);
  });

  it('stops ticking when its injector is destroyed', () => {
    const service = TestBed.inject(NowService);
    const before = service.now();
    TestBed.resetTestingModule();
    vi.advanceTimersByTime(5000);
    expect(service.now()).toBe(before);
  });
});
