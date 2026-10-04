package com.quickflow.habit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.willThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

import org.junit.jupiter.api.Test;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;

import com.quickflow.common.BadRequestException;
import com.quickflow.common.ConflictException;
import com.quickflow.common.NotFoundException;
import com.quickflow.habit.dto.HabitCompletionResponse;
import com.quickflow.habit.dto.HabitRequest;
import com.quickflow.habit.dto.HabitResponse;

/**
 * T048 — {@link HabitController} web slice with a mocked {@link HabitService}: status codes of all 10
 * operations, request-DTO validation 400 problem+json, 404 and 409 mapped from the service. Traces US2 AS1-AS6.
 */
@WebMvcTest(HabitController.class)
class HabitControllerTest {

    @Autowired
    MockMvcTester mvc;

    @MockitoBean
    HabitService service;

    static final OffsetDateTime NOW = OffsetDateTime.parse("2026-06-17T10:00:00Z");
    static final LocalDate TODAY = LocalDate.of(2026, 6, 17);

    static HabitResponse habit(long id, boolean done) {
        return new HabitResponse(id, "H" + id, null, HabitFrequency.DAILY, NOW, true, done, done, done ? 1 : 0,
                done ? 100 : 0, done ? TODAY : null);
    }

    private MvcTestResult postJson(String uri, String body) {
        return mvc.post().uri(uri).contentType(MediaType.APPLICATION_JSON).content(body).exchange();
    }

    private MvcTestResult putJson(String uri, String body) {
        return mvc.put().uri(uri).contentType(MediaType.APPLICATION_JSON).content(body).exchange();
    }

