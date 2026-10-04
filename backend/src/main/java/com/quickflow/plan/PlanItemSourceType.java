package com.quickflow.plan;

import io.swagger.v3.oas.annotations.media.Schema;

/** Kind of entity a plan item points at. */
@Schema(name = "PlanItemSourceType", enumAsRef = true)
public enum PlanItemSourceType {
    TASK, HABIT, LEARNING_RESOURCE
}
