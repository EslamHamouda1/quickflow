package com.quickflow.learning;

import io.swagger.v3.oas.annotations.media.Schema;

/** Status of a learning card; derived from milestones (R9) or set manually (FR-013). */
@Schema(name = "LearningStatus", enumAsRef = true)
public enum LearningStatus {
    NOT_STARTED, IN_PROGRESS, COMPLETED
}
