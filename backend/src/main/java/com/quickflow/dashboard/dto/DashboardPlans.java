package com.quickflow.dashboard.dto;

import java.util.List;

import com.quickflow.plan.dto.PlanResponse;

import io.swagger.v3.oas.annotations.media.Schema;

/** Plan section of the dashboard (contract schema {@code DashboardPlans}). */
@Schema(name = "DashboardPlans")
public record DashboardPlans(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<PlanResponse> inProgress,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) int upcomingCount,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) int completedCount) {
}
