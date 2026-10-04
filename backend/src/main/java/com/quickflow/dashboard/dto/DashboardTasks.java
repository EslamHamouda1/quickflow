package com.quickflow.dashboard.dto;

import java.util.List;

import com.quickflow.task.dto.TaskResponse;

import io.swagger.v3.oas.annotations.media.Schema;

/** Task section of the dashboard (contract schema {@code DashboardTasks}); archived tasks excluded. */
@Schema(name = "DashboardTasks")
public record DashboardTasks(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<TaskResponse> dueToday,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<TaskResponse> overdue,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) int completedTodayCount,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) int totalActive,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) int doneCount,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, minimum = "0", maximum = "100") int completionPercent) {
}
