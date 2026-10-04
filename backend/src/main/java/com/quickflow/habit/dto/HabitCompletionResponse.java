package com.quickflow.habit.dto;

import java.time.LocalDate;
import java.time.OffsetDateTime;

import io.swagger.v3.oas.annotations.media.Schema;

import com.quickflow.habit.HabitCompletion;

/** API view of a habit completion (contract schema {@code HabitCompletion}). */
@Schema(name = "HabitCompletion")
public record HabitCompletionResponse(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, format = "int64") Long id,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, format = "int64") Long habitId,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, format = "date") LocalDate completionDate,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) OffsetDateTime createdAt) {

    public static HabitCompletionResponse of(HabitCompletion c) {
        return new HabitCompletionResponse(c.getId(), c.getHabit().getId(), c.getCompletionDate(), c.getCreatedAt());
    }
}
