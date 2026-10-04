package com.quickflow.plan.dto;

import java.time.OffsetDateTime;
import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;

import com.quickflow.plan.Plan;
import com.quickflow.plan.PlanStatus;
import com.quickflow.plan.PlanStatusCalculator.PlanState;

/** API view of a plan (contract schema {@code Plan}) with derived status, progress and rest time. */
@Schema(name = "Plan")
public record PlanResponse(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, format = "int64") Long id,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String title,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) int estimatedDurationMinutes,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) OffsetDateTime startDateTime,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) OffsetDateTime endDateTime,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) int priorityOrder,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) PlanStatus status,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) OffsetDateTime createdAt,
        @Schema(types = {"string", "null"}, format = "date-time") OffsetDateTime startNotifiedAt,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<PlanItemResponse> items,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) int itemsTotal,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) int itemsDone,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, minimum = "0", maximum = "100") int progressPercent,
        @Schema(types = {"integer", "null"}, format = "int64") Long restSeconds) {

    public static PlanResponse of(Plan p, List<PlanItemResponse> items, PlanState state) {
        return new PlanResponse(p.getId(), p.getTitle(), p.getEstimatedDurationMinutes(), p.getStartDateTime(),
                p.getEndDateTime(), p.getPriorityOrder(), state.status(), p.getCreatedAt(), p.getStartNotifiedAt(),
                items, state.itemsTotal(), state.itemsDone(), state.progressPercent(), state.restSeconds());
    }
}
