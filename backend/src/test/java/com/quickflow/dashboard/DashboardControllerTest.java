package com.quickflow.dashboard;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;

import org.junit.jupiter.api.Test;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;

import com.quickflow.dashboard.dto.DashboardHabits;
import com.quickflow.dashboard.dto.DashboardLearning;
import com.quickflow.dashboard.dto.DashboardPlans;
import com.quickflow.dashboard.dto.DashboardResponse;
import com.quickflow.dashboard.dto.DashboardTasks;
import com.quickflow.task.TaskPriority;
import com.quickflow.task.TaskStatus;
import com.quickflow.task.dto.TaskResponse;

/**
 * T098 — {@link DashboardController} web slice with a mocked {@link DashboardService}: GET /api/dashboard
 * returns 200 JSON with every contract field; other methods 405 problem+json. Traces US5 AS1-AS5, FR-026.
 */
@WebMvcTest(DashboardController.class)
class DashboardControllerTest {

    static final String URI = "/api/dashboard";
    static final OffsetDateTime T = OffsetDateTime.of(2026, 6, 17, 10, 0, 0, 0, ZoneOffset.UTC);

    @Autowired
    MockMvcTester mvc;

    @MockitoBean
    DashboardService service;

    private static DashboardResponse sample() {
        TaskResponse due = new TaskResponse(1L, "Due today", null, TaskStatus.TODO, TaskPriority.MEDIUM,
                LocalDate.of(2026, 6, 17), T, T, null, false, false);
        TaskResponse late = new TaskResponse(2L, "Late", null, TaskStatus.IN_PROGRESS, TaskPriority.HIGH,
                LocalDate.of(2026, 6, 15), T, T, null, false, true);
        return new DashboardResponse("Sara", LocalDate.of(2026, 6, 17),
                new DashboardTasks(List.of(due), List.of(late), 3, 8, 3, 38),
                new DashboardHabits(List.of(), 4, 2),
                new DashboardPlans(List.of(), 2, 5),
                new DashboardLearning(6, 2, 10, 7, 3));
    }

    @Test
    void getReturns200WithAllFields() {
        given(service.get()).willReturn(sample());
        MvcTestResult r = mvc.get().uri(URI).exchange();
        assertThat(r).hasStatusOk().hasContentTypeCompatibleWith(MediaType.APPLICATION_JSON);
        var json = assertThat(r).bodyJson();
        json.extractingPath("$.greetingName").isEqualTo("Sara");
        json.extractingPath("$.today").isEqualTo("2026-06-17");
        json.extractingPath("$.tasks.dueToday[0].id").isEqualTo(1);
        json.extractingPath("$.tasks.dueToday[0].title").isEqualTo("Due today");
        json.extractingPath("$.tasks.overdue[0].overdue").isEqualTo(true);
        json.extractingPath("$.tasks.completedTodayCount").isEqualTo(3);
        json.extractingPath("$.tasks.totalActive").isEqualTo(8);
        json.extractingPath("$.tasks.doneCount").isEqualTo(3);
        json.extractingPath("$.tasks.completionPercent").isEqualTo(38);
        json.extractingPath("$.habits.today").asArray().isEmpty();
        json.extractingPath("$.habits.activeCount").isEqualTo(4);
        json.extractingPath("$.habits.completedTodayCount").isEqualTo(2);
        json.extractingPath("$.plans.inProgress").asArray().isEmpty();
        json.extractingPath("$.plans.upcomingCount").isEqualTo(2);
        json.extractingPath("$.plans.completedCount").isEqualTo(5);
        json.extractingPath("$.learning.cardsTotal").isEqualTo(6);
        json.extractingPath("$.learning.inProgressCount").isEqualTo(2);
        json.extractingPath("$.learning.milestonesTotal").isEqualTo(10);
        json.extractingPath("$.learning.milestonesDone").isEqualTo(7);
        json.extractingPath("$.learning.milestonesCompletedLast7Days").isEqualTo(3);
        verify(service).get();
    }

    @Test
    void emptyDashboardSerializesEmptyListsAndZeros() {
        given(service.get()).willReturn(new DashboardResponse("Friend", LocalDate.of(2026, 1, 1),
                new DashboardTasks(List.of(), List.of(), 0, 0, 0, 0), new DashboardHabits(List.of(), 0, 0),
                new DashboardPlans(List.of(), 0, 0), new DashboardLearning(0, 0, 0, 0, 0)));
        MvcTestResult r = mvc.get().uri(URI).exchange();
        assertThat(r).hasStatusOk();
        assertThat(r).bodyJson().extractingPath("$.tasks.dueToday").asArray().isEmpty();
        assertThat(r).bodyJson().extractingPath("$.tasks.overdue").asArray().isEmpty();
        assertThat(r).bodyJson().extractingPath("$.tasks.completionPercent").isEqualTo(0);
    }

    @Test
    void postIsMethodNotAllowed() {
        MvcTestResult r = mvc.post().uri(URI).exchange();
        assertThat(r).hasStatus(405).hasContentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON);
        verifyNoInteractions(service);
    }

    @Test
    void putAndDeleteAreMethodNotAllowed() {
        assertThat(mvc.put().uri(URI).contentType(MediaType.APPLICATION_JSON).content("{}").exchange())
                .hasStatus(405);
        assertThat(mvc.delete().uri(URI).exchange()).hasStatus(405);
        verifyNoInteractions(service);
    }
}
