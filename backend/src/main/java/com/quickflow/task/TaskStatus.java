package com.quickflow.task;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "TaskStatus", enumAsRef = true)
public enum TaskStatus {
    TODO, IN_PROGRESS, DONE
}
