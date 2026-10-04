package com.quickflow.task;

import io.swagger.v3.oas.annotations.media.Schema;

/** Sort field of {@code GET /api/tasks}. */
@Schema(name = "TaskSort", enumAsRef = true, defaultValue = "CREATED_AT")
public enum TaskSort {
    DUE_DATE, CREATED_AT
}
