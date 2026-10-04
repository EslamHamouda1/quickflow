package com.quickflow.dashboard.dto;

import java.util.List;

import com.quickflow.habit.dto.HabitResponse;

import io.swagger.v3.oas.annotations.media.Schema;

/** Habit section of the dashboard (contract schema {@code DashboardHabits}); active habits only. */
@Schema(name = "DashboardHabits")
public record DashboardHabits(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<HabitResponse> today,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) int activeCount,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) int completedTodayCount) {
}
