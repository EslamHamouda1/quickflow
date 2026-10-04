package com.quickflow.plan;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.willThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import java.time.OffsetDateTime;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;

import com.quickflow.common.BadRequestException;
import com.quickflow.common.NotFoundException;
import com.quickflow.plan.dto.PlanItemResponse;
import com.quickflow.plan.dto.PlanItemSource;
import com.quickflow.plan.dto.PlanRequest;
import com.quickflow.plan.dto.PlanResponse;

/**
 * T080 — {@link PlanController} web slice with a mocked {@link PlanService}: status codes of all 6 operations,
 * request-DTO validation 400 problem+json, service 400/404 mapping. Traces US4 AS1-AS8.
 */
@WebMvcTest(PlanController.class)
class PlanControllerTest {

    static final String BASE = "/api/plans";
    static final OffsetDateTime START = OffsetDateTime.parse("2026-06-17T10:00:00Z");
    static final OffsetDateTime END = START.plusHours(2);
    static final String T200 = "a".repeat(200);
    static final String T201 = "a".repeat(201);

    @Autowired
    MockMvcTester mvc;

    @MockitoBean
    PlanService service;

    static PlanResponse plan(long id) {
        return new PlanResponse(id, "Plan " + id, 90, START, END, 1, PlanStatus.IN_PROGRESS, START, null,
                List.of(new PlanItemResponse(10L, PlanItemSourceType.TASK, 5L, "Write report", true, true),
                        new PlanItemResponse(11L, PlanItemSourceType.HABIT, 6L, "Stretch", false, false)),
                2, 1, 50, 3600L);
    }

    static String body(String title, String duration, String start, String end, String priority, String items) {
        StringBuilder sb = new StringBuilder("{");
        if (title != null) sb.append("\"title\":").append(title).append(',');
        if (duration != null) sb.append("\"estimatedDurationMinutes\":").append(duration).append(',');
        if (start != null) sb.append("\"startDateTime\":").append(start).append(',');
        if (end != null) sb.append("\"endDateTime\":").append(end).append(',');
        if (priority != null) sb.append("\"priorityOrder\":").append(priority).append(',');
        if (items != null) sb.append("\"items\":").append(items).append(',');
        if (sb.charAt(sb.length() - 1) == ',') sb.setLength(sb.length() - 1);
        return sb.append('}').toString();
    }

    static final String ITEMS = "[{\"sourceType\":\"TASK\",\"sourceId\":5},{\"sourceType\":\"HABIT\",\"sourceId\":6}]";
    static final String S = "\"2026-06-17T10:00:00Z\"";
    static final String E = "\"2026-06-17T12:00:00Z\"";

    static String valid() {
        return body("\"Focus\"", "90", S, E, "1", ITEMS);
    }

    private MvcTestResult postJson(String uri, String json) {
        return mvc.post().uri(uri).contentType(MediaType.APPLICATION_JSON).content(json).exchange();
    }

    private MvcTestResult putJson(String uri, String json) {
        return mvc.put().uri(uri).contentType(MediaType.APPLICATION_JSON).content(json).exchange();
    }

