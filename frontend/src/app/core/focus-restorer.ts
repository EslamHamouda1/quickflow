import { DOCUMENT, DestroyRef, Injectable, inject } from '@angular/core';

/** Rows of lists/grids whose controls can disappear after an in-place action. */
const ROW_SELECTOR = '[role="listitem"], li, [data-id]';
/** Focusable controls including disabled ones (stable positions within a row). */
const CONTROLS = 'button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])';
const DIALOG_SELECTOR = 'dialog, [role="dialog"], [role="alertdialog"]';
/** How long to wait for a disabled control to become usable again (request round trip). */
const RESTORE_WINDOW_MS = 3000;
const POLL_MS = 40;

interface FocusRecord {
  el: HTMLElement;
  row: HTMLElement | null;
  list: HTMLElement | null;
  /** Index of `row` among the rows of `list`. */
  rowIndex: number;
  /** Index of `el` among the controls of its row (to pick the same control next door). */
  controlIndex: number;
  /** `data-id` of the entity row/card owning the control, and the control's accessible name. */
  ownerId: string | null;
  name: string;
}

/** How long a removed control may take to re-appear elsewhere before a neighbour gets focus. */
const TWIN_WAIT_MS = 300;

function accessibleName(el: HTMLElement): string {
  const aria = el.getAttribute('aria-label');
  if (aria) {
    return aria;
  }
  const label = (el as HTMLInputElement).labels?.[0];
  return (label?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * Keeps keyboard focus in place after in-place actions (FR-034, SC-010, WCAG 2.4.3).
 *
 * Controls are briefly disabled while their request runs, and rows leave a list (archive,
 * deactivate, complete from "due today"). Browsers then drop focus to `<body>`, which sends
 * keyboard users back to the top of the page. When the focused control was disabled or removed and
 * focus fell to `<body>`, this service puts focus back on the same control once it is usable
 * again, or on the matching control of the next (else previous) row of the same list, or on
 * `<main>` as a last resort. It never moves focus that the user or a dialog placed elsewhere, and
 * does nothing when focus was lost by clicking a non-focusable area.
 */
@Injectable({ providedIn: 'root' })
export class FocusRestorer {
  private readonly doc = inject(DOCUMENT);
  private last: FocusRecord | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private deadline = 0;
  private started = 0;

  constructor() {
    const onFocusIn = (e: FocusEvent) => this.record(e.target);
    const onFocusOut = () => this.check();
    this.doc.addEventListener('focusin', onFocusIn, true);
    this.doc.addEventListener('focusout', onFocusOut, true);
    // Removing or disabling an element does not always fire focusout; watch the DOM as well.
    const observer = new MutationObserver(() => this.check());
    observer.observe(this.doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled', 'class'] });
    inject(DestroyRef).onDestroy(() => {
      this.doc.removeEventListener('focusin', onFocusIn, true);
      this.doc.removeEventListener('focusout', onFocusOut, true);
      observer.disconnect();
      clearTimeout(this.timer);
    });
  }

  private record(target: EventTarget | null): void {
    clearTimeout(this.timer);
    this.timer = undefined;
    if (!(target instanceof HTMLElement) || target.closest(DIALOG_SELECTOR) || target.id === 'main-content') {
      this.last = null;
      return;
    }
    const row = target.closest<HTMLElement>(ROW_SELECTOR);
    const list = row?.parentElement ?? null;
    this.last = {
      el: target,
      row,
      list,
      rowIndex: row && list ? this.rows(list).indexOf(row) : -1,
      controlIndex: row ? Array.from(row.querySelectorAll(CONTROLS)).indexOf(target) : -1,
      ownerId: target.closest('[data-id]')?.getAttribute('data-id') ?? null,
      name: accessibleName(target),
    };
  }

  /** Starts a restore when the recorded control became unusable (checked synchronously). */
  private check(): void {
    if (this.timer === undefined && this.last && this.unusable(this.last.el)) {
      this.started = Date.now();
      this.deadline = this.started + RESTORE_WINDOW_MS;
      // First attempt after the current task, so dialogs and other code can place focus first.
      this.timer = setTimeout(() => this.tick(), 0);
    }
  }

  private tick(): void {
    this.timer = undefined;
    const rec = this.last;
    if (!rec || !this.focusLost()) {
      return;
    }
    const el = rec.el;
    if (el.isConnected && !this.leaving(el)) {
      if (!el.matches(':disabled')) {
        el.focus();
      } else if (Date.now() < this.deadline) {
        // Disabled while its request runs: wait until it is enabled again.
        this.timer = setTimeout(() => this.tick(), POLL_MS);
      }
      return;
    }
    // Removed: the same control may have been re-created elsewhere (e.g. a plan card moving to
    // "Completed"); give the new view a moment to render before falling back to a neighbour.
    const twin = this.twin(rec);
    if (twin) {
      twin.focus();
    } else if (Date.now() < this.started + TWIN_WAIT_MS) {
      this.timer = setTimeout(() => this.tick(), POLL_MS);
    } else {
      this.neighbour(rec)?.focus();
    }
  }

  /** A usable control with the same tag, accessible name and owning `[data-id]` row. */
  private twin(rec: FocusRecord): HTMLElement | null {
    if (!rec.ownerId) {
      return null;
    }
    const tag = rec.el.tagName.toLowerCase();
    for (const owner of Array.from(this.doc.querySelectorAll(`[data-id="${CSS.escape(rec.ownerId)}"]`))) {
      for (const c of Array.from(owner.querySelectorAll<HTMLElement>(tag))) {
        if (c !== rec.el && !this.unusable(c) && accessibleName(c) === rec.name) {
          return c;
        }
      }
    }
    return null;
  }

  private neighbour(rec: FocusRecord): HTMLElement | null {
    if (rec.list?.isConnected && rec.rowIndex >= 0) {
      const rows = this.rows(rec.list).filter((r) => r !== rec.row);
      const row = rows[Math.min(rec.rowIndex, rows.length - 1)];
      if (row) {
        const controls = Array.from(row.querySelectorAll<HTMLElement>(CONTROLS));
        const usable = (c: HTMLElement | undefined) => !!c && !this.unusable(c);
        const same = controls[rec.controlIndex];
        const target = usable(same) ? same : controls.find(usable);
        if (target) {
          return target;
        }
      }
    }
    return this.doc.querySelector<HTMLElement>('main#main-content');
  }

  private rows(list: HTMLElement): HTMLElement[] {
    return Array.from(list.children).filter(
      (r): r is HTMLElement => r instanceof HTMLElement && r.matches(ROW_SELECTOR) && !this.leaving(r),
    );
  }

  private focusLost(): boolean {
    const active = this.doc.activeElement;
    return !active || active === this.doc.body || active === this.doc.documentElement;
  }

  private unusable(el: HTMLElement): boolean {
    return !el.isConnected || el.matches(':disabled') || this.leaving(el);
  }

  /** True while the element's row runs its leave animation (Angular `animate.leave` classes). */
  private leaving(el: HTMLElement): boolean {
    return !!el.closest('[class*="-leave"]');
  }
}
