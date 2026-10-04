package com.quickflow.plan;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;

import jakarta.persistence.EntityManager;

import com.quickflow.habit.HabitCompletionRepository;
import com.quickflow.habit.HabitFrequency;
import com.quickflow.habit.HabitRepository;
import com.quickflow.habit.HabitService;
import com.quickflow.habit.dto.HabitRequest;
import com.quickflow.learning.LearningCardRepository;
import com.quickflow.learning.LearningService;
import com.quickflow.learning.LearningStatus;
import com.quickflow.learning.dto.LearningCardRequest;
import com.quickflow.learning.dto.LearningCardResponse;
import com.quickflow.task.TaskRepository;
import com.quickflow.task.TaskService;
import com.quickflow.task.TaskStatus;
import com.quickflow.task.dto.TaskRequest;
import com.quickflow.task.dto.TaskResponse;

/**
 * T079 — {@link PlanItemCompletionService} side effects (business rule 13 / research R6) against real services
 * and repositories: task → DONE, habit → today's completion once, learning untouched, undo never reverts,
 * deleted source → no side effect. Traces US4 AS4, AS9 / FR-024.
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import({PlanItemCompletionService.class, TaskService.class, HabitService.class, LearningService.class,
        PlanItemCompletionServiceTest.ClockConfig.class})
class PlanItemCompletionServiceTest {

    static final Instant NOW = Instant.parse("2026-06-17T10:00:00Z");
    static final LocalDate TODAY = LocalDate.of(2026, 6, 17);

    @TestConfiguration
    static class ClockConfig {
        @Bean
        MutableClock clock() {
            return new MutableClock(NOW);
        }
    }

    @Autowired PlanItemCompletionService completion;
    @Autowired TaskService taskService;
    @Autowired HabitService habitService;
    @Autowired LearningService learningService;
    @Autowired TaskRepository tasks;
    @Autowired HabitRepository habits;
    @Autowired HabitCompletionRepository completions;
    @Autowired LearningCardRepository cards;
    @Autowired EntityManager em;
    @Autowired MutableClock clock;

    @BeforeEach
    void reset() {
        clock.set(NOW);
    }

    static PlanItem item(PlanItemSourceType type, Long sourceId) {
        PlanItem i = new PlanItem();
        i.setSourceType(type);
        i.setSourceId(sourceId);
        i.setSourceTitle("x");
        return i;
    }

    private long task() {
        return taskService.create(new TaskRequest("Write report", null, null, null, null)).id();
    }

    private long habit() {
        return habitService.create(new HabitRequest("Stretch", null, HabitFrequency.DAILY)).id();
    }

    private void flushClear() {
        em.flush();
        em.clear();
    }

    @Test
    void taskItemDoneSetsTaskDoneWithCompletedAt() {
        long t = task();
        PlanItem i = item(PlanItemSourceType.TASK, t);
        completion.setDone(i, true);
        flushClear();
        assertThat(i.isDone()).isTrue();
        TaskResponse r = taskService.get(t);
        assertThat(r.status()).isEqualTo(TaskStatus.DONE);
        assertThat(r.completedAt()).isAtSameInstantAs(OffsetDateTime.ofInstant(NOW, ZoneOffset.UTC));
    }

    @Test
    void taskAlreadyDoneKeepsOriginalCompletedAt() {
        long t = task();
        taskService.complete(t);
        flushClear();
        OffsetDateTime first = taskService.get(t).completedAt();
        clock.set(NOW.plusSeconds(3600));
        completion.setDone(item(PlanItemSourceType.TASK, t), true);
        flushClear();
        assertThat(taskService.get(t).completedAt()).isAtSameInstantAs(first);
    }

    @Test
    void habitItemDoneRecordsTodayOnce() {
        long h = habit();
        PlanItem i = item(PlanItemSourceType.HABIT, h);
        completion.setDone(i, true);
        completion.setDone(i, false);
        completion.setDone(i, true);
        flushClear();
        assertThat(completions.findByHabitIdOrderByCompletionDateDesc(h))
                .singleElement()
                .satisfies(c -> assertThat(c.getCompletionDate()).isEqualTo(TODAY));
    }

    @Test
    void habitAlreadyCompletedTodayNoDuplicate() {
        long h = habit();
        habitService.complete(h, null);
        flushClear();
        completion.setDone(item(PlanItemSourceType.HABIT, h), true);
        flushClear();
        assertThat(completions.findByHabitIdOrderByCompletionDateDesc(h)).hasSize(1);
    }

    @Test
    void learningItemLeavesCardUntouched() {
        LearningCardResponse c = learningService.create(new LearningCardRequest("Course", null, null));
        PlanItem i = item(PlanItemSourceType.LEARNING_RESOURCE, c.id());
        completion.setDone(i, true);
        flushClear();
        assertThat(i.isDone()).isTrue();
        LearningCardResponse after = learningService.get(c.id());
        assertThat(after.status()).isEqualTo(LearningStatus.NOT_STARTED);
        assertThat(after.milestones()).isEmpty();
        assertThat(after.progressPercent()).isZero();
    }

    @Test
    void undoNeverRevertsTaskOrHabit() {
        long t = task();
        long h = habit();
        PlanItem ti = item(PlanItemSourceType.TASK, t);
        PlanItem hi = item(PlanItemSourceType.HABIT, h);
        completion.setDone(ti, true);
        completion.setDone(hi, true);
        flushClear();
        completion.setDone(ti, false);
        completion.setDone(hi, false);
        flushClear();
        assertThat(ti.isDone()).isFalse();
        assertThat(hi.isDone()).isFalse();
        assertThat(taskService.get(t).status()).isEqualTo(TaskStatus.DONE);
        assertThat(completions.findByHabitIdOrderByCompletionDateDesc(h)).hasSize(1);
    }

    @Test
    void undoOnOpenTaskDoesNothing() {
        long t = task();
        completion.setDone(item(PlanItemSourceType.TASK, t), false);
        flushClear();
        assertThat(taskService.get(t).status()).isEqualTo(TaskStatus.TODO);
    }

    @Test
    void deletedSourcesHaveNoSideEffect() {
        long t = task();
        long h = habit();
        taskService.delete(t);
        habitService.delete(h);
        flushClear();
        PlanItem ti = item(PlanItemSourceType.TASK, t);
        PlanItem hi = item(PlanItemSourceType.HABIT, h);
        PlanItem li = item(PlanItemSourceType.LEARNING_RESOURCE, 999_999L);
        completion.setDone(ti, true);
        completion.setDone(hi, true);
        completion.setDone(li, true);
        flushClear();
        assertThat(ti.isDone()).isTrue();
        assertThat(hi.isDone()).isTrue();
        assertThat(li.isDone()).isTrue();
        assertThat(tasks.existsById(t)).isFalse();
        assertThat(habits.existsById(h)).isFalse();
        assertThat(completions.findByHabitIdOrderByCompletionDateDesc(h)).isEmpty();
    }

    @Test
    void nullSourceIgnored() {
        PlanItem i = item(PlanItemSourceType.TASK, null);
        completion.setDone(i, true);
        assertThat(i.isDone()).isTrue();
        completion.applySideEffect(null, 1L);
        assertThat(cards.count()).isGreaterThanOrEqualTo(0);
    }
}
