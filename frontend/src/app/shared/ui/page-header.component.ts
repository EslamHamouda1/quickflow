import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Page title (the single h1 of a page), optional subtitle and projected actions. */
@Component({
  selector: 'app-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ph__text">
      <h1 class="ph__title">{{ heading() }}</h1>
      @if (subtitle()) {
        <p class="ph__subtitle">{{ subtitle() }}</p>
      }
    </div>
    <div class="ph__actions"><ng-content /></div>
  `,
  styles: `
    :host {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      justify-content: space-between;
      gap: var(--space-4);
      margin-bottom: var(--space-6);
    }
    .ph__text { min-width: 0; }
    .ph__title { font-size: var(--text-2xl); font-weight: var(--weight-bold); letter-spacing: -0.01em; }
    .ph__subtitle { color: var(--text-muted); margin-top: var(--space-1); }
    .ph__actions { display: flex; flex-wrap: wrap; gap: var(--space-2); }
    .ph__actions:empty { display: none; }
  `,
})
export class PageHeaderComponent {
  readonly heading = input.required<string>();
  readonly subtitle = input('');
}
