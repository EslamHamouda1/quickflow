package com.quickflow.learning.dto;

import java.time.LocalDate;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import io.swagger.v3.oas.annotations.media.Schema;

import com.quickflow.learning.LearningMilestone;

/** Body of add/update milestone. Omitted done defaults to false on add and is kept on update. */
@Schema(name = "MilestoneRequest")
public record MilestoneRequest(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, minLength = 1, maxLength = LearningMilestone.TITLE_MAX)
        @NotBlank(message = "Title is required")
        @Size(min = 1, max = LearningMilestone.TITLE_MAX, message = "Title must be 1-200 characters")
        String title,

        Boolean done,

        @Schema(types = {"string", "null"}, format = "date")
        LocalDate targetDate) {
}
