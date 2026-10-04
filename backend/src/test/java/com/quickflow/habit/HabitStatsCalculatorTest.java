package com.quickflow.habit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import org.junit.jupiter.api.Test;

import com.quickflow.habit.HabitStatsCalculator.HabitStats;

/**
 * T047 — pure {@link HabitStatsCalculator}. TODAY = Wednesday 2026-06-17 (ISO week Mon 06-15 .. Sun 06-21).
 * Traces US2 AS2, AS5, FR-011 and the edge case "Weekly = any completion in the current ISO week".
 */
class HabitStatsCalculatorTest {

    static final LocalDate TODAY = LocalDate.of(2026, 6, 17);
    static final LocalDate OLD = LocalDate.of(2025, 1, 1);

    private static HabitStats daily(LocalDate created, LocalDate... dates) {
        return HabitStatsCalculator.calculate(HabitFrequency.DAILY, created, Arrays.asList(dates), TODAY);
    }

    private static HabitStats weekly(LocalDate created, LocalDate... dates) {
        return HabitStatsCalculator.calculate(HabitFrequency.WEEKLY, created, Arrays.asList(dates), TODAY);
    }

    private static LocalDate d(int daysAgo) {
        return TODAY.minusDays(daysAgo);
    }

    // --- DAILY

    @Test
    void dailyNoCompletions() {
        HabitStats s = daily(OLD);
        assertThat(s).isEqualTo(new HabitStats(false, false, 0, 0, null));
    }

    @Test
    void dailyStreakEndingTodayCountsConsecutiveDays() {
        HabitStats s = daily(OLD, d(0), d(1), d(2), d(4));
        assertThat(s.completedToday()).isTrue();
        assertThat(s.doneForCurrentPeriod()).isTrue();
        assertThat(s.currentStreak()).isEqualTo(3); // gap at d(3) stops the streak
        assertThat(s.lastCompletedDate()).isEqualTo(TODAY);
    }

    @Test
    void dailyStreakCountsFromYesterdayWhenTodayNotYetDone() {
        HabitStats s = daily(OLD, d(1), d(2));
        assertThat(s.completedToday()).isFalse();
        assertThat(s.doneForCurrentPeriod()).isFalse();
        assertThat(s.currentStreak()).isEqualTo(2);
        assertThat(s.lastCompletedDate()).isEqualTo(d(1));
    }

    @Test
    void dailyStreakIsZeroWhenYesterdayAndTodayMissing() {
        assertThat(daily(OLD, d(2), d(3), d(4)).currentStreak()).isZero();
    }

    @Test
    void dailyRateOver30DayWindow() {
        // 15 of the last 30 days (d0..d29) done; d30 is outside the window
        List<LocalDate> dates = new ArrayList<>();
        for (int i = 0; i < 30; i += 2) {
            dates.add(d(i));
        }
        dates.add(d(30));
        HabitStats s = HabitStatsCalculator.calculate(HabitFrequency.DAILY, OLD, dates, TODAY);
        assertThat(s.completionRate()).isEqualTo(50);
    }

    @Test
    void dailyRateAllThirtyDaysIs100() {
        List<LocalDate> dates = new ArrayList<>();
        for (int i = 0; i < 30; i++) {
            dates.add(d(i));
        }
        HabitStats s = HabitStatsCalculator.calculate(HabitFrequency.DAILY, OLD, dates, TODAY);
        assertThat(s.completionRate()).isEqualTo(100);
        assertThat(s.currentStreak()).isEqualTo(30);
    }

    @Test
    void dailyRateWindowStartsAtCreationForNewHabit() {
        // created 3 days ago → 4 periods (d3..d0), 1 done → 25 %
        assertThat(daily(d(3), d(1)).completionRate()).isEqualTo(25);
        // created today, done today → 100 %
        assertThat(daily(TODAY, TODAY).completionRate()).isEqualTo(100);
        // created today, not done → 0 %
        assertThat(daily(TODAY).completionRate()).isZero();
        // 1 of 3 → 33 (rounded)
        assertThat(daily(d(2), d(0)).completionRate()).isEqualTo(33);
        // 2 of 3 → 67 (rounded half up)
        assertThat(daily(d(2), d(0), d(1)).completionRate()).isEqualTo(67);
    }

    @Test
    void completionsBeforeCreationAreNotCountedAboveHundred() {
        HabitStats s = daily(TODAY, d(0), d(1), d(2));
        assertThat(s.completionRate()).isEqualTo(100);
        assertThat(s.currentStreak()).isEqualTo(3);
    }

    @Test
    void futureCompletionsAndDuplicatesAndNullsAreIgnored() {
        List<LocalDate> dates = new ArrayList<>(List.of(d(0), d(0), TODAY.plusDays(1)));
        dates.add(null);
        HabitStats s = HabitStatsCalculator.calculate(HabitFrequency.DAILY, d(1), dates, TODAY);
        assertThat(s.lastCompletedDate()).isEqualTo(TODAY);
        assertThat(s.currentStreak()).isEqualTo(1);
        assertThat(s.completionRate()).isEqualTo(50); // 1 of 2 days
    }

