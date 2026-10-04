package com.quickflow.learning;

/** Pure rules of research R9: status and progress derived from milestone counts. */
public final class LearningStatusCalculator {

    private LearningStatusCalculator() {
    }

    /** none done → NOT_STARTED, some → IN_PROGRESS, all → COMPLETED; no milestones → {@code current}. */
    public static LearningStatus derive(int total, int done, LearningStatus current) {
        if (total <= 0) {
            return current;
        }
        if (done <= 0) {
            return LearningStatus.NOT_STARTED;
        }
        return done >= total ? LearningStatus.COMPLETED : LearningStatus.IN_PROGRESS;
    }

    /** round(done * 100 / total), 0 when there are no milestones; clamped to 0..100. */
    public static int progressPercent(int total, int done) {
        if (total <= 0) {
            return 0;
        }
        int pct = (int) Math.round(done * 100.0 / total);
        return Math.max(0, Math.min(100, pct));
    }
}