    private void assertProblem(MvcTestResult r, int status) {
        assertThat(r).hasStatus(status).hasContentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON);
        assertThat(r).bodyJson().extractingPath("$.status").isEqualTo(status);
    }

    private void assertValidation(MvcTestResult r, String field) {
        assertProblem(r, 400);
        assertThat(r).bodyJson().extractingPath("$.errors[*].field").asArray()
                .anySatisfy(f -> assertThat((String) f).contains(field));
    }

    private void assertPlanBody(MvcTestResult r) {
        assertThat(r).bodyJson().extractingPath("$.status").isEqualTo("IN_PROGRESS");
        assertThat(r).bodyJson().extractingPath("$.progressPercent").isEqualTo(50);
        assertThat(r).bodyJson().extractingPath("$.restSeconds").isEqualTo(3600);
        assertThat(r).bodyJson().extractingPath("$.items[1].sourceAvailable").isEqualTo(false);
        assertThat(r).bodyJson().extractingPath("$.items[0].sourceType").isEqualTo("TASK");
    }

    // ---- list ----

    @Test
    void list200() {
        given(service.list(null)).willReturn(List.of(plan(2), plan(1)));
        MvcTestResult r = mvc.get().uri(BASE).exchange();
        assertThat(r).hasStatusOk().hasContentTypeCompatibleWith(MediaType.APPLICATION_JSON);
        assertThat(r).bodyJson().extractingPath("$[0].id").isEqualTo(2);
        assertThat(r).bodyJson().extractingPath("$[1].id").isEqualTo(1);
    }

    @Test
    void listWithStatusFilter200() {
        given(service.list(PlanStatus.COMPLETED)).willReturn(List.of());
        assertThat(mvc.get().uri(BASE + "?status=COMPLETED").exchange()).hasStatusOk();
        verify(service).list(PlanStatus.COMPLETED);
    }

    @Test
    void listInvalidStatus400() {
        assertProblem(mvc.get().uri(BASE + "?status=BOGUS").exchange(), 400);
        verifyNoInteractions(service);
    }

    // ---- create ----

    @Test
    void create201() {
        given(service.create(any())).willReturn(plan(1));
        MvcTestResult r = postJson(BASE, body("\"" + T200 + "\"", "1", S, E, "1", ITEMS));
        assertThat(r).hasStatus(201).hasContentTypeCompatibleWith(MediaType.APPLICATION_JSON);
        assertPlanBody(r);
        verify(service).create(new PlanRequest(T200, 1, START, END, 1,
                List.of(new PlanItemSource(PlanItemSourceType.TASK, 5L),
                        new PlanItemSource(PlanItemSourceType.HABIT, 6L))));
    }

    @ParameterizedTest
    @ValueSource(strings = {"\"\"", "\"   \"", "null"})
    void createBlankTitle400(String title) {
        assertValidation(postJson(BASE, body(title, "90", S, E, "1", ITEMS)), "title");
        verifyNoInteractions(service);
    }

    @Test
    void createMissingTitle400() {
        assertValidation(postJson(BASE, body(null, "90", S, E, "1", ITEMS)), "title");
        verifyNoInteractions(service);
    }

    @Test
    void createTitle201Chars400() {
        assertValidation(postJson(BASE, body("\"" + T201 + "\"", "90", S, E, "1", ITEMS)), "title");
        verifyNoInteractions(service);
    }

    @Test
    void createEmptyItems400() {
        assertValidation(postJson(BASE, body("\"x\"", "90", S, E, "1", "[]")), "items");
        verifyNoInteractions(service);
    }

    @Test
    void createMissingItems400() {
        assertValidation(postJson(BASE, body("\"x\"", "90", S, E, "1", null)), "items");
        verifyNoInteractions(service);
    }

    @Test
    void createMissingEstimatedDuration400() {
        assertValidation(postJson(BASE, body("\"x\"", null, S, E, "1", ITEMS)), "estimatedDurationMinutes");
        verifyNoInteractions(service);
    }

    @Test
    void createMissingPriority400() {
        assertValidation(postJson(BASE, body("\"x\"", "90", S, E, null, ITEMS)), "priorityOrder");
        verifyNoInteractions(service);
    }

    @Test
    void createMissingStart400() {
        assertValidation(postJson(BASE, body("\"x\"", "90", null, E, "1", ITEMS)), "startDateTime");
        verifyNoInteractions(service);
    }

    @Test
    void createMissingEnd400() {
        assertValidation(postJson(BASE, body("\"x\"", "90", S, null, "1", ITEMS)), "endDateTime");
        verifyNoInteractions(service);
    }

    @ParameterizedTest
    @CsvSource({"0,1,estimatedDurationMinutes", "-5,1,estimatedDurationMinutes", "90,0,priorityOrder",
            "90,-1,priorityOrder"})
    void createZeroOrNegative400(String duration, String priority, String field) {
        assertValidation(postJson(BASE, body("\"x\"", duration, S, E, priority, ITEMS)), field);
        verifyNoInteractions(service);
    }

    @Test
    void createItemWithoutSourceType400() {
        assertValidation(postJson(BASE, body("\"x\"", "90", S, E, "1", "[{\"sourceId\":5}]")), "sourceType");
        verifyNoInteractions(service);
    }

    @Test
    void createItemWithoutSourceId400() {
        assertValidation(postJson(BASE, body("\"x\"", "90", S, E, "1", "[{\"sourceType\":\"TASK\"}]")), "sourceId");
        verifyNoInteractions(service);
    }

    @Test
    void createInvalidSourceTypeEnum400() {
        assertProblem(postJson(BASE, body("\"x\"", "90", S, E, "1", "[{\"sourceType\":\"BOOK\",\"sourceId\":5}]")),
                400);
        verifyNoInteractions(service);
    }

    @Test
    void createMalformedJson400() {
        assertProblem(postJson(BASE, "{bad"), 400);
        verifyNoInteractions(service);
    }

    @Test
    void createServiceBadRequestMappedToField() {
        given(service.create(any())).willThrow(new BadRequestException("endDateTime", "End must be after start"));
        assertValidation(postJson(BASE, valid()), "endDateTime");
        willThrow(new BadRequestException("items", "Task 9 does not exist")).given(service).create(any());
        assertValidation(postJson(BASE, valid()), "items");
    }

    // ---- get / delete ----

    @Test
    void get200And404And400() {
        given(service.get(1L)).willReturn(plan(1));
        given(service.get(9L)).willThrow(NotFoundException.of("Plan", 9L));
        MvcTestResult ok = mvc.get().uri(BASE + "/1").exchange();
        assertThat(ok).hasStatusOk();
        assertPlanBody(ok);
        assertProblem(mvc.get().uri(BASE + "/9").exchange(), 404);
        assertProblem(mvc.get().uri(BASE + "/abc").exchange(), 400);
    }

    @Test
    void delete204And404() {
        assertThat(mvc.delete().uri(BASE + "/1").exchange()).hasStatus(204);
        verify(service).delete(1L);
        willThrow(NotFoundException.of("Plan", 9L)).given(service).delete(9L);
        assertProblem(mvc.delete().uri(BASE + "/9").exchange(), 404);
    }

    @Test
    void deleteWithProblemAcceptHeader204() {
        assertThat(mvc.delete().uri(BASE + "/1").accept(MediaType.APPLICATION_PROBLEM_JSON).exchange())
                .hasStatus(204);
    }

    // ---- items ----

    @Test
    void setItemDone200() {
        given(service.setItemDone(1L, 10L, true)).willReturn(plan(1));
        MvcTestResult r = putJson(BASE + "/1/items/10", "{\"done\":true}");
        assertThat(r).hasStatusOk();
        assertPlanBody(r);
        verify(service).setItemDone(1L, 10L, true);
    }

    @Test
    void setItemNotDone200() {
        given(service.setItemDone(1L, 10L, false)).willReturn(plan(1));
        assertThat(putJson(BASE + "/1/items/10", "{\"done\":false}")).hasStatusOk();
        verify(service).setItemDone(1L, 10L, false);
    }

    @ParameterizedTest
    @ValueSource(strings = {"{}", "{\"done\":null}"})
    void setItemWithoutDone400(String json) {
        assertValidation(putJson(BASE + "/1/items/10", json), "done");
        verifyNoInteractions(service);
    }

    @Test
    void setItemUnknown404() {
        given(service.setItemDone(1L, 99L, true)).willThrow(new NotFoundException("Plan 1 has no item 99"));
        assertProblem(putJson(BASE + "/1/items/99", "{\"done\":true}"), 404);
    }

    // ---- start notification ----

    @Test
    void acknowledgeStart200And404() {
        given(service.acknowledgeStart(1L)).willReturn(plan(1));
        given(service.acknowledgeStart(9L)).willThrow(NotFoundException.of("Plan", 9L));
        MvcTestResult ok = mvc.post().uri(BASE + "/1/start-notification").exchange();
        assertThat(ok).hasStatusOk();
        assertPlanBody(ok);
        assertProblem(mvc.post().uri(BASE + "/9/start-notification").exchange(), 404);
        assertProblem(mvc.post().uri(BASE + "/abc/start-notification").exchange(), 400);
    }
}
