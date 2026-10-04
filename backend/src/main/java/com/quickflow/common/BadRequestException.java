package com.quickflow.common;

/**
 * Business-rule validation failure on one field. Mapped to 400 problem+json with
 * {@code errors: [{field, message}]} by {@link ApiExceptionHandler}.
 */
public class BadRequestException extends RuntimeException {

    private final String field;

    public BadRequestException(String field, String message) {
        super(message);
        this.field = field;
    }

    public String getField() {
        return field;
    }
}
