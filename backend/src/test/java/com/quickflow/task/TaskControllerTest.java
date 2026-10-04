package com.quickflow.task;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.willThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;

import com.quickflow.common.NotFoundException;
import com.quickflow.task.dto.TaskRequest;
import com.quickflow.task.dto.TaskResponse;

/**
 * T033 — {@link TaskController} web slice with a mocked {@link TaskService}: status codes of all 8
 * operations, request validation 400 problem+json, 404. Traces US1 AS1-AS8.
 */
@WebMvcTest(TaskController.class)
class TaskControllerTest {

    @Autowired
    MockMvcTester mvc;

    @MockitoBean
    TaskService service;

    static final OffsetDateTime NOW = OffsetDateTime.parse("2026-06-15T10:00:00Z");

    static TaskResponse task(long id, TaskStatus status) {
        return new TaskResponse(id, "T" + id, null, status, TaskPriority.MEDIUM, null, NOW, NOW,
                status == TaskStatus.DONE ? NOW : null, false, false);
    }

    private MvcTestResult postJson(String uri, String body) {
        return mvc.post().uri(uri).contentType(MediaType.APPLICATION_JSON).content(body).exchange();
    }

    private MvcTestResult putJson(String uri, String body) {
        return mvc.put().uri(uri).contentType(MediaType.APPLICATION_JSON).content(body).exchange();
    }

