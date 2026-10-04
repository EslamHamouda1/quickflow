package com.quickflow.dashboard.dto;

import java.time.LocalDate;

import io.swagger.v3.oas.annotations.media.Schema;

/** Dashboard summary (contract schema {@code Dashboard}); read model, never stored. */
@Schema(name = "Dashboard")
public record DashboardResponse(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String greetingName,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) LocalDate today,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) DashboardTasks tasks,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) DashboardHabits habits,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) DashboardPlans plans,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) DashboardLearning learning) {
}
