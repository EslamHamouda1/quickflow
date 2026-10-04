package com.quickflow.task;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "TaskPriority", enumAsRef = true)
public enum TaskPriority {
    LOW, MEDIUM, HIGH
}
