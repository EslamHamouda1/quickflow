package com.quickflow.learning.dto;

import java.time.LocalDate;
import java.time.OffsetDateTime;

import io.swagger.v3.oas.annotations.media.Schema;

import com.quickflow.learning.LearningMilestone;

/** API view of a milestone (contract schema {@code Milestone}). */
@Schema(name = "Milestone")
public record MilestoneResponse(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, format = "int64") Long id,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String title,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean done,
        @Schema(types = {"string", "null"}, format = "date") LocalDate targetDate,
        @Schema(types = {"string", "null"}, format = "date-time") OffsetDateTime completedAt) {

    public static MilestoneResponse of(LearningMilestone m) {
        return new MilestoneResponse(m.getId(), m.getTitle(), m.isDone(), m.getTargetDate(), m.getCompletedAt());
    }
}
