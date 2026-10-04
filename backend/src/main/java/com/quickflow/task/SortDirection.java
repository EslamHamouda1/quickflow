package com.quickflow.task;

import io.swagger.v3.oas.annotations.media.Schema;

/** Sort direction of {@code GET /api/tasks}. */
@Schema(name = "SortDirection", enumAsRef = true, defaultValue = "DESC")
public enum SortDirection {
    ASC, DESC
}
