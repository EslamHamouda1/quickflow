package com.quickflow.common;

/** Mapped to 409 problem+json by {@link ApiExceptionHandler}. */
public class ConflictException extends RuntimeException {

    public ConflictException(String message) {
        super(message);
    }
}
