package com.quickflow.dashboard.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/** Learning snapshot of the dashboard (contract schema {@code DashboardLearning}). */
@Schema(name = "DashboardLearning")
public record DashboardLearning(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) int cardsTotal,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) int inProgressCount,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) int milestonesTotal,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) int milestonesDone,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) int milestonesCompletedLast7Days) {
}
