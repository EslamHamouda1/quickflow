package com.quickflow.habit.dto;

import java.time.LocalDate;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * Optional body of {@code completeHabit}. The not-in-future rule is checked in {@code HabitService}
 * against the injected {@code Clock}, not with a bean-validation annotation.
 */
@Schema(name = "HabitCompletionRequest")
public record HabitCompletionRequest(
        @Schema(types = {"string", "null"}, format = "date",
                description = "Defaults to today; must not be in the future")
        LocalDate date) {
}
