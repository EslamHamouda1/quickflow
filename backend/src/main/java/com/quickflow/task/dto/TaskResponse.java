package com.quickflow.task.dto;

import java.time.LocalDate;
import java.time.OffsetDateTime;

import io.swagger.v3.oas.annotations.media.Schema;

import com.quickflow.task.Task;
import com.quickflow.task.TaskPriority;
import com.quickflow.task.TaskStatus;

/** API view of a task (contract schema {@code Task}), including the derived {@code overdue} flag. */
@Schema(name = "Task")
public record TaskResponse(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, format = "int64") Long id,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String title,
        @Schema(types = {"string", "null"}) String description,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) TaskStatus status,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) TaskPriority priority,
        @Schema(types = {"string", "null"}, format = "date") LocalDate dueDate,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) OffsetDateTime createdAt,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) OffsetDateTime updatedAt,
        @Schema(types = {"string", "null"}, format = "date-time") OffsetDateTime completedAt,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean archived,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean overdue) {

    public static TaskResponse of(Task t, boolean overdue) {
        return new TaskResponse(t.getId(), t.getTitle(), t.getDescription(), t.getStatus(), t.getPriority(),
                t.getDueDate(), t.getCreatedAt(), t.getUpdatedAt(), t.getCompletedAt(), t.isArchived(), overdue);
    }
}
