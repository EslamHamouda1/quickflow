package com.quickflow.common;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** Backend smoke check: problem+json carries a top-level {@code errors} array (not nested under "properties"). */
@WebMvcTest(controllers = ProblemJsonSmokeTest.ThrowingController.class)
@Import(ProblemJsonSmokeTest.ThrowingController.class)
class ProblemJsonSmokeTest {

    @Autowired
    MockMvcTester mvc;

    @Test
    void badRequestHasTopLevelErrors() {
        assertThat(mvc.get().uri("/smoke/bad"))
                .hasStatus(400)
                .hasContentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON)
                .bodyJson()
                .extractingPath("$.errors[0].field").isEqualTo("title");
    }

    @Test
    void notFoundIsProblemJson() {
        assertThat(mvc.get().uri("/smoke/missing"))
                .hasStatus(404)
                .hasContentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON)
                .bodyJson()
                .extractingPath("$.status").isEqualTo(404);
    }

    @RestController
    static class ThrowingController {

        @GetMapping("/smoke/bad")
        String bad() {
            throw new BadRequestException("title", "must not be blank");
        }

        @GetMapping("/smoke/missing")
        String missing() {
            throw new NotFoundException("Thing 1 not found");
        }
    }
}
