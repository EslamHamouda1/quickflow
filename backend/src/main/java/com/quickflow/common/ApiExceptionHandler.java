package com.quickflow.common;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.ConstraintViolationException;

import tools.jackson.core.JacksonException;

import org.springframework.context.MessageSourceResolvable;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

/**
 * Maps API errors to RFC 9457 {@code application/problem+json}:
 * 400 (with {@code errors: [{field, message}]}), 404 and 409. Runs before Boot's
 * {@code ProblemDetailsExceptionHandler} ({@code spring.mvc.problemdetails.enabled}), which
 * renders the remaining framework errors (unknown path 404, 405, 415, ...) as problem+json.
 */
@RestControllerAdvice
@Order(Ordered.HIGHEST_PRECEDENCE)
public class ApiExceptionHandler {

    static final String ERRORS = "errors";

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ProblemDetail> handleBodyValidation(MethodArgumentNotValidException ex) {
        List<FieldErrorDto> errors = new ArrayList<>();
        for (FieldError fe : ex.getBindingResult().getFieldErrors()) {
            errors.add(new FieldErrorDto(fe.getField(), messageOf(fe)));
        }
        ex.getBindingResult().getGlobalErrors()
                .forEach(ge -> errors.add(new FieldErrorDto(ge.getObjectName(), messageOf(ge))));
        return badRequest("Validation failed", errors);
    }

    @ExceptionHandler(HandlerMethodValidationException.class)
    ResponseEntity<ProblemDetail> handleParameterValidation(HandlerMethodValidationException ex) {
        List<FieldErrorDto> errors = ex.getParameterValidationResults().stream()
                .flatMap(result -> result.getResolvableErrors().stream()
                        .map(err -> new FieldErrorDto(
                                err instanceof FieldError fe ? fe.getField() : result.getMethodParameter().getParameterName(),
                                messageOf(err))))
                .toList();
        return badRequest("Validation failed", errors);
    }

    @ExceptionHandler(ConstraintViolationException.class)
    ResponseEntity<ProblemDetail> handleConstraintViolation(ConstraintViolationException ex) {
        List<FieldErrorDto> errors = ex.getConstraintViolations().stream()
                .map(v -> new FieldErrorDto(lastNode(v), v.getMessage()))
                .toList();
        return badRequest("Validation failed", errors);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    ResponseEntity<ProblemDetail> handleUnreadable(HttpMessageNotReadableException ex) {
        String field = "body";
        String message = "Malformed or unreadable request body";
        JacksonException je = null;
        for (Throwable t = ex.getCause(); t != null && je == null; t = t.getCause()) {
            if (t instanceof JacksonException candidate && !candidate.getPath().isEmpty()) {
                je = candidate;
            }
        }
        if (je != null) {
            field = je.getPath().stream()
                    .map(ref -> ref.getPropertyName() != null ? ref.getPropertyName() : "[" + ref.getIndex() + "]")
                    .collect(Collectors.joining("."))
                    .replace(".[", "[");
            message = "Invalid value";
        }
        return badRequest(message, List.of(new FieldErrorDto(field, message)));
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    ResponseEntity<ProblemDetail> handleTypeMismatch(MethodArgumentTypeMismatchException ex) {
        String message = "Invalid value '" + ex.getValue() + "'";
        return badRequest(message, List.of(new FieldErrorDto(ex.getName(), message)));
    }

    @ExceptionHandler(BadRequestException.class)
    ResponseEntity<ProblemDetail> handleBadRequest(BadRequestException ex) {
        return badRequest(ex.getMessage(), List.of(new FieldErrorDto(ex.getField(), ex.getMessage())));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    ResponseEntity<ProblemDetail> handleIllegalArgument(IllegalArgumentException ex) {
        String message = ex.getMessage() != null ? ex.getMessage() : "Invalid argument";
        return badRequest(message, List.of(new FieldErrorDto("request", message)));
    }

    @ExceptionHandler(NotFoundException.class)
    ResponseEntity<ProblemDetail> handleNotFound(NotFoundException ex) {
        return problem(HttpStatus.NOT_FOUND, ex.getMessage());
    }

    @ExceptionHandler(ConflictException.class)
    ResponseEntity<ProblemDetail> handleConflict(ConflictException ex) {
        return problem(HttpStatus.CONFLICT, ex.getMessage());
    }

    private static ResponseEntity<ProblemDetail> badRequest(String detail, List<FieldErrorDto> errors) {
        ProblemDetail body = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, detail);
        body.setProperty(ERRORS, errors);
        return respond(body);
    }

    private static ResponseEntity<ProblemDetail> problem(HttpStatus status, String detail) {
        return respond(ProblemDetail.forStatusAndDetail(status, detail));
    }

    private static ResponseEntity<ProblemDetail> respond(ProblemDetail body) {
        return ResponseEntity.status(body.getStatus())
                .contentType(MediaType.APPLICATION_PROBLEM_JSON)
                .body(body);
    }

    private static String messageOf(MessageSourceResolvable error) {
        return error.getDefaultMessage() != null ? error.getDefaultMessage() : "Invalid value";
    }

    private static String lastNode(ConstraintViolation<?> violation) {
        String path = violation.getPropertyPath().toString();
        int dot = path.lastIndexOf('.');
        return dot >= 0 ? path.substring(dot + 1) : path;
    }
}
