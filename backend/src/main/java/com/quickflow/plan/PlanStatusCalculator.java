package com.quickflow.plan;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.Collection;

/**
 * Pure derivation of plan status, progress and rest time (research R4, FR-020..FR-022).
 * No side effects, no clock: "now" is an input.
 */
public final class PlanStatusCalculator {

    /** Derived view of a plan at a given instant. {@code restSeconds} is null unless IN_PROGRESS. */
    public record PlanState(PlanStatus status, int itemsTotal, int itemsDone, int progressPercent, Long restSeconds) {
    }

    private PlanStatusCalculator() {
    }

    public static PlanState calculate(OffsetDateTime start, OffsetDateTime end, Collection<PlanItem> items,
                                      OffsetDateTime now) {
        int total = items.size();
        int done = (int) items.stream().filter(PlanItem::isDone).count();
        PlanStatus status = status(start, end, total, done, now);
        Long rest = status == PlanStatus.IN_PROGRESS
                ? Math.max(0L, Duration.between(now, end).getSeconds())
                : null;
        return new PlanState(status, total, done, progressPercent(total, done), rest);
    }

    /** COMPLETED if all items done or now ≥ end; else IN_PROGRESS if now ≥ start; else NOT_STARTED. */
    public static PlanStatus status(OffsetDateTime start, OffsetDateTime end, int total, int done,
                                    OffsetDateTime now) {
        boolean allDone = total > 0 && done >= total;
        if (allDone || !now.isBefore(end)) {
            return PlanStatus.COMPLETED;
        }
        if (!now.isBefore(start)) {
            return PlanStatus.IN_PROGRESS;
        }
        return PlanStatus.NOT_STARTED;
    }

    /** round(done × 100 / total); 0 when there are no items. */
    public static int progressPercent(int total, int done) {
        if (total <= 0) {
            return 0;
        }
        int pct = (int) Math.round(done * 100.0 / total);
        return Math.max(0, Math.min(100, pct));
    }
}
