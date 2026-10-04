package com.quickflow.learning.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import io.swagger.v3.oas.annotations.media.Schema;

import com.quickflow.learning.LearningCard;
import com.quickflow.learning.LearningStatus;

/**
 * Body of create/update learning card. Omitted status defaults to NOT_STARTED on create and keeps
 * the current value on update (manual status, FR-013).
 */
@Schema(name = "LearningCardRequest")
public record LearningCardRequest(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, minLength = 1, maxLength = LearningCard.TITLE_MAX)
        @NotBlank(message = "Title is required")
        @Size(min = 1, max = LearningCard.TITLE_MAX, message = "Title must be 1-200 characters")
        String title,

        @Schema(types = {"string", "null"}, maxLength = LearningCard.DESCRIPTION_MAX)
        @Size(max = LearningCard.DESCRIPTION_MAX, message = "Description must be at most 2000 characters")
        String description,

        LearningStatus status) {
}
