package com.quickflow.plan;

import io.swagger.v3.oas.annotations.media.Schema;

/** Derived plan status (research R4); never stored. */
@Schema(name = "PlanStatus", enumAsRef = true)
public enum PlanStatus {
    NOT_STARTED, IN_PROGRESS, COMPLETED
}
