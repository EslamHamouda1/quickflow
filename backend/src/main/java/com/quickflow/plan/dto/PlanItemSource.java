package com.quickflow.plan.dto;

import jakarta.validation.constraints.NotNull;

import io.swagger.v3.oas.annotations.media.Schema;

import com.quickflow.plan.PlanItemSourceType;

/** Reference to an existing task / habit / learning card picked for a plan. */
@Schema(name = "PlanItemSource")
public record PlanItemSource(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
        @NotNull(message = "Source type is required")
        PlanItemSourceType sourceType,

        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, format = "int64")
        @NotNull(message = "Source id is required")
        Long sourceId) {
}
