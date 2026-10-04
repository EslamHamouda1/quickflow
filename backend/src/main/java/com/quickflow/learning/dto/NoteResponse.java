package com.quickflow.learning.dto;

import java.time.OffsetDateTime;

import io.swagger.v3.oas.annotations.media.Schema;

import com.quickflow.learning.LearningNote;

/** API view of a note (contract schema {@code Note}). */
@Schema(name = "Note")
public record NoteResponse(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, format = "int64") Long id,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String text,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) OffsetDateTime createdAt) {

    public static NoteResponse of(LearningNote n) {
        return new NoteResponse(n.getId(), n.getText(), n.getCreatedAt());
    }
}
