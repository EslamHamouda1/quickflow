package com.quickflow.plan;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import com.quickflow.plan.PlanStatusCalculator.PlanState;

/**
 * T079 — pure {@link PlanStatusCalculator}: Not Started → In Progress → Completed across start/end boundaries,
 * all done before start, end passed with open items, rest time only In Progress, progress rounding.
 * Traces US4 AS3, AS5 / FR-020..FR-022.
 */
class PlanStatusCalculatorTest {

    static final OffsetDateTime START = OffsetDateTime.parse("2026-06-17T10:00:00Z");
    static final OffsetDateTime END = START.plusHours(2);

    static List<PlanItem> items(int total, int done) {
        List<PlanItem> list = new ArrayList<>();
        for (int i = 0; i < total; i++) {
            PlanItem item = new PlanItem();
            item.setDone(i < done);
            list.add(item);
        }
        return list;
    }

    @Test
    void notStartedBeforeStartWithoutRestTime() {
        PlanState s = PlanStatusCalculator.calculate(START, END, items(3, 0), START.minusSeconds(1));
        assertThat(s.status()).isEqualTo(PlanStatus.NOT_STARTED);
        assertThat(s.restSeconds()).isNull();
        assertThat(s.itemsTotal()).isEqualTo(3);
        assertThat(s.itemsDone()).isZero();
        assertThat(s.progressPercent()).isZero();
    }

    @Test
    void inProgressExactlyAtStartWithRestTime() {
        PlanState s = PlanStatusCalculator.calculate(START, END, items(3, 1), START);
        assertThat(s.status()).isEqualTo(PlanStatus.IN_PROGRESS);
        assertThat(s.restSeconds()).isEqualTo(7200L);
        assertThat(s.progressPercent()).isEqualTo(33);
    }

    @Test
    void restTimeIsEndMinusNow() {
        PlanState s = PlanStatusCalculator.calculate(START, END, items(2, 0), END.minusSeconds(61));
        assertThat(s.status()).isEqualTo(PlanStatus.IN_PROGRESS);
        assertThat(s.restSeconds()).isEqualTo(61L);
    }

    @Test
    void completedExactlyAtEndWithOpenItems() {
        PlanState s = PlanStatusCalculator.calculate(START, END, items(3, 1), END);
        assertThat(s.status()).isEqualTo(PlanStatus.COMPLETED);
        assertThat(s.restSeconds()).isNull();
        assertThat(s.progressPercent()).isEqualTo(33);
    }

    @Test
    void endPassedWithOpenItemsIsCompleted() {
        PlanState s = PlanStatusCalculator.calculate(START, END, items(2, 0), END.plusDays(1));
        assertThat(s.status()).isEqualTo(PlanStatus.COMPLETED);
        assertThat(s.progressPercent()).isZero();
        assertThat(s.restSeconds()).isNull();
    }

    @Test
    void allDoneBeforeStartIsCompleted() {
        PlanState s = PlanStatusCalculator.calculate(START, END, items(2, 2), START.minusHours(5));
        assertThat(s.status()).isEqualTo(PlanStatus.COMPLETED);
        assertThat(s.progressPercent()).isEqualTo(100);
        assertThat(s.restSeconds()).isNull();
    }

    @Test
    void allDoneWhileInProgressIsCompletedWithoutRestTime() {
        PlanState s = PlanStatusCalculator.calculate(START, END, items(3, 3), START.plusMinutes(5));
        assertThat(s.status()).isEqualTo(PlanStatus.COMPLETED);
        assertThat(s.restSeconds()).isNull();
    }

    @Test
    void transitionsAcrossBoundaries() {
        List<PlanItem> list = items(2, 0);
        assertThat(PlanStatusCalculator.calculate(START, END, list, START.minusNanos(1000)).status())
                .isEqualTo(PlanStatus.NOT_STARTED);
        assertThat(PlanStatusCalculator.calculate(START, END, list, START).status())
                .isEqualTo(PlanStatus.IN_PROGRESS);
        assertThat(PlanStatusCalculator.calculate(START, END, list, END.minusNanos(1000)).status())
                .isEqualTo(PlanStatus.IN_PROGRESS);
        assertThat(PlanStatusCalculator.calculate(START, END, list, END).status())
                .isEqualTo(PlanStatus.COMPLETED);
    }

    @Test
    void undoAfterAllDoneReturnsToInProgress() {
        List<PlanItem> list = items(2, 2);
        OffsetDateTime now = START.plusMinutes(10);
        assertThat(PlanStatusCalculator.calculate(START, END, list, now).status()).isEqualTo(PlanStatus.COMPLETED);
        list.get(0).setDone(false);
        PlanState s = PlanStatusCalculator.calculate(START, END, list, now);
        assertThat(s.status()).isEqualTo(PlanStatus.IN_PROGRESS);
        assertThat(s.progressPercent()).isEqualTo(50);
        assertThat(s.restSeconds()).isEqualTo(110 * 60L);
    }

    @Test
    void noItemsNeverCompletedByItems() {
        PlanState s = PlanStatusCalculator.calculate(START, END, List.of(), START.plusMinutes(1));
        assertThat(s.status()).isEqualTo(PlanStatus.IN_PROGRESS);
        assertThat(s.progressPercent()).isZero();
    }

    @ParameterizedTest
    @CsvSource({"0,0,0", "1,0,0", "1,1,100", "2,1,50", "3,1,33", "3,2,67", "8,1,13", "6,1,17", "200,1,1",
            "201,1,0", "3,3,100"})
    void progressRounding(int total, int done, int expected) {
        assertThat(PlanStatusCalculator.progressPercent(total, done)).isEqualTo(expected);
    }

    @Test
    void progressClampedTo100() {
        assertThat(PlanStatusCalculator.progressPercent(2, 5)).isEqualTo(100);
        assertThat(PlanStatusCalculator.progressPercent(2, -1)).isZero();
    }
}
