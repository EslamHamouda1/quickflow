package com.quickflow.common;

import io.swagger.v3.oas.annotations.media.Schema;

/** One invalid field inside a 400 problem+json {@code errors} array. */
@Schema(name = "FieldError")
public record FieldErrorDto(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String field,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String message) {
}