    @Test
    void nullOrFutureCreatedDateTreatedAsToday() {
        assertThat(daily(null, TODAY).completionRate()).isEqualTo(100);
        assertThat(daily(TODAY.plusDays(5), TODAY).completionRate()).isEqualTo(100);
    }

    @Test
    void nullFrequencyOrTodayRejected() {
        assertThatThrownBy(() -> HabitStatsCalculator.calculate(null, OLD, List.of(), TODAY))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> HabitStatsCalculator.calculate(HabitFrequency.DAILY, OLD, List.of(), null))
                .isInstanceOf(NullPointerException.class);
    }

    // --- WEEKLY

    @Test
    void weekStartIsMonday() {
        assertThat(HabitStatsCalculator.weekStart(LocalDate.of(2026, 6, 15))).isEqualTo(LocalDate.of(2026, 6, 15));
        assertThat(HabitStatsCalculator.weekStart(LocalDate.of(2026, 6, 21))).isEqualTo(LocalDate.of(2026, 6, 15));
        assertThat(HabitStatsCalculator.weekStart(LocalDate.of(2026, 6, 22))).isEqualTo(LocalDate.of(2026, 6, 22));
        // ISO week across year end: Thu 2026-01-01 belongs to the week of Mon 2025-12-29
        assertThat(HabitStatsCalculator.weekStart(LocalDate.of(2026, 1, 1))).isEqualTo(LocalDate.of(2025, 12, 29));
    }

    @Test
    void weeklyDoneThisWeekByMondayButNotToday() {
        HabitStats s = weekly(OLD, LocalDate.of(2026, 6, 15)); // Monday of current week
        assertThat(s.completedToday()).isFalse();
        assertThat(s.doneForCurrentPeriod()).isTrue();
        assertThat(s.currentStreak()).isEqualTo(1);
    }

    @Test
    void weeklySundayBelongsToPreviousWeek() {
        HabitStats s = weekly(OLD, LocalDate.of(2026, 6, 14)); // Sunday of previous week
        assertThat(s.doneForCurrentPeriod()).isFalse();
        assertThat(s.currentStreak()).isEqualTo(1); // previous week counts when current not yet done
    }

    @Test
    void weeklyStreakAcrossWeeksWithGap() {
        // current week (Wed), previous week (Sun 06-14 → week of 06-08), week of 05-25 (gap: week of 06-01 missing)
        HabitStats s = weekly(OLD, TODAY, LocalDate.of(2026, 6, 14), LocalDate.of(2026, 5, 27));
        assertThat(s.completedToday()).isTrue();
        assertThat(s.currentStreak()).isEqualTo(2);
    }

    @Test
    void weeklyMultipleCompletionsInOneWeekCountOnce() {
        HabitStats s = weekly(OLD, LocalDate.of(2026, 6, 15), LocalDate.of(2026, 6, 16), TODAY);
        assertThat(s.currentStreak()).isEqualTo(1);
        assertThat(s.completionRate()).isEqualTo(8); // 1 of 12 weeks → 8.33
    }

    @Test
    void weeklyStreakZeroWhenCurrentAndPreviousWeekMissing() {
        assertThat(weekly(OLD, LocalDate.of(2026, 6, 3)).currentStreak()).isZero();
    }

    @Test
    void weeklyRateOver12WeekWindow() {
        List<LocalDate> dates = new ArrayList<>();
        for (int w = 0; w < 12; w += 2) {
            dates.add(TODAY.minusWeeks(w));
        }
        dates.add(TODAY.minusWeeks(12)); // outside window
        HabitStats s = HabitStatsCalculator.calculate(HabitFrequency.WEEKLY, OLD, dates, TODAY);
        assertThat(s.completionRate()).isEqualTo(50);
    }

    @Test
    void weeklyRateWindowStartsAtCreationWeek() {
        // created Sunday 06-14 (previous week) → 2 periods; done this week only → 50 %
        assertThat(weekly(LocalDate.of(2026, 6, 14), TODAY).completionRate()).isEqualTo(50);
        // created Monday this week → 1 period, done → 100 %
        assertThat(weekly(LocalDate.of(2026, 6, 15), TODAY).completionRate()).isEqualTo(100);
        // created this week, not done → 0 %
        assertThat(weekly(LocalDate.of(2026, 6, 16)).completionRate()).isZero();
    }

    @Test
    void weeklyStreakAcrossYearEnd() {
        LocalDate today = LocalDate.of(2026, 1, 2); // Fri, ISO week of Mon 2025-12-29
        HabitStats s = HabitStatsCalculator.calculate(HabitFrequency.WEEKLY, OLD,
                List.of(LocalDate.of(2025, 12, 29), LocalDate.of(2025, 12, 22), LocalDate.of(2025, 12, 15)), today);
        assertThat(s.doneForCurrentPeriod()).isTrue();
        assertThat(s.currentStreak()).isEqualTo(3);
    }
}
