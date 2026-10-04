package com.quickflow.habit.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import io.swagger.v3.oas.annotations.media.Schema;

import com.quickflow.habit.Habit;
import com.quickflow.habit.HabitFrequency;

/** Body of create/update habit (contract schema {@code HabitRequest}). */
@Schema(name = "HabitRequest")
public record HabitRequest(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, minLength = 1, maxLength = Habit.NAME_MAX)
        @NotBlank(message = "Name is required")
        @Size(min = 1, max = Habit.NAME_MAX, message = "Name must be 1-150 characters")
        String name,

        @Schema(types = {"string", "null"}, maxLength = Habit.DESCRIPTION_MAX)
        @Size(max = Habit.DESCRIPTION_MAX, message = "Description must be at most 2000 characters")
        String description,

        @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
        @NotNull(message = "Frequency is required")
        HabitFrequency frequency) {
}