    private void assertValidation(MvcTestResult r, String field) {
        assertThat(r).hasStatus(400).hasContentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON);
        assertThat(r).bodyJson().extractingPath("$.status").isEqualTo(400);
        assertThat(r).bodyJson().extractingPath("$.errors[*].field").asArray().contains(field);
    }

    // --- list

    @Test
    void listReturns200AndPassesQuery() {
        given(service.list(any())).willReturn(List.of(task(1, TaskStatus.TODO)));
        MvcTestResult r = mvc.get().uri("/api/tasks?q=ab&status=DONE&priority=HIGH&dueFrom=2026-06-01"
                + "&dueTo=2026-06-30&overdue=true&archived=true&sort=DUE_DATE&direction=ASC").exchange();
        assertThat(r).hasStatusOk().hasContentTypeCompatibleWith(MediaType.APPLICATION_JSON);
        assertThat(r).bodyJson().extractingPath("$[0].id").isEqualTo(1);
        assertThat(r).bodyJson().extractingPath("$[0].overdue").isEqualTo(false);
        ArgumentCaptor<TaskService.TaskQuery> q = ArgumentCaptor.forClass(TaskService.TaskQuery.class);
        verify(service).list(q.capture());
        assertThat(q.getValue()).isEqualTo(new TaskService.TaskQuery("ab", TaskStatus.DONE, TaskPriority.HIGH,
                LocalDate.of(2026, 6, 1), LocalDate.of(2026, 6, 30), true, true, TaskSort.DUE_DATE,
                SortDirection.ASC));
    }

    @Test
    void listDefaultsArchivedFalse() {
        given(service.list(any())).willReturn(List.of());
        assertThat(mvc.get().uri("/api/tasks").exchange()).hasStatusOk();
        ArgumentCaptor<TaskService.TaskQuery> q = ArgumentCaptor.forClass(TaskService.TaskQuery.class);
        verify(service).list(q.capture());
        assertThat(q.getValue().archived()).isFalse();
        assertThat(q.getValue().sort()).isNull();
    }

    @Test
    void listInvalidParamsReturn400() {
        assertValidation(mvc.get().uri("/api/tasks?status=NOPE").exchange(), "status");
        assertValidation(mvc.get().uri("/api/tasks?sort=BOGUS").exchange(), "sort");
        assertValidation(mvc.get().uri("/api/tasks?dueFrom=notadate").exchange(), "dueFrom");
        verifyNoInteractions(service);
    }

    // --- create

    @Test
    void createReturns201() {
        given(service.create(any())).willReturn(task(5, TaskStatus.TODO));
        MvcTestResult r = postJson("/api/tasks", "{\"title\":\"Buy\",\"priority\":\"HIGH\",\"dueDate\":\"2026-07-01\"}");
        assertThat(r).hasStatus(201);
        assertThat(r).bodyJson().extractingPath("$.id").isEqualTo(5);
        verify(service).create(new TaskRequest("Buy", null, null, TaskPriority.HIGH, LocalDate.of(2026, 7, 1)));
    }

    @Test
    void createAccepts200CharTitleAnd2000CharDescription() {
        given(service.create(any())).willReturn(task(1, TaskStatus.TODO));
        assertThat(postJson("/api/tasks", "{\"title\":\"" + "a".repeat(200) + "\",\"description\":\""
                + "d".repeat(2000) + "\"}")).hasStatus(201);
    }

    @Test
    void createEmptyTitleReturns400() {
        assertValidation(postJson("/api/tasks", "{\"title\":\"\"}"), "title");
        assertValidation(postJson("/api/tasks", "{\"title\":\"   \"}"), "title");
        assertValidation(postJson("/api/tasks", "{}"), "title");
        verify(service, never()).create(any());
    }

    @Test
    void createTitle201CharsReturns400() {
        assertValidation(postJson("/api/tasks", "{\"title\":\"" + "a".repeat(201) + "\"}"), "title");
        verify(service, never()).create(any());
    }

    @Test
    void createDescription2001CharsReturns400() {
        assertValidation(postJson("/api/tasks", "{\"title\":\"t\",\"description\":\"" + "d".repeat(2001) + "\"}"),
                "description");
        verify(service, never()).create(any());
    }

    @Test
    void createInvalidEnumOrDateReturns400() {
        assertValidation(postJson("/api/tasks", "{\"title\":\"t\",\"status\":\"NOPE\"}"), "status");
        assertValidation(postJson("/api/tasks", "{\"title\":\"t\",\"priority\":\"URGENT\"}"), "priority");
        assertValidation(postJson("/api/tasks", "{\"title\":\"t\",\"dueDate\":\"2026-13-40\"}"), "dueDate");
        verify(service, never()).create(any());
    }

    @Test
    void createMalformedJsonReturns400() {
        MvcTestResult r = postJson("/api/tasks", "{bad");
        assertThat(r).hasStatus(400).hasContentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON);
    }

    // --- get / put / delete

    @Test
    void getReturns200Or404() {
        given(service.get(1)).willReturn(task(1, TaskStatus.TODO));
        given(service.get(99)).willThrow(NotFoundException.of("Task", 99));
        assertThat(mvc.get().uri("/api/tasks/1").exchange()).hasStatusOk().bodyJson()
                .extractingPath("$.title").isEqualTo("T1");
        MvcTestResult nf = mvc.get().uri("/api/tasks/99").exchange();
        assertThat(nf).hasStatus(404).hasContentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON);
        assertThat(nf).bodyJson().extractingPath("$.detail").isEqualTo("Task 99 not found");
    }

    @Test
    void invalidIdReturns400() {
        assertValidation(mvc.get().uri("/api/tasks/abc").exchange(), "id");
        verifyNoInteractions(service);
    }

    @Test
    void updateReturns200Or400Or404() {
        given(service.update(eq(1L), any())).willReturn(task(1, TaskStatus.DONE));
        given(service.update(eq(99L), any())).willThrow(NotFoundException.of("Task", 99));
        assertThat(putJson("/api/tasks/1", "{\"title\":\"x\",\"status\":\"DONE\"}")).hasStatusOk()
                .bodyJson().extractingPath("$.status").isEqualTo("DONE");
        assertThat(putJson("/api/tasks/99", "{\"title\":\"x\"}")).hasStatus(404);
        assertValidation(putJson("/api/tasks/1", "{\"title\":\"\"}"), "title");
        assertValidation(putJson("/api/tasks/1", "{\"title\":\"" + "a".repeat(201) + "\"}"), "title");
    }

    @Test
    void deleteReturns204Or404() {
        willThrow(NotFoundException.of("Task", 99)).given(service).delete(99);
        MvcTestResult ok = mvc.delete().uri("/api/tasks/1").exchange();
        assertThat(ok).hasStatus(204);
        assertThat(ok.getResponse().getContentAsByteArray()).isEmpty();
        verify(service).delete(1);
        assertThat(mvc.delete().uri("/api/tasks/99").exchange()).hasStatus(404)
                .hasContentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON);
    }

    @Test
    void deleteAcceptsProblemJsonOnly() { // BUG-P2-001
        willThrow(NotFoundException.of("Task", 99)).given(service).delete(99);
        assertThat(mvc.delete().uri("/api/tasks/1").accept(MediaType.APPLICATION_PROBLEM_JSON).exchange())
                .hasStatus(204);
        verify(service).delete(1);
        assertThat(mvc.delete().uri("/api/tasks/99").accept(MediaType.APPLICATION_PROBLEM_JSON).exchange())
                .hasStatus(404).hasContentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON);
    }

    // --- complete / archive / restore

    @Test
    void actionEndpointsReturn200Or404() {
        given(service.complete(1)).willReturn(task(1, TaskStatus.DONE));
        given(service.archive(1)).willReturn(task(1, TaskStatus.TODO));
        given(service.restore(1)).willReturn(task(1, TaskStatus.TODO));
        given(service.complete(99)).willThrow(NotFoundException.of("Task", 99));
        given(service.archive(99)).willThrow(NotFoundException.of("Task", 99));
        given(service.restore(99)).willThrow(NotFoundException.of("Task", 99));

        assertThat(mvc.post().uri("/api/tasks/1/complete").exchange()).hasStatusOk().bodyJson()
                .extractingPath("$.status").isEqualTo("DONE");
        assertThat(mvc.post().uri("/api/tasks/1/archive").exchange()).hasStatusOk();
        assertThat(mvc.post().uri("/api/tasks/1/restore").exchange()).hasStatusOk();
        assertThat(mvc.post().uri("/api/tasks/99/complete").exchange()).hasStatus(404);
        assertThat(mvc.post().uri("/api/tasks/99/archive").exchange()).hasStatus(404);
        assertThat(mvc.post().uri("/api/tasks/99/restore").exchange()).hasStatus(404);
    }
}
