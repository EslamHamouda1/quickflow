package com.quickflow.plan.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import com.quickflow.plan.PlanItem;
import com.quickflow.plan.PlanItemSourceType;

/** API view of a plan item (contract schema {@code PlanItem}). */
@Schema(name = "PlanItem")
public record PlanItemResponse(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, format = "int64") Long id,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) PlanItemSourceType sourceType,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, format = "int64") Long sourceId,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String sourceTitle,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean done,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean sourceAvailable) {

    public static PlanItemResponse of(PlanItem item, boolean sourceAvailable) {
        return new PlanItemResponse(item.getId(), item.getSourceType(), item.getSourceId(), item.getSourceTitle(),
                item.isDone(), sourceAvailable);
    }
}
