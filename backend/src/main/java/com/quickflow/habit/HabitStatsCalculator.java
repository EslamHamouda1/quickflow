package com.quickflow.habit;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.Collection;
import java.util.Objects;
import java.util.Set;
import java.util.TreeSet;

/**
 * Pure habit metrics (research R8, FR-011). A period is a calendar date (DAILY) or an ISO week
 * Monday-Sunday (WEEKLY). Completion dates after {@code today} are ignored.
 */
public final class HabitStatsCalculator {

    /** Daily completion-rate window in days. */
    public static final int DAILY_WINDOW_DAYS = 30;
    /** Weekly completion-rate window in weeks. */
    public static final int WEEKLY_WINDOW_WEEKS = 12;

    /** Derived habit metrics. */
    public record HabitStats(boolean completedToday, boolean doneForCurrentPeriod, int currentStreak,
                             int completionRate, LocalDate lastCompletedDate) {
    }

    private HabitStatsCalculator() {
    }

    /**
     * @param frequency   DAILY or WEEKLY
     * @param createdDate the habit's creation date (completion-rate window starts no earlier)
     * @param completions completion dates (any order, duplicates allowed)
     * @param today       the current date
     */
    public static HabitStats calculate(HabitFrequency frequency, LocalDate createdDate,
                                       Collection<LocalDate> completions, LocalDate today) {
        Objects.requireNonNull(frequency, "frequency");
        Objects.requireNonNull(today, "today");
        TreeSet<LocalDate> dates = new TreeSet<>();
        for (LocalDate d : completions) {
            if (d != null && !d.isAfter(today)) {
                dates.add(d);
            }
        }
        boolean completedToday = dates.contains(today);
        LocalDate lastCompleted = dates.isEmpty() ? null : dates.last();
        LocalDate created = createdDate == null || createdDate.isAfter(today) ? today : createdDate;

        if (frequency == HabitFrequency.DAILY) {
            return new HabitStats(completedToday, completedToday, dailyStreak(dates, today),
                    dailyRate(dates, created, today), lastCompleted);
        }
        Set<LocalDate> weeks = new TreeSet<>();
        dates.forEach(d -> weeks.add(weekStart(d)));
        LocalDate currentWeek = weekStart(today);
        boolean doneThisWeek = weeks.contains(currentWeek);
        return new HabitStats(completedToday, doneThisWeek, weeklyStreak(weeks, currentWeek),
                weeklyRate(weeks, created, currentWeek), lastCompleted);
    }

    /** Monday of the ISO week containing {@code date}. */
    public static LocalDate weekStart(LocalDate date) {
        return date.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
    }

    private static int dailyStreak(Set<LocalDate> dates, LocalDate today) {
        LocalDate cursor = dates.contains(today) ? today : today.minusDays(1);
        int streak = 0;
        while (dates.contains(cursor)) {
            streak++;
            cursor = cursor.minusDays(1);
        }
        return streak;
    }

    private static int weeklyStreak(Set<LocalDate> weeks, LocalDate currentWeek) {
        LocalDate cursor = weeks.contains(currentWeek) ? currentWeek : currentWeek.minusWeeks(1);
        int streak = 0;
        while (weeks.contains(cursor)) {
            streak++;
            cursor = cursor.minusWeeks(1);
        }
        return streak;
    }

    private static int dailyRate(TreeSet<LocalDate> dates, LocalDate created, LocalDate today) {
        LocalDate start = max(today.minusDays(DAILY_WINDOW_DAYS - 1L), created);
        long periods = ChronoUnit.DAYS.between(start, today) + 1;
        long done = dates.subSet(start, true, today, true).size();
        return percent(done, periods);
    }

    private static int weeklyRate(Set<LocalDate> weeks, LocalDate created, LocalDate currentWeek) {
        LocalDate start = max(currentWeek.minusWeeks(WEEKLY_WINDOW_WEEKS - 1L), weekStart(created));
        long periods = ChronoUnit.WEEKS.between(start, currentWeek) + 1;
        long done = weeks.stream().filter(w -> !w.isBefore(start) && !w.isAfter(currentWeek)).count();
        return percent(done, periods);
    }

    private static int percent(long done, long periods) {
        if (periods <= 0) {
            return 0;
        }
        return (int) Math.max(0, Math.min(100, Math.round(done * 100.0 / periods)));
    }

    private static LocalDate max(LocalDate a, LocalDate b) {
        return a.isAfter(b) ? a : b;
    }
}
