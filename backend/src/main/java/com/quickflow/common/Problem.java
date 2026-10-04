package com.quickflow.common;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * Documentation-only schema of the RFC 9457 body produced by {@link ApiExceptionHandler}
 * (the runtime type is Spring's {@code ProblemDetail}). Referenced from {@code @ApiResponse}
 * content for 400/404/409.
 */
@Schema(name = "Problem", description = "RFC 9457 problem details")
public record Problem(
        String type,
        String title,
        Integer status,
        String detail,
        String instance,
        List<FieldErrorDto> errors) {
}
