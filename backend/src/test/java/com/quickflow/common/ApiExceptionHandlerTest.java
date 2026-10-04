package com.quickflow.common;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Set;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.ConstraintViolationException;
import jakarta.validation.Valid;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import org.junit.jupiter.api.Test;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * T018 — {@link ApiExceptionHandler} maps every handled exception to RFC 9457
 * {@code application/problem+json}: 400 with {@code errors[{field, message}]}, 404 and 409.
 * Traces US1, US2, US3, US4, US6 (shared 400/404/409 error format).
 */
@WebMvcTest(controllers = ApiExceptionHandlerTest.TestController.class)
@Import(ApiExceptionHandlerTest.TestController.class)
class ApiExceptionHandlerTest {

    @Autowired
    MockMvcTester mvc;

    // --- 400: bean validation on the request body (MethodArgumentNotValidException)

    @Test
    void bodyValidationErrorReturns400WithFieldErrors() {
        var result = mvc.post().uri("/t/body")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"\",\"description\":\"" + "x".repeat(11) + "\"}");
        assertThat(result)
                .hasStatus(400)
                .hasContentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON);
        assertThat(result).bodyJson().extractingPath("$.status").isEqualTo(400);
        assertThat(result).bodyJson().extractingPath("$.title").isEqualTo("Bad Request");
        assertThat(result).bodyJson().extractingPath("$.detail").isEqualTo("Validation failed");
        assertThat(result).bodyJson().extractingPath("$.errors.length()").isEqualTo(2);
        assertThat(result).bodyJson().extractingPath("$.errors[*].field")
                .asArray().containsExactlyInAnyOrder("title", "description");
        assertThat(result).bodyJson().extractingPath("$.errors[*].message")
                .asArray().allSatisfy(m -> assertThat((String) m).isNotBlank());
    }

    @Test
    void validBodyPasses() {
        assertThat(mvc.post().uri("/t/body")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"ok\"}"))
                .hasStatusOk()
                .bodyText().isEqualTo("ok");
    }

    // --- 400: malformed body / wrong type in body (HttpMessageNotReadableException)

    @Test
    void malformedJsonReturns400WithBodyField() {
        var result = mvc.post().uri("/t/body")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{not json");
        assertThat(result).hasStatus(400).hasContentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON);
        assertThat(result).bodyJson().extractingPath("$.errors[0].field").isEqualTo("body");
        assertThat(result).bodyJson().extractingPath("$.errors[0].message").isNotNull();
    }

    @Test
    void wrongTypeInBodyReturns400NamingTheProperty() {
        var result = mvc.post().uri("/t/count")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"count\":\"abc\"}");
        assertThat(result).hasStatus(400).hasContentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON);
        assertThat(result).bodyJson().extractingPath("$.errors[0].field").isEqualTo("count");
        assertThat(result).bodyJson().extractingPath("$.errors[0].message").isEqualTo("Invalid value");
    }

    // --- 400: path / query parameter type mismatch (MethodArgumentTypeMismatchException)

    @Test
    void pathVariableTypeMismatchReturns400() {
        var result = mvc.get().uri("/t/items/abc");
        assertThat(result).hasStatus(400).hasContentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON);
        assertThat(result).bodyJson().extractingPath("$.errors[0].field").isEqualTo("id");
        assertThat(result).bodyJson().extractingPath("$.errors[0].message").isEqualTo("Invalid value 'abc'");
    }

    // --- 400: method validation on @RequestParam (HandlerMethodValidationException)

    @Test
    void requestParamConstraintReturns400() {
        var result = mvc.get().uri("/t/limit?limit=500");
        assertThat(result).hasStatus(400).hasContentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON);
        assertThat(result).bodyJson().extractingPath("$.detail").isEqualTo("Validation failed");
        assertThat(result).bodyJson().extractingPath("$.errors[0].field").isEqualTo("limit");
    }

    // --- 400: ConstraintViolationException thrown by a service

    @Test
    void constraintViolationReturns400WithLastPathNode() {
        var result = mvc.get().uri("/t/constraint");
        assertThat(result).hasStatus(400).hasContentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON);
        assertThat(result).bodyJson().extractingPath("$.errors[0].field").isEqualTo("title");
    }

    // --- 400: BadRequestException carries its field

    @Test
    void badRequestExceptionReturns400WithItsField() {
        var result = mvc.get().uri("/t/bad");
        assertThat(result).hasStatus(400).hasContentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON);
        assertThat(result).bodyJson().extractingPath("$.detail").isEqualTo("end must be after start");
        assertThat(result).bodyJson().extractingPath("$.errors.length()").isEqualTo(1);
        assertThat(result).bodyJson().extractingPath("$.errors[0].field").isEqualTo("endDateTime");
        assertThat(result).bodyJson().extractingPath("$.errors[0].message").isEqualTo("end must be after start");
    }

    // --- 400: IllegalArgumentException

    @Test
    void illegalArgumentReturns400() {
        var result = mvc.get().uri("/t/illegal");
        assertThat(result).hasStatus(400).hasContentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON);
        assertThat(result).bodyJson().extractingPath("$.errors[0].field").isEqualTo("request");
        assertThat(result).bodyJson().extractingPath("$.errors[0].message").isEqualTo("bad sort");
    }

    @Test
    void illegalArgumentWithoutMessageUsesDefault() {
        var result = mvc.get().uri("/t/illegal-null");
        assertThat(result).hasStatus(400);
        assertThat(result).bodyJson().extractingPath("$.errors[0].message").isEqualTo("Invalid argument");
    }

    // --- 404 / 409

    @Test
    void notFoundExceptionReturns404ProblemJson() {
        var result = mvc.get().uri("/t/missing");
        assertThat(result).hasStatus(404).hasContentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON);
        assertThat(result).bodyJson().extractingPath("$.status").isEqualTo(404);
        assertThat(result).bodyJson().extractingPath("$.title").isEqualTo("Not Found");
        assertThat(result).bodyJson().extractingPath("$.detail").isEqualTo("Task 42 not found");
    }

    @Test
    void conflictExceptionReturns409ProblemJson() {
        var result = mvc.get().uri("/t/conflict");
        assertThat(result).hasStatus(409).hasContentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON);
        assertThat(result).bodyJson().extractingPath("$.status").isEqualTo(409);
        assertThat(result).bodyJson().extractingPath("$.title").isEqualTo("Conflict");
        assertThat(result).bodyJson().extractingPath("$.detail").isEqualTo("Already completed today");
    }

    // --- test-only controller

    record Body(@NotBlank String title, @Size(max = 10) String description) {
    }

    record CountBody(Integer count) {
    }

    @RestController
    static class TestController {

        private static final Validator VALIDATOR = Validation.buildDefaultValidatorFactory().getValidator();

        @PostMapping("/t/body")
        String body(@Valid @RequestBody Body body) {
            return "ok";
        }

        @PostMapping("/t/count")
        String count(@RequestBody CountBody body) {
            return "ok";
        }

        @GetMapping("/t/items/{id}")
        String item(@PathVariable("id") Long id) {
            return "ok";
        }

        @GetMapping("/t/limit")
        String limit(@RequestParam("limit") @Max(100) int limit) {
            return "ok";
        }

        @GetMapping("/t/constraint")
        String constraint() {
            Set<ConstraintViolation<Body>> violations = VALIDATOR.validate(new Body(" ", null));
            throw new ConstraintViolationException(violations);
        }

        @GetMapping("/t/bad")
        String bad() {
            throw new BadRequestException("endDateTime", "end must be after start");
        }

        @GetMapping("/t/illegal")
        String illegal() {
            throw new IllegalArgumentException("bad sort");
        }

        @GetMapping("/t/illegal-null")
        String illegalNull() {
            throw new IllegalArgumentException();
        }

        @GetMapping("/t/missing")
        String missing() {
            throw NotFoundException.of("Task", 42);
        }

        @GetMapping("/t/conflict")
        String conflict() {
            throw new ConflictException("Already completed today");
        }
    }
}
