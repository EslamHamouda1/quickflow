package com.quickflow.task.dto;

import java.time.LocalDate;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import io.swagger.v3.oas.annotations.media.Schema;

import com.quickflow.task.Task;
import com.quickflow.task.TaskPriority;
import com.quickflow.task.TaskStatus;

/**
 * Body of create/update task. Omitted status/priority take their default on create and keep the
 * current value on update.
 */
@Schema(name = "TaskRequest")
public record TaskRequest(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, minLength = 1, maxLength = Task.TITLE_MAX)
        @NotBlank(message = "Title is required")
        @Size(min = 1, max = Task.TITLE_MAX, message = "Title must be 1-200 characters")
        String title,

        @Schema(types = {"string", "null"}, maxLength = Task.DESCRIPTION_MAX)
        @Size(max = Task.DESCRIPTION_MAX, message = "Description must be at most 2000 characters")
        String description,

        TaskStatus status,

        TaskPriority priority,

        @Schema(types = {"string", "null"}, format = "date")
        LocalDate dueDate) {
}