    private void assertProblem(MvcTestResult r, int status) {
        assertThat(r).hasStatus(status).hasContentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON);
        assertThat(r).bodyJson().extractingPath("$.status").isEqualTo(status);
    }

    private void assertValidation(MvcTestResult r, String field) {
        assertProblem(r, 400);
        assertThat(r).bodyJson().extractingPath("$.errors[*].field").asArray().contains(field);
    }

    // --- list

    @Test
    void listReturns200WithStats() {
        given(service.list(null)).willReturn(List.of(habit(2, true), habit(1, false)));
        MvcTestResult r = mvc.get().uri("/api/habits").exchange();
        assertThat(r).hasStatusOk().hasContentTypeCompatibleWith(MediaType.APPLICATION_JSON);
        assertThat(r).bodyJson().extractingPath("$[0].id").isEqualTo(2);
        assertThat(r).bodyJson().extractingPath("$[0].completedToday").isEqualTo(true);
        assertThat(r).bodyJson().extractingPath("$[0].currentStreak").isEqualTo(1);
        assertThat(r).bodyJson().extractingPath("$[0].completionRate").isEqualTo(100);
        assertThat(r).bodyJson().extractingPath("$[0].lastCompletedDate").isEqualTo("2026-06-17");
        assertThat(r).bodyJson().extractingPath("$[0].frequency").isEqualTo("DAILY");
    }

    @Test
    void listPassesActiveFilter() {
        given(service.list(any())).willReturn(List.of());
        assertThat(mvc.get().uri("/api/habits?active=false").exchange()).hasStatusOk();
        verify(service).list(false);
    }

    @Test
    void listInvalidActiveReturns400() {
        assertValidation(mvc.get().uri("/api/habits?active=bogus").exchange(), "active");
        verifyNoInteractions(service);
    }

    // --- create (AS1) + validation

    @Test
    void createReturns201() {
        given(service.create(any())).willReturn(habit(5, false));
        MvcTestResult r = postJson("/api/habits", "{\"name\":\"Water\",\"description\":\"d\",\"frequency\":\"WEEKLY\"}");
        assertThat(r).hasStatus(201);
        assertThat(r).bodyJson().extractingPath("$.id").isEqualTo(5);
        verify(service).create(new HabitRequest("Water", "d", HabitFrequency.WEEKLY));
    }

    @Test
    void createAccepts150CharNameAnd2000CharDescription() {
        given(service.create(any())).willReturn(habit(1, false));
        assertThat(postJson("/api/habits", "{\"name\":\"" + "a".repeat(150) + "\",\"description\":\""
                + "d".repeat(2000) + "\",\"frequency\":\"DAILY\"}")).hasStatus(201);
    }

    @Test
    void createBlankOrMissingNameReturns400() {
        assertValidation(postJson("/api/habits", "{\"name\":\"\",\"frequency\":\"DAILY\"}"), "name");
        assertValidation(postJson("/api/habits", "{\"name\":\"   \",\"frequency\":\"DAILY\"}"), "name");
        assertValidation(postJson("/api/habits", "{\"frequency\":\"DAILY\"}"), "name");
        verifyNoInteractions(service);
    }

    @Test
    void create151CharNameReturns400() {
        assertValidation(postJson("/api/habits", "{\"name\":\"" + "a".repeat(151) + "\",\"frequency\":\"DAILY\"}"),
                "name");
        verifyNoInteractions(service);
    }

    @Test
    void create2001CharDescriptionReturns400() {
        assertValidation(postJson("/api/habits", "{\"name\":\"x\",\"description\":\"" + "d".repeat(2001)
                + "\",\"frequency\":\"DAILY\"}"), "description");
        verifyNoInteractions(service);
    }

    @Test
    void createMissingOrInvalidFrequencyReturns400() {
        assertValidation(postJson("/api/habits", "{\"name\":\"x\"}"), "frequency");
        assertValidation(postJson("/api/habits", "{\"name\":\"x\",\"frequency\":\"MONTHLY\"}"), "frequency");
        verifyNoInteractions(service);
    }

    @Test
    void createMalformedJsonReturns400() {
        assertProblem(postJson("/api/habits", "{bad"), 400);
        verifyNoInteractions(service);
    }

    // --- get / update / delete

    @Test
    void getReturns200Or404Or400() {
        given(service.get(1)).willReturn(habit(1, false));
        given(service.get(99)).willThrow(NotFoundException.of("Habit", 99));
        assertThat(mvc.get().uri("/api/habits/1").exchange()).hasStatusOk().bodyJson().extractingPath("$.name")
                .isEqualTo("H1");
        assertProblem(mvc.get().uri("/api/habits/99").exchange(), 404);
        assertValidation(mvc.get().uri("/api/habits/abc").exchange(), "id");
    }

    @Test
    void updateReturns200Or400Or404() {
        given(service.update(eq(1L), any())).willReturn(habit(1, false));
        given(service.update(eq(99L), any())).willThrow(NotFoundException.of("Habit", 99));
        assertThat(putJson("/api/habits/1", "{\"name\":\"n\",\"frequency\":\"DAILY\"}")).hasStatusOk();
        assertProblem(putJson("/api/habits/99", "{\"name\":\"n\",\"frequency\":\"DAILY\"}"), 404);
        assertValidation(putJson("/api/habits/1", "{\"name\":\"\",\"frequency\":\"DAILY\"}"), "name");
        assertValidation(putJson("/api/habits/1", "{\"name\":\"" + "a".repeat(151) + "\",\"frequency\":\"DAILY\"}"),
                "name");
        assertValidation(putJson("/api/habits/1", "{\"name\":\"n\"}"), "frequency");
    }

    @Test
    void deleteReturns204Or404() {
        willThrow(NotFoundException.of("Habit", 99)).given(service).delete(99);
        assertThat(mvc.delete().uri("/api/habits/1").exchange()).hasStatus(204);
        verify(service).delete(1);
        assertProblem(mvc.delete().uri("/api/habits/99").exchange(), 404);
    }

    @Test
    void deleteWithProblemJsonAcceptReturns204() {
        assertThat(mvc.delete().uri("/api/habits/1").accept(MediaType.APPLICATION_PROBLEM_JSON).exchange())
                .hasStatus(204);
    }

    // --- activate / deactivate (AS6)

    @Test
    void deactivateAndActivateReturn200Or404() {
        HabitResponse inactive = new HabitResponse(1L, "H1", null, HabitFrequency.DAILY, NOW, false, false, false, 0,
                0, null);
        given(service.deactivate(1)).willReturn(inactive);
        given(service.activate(1)).willReturn(habit(1, false));
        given(service.deactivate(99)).willThrow(NotFoundException.of("Habit", 99));
        given(service.activate(99)).willThrow(NotFoundException.of("Habit", 99));
        assertThat(mvc.post().uri("/api/habits/1/deactivate").exchange()).hasStatusOk().bodyJson()
                .extractingPath("$.active").isEqualTo(false);
        assertThat(mvc.post().uri("/api/habits/1/activate").exchange()).hasStatusOk().bodyJson()
                .extractingPath("$.active").isEqualTo(true);
        assertProblem(mvc.post().uri("/api/habits/99/deactivate").exchange(), 404);
        assertProblem(mvc.post().uri("/api/habits/99/activate").exchange(), 404);
    }

    // --- completions (AS2-AS4)

    @Test
    void listCompletionsReturns200Or404() {
        given(service.listCompletions(1)).willReturn(List.of(new HabitCompletionResponse(7L, 1L, TODAY, NOW)));
        given(service.listCompletions(99)).willThrow(NotFoundException.of("Habit", 99));
        MvcTestResult r = mvc.get().uri("/api/habits/1/completions").exchange();
        assertThat(r).hasStatusOk();
        assertThat(r).bodyJson().extractingPath("$[0].completionDate").isEqualTo("2026-06-17");
        assertThat(r).bodyJson().extractingPath("$[0].habitId").isEqualTo(1);
        assertProblem(mvc.get().uri("/api/habits/99/completions").exchange(), 404);
    }

    @Test
    void completeWithoutBodyDefaultsToNullDate() {
        given(service.complete(eq(1L), isNull())).willReturn(habit(1, true));
        MvcTestResult r = mvc.post().uri("/api/habits/1/completions").exchange();
        assertThat(r).hasStatus(201);
        assertThat(r).bodyJson().extractingPath("$.completedToday").isEqualTo(true);
        verify(service).complete(1L, null);
    }

    @Test
    void completeWithDateBodyPassesDate() {
        given(service.complete(eq(1L), any())).willReturn(habit(1, true));
        assertThat(postJson("/api/habits/1/completions", "{\"date\":\"2026-06-16\"}")).hasStatus(201);
        verify(service).complete(1L, LocalDate.of(2026, 6, 16));
    }

    @Test
    void completeDuplicateReturns409Problem() {
        given(service.complete(eq(1L), any())).willThrow(new ConflictException("Habit is already completed on 2026-06-17"));
        MvcTestResult r = mvc.post().uri("/api/habits/1/completions").exchange();
        assertProblem(r, 409);
        assertThat(r).bodyJson().extractingPath("$.detail").asString().contains("already completed");
    }

    @Test
    void completeFutureDateReturns400OnDate() {
        given(service.complete(eq(1L), any())).willThrow(new BadRequestException("date", "Completion date must not be in the future"));
        assertValidation(postJson("/api/habits/1/completions", "{\"date\":\"2099-01-01\"}"), "date");
    }

    @Test
    void completeInvalidDateReturns400() {
        assertProblem(postJson("/api/habits/1/completions", "{\"date\":\"2026-13-40\"}"), 400);
        verifyNoInteractions(service);
    }

    @Test
    void completeUnknownHabitReturns404() {
        given(service.complete(eq(99L), any())).willThrow(NotFoundException.of("Habit", 99));
        assertProblem(mvc.post().uri("/api/habits/99/completions").exchange(), 404);
    }

    @Test
    void uncompleteReturns200Or404Or400() {
        given(service.uncomplete(1, TODAY)).willReturn(habit(1, false));
        given(service.uncomplete(1, TODAY.minusDays(1)))
                .willThrow(new NotFoundException("Habit 1 has no completion on 2026-06-16"));
        assertThat(mvc.delete().uri("/api/habits/1/completions/2026-06-17").exchange()).hasStatusOk().bodyJson()
                .extractingPath("$.completedToday").isEqualTo(false);
        assertProblem(mvc.delete().uri("/api/habits/1/completions/2026-06-16").exchange(), 404);
        assertValidation(mvc.delete().uri("/api/habits/1/completions/notadate").exchange(), "date");
    }
}
