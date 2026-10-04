package com.quickflow.learning;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.EnumSource;

/** T062 — pure status/progress rules (US3 AS3/AS5, FR-016, edge case "no milestones → 0%, manual status"). */
class LearningStatusCalculatorTest {

    @Test
    void noneDoneIsNotStarted() {
        assertThat(LearningStatusCalculator.derive(3, 0, LearningStatus.COMPLETED)).isEqualTo(LearningStatus.NOT_STARTED);
    }

    @Test
    void someDoneIsInProgress() {
        assertThat(LearningStatusCalculator.derive(3, 1, LearningStatus.NOT_STARTED)).isEqualTo(LearningStatus.IN_PROGRESS);
        assertThat(LearningStatusCalculator.derive(3, 2, LearningStatus.COMPLETED)).isEqualTo(LearningStatus.IN_PROGRESS);
    }

    @Test
    void allDoneIsCompleted() {
        assertThat(LearningStatusCalculator.derive(2, 2, LearningStatus.NOT_STARTED)).isEqualTo(LearningStatus.COMPLETED);
        assertThat(LearningStatusCalculator.derive(1, 1, LearningStatus.IN_PROGRESS)).isEqualTo(LearningStatus.COMPLETED);
    }

    @ParameterizedTest
    @EnumSource(LearningStatus.class)
    void noMilestonesKeepsCurrentStatus(LearningStatus current) {
        assertThat(LearningStatusCalculator.derive(0, 0, current)).isEqualTo(current);
    }

    @ParameterizedTest
    @CsvSource({"0,0,0", "1,0,0", "1,1,100", "2,1,50", "3,1,33", "3,2,67", "3,3,100", "8,1,13", "200,1,1", "7,7,100"})
    void progressPercentRounds(int total, int done, int expected) {
        assertThat(LearningStatusCalculator.progressPercent(total, done)).isEqualTo(expected);
    }

    @Test
    void progressPercentIsClamped() {
        assertThat(LearningStatusCalculator.progressPercent(2, 5)).isEqualTo(100);
        assertThat(LearningStatusCalculator.progressPercent(2, -1)).isZero();
        assertThat(LearningStatusCalculator.progressPercent(-1, 1)).isZero();
    }
}
