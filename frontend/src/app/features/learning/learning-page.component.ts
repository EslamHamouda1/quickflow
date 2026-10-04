import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';

import { LearningCard } from '../../api';
import { ConfirmDialogService } from '../../shared/ui/confirm-dialog.service';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { IconComponent } from '../../shared/ui/icon.component';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { LearningCardFormDialogComponent } from './learning-card-form-dialog.component';
import { LearningCardComponent } from './learning-card.component';
import { LearningStore } from './learning.store';

interface FormState {
  card: LearningCard | null;
}

/** Learning Resources page (US3): card grid with milestones and notes, CRUD, manual status. */
@Component({
  selector: 'app-learning-page',
  imports: [EmptyStateComponent, IconComponent, LearningCardComponent, LearningCardFormDialogComponent, PageHeaderComponent],
  providers: [LearningStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header heading="Learning Resources" subtitle="Courses, books and topics with milestones and notes">
      <button type="button" class="btn btn-primary" (click)="openCreate()">
        <app-icon name="plus" [size]="18" /> Add Learning Card
      </button>
    </app-page-header>

    @if (!store.loaded()) {
      <div class="grid" aria-busy="true" aria-label="Loading learning cards">
        @for (i of [1, 2, 3]; track i) {
          <div class="skeleton skeleton-card"></div>
        }
      </div>
    } @else if (store.error() && store.cards().length === 0) {
      <app-empty-state icon="error" heading="Could not load learning cards" [message]="store.error()!">
        <button type="button" class="btn" (click)="store.load()"><app-icon name="restore" [size]="16" /> Retry</button>
      </app-empty-state>
    } @else if (store.cards().length === 0) {
      <app-empty-state
        icon="learning"
        heading="No learning cards yet"
        message="Add a course, book or topic, then break it into milestones and keep notes as you go."
        actionLabel="Add Learning Card"
        (action)="openCreate()"
      />
    } @else {
      <section aria-labelledby="learning-heading">
        <div class="section__head">
          <h2 id="learning-heading" class="section__title">Your cards</h2>
          <p class="section__count" aria-live="polite" aria-atomic="true">{{ summary() }}</p>
          @if (store.loading()) {
            <span class="section__loading" role="status" aria-label="Updating learning cards"></span>
          }
        </div>
        <div class="grid" role="list" aria-label="Learning cards">
          @for (card of store.cards(); track card.id) {
            <app-learning-card
              animate.enter="lcard-enter"
              animate.leave="lcard-leave"
              [card]="card"
              [busy]="store.pending().has(card.id)"
              (edit)="openEdit($event)"
              (remove)="confirmRemove($event)"
            />
          }
        </div>
      </section>
    }

    @if (form(); as f) {
      <app-learning-card-form-dialog [card]="f.card" (closed)="form.set(null)" />
    }
  `,
  styles: `
    :host { display: block; }
    .section__head { display: flex; align-items: baseline; gap: var(--space-3); margin-bottom: var(--space-3); }
    .section__title { font-size: var(--text-lg); }
    .section__count { color: var(--text-muted); font-size: var(--text-sm); }
    .section__loading {
      width: 14px;
      height: 14px;
      align-self: center;
      border: 2px solid var(--primary);
      border-right-color: transparent;
      border-radius: 50%;
      animation: spin var(--duration-slow) linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr));
      align-items: start;
      gap: var(--space-4);
    }
    .skeleton-card { height: 180px; border-radius: var(--radius-lg); }
    .grid ::ng-deep .lcard-enter { animation: qf-scale-in var(--duration-base) var(--ease-out) both; }
    .grid ::ng-deep .lcard-leave { animation: qf-scale-out var(--duration-base) var(--ease-in) both; }
  `,
})
export class LearningPageComponent {
  protected readonly store = inject(LearningStore);
  private readonly confirm = inject(ConfirmDialogService);
  private readonly router = inject(Router);

  /** `?new=1` (dashboard quick-add) opens the create form. */
  readonly newParam = input<string | undefined>(undefined, { alias: 'new' });

  protected readonly form = signal<FormState | null>(null);

  protected readonly summary = computed(() => {
    const total = this.store.cards().length;
    return `${total} card${total === 1 ? '' : 's'} · ${this.store.inProgressCount()} in progress · ${this.store.completedCount()} completed`;
  });

  constructor() {
    effect(() => {
      if (this.newParam()) {
        untracked(() => {
          this.openCreate();
          void this.router.navigate([], { queryParams: { new: null }, queryParamsHandling: 'merge', replaceUrl: true });
        });
      }
    });
  }

  protected openCreate(): void {
    this.form.set({ card: null });
  }

  protected openEdit(card: LearningCard): void {
    this.form.set({ card });
  }

  protected async confirmRemove(card: LearningCard): Promise<void> {
    const title = card.title.length > 80 ? `${card.title.slice(0, 79)}…` : card.title;
    const ok = await this.confirm.confirm({
      title: 'Remove learning card?',
      message: `"${title}" with its ${card.milestonesTotal} milestone(s) and ${card.notes.length} note(s) will be permanently deleted.`,
      confirmLabel: 'Remove',
      danger: true,
    });
    if (ok) {
      await this.store.remove(card);
    }
  }
}
