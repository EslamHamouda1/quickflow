package com.quickflow.task;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;

import com.quickflow.common.NotFoundException;
import com.quickflow.task.dto.TaskRequest;
import com.quickflow.task.dto.TaskResponse;

/**
 * T032 — {@link TaskService} with a fixed {@link Clock} (today = 2026-06-15 UTC) against the real
 * repository (test profile H2 file). Traces US1 AS1, AS3, AS4, AS5, AS7, AS8 and edge cases.
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import({TaskService.class, TaskServiceTest.ClockConfig.class})
class TaskServiceTest {

    static final Instant NOW = Instant.parse("2026-06-15T10:00:00Z");
    static final LocalDate TODAY = LocalDate.of(2026, 6, 15);

    @TestConfiguration
    static class ClockConfig {
        @Bean
        MutableClock clock() {
            return new MutableClock(NOW);
        }
    }

    @Autowired
    TaskService service;

    @Autowired
    TaskRepository repository;

    @Autowired
    MutableClock clock;

    @BeforeEach
    void reset() {
        repository.deleteAll();
        clock.set(NOW);
    }

    private static TaskRequest req(String title) {
        return new TaskRequest(title, null, null, null, null);
    }

    private static TaskRequest req(String title, TaskStatus status, TaskPriority priority, LocalDate due) {
        return new TaskRequest(title, null, status, priority, due);
    }

    private static List<String> titles(List<TaskResponse> list) {
        return list.stream().map(TaskResponse::title).toList();
    }

    private static TaskService.TaskQuery query() {
        return new TaskService.TaskQuery(null, null, null, null, null, null, null, null, null);
    }

    // --- create (AS1)

    @Test
    void createAppliesDefaultsTrimAndTimestamps() {
        TaskResponse t = service.create(new TaskRequest("  Buy milk  ", "desc", null, null, null));
        assertThat(t.id()).isNotNull();
        assertThat(t.title()).isEqualTo("Buy milk");
        assertThat(t.description()).isEqualTo("desc");
        assertThat(t.status()).isEqualTo(TaskStatus.TODO);
        assertThat(t.priority()).isEqualTo(TaskPriority.MEDIUM);
        assertThat(t.createdAt()).isEqualTo(OffsetDateTime.ofInstant(NOW, java.time.ZoneOffset.UTC));
        assertThat(t.updatedAt()).isEqualTo(t.createdAt());
        assertThat(t.completedAt()).isNull();
        assertThat(t.archived()).isFalse();
        assertThat(t.overdue()).isFalse();
    }

    @Test
    void createDoneSetsCompletedAt() {
        TaskResponse t = service.create(req("x", TaskStatus.DONE, TaskPriority.HIGH, null));
        assertThat(t.status()).isEqualTo(TaskStatus.DONE);
        assertThat(t.priority()).isEqualTo(TaskPriority.HIGH);
        assertThat(t.completedAt()).isEqualTo(t.createdAt());
    }

    // --- update (AS3, AS4)

    @Test
    void updateKeepsStatusAndPriorityWhenOmittedAndChangesUpdatedAt() {
        TaskResponse t = service.create(req("a", TaskStatus.IN_PROGRESS, TaskPriority.LOW, TODAY));
        clock.advance(Duration.ofMinutes(5));
        TaskResponse u = service.update(t.id(), new TaskRequest(" b ", "d2", null, null, null));
        assertThat(u.title()).isEqualTo("b");
        assertThat(u.description()).isEqualTo("d2");
        assertThat(u.status()).isEqualTo(TaskStatus.IN_PROGRESS);
        assertThat(u.priority()).isEqualTo(TaskPriority.LOW);
        assertThat(u.dueDate()).isNull();
        assertThat(u.updatedAt()).isAfter(t.updatedAt());
        assertThat(u.createdAt()).isEqualTo(t.createdAt());
    }

    @Test
    void completedAtSetWhenStatusBecomesDoneAndClearedWhenItLeaves() {
        TaskResponse t = service.create(req("a"));
        clock.advance(Duration.ofMinutes(1));
        TaskResponse done = service.update(t.id(), req("a", TaskStatus.DONE, null, null));
        assertThat(done.completedAt()).isNotNull().isEqualTo(done.updatedAt());

        clock.advance(Duration.ofMinutes(1));
        TaskResponse stillDone = service.update(t.id(), req("a2", TaskStatus.DONE, null, null));
        assertThat(stillDone.completedAt()).isEqualTo(done.completedAt());

        TaskResponse back = service.update(t.id(), req("a", TaskStatus.IN_PROGRESS, null, null));
        assertThat(back.status()).isEqualTo(TaskStatus.IN_PROGRESS);
        assertThat(back.completedAt()).isNull();

        service.update(t.id(), req("a", TaskStatus.DONE, null, null));
        TaskResponse todo = service.update(t.id(), req("a", TaskStatus.TODO, null, null));
        assertThat(todo.completedAt()).isNull();
    }

    @Test
    void completeSetsDoneAndIsIdempotent() {
        TaskResponse t = service.create(req("a", null, null, TODAY.minusDays(1)));
        assertThat(t.overdue()).isTrue();
        clock.advance(Duration.ofMinutes(1));
        TaskResponse c1 = service.complete(t.id());
        assertThat(c1.status()).isEqualTo(TaskStatus.DONE);
        assertThat(c1.completedAt()).isEqualTo(c1.updatedAt()).isAfter(t.createdAt());
        assertThat(c1.overdue()).isFalse();

        clock.advance(Duration.ofHours(1));
        TaskResponse c2 = service.complete(t.id());
        assertThat(c2.completedAt()).isEqualTo(c1.completedAt());
        assertThat(c2.updatedAt()).isEqualTo(c1.updatedAt());
    }

    // --- archive / restore / delete (AS5, AS6)

    @Test
    void archiveExcludedByDefaultAndRestoreReturnsIt() {
        TaskResponse a = service.create(req("a"));
        service.create(req("b"));
        clock.advance(Duration.ofMinutes(1));
        TaskResponse archived = service.archive(a.id());
        assertThat(archived.archived()).isTrue();
        assertThat(archived.updatedAt()).isAfter(a.updatedAt());

        assertThat(titles(service.list(query()))).containsExactly("b");
        assertThat(titles(service.list(new TaskService.TaskQuery(null, null, null, null, null, null, true, null,
                null)))).containsExactly("a");

        assertThat(service.restore(a.id()).archived()).isFalse();
        assertThat(titles(service.list(query()))).containsExactlyInAnyOrder("a", "b");
    }

    @Test
    void deleteRemovesAndMissingIdsThrowNotFound() {
        TaskResponse a = service.create(req("a"));
        service.delete(a.id());
        assertThat(repository.findById(a.id())).isEmpty();
        long missing = a.id();
        assertThatThrownBy(() -> service.get(missing)).isInstanceOf(NotFoundException.class)
                .hasMessage("Task " + missing + " not found");
        assertThatThrownBy(() -> service.delete(missing)).isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.update(missing, req("x"))).isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.complete(missing)).isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.archive(missing)).isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.restore(missing)).isInstanceOf(NotFoundException.class);
    }

    // --- overdue rule (AS8, FR-006, edge cases)

    @Test
    void overdueRule() {
        Task t = new Task();
        t.setStatus(TaskStatus.TODO);
        assertThat(TaskService.isOverdue(t, TODAY)).as("no due date").isFalse();
        t.setDueDate(TODAY);
        assertThat(TaskService.isOverdue(t, TODAY)).as("due today").isFalse();
        t.setDueDate(TODAY.plusDays(1));
        assertThat(TaskService.isOverdue(t, TODAY)).as("due tomorrow").isFalse();
        t.setDueDate(TODAY.minusDays(1));
        assertThat(TaskService.isOverdue(t, TODAY)).as("due yesterday, TODO").isTrue();
        t.setStatus(TaskStatus.IN_PROGRESS);
        assertThat(TaskService.isOverdue(t, TODAY)).as("due yesterday, IN_PROGRESS").isTrue();
        t.setStatus(TaskStatus.DONE);
        assertThat(TaskService.isOverdue(t, TODAY)).as("due yesterday, DONE").isFalse();
    }

    @Test
    void overdueFlagFollowsClockInResponses() {
        TaskResponse t = service.create(req("a", null, null, TODAY));
        assertThat(service.get(t.id()).overdue()).isFalse();
        clock.advance(Duration.ofDays(1));
        assertThat(service.get(t.id()).overdue()).isTrue();
    }

    // --- list filters and sort (AS7)

    @Test
    void listFiltersCombine() {
        service.create(req("Alpha report", TaskStatus.TODO, TaskPriority.HIGH, TODAY.minusDays(2)));
        service.create(req("beta REPORT", TaskStatus.DONE, TaskPriority.HIGH, TODAY.minusDays(2)));
        service.create(req("gamma", TaskStatus.IN_PROGRESS, TaskPriority.LOW, TODAY.plusDays(3)));
        service.create(req("100% done_x", null, null, null));

        assertThat(titles(service.list(new TaskService.TaskQuery("report", null, null, null, null, null, null, null,
                null)))).containsExactlyInAnyOrder("Alpha report", "beta REPORT");
        assertThat(titles(service.list(new TaskService.TaskQuery("REPORT", null, TaskPriority.HIGH, null, null,
                true, null, null, null)))).containsExactly("Alpha report");
        assertThat(titles(service.list(new TaskService.TaskQuery("%", null, null, null, null, null, null, null,
                null)))).containsExactly("100% done_x");
        assertThat(titles(service.list(new TaskService.TaskQuery(null, TaskStatus.IN_PROGRESS, null, TODAY,
                TODAY.plusDays(3), null, null, null, null)))).containsExactly("gamma");
        assertThat(titles(service.list(new TaskService.TaskQuery(null, null, null, null, null, false, null, null,
                null)))).containsExactlyInAnyOrder("beta REPORT", "gamma", "100% done_x");
    }

    @Test
    void sortWithNullDueDatesLastInBothDirections() {
        service.create(req("none1"));
        clock.advance(Duration.ofSeconds(1));
        service.create(req("late", null, null, TODAY.plusDays(5)));
        clock.advance(Duration.ofSeconds(1));
        service.create(req("early", null, null, TODAY.minusDays(5)));
        clock.advance(Duration.ofSeconds(1));
        service.create(req("none2"));

        assertThat(titles(service.list(new TaskService.TaskQuery(null, null, null, null, null, null, null,
                TaskSort.DUE_DATE, SortDirection.ASC)))).containsExactly("early", "late", "none1", "none2");
        assertThat(titles(service.list(new TaskService.TaskQuery(null, null, null, null, null, null, null,
                TaskSort.DUE_DATE, SortDirection.DESC)))).containsExactly("late", "early", "none2", "none1");
        assertThat(titles(service.list(new TaskService.TaskQuery(null, null, null, null, null, null, null,
                TaskSort.CREATED_AT, SortDirection.ASC)))).containsExactly("none1", "late", "early", "none2");
        assertThat(titles(service.list(query()))).as("default CREATED_AT DESC")
                .containsExactly("none2", "early", "late", "none1");
    }
}
