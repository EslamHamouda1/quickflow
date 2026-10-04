import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IconComponent } from './icon.component';

/** Guides the user toward the relevant "add" action when a list is empty. */
@Component({
  selector: 'app-empty-state',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="empty" animate.enter="qf-enter-scale">
      <div class="empty__icon"><app-icon [name]="icon()" [size]="32" /></div>
      <h2 class="empty__title">{{ heading() }}</h2>
      @if (message()) {
        <p class="empty__message">{{ message() }}</p>
      }
      @if (actionLabel()) {
        <button type="button" class="btn btn-primary" (click)="action.emit()">
          <app-icon name="plus" [size]="18" />
          {{ actionLabel() }}
        </button>
      }
      <ng-content />
    </div>
  `,
  styles: `
    .empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: var(--space-3);
      padding: var(--space-12) var(--space-6);
      border: 1px dashed var(--border-strong);
      border-radius: var(--radius-xl);
      background: var(--surface);
    }
    .empty__icon {
      display: grid;
      place-items: center;
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: var(--primary-soft);
      color: var(--primary);
    }
    .empty__title {
      font-size: var(--text-lg);
    }
    .empty__message {
      max-width: 42ch;
      color: var(--text-muted);
    }
  `,
})
export class EmptyStateComponent {
  readonly icon = input('inbox');
  readonly heading = input.required<string>();
  readonly message = input('');
  readonly actionLabel = input('');
  readonly action = output<void>();
}
