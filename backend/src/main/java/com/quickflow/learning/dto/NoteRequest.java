package com.quickflow.learning.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import io.swagger.v3.oas.annotations.media.Schema;

import com.quickflow.learning.LearningNote;

/** Body of add note. */
@Schema(name = "NoteRequest")
public record NoteRequest(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, minLength = 1, maxLength = LearningNote.TEXT_MAX)
        @NotBlank(message = "Text is required")
        @Size(min = 1, max = LearningNote.TEXT_MAX, message = "Text must be 1-5000 characters")
        String text) {
}
