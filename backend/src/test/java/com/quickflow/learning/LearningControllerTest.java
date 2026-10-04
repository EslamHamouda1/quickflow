package com.quickflow.learning;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.willThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;

import com.quickflow.common.NotFoundException;
import com.quickflow.learning.dto.LearningCardRequest;
import com.quickflow.learning.dto.LearningCardResponse;
import com.quickflow.learning.dto.MilestoneRequest;
import com.quickflow.learning.dto.MilestoneResponse;
import com.quickflow.learning.dto.NoteRequest;
import com.quickflow.learning.dto.NoteResponse;

/**
 * T063 — {@link LearningController} web slice with a mocked {@link LearningService}: status codes of all
 * 10 operations, request-DTO validation 400 problem+json, 404 mapped from the service. Traces US3 AS1-AS6.
 */
@WebMvcTest(LearningController.class)
class LearningControllerTest {

    static final String BASE = "/api/learning-cards";
    static final OffsetDateTime NOW = OffsetDateTime.parse("2026-06-17T10:00:00Z");
    static final String T200 = "a".repeat(200);
    static final String T201 = "a".repeat(201);

    @Autowired
    MockMvcTester mvc;

    @MockitoBean
    LearningService service;

    static LearningCardResponse card(long id) {
        return new LearningCardResponse(id, "Card " + id, null, LearningStatus.IN_PROGRESS, NOW,
                List.of(new MilestoneResponse(10L, "m1", true, LocalDate.of(2026, 7, 1), NOW),
                        new MilestoneResponse(11L, "m2", false, null, null)),
                List.of(new NoteResponse(20L, "note", NOW)), 2, 1, 50);
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

    private void assertCardBody(MvcTestResult r) {
        assertThat(r).bodyJson().extractingPath("$.status").isEqualTo("IN_PROGRESS");
        assertThat(r).bodyJson().extractingPath("$.progressPercent").isEqualTo(50);
        assertThat(r).bodyJson().extractingPath("$.milestonesTotal").isEqualTo(2);
        assertThat(r).bodyJson().extractingPath("$.milestonesDone").isEqualTo(1);
        assertThat(r).bodyJson().extractingPath("$.milestones[0].targetDate").isEqualTo("2026-07-01");
        assertThat(r).bodyJson().extractingPath("$.notes[0].text").isEqualTo("note");
    }

    // --- cards

    @Test
    void list200() {
        given(service.list()).willReturn(List.of(card(2), card(1)));
        MvcTestResult r = mvc.get().uri(BASE).exchange();
        assertThat(r).hasStatusOk().hasContentTypeCompatibleWith(MediaType.APPLICATION_JSON);
        assertThat(r).bodyJson().extractingPath("$[0].id").isEqualTo(2);
        assertThat(r).bodyJson().extractingPath("$[1].id").isEqualTo(1);
    }

    @Test
    void create201() {
        given(service.create(any())).willReturn(card(1));
        MvcTestResult r = postJson(BASE, "{\"title\":\"" + T200 + "\",\"description\":\"" + "d".repeat(2000) + "\"}");
        assertThat(r).hasStatus(201);
        assertCardBody(r);
        verify(service).create(new LearningCardRequest(T200, "d".repeat(2000), null));
    }

    @Test
    void createWithStatus201() {
        given(service.create(any())).willReturn(card(1));
        assertThat(postJson(BASE, "{\"title\":\"x\",\"status\":\"COMPLETED\"}")).hasStatus(201);
        verify(service).create(new LearningCardRequest("x", null, LearningStatus.COMPLETED));
    }

    @ParameterizedTest
    @ValueSource(strings = {"{\"title\":\"\"}", "{\"title\":\"   \"}", "{}", "{\"title\":null}"})
    void createBlankOrMissingTitle400(String body) {
        assertValidation(postJson(BASE, body), "title");
        verifyNoInteractions(service);
    }

    @Test
    void createTitle201Chars400() {
        assertValidation(postJson(BASE, "{\"title\":\"" + T201 + "\"}"), "title");
        verifyNoInteractions(service);
    }

    @Test
    void createDescription2001Chars400() {
        assertValidation(postJson(BASE, "{\"title\":\"x\",\"description\":\"" + "d".repeat(2001) + "\"}"), "description");
        verifyNoInteractions(service);
    }

    @Test
    void createInvalidStatus400() {
        assertValidation(postJson(BASE, "{\"title\":\"x\",\"status\":\"DONE\"}"), "status");
        verifyNoInteractions(service);
    }

    @Test
    void createMalformedJson400() {
        assertProblem(postJson(BASE, "{bad"), 400);
        verifyNoInteractions(service);
    }

    @Test
    void get200And404And400() {
        given(service.get(1L)).willReturn(card(1));
        given(service.get(9L)).willThrow(NotFoundException.of("Learning card", 9L));
        MvcTestResult ok = mvc.get().uri(BASE + "/1").exchange();
        assertThat(ok).hasStatusOk();
        assertCardBody(ok);
        assertProblem(mvc.get().uri(BASE + "/9").exchange(), 404);
        assertValidation(mvc.get().uri(BASE + "/abc").exchange(), "id");
    }

    @Test
    void update200() {
        given(service.update(eq(1L), any())).willReturn(card(1));
        assertThat(putJson(BASE + "/1", "{\"title\":\"t\",\"status\":\"NOT_STARTED\"}")).hasStatusOk();
        verify(service).update(1L, new LearningCardRequest("t", null, LearningStatus.NOT_STARTED));
    }

    @Test
    void updateValidation400() {
        assertValidation(putJson(BASE + "/1", "{\"title\":\" \"}"), "title");
        assertValidation(putJson(BASE + "/1", "{\"title\":\"" + T201 + "\"}"), "title");
        assertValidation(putJson(BASE + "/1", "{\"title\":\"x\",\"description\":\"" + "d".repeat(2001) + "\"}"), "description");
        assertValidation(putJson(BASE + "/1", "{\"title\":\"x\",\"status\":\"bogus\"}"), "status");
        verifyNoInteractions(service);
    }

    @Test
    void update404() {
        given(service.update(eq(9L), any())).willThrow(NotFoundException.of("Learning card", 9L));
        assertProblem(putJson(BASE + "/9", "{\"title\":\"t\"}"), 404);
    }

    @Test
    void delete204And404() {
        assertThat(mvc.delete().uri(BASE + "/1").exchange()).hasStatus(204);
        assertThat(mvc.delete().uri(BASE + "/1").accept(MediaType.APPLICATION_PROBLEM_JSON).exchange()).hasStatus(204);
        willThrow(NotFoundException.of("Learning card", 9L)).given(service).delete(9L);
        assertProblem(mvc.delete().uri(BASE + "/9").exchange(), 404);
        assertValidation(mvc.delete().uri(BASE + "/x").exchange(), "id");
    }

    // --- milestones

    @Test
    void addMilestone201() {
        given(service.addMilestone(eq(1L), any())).willReturn(card(1));
        MvcTestResult r = postJson(BASE + "/1/milestones", "{\"title\":\"" + T200 + "\",\"targetDate\":\"2026-07-01\"}");
        assertThat(r).hasStatus(201);
        assertCardBody(r);
        verify(service).addMilestone(1L, new MilestoneRequest(T200, null, LocalDate.of(2026, 7, 1)));
    }

    @ParameterizedTest
    @ValueSource(strings = {"{\"title\":\"\"}", "{\"title\":\"  \"}", "{}"})
    void addMilestoneBlankTitle400(String body) {
        assertValidation(postJson(BASE + "/1/milestones", body), "title");
        verifyNoInteractions(service);
    }

    @Test
    void addMilestoneTitle201AndBadDate400() {
        assertValidation(postJson(BASE + "/1/milestones", "{\"title\":\"" + T201 + "\"}"), "title");
        assertValidation(postJson(BASE + "/1/milestones", "{\"title\":\"x\",\"targetDate\":\"2026-13-40\"}"), "targetDate");
        verifyNoInteractions(service);
    }

    @Test
    void addMilestone404() {
        given(service.addMilestone(eq(9L), any())).willThrow(NotFoundException.of("Learning card", 9L));
        assertProblem(postJson(BASE + "/9/milestones", "{\"title\":\"x\"}"), 404);
    }

    @Test
    void updateMilestone200And400And404() {
        given(service.updateMilestone(eq(1L), eq(10L), any())).willReturn(card(1));
        assertThat(putJson(BASE + "/1/milestones/10", "{\"title\":\"m\",\"done\":true}")).hasStatusOk();
        verify(service).updateMilestone(1L, 10L, new MilestoneRequest("m", true, null));
        assertValidation(putJson(BASE + "/1/milestones/10", "{\"title\":\"\",\"done\":true}"), "title");
        assertValidation(putJson(BASE + "/1/milestones/10", "{\"title\":\"" + T201 + "\"}"), "title");
        assertValidation(putJson(BASE + "/1/milestones/abc", "{\"title\":\"m\"}"), "milestoneId");
        given(service.updateMilestone(eq(1L), eq(99L), any())).willThrow(new NotFoundException("Milestone 99 not found"));
        assertProblem(putJson(BASE + "/1/milestones/99", "{\"title\":\"m\"}"), 404);
    }

    @Test
    void deleteMilestone200And404() {
        given(service.deleteMilestone(1L, 10L)).willReturn(card(1));
        MvcTestResult r = mvc.delete().uri(BASE + "/1/milestones/10").exchange();
        assertThat(r).hasStatusOk();
        assertCardBody(r);
        given(service.deleteMilestone(1L, 99L)).willThrow(new NotFoundException("Milestone 99 not found"));
        assertProblem(mvc.delete().uri(BASE + "/1/milestones/99").exchange(), 404);
        assertValidation(mvc.delete().uri(BASE + "/1/milestones/x").exchange(), "milestoneId");
    }

    // --- notes

    @Test
    void addNote201() {
        given(service.addNote(eq(1L), any())).willReturn(card(1));
        String t5000 = "n".repeat(5000);
        assertThat(postJson(BASE + "/1/notes", "{\"text\":\"" + t5000 + "\"}")).hasStatus(201);
        verify(service).addNote(1L, new NoteRequest(t5000));
    }

    @ParameterizedTest
    @ValueSource(strings = {"{\"text\":\"\"}", "{\"text\":\"   \"}", "{}"})
    void addNoteBlank400(String body) {
        assertValidation(postJson(BASE + "/1/notes", body), "text");
        verifyNoInteractions(service);
    }

    @Test
    void addNote5001Chars400() {
        assertValidation(postJson(BASE + "/1/notes", "{\"text\":\"" + "n".repeat(5001) + "\"}"), "text");
        verifyNoInteractions(service);
    }

    @Test
    void addNote404() {
        given(service.addNote(eq(9L), any())).willThrow(NotFoundException.of("Learning card", 9L));
        assertProblem(postJson(BASE + "/9/notes", "{\"text\":\"x\"}"), 404);
    }

    @Test
    void deleteNote200And404() {
        given(service.deleteNote(1L, 20L)).willReturn(card(1));
        assertThat(mvc.delete().uri(BASE + "/1/notes/20").exchange()).hasStatusOk();
        given(service.deleteNote(eq(1L), anyLong())).willThrow(new NotFoundException("Note 99 not found"));
        assertProblem(mvc.delete().uri(BASE + "/1/notes/99").exchange(), 404);
        assertValidation(mvc.delete().uri(BASE + "/1/notes/x").exchange(), "noteId");
    }
}
