package com.quickflow.plan.dto;

import jakarta.validation.constraints.NotNull;

import io.swagger.v3.oas.annotations.media.Schema;

/** Body of {@code PUT /api/plans/{id}/items/{itemId}}. */
@Schema(name = "PlanItemUpdateRequest")
public record PlanItemUpdateRequest(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
        @NotNull(message = "Done is required")
        Boolean done) {
}
