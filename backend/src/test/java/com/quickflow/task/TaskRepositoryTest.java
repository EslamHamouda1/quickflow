package com.quickflow.task;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.data.jpa.domain.Specification;

/**
 * T032 — {@link TaskRepository} + {@link TaskSpecifications}: each filter of {@code GET /api/tasks}
 * against the test-profile H2 file database. Traces US1 AS5, AS7, AS8.
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class TaskRepositoryTest {

    static final LocalDate TODAY = LocalDate.of(2026, 6, 15);

    @Autowired
    TaskRepository repository;

    @BeforeEach
    void seed() {
        repository.deleteAll();
        save("Write REPORT", TaskStatus.TODO, TaskPriority.HIGH, TODAY.minusDays(1), false);
        save("read report", TaskStatus.DONE, TaskPriority.LOW, TODAY.minusDays(3), false);
        save("Plan trip", TaskStatus.IN_PROGRESS, TaskPriority.MEDIUM, TODAY, false);
        save("50% off_sale", TaskStatus.TODO, TaskPriority.MEDIUM, null, false);
        save("Old archived report", TaskStatus.TODO, TaskPriority.HIGH, TODAY.plusDays(10), true);
    }

    private void save(String title, TaskStatus s, TaskPriority p, LocalDate due, boolean archived) {
        Task t = new Task();
        t.setTitle(title);
        t.setStatus(s);
        t.setPriority(p);
        t.setDueDate(due);
        t.setArchived(archived);
        OffsetDateTime now = OffsetDateTime.of(2026, 6, 15, 9, 0, 0, 0, ZoneOffset.UTC);
        t.setCreatedAt(now);
        t.setUpdatedAt(now);
        repository.save(t);
    }

    private List<String> find(Specification<Task> spec) {
        Specification<Task> all = TaskSpecifications.archived(false);
        return repository.findAll(spec == null ? all : all.and(spec)).stream().map(Task::getTitle).toList();
    }

    @Test
    void savedTaskGetsIdAndDefaults() {
        Task t = new Task();
        t.setTitle("defaults");
        t.setCreatedAt(OffsetDateTime.now());
        t.setUpdatedAt(t.getCreatedAt());
        Task saved = repository.saveAndFlush(t);
        assertThat(saved.getId()).isNotNull();
        Task loaded = repository.findById(saved.getId()).orElseThrow();
        assertThat(loaded.getStatus()).isEqualTo(TaskStatus.TODO);
        assertThat(loaded.getPriority()).isEqualTo(TaskPriority.MEDIUM);
        assertThat(loaded.isArchived()).isFalse();
    }

    @Test
    void archivedFlag() {
        assertThat(find(null)).hasSize(4).doesNotContain("Old archived report");
        assertThat(repository.findAll(TaskSpecifications.archived(true)).stream().map(Task::getTitle))
                .containsExactly("Old archived report");
    }

    @Test
    void titleContainsCaseInsensitive() {
        assertThat(find(TaskSpecifications.titleContains("RePoRt")))
                .containsExactlyInAnyOrder("Write REPORT", "read report");
        assertThat(find(TaskSpecifications.titleContains("  trip "))).containsExactly("Plan trip");
        assertThat(TaskSpecifications.titleContains("   ")).isNull();
        assertThat(TaskSpecifications.titleContains(null)).isNull();
    }

    @Test
    void titleContainsMatchesWildcardsLiterally() {
        assertThat(find(TaskSpecifications.titleContains("%"))).containsExactly("50% off_sale");
        assertThat(find(TaskSpecifications.titleContains("_"))).containsExactly("50% off_sale");
        assertThat(find(TaskSpecifications.titleContains("\\"))).isEmpty();
    }

    @Test
    void statusFilter() {
        assertThat(find(TaskSpecifications.hasStatus(TaskStatus.DONE))).containsExactly("read report");
        assertThat(find(TaskSpecifications.hasStatus(TaskStatus.TODO)))
                .containsExactlyInAnyOrder("Write REPORT", "50% off_sale");
        assertThat(TaskSpecifications.hasStatus(null)).isNull();
    }

    @Test
    void priorityFilter() {
        assertThat(find(TaskSpecifications.hasPriority(TaskPriority.HIGH))).containsExactly("Write REPORT");
        assertThat(find(TaskSpecifications.hasPriority(TaskPriority.LOW))).containsExactly("read report");
        assertThat(TaskSpecifications.hasPriority(null)).isNull();
    }

    @Test
    void dueRangeInclusive() {
        assertThat(find(TaskSpecifications.dueFrom(TODAY))).containsExactly("Plan trip");
        assertThat(find(TaskSpecifications.dueTo(TODAY.minusDays(1))))
                .containsExactlyInAnyOrder("Write REPORT", "read report");
        assertThat(find(TaskSpecifications.dueFrom(TODAY.minusDays(1)).and(TaskSpecifications.dueTo(TODAY))))
                .containsExactlyInAnyOrder("Write REPORT", "Plan trip");
        assertThat(TaskSpecifications.dueFrom(null)).isNull();
        assertThat(TaskSpecifications.dueTo(null)).isNull();
    }

    @Test
    void overdueFilter() {
        assertThat(find(TaskSpecifications.overdue(true, TODAY))).containsExactly("Write REPORT");
        assertThat(find(TaskSpecifications.overdue(false, TODAY)))
                .containsExactlyInAnyOrder("read report", "Plan trip", "50% off_sale");
        assertThat(TaskSpecifications.overdue(null, TODAY)).isNull();
    }
}
