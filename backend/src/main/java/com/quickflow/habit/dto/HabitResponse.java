package com.quickflow.habit.dto;

import java.time.LocalDate;
import java.time.OffsetDateTime;

import io.swagger.v3.oas.annotations.media.Schema;

import com.quickflow.habit.Habit;
import com.quickflow.habit.HabitFrequency;
import com.quickflow.habit.HabitStatsCalculator.HabitStats;

/** API view of a habit with its derived stats (contract schema {@code Habit}). */
@Schema(name = "Habit")
public record HabitResponse(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, format = "int64") Long id,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String name,
        @Schema(types = {"string", "null"}) String description,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) HabitFrequency frequency,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) OffsetDateTime createdAt,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean active,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean completedToday,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean doneForCurrentPeriod,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) int currentStreak,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, minimum = "0", maximum = "100") int completionRate,
        @Schema(types = {"string", "null"}, format = "date") LocalDate lastCompletedDate) {

    public static HabitResponse of(Habit h, HabitStats s) {
        return new HabitResponse(h.getId(), h.getName(), h.getDescription(), h.getFrequency(), h.getCreatedAt(),
                h.isActive(), s.completedToday(), s.doneForCurrentPeriod(), s.currentStreak(), s.completionRate(),
                s.lastCompletedDate());
    }
}
