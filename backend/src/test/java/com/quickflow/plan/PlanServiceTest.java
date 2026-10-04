package com.quickflow.plan;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;

import jakarta.persistence.EntityManager;

import com.quickflow.common.BadRequestException;
import com.quickflow.common.NotFoundException;
import com.quickflow.habit.HabitCompletionRepository;
import com.quickflow.habit.HabitFrequency;
import com.quickflow.habit.HabitService;
import com.quickflow.habit.dto.HabitRequest;
import com.quickflow.learning.LearningService;
import com.quickflow.learning.dto.LearningCardRequest;
import com.quickflow.plan.dto.PlanItemResponse;
import com.quickflow.plan.dto.PlanItemSource;
import com.quickflow.plan.dto.PlanRequest;
import com.quickflow.plan.dto.PlanResponse;
import com.quickflow.task.TaskService;
import com.quickflow.task.TaskStatus;
import com.quickflow.task.dto.TaskRequest;

/**
 * T080 — {@link PlanService} with a fixed clock against the real repositories (test profile DB):
 * validation (no items, end ≤ start → field endDateTime, archived task, inactive habit, unknown source,
 * duplicate source → field items), acknowledgeStart idempotent, derived status consistent after reload,
 * list order / status filter, delete, item side effects, removed sources. Traces US4 AS1-AS9 / FR-017..FR-025.
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import({PlanService.class, PlanItemCompletionService.class, TaskService.class, HabitService.class,
        LearningService.class, PlanServiceTest.ClockConfig.class})
class PlanServiceTest {

    static final Instant NOW = Instant.parse("2026-06-17T10:00:00Z");
    static final OffsetDateTime NOW_ODT = OffsetDateTime.ofInstant(NOW, ZoneOffset.UTC);

    @TestConfiguration
    static class ClockConfig {
        @Bean
        MutableClock clock() {
            return new MutableClock(NOW);
        }
    }

    @Autowired PlanService service;
    @Autowired PlanRepository plans;
    @Autowired TaskService taskService;
    @Autowired HabitService habitService;
    @Autowired LearningService learningService;
    @Autowired HabitCompletionRepository completions;
    @Autowired EntityManager em;
    @Autowired MutableClock clock;

    long task;
    long habit;
    long card;

    @BeforeEach
    void reset() {
        plans.deleteAll();
        plans.flush();
        clock.set(NOW);
        task = taskService.create(new TaskRequest("Write report", null, null, null, null)).id();
        habit = habitService.create(new HabitRequest("Stretch", null, HabitFrequency.DAILY)).id();
        card = learningService.create(new LearningCardRequest("RxJS course", null, null)).id();
    }

    static PlanItemSource src(PlanItemSourceType type, long id) {
        return new PlanItemSource(type, id);
    }

    private List<PlanItemSource> all3() {
        return List.of(src(PlanItemSourceType.TASK, task), src(PlanItemSourceType.HABIT, habit),
                src(PlanItemSourceType.LEARNING_RESOURCE, card));
    }

    static PlanRequest req(String title, OffsetDateTime start, OffsetDateTime end, int priority,
                           List<PlanItemSource> items) {
        return new PlanRequest(title, 90, start, end, priority, items);
    }

    private PlanResponse inProgress() {
        return service.create(req("Focus", NOW_ODT.minusMinutes(10), NOW_ODT.plusHours(1), 1, all3()));
    }

    private PlanResponse reload(long id) {
        em.flush();
        em.clear();
        return service.get(id);
    }

    private static long itemId(PlanResponse p, PlanItemSourceType type) {
        return p.items().stream().filter(i -> i.sourceType() == type).findFirst().orElseThrow().id();
    }

    private void assertBadRequest(PlanRequest r, String field) {
        assertThatThrownBy(() -> service.create(r))
                .isInstanceOf(BadRequestException.class)
                .extracting(e -> ((BadRequestException) e).getField())
                .isEqualTo(field);
        assertThat(plans.count()).isZero();
    }

    // ---- create (AS1) ----

    @Test
    void createSnapshotsTitlesAndDerivesInProgress() {
        PlanResponse p = service.create(req("  Focus  ", NOW_ODT.minusMinutes(10), NOW_ODT.plusHours(1), 2, all3()));
        assertThat(p.id()).isNotNull();
        assertThat(p.title()).isEqualTo("Focus");
        assertThat(p.estimatedDurationMinutes()).isEqualTo(90);
        assertThat(p.priorityOrder()).isEqualTo(2);
        assertThat(p.createdAt()).isAtSameInstantAs(NOW_ODT);
        assertThat(p.startNotifiedAt()).isNull();
        assertThat(p.status()).isEqualTo(PlanStatus.IN_PROGRESS);
        assertThat(p.restSeconds()).isEqualTo(3600L);
        assertThat(p.itemsTotal()).isEqualTo(3);
        assertThat(p.itemsDone()).isZero();
        assertThat(p.progressPercent()).isZero();
        assertThat(p.items()).extracting(PlanItemResponse::sourceTitle)
                .containsExactly("Write report", "Stretch", "RxJS course");
        assertThat(p.items()).allSatisfy(i -> {
            assertThat(i.done()).isFalse();
            assertThat(i.sourceAvailable()).isTrue();
        });
    }

    @Test
    void createFutureIsNotStartedAndPastIsCompleted() {
        PlanResponse future = service.create(req("F", NOW_ODT.plusHours(1), NOW_ODT.plusHours(2), 1, all3()));
        assertThat(future.status()).isEqualTo(PlanStatus.NOT_STARTED);
        assertThat(future.restSeconds()).isNull();
        PlanResponse past = service.create(req("P", NOW_ODT.minusHours(2), NOW_ODT.minusHours(1), 1, all3()));
        assertThat(past.status()).isEqualTo(PlanStatus.COMPLETED);
        assertThat(past.progressPercent()).isZero();
        assertThat(past.restSeconds()).isNull();
    }

    @Test
    void snapshotTitleKeptAfterSourceRename() {
        PlanResponse p = inProgress();
        taskService.update(task, new TaskRequest("Renamed", null, null, null, null));
        assertThat(reload(p.id()).items().get(0).sourceTitle()).isEqualTo("Write report");
    }

    @Test
    void doneButNotArchivedTaskIsPickable() {
        taskService.complete(task);
        PlanResponse p = service.create(req("Done task ok", NOW_ODT, NOW_ODT.plusHours(1), 1,
                List.of(src(PlanItemSourceType.TASK, task))));
        assertThat(p.itemsTotal()).isEqualTo(1);
    }

    // ---- validation (AS2) ----

    @Test
    void noItems400Items() {
        assertBadRequest(req("x", NOW_ODT, NOW_ODT.plusHours(1), 1, List.of()), "items");
    }

    @Test
    void nullItems400Items() {
        assertBadRequest(req("x", NOW_ODT, NOW_ODT.plusHours(1), 1, null), "items");
    }

    @Test
    void endEqualStart400EndDateTime() {
        assertBadRequest(req("x", NOW_ODT, NOW_ODT, 1, all3()), "endDateTime");
    }

    @Test
    void endBeforeStart400EndDateTime() {
        assertBadRequest(req("x", NOW_ODT, NOW_ODT.minusSeconds(1), 1, all3()), "endDateTime");
    }

    @Test
    void endBeforeStartSameInstantDifferentOffset400() {
        OffsetDateTime start = OffsetDateTime.parse("2026-06-17T12:00:00+02:00");
        OffsetDateTime end = OffsetDateTime.parse("2026-06-17T10:00:00Z");
        assertBadRequest(req("x", start, end, 1, all3()), "endDateTime");
    }

    @Test
    void archivedTask400Items() {
        taskService.archive(task);
        assertBadRequest(req("x", NOW_ODT, NOW_ODT.plusHours(1), 1, all3()), "items");
    }

    @Test
    void inactiveHabit400Items() {
        habitService.deactivate(habit);
        assertBadRequest(req("x", NOW_ODT, NOW_ODT.plusHours(1), 1, all3()), "items");
    }

    @Test
    void unknownSources400Items() {
        for (PlanItemSourceType type : PlanItemSourceType.values()) {
            assertBadRequest(req("x", NOW_ODT, NOW_ODT.plusHours(1), 1, List.of(src(type, 999_999L))), "items");
        }
    }

    @Test
    void duplicateSource400Items() {
        assertBadRequest(req("x", NOW_ODT, NOW_ODT.plusHours(1), 1,
                List.of(src(PlanItemSourceType.TASK, task), src(PlanItemSourceType.TASK, task))), "items");
    }

    @Test
    void sameIdDifferentTypeIsNotDuplicate() {
        long sameIdCard = card;
        // a task, habit and card may share a numeric id; only (type, id) pairs must be unique
        PlanResponse p = service.create(req("x", NOW_ODT, NOW_ODT.plusHours(1), 1,
                List.of(src(PlanItemSourceType.LEARNING_RESOURCE, sameIdCard), src(PlanItemSourceType.TASK, task))));
        assertThat(p.itemsTotal()).isEqualTo(2);
    }

    // ---- get / list / delete ----

    @Test
    void getUnknown404() {
        assertThatThrownBy(() -> service.get(999_999L)).isInstanceOf(NotFoundException.class);
    }

    @Test
    void listOrderedByPriorityThenStartAndFilteredByDerivedStatus() {
        long a = service.create(req("A", NOW_ODT.plusHours(2), NOW_ODT.plusHours(3), 2, all3())).id();
        long b = service.create(req("B", NOW_ODT.minusHours(1), NOW_ODT.plusHours(3), 2, all3())).id();
        long c = service.create(req("C", NOW_ODT.plusHours(5), NOW_ODT.plusHours(6), 1, all3())).id();
        long d = service.create(req("D", NOW_ODT.minusHours(3), NOW_ODT.minusHours(2), 3, all3())).id();
        em.flush();
        em.clear();
        assertThat(service.list(null)).extracting(PlanResponse::id).containsExactly(c, b, a, d);
        assertThat(service.list(PlanStatus.IN_PROGRESS)).extracting(PlanResponse::id).containsExactly(b);
        assertThat(service.list(PlanStatus.NOT_STARTED)).extracting(PlanResponse::id).containsExactly(c, a);
        assertThat(service.list(PlanStatus.COMPLETED)).extracting(PlanResponse::id).containsExactly(d);
    }

    @Test
    void deleteRemovesPlanButNotSources() {
        PlanResponse p = inProgress();
        service.delete(p.id());
        em.flush();
        em.clear();
        assertThat(plans.existsById(p.id())).isFalse();
        assertThat(taskService.get(task).id()).isEqualTo(task);
        assertThat(habitService.get(habit).id()).isEqualTo(habit);
        assertThat(learningService.get(card).id()).isEqualTo(card);
        assertThatThrownBy(() -> service.delete(p.id())).isInstanceOf(NotFoundException.class);
    }

    // ---- items (AS3, AS4) ----

    @Test
    void setItemDoneProgressAndSideEffects() {
        PlanResponse p = inProgress();
        PlanResponse r = service.setItemDone(p.id(), itemId(p, PlanItemSourceType.TASK), true);
        assertThat(r.itemsDone()).isEqualTo(1);
        assertThat(r.progressPercent()).isEqualTo(33);
        assertThat(r.status()).isEqualTo(PlanStatus.IN_PROGRESS);
        r = service.setItemDone(p.id(), itemId(p, PlanItemSourceType.HABIT), true);
        assertThat(r.progressPercent()).isEqualTo(67);
        r = service.setItemDone(p.id(), itemId(p, PlanItemSourceType.LEARNING_RESOURCE), true);
        assertThat(r.status()).isEqualTo(PlanStatus.COMPLETED);
        assertThat(r.progressPercent()).isEqualTo(100);
        assertThat(r.restSeconds()).isNull();
        em.flush();
        em.clear();
        assertThat(taskService.get(task).status()).isEqualTo(TaskStatus.DONE);
        assertThat(completions.findByHabitIdOrderByCompletionDateDesc(habit)).hasSize(1);
        assertThat(learningService.get(card).progressPercent()).isZero();
        // undo → back to in progress; task stays DONE
        r = service.setItemDone(p.id(), itemId(p, PlanItemSourceType.TASK), false);
        assertThat(r.status()).isEqualTo(PlanStatus.IN_PROGRESS);
        assertThat(r.progressPercent()).isEqualTo(67);
        assertThat(reload(p.id()).progressPercent()).isEqualTo(67);
        assertThat(taskService.get(task).status()).isEqualTo(TaskStatus.DONE);
    }

    @Test
    void setItemDoneUnknownPlanOrItemOrForeignItem404() {
        PlanResponse p = inProgress();
        PlanResponse other = service.create(req("Other", NOW_ODT, NOW_ODT.plusHours(1), 1,
                List.of(src(PlanItemSourceType.LEARNING_RESOURCE, card))));
        long foreign = other.items().get(0).id();
        assertThatThrownBy(() -> service.setItemDone(999_999L, foreign, true)).isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.setItemDone(p.id(), 999_999L, true)).isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.setItemDone(p.id(), foreign, true)).isInstanceOf(NotFoundException.class);
        assertThat(reload(other.id()).itemsDone()).isZero();
    }

    // ---- removed source (AS9) ----

    @Test
    void deletedSourceKeptAsRemovedAndCountsTowardsProgress() {
        PlanResponse p = inProgress();
        taskService.delete(task);
        PlanResponse r = reload(p.id());
        assertThat(r.itemsTotal()).isEqualTo(3);
        PlanItemResponse t = r.items().stream().filter(i -> i.sourceType() == PlanItemSourceType.TASK)
                .findFirst().orElseThrow();
        assertThat(t.sourceAvailable()).isFalse();
        assertThat(t.sourceTitle()).isEqualTo("Write report");
        r = service.setItemDone(p.id(), t.id(), true);
        assertThat(r.progressPercent()).isEqualTo(33);
        assertThat(service.list(null).get(0).items().get(0).sourceAvailable()).isFalse();
    }

    @Test
    void archivedSourceStillAvailableAfterCreate() {
        PlanResponse p = inProgress();
        taskService.archive(task);
        assertThat(reload(p.id()).items().get(0).sourceAvailable()).isTrue();
    }

    // ---- acknowledgeStart (AS6) ----

    @Test
    void acknowledgeStartIdempotent() {
        PlanResponse p = inProgress();
        PlanResponse first = service.acknowledgeStart(p.id());
        assertThat(first.startNotifiedAt()).isAtSameInstantAs(NOW_ODT);
        clock.advance(Duration.ofMinutes(5));
        PlanResponse second = service.acknowledgeStart(p.id());
        assertThat(second.startNotifiedAt()).isAtSameInstantAs(NOW_ODT);
        assertThat(reload(p.id()).startNotifiedAt()).isAtSameInstantAs(NOW_ODT);
        assertThatThrownBy(() -> service.acknowledgeStart(999_999L)).isInstanceOf(NotFoundException.class);
    }

    // ---- derived status after reload (AS5) ----

    @Test
    void statusConsistentAfterReloadAcrossClock() {
        PlanResponse p = service.create(req("Later", NOW_ODT.plusMinutes(30), NOW_ODT.plusMinutes(90), 1, all3()));
        assertThat(reload(p.id()).status()).isEqualTo(PlanStatus.NOT_STARTED);
        clock.advance(Duration.ofMinutes(30));
        PlanResponse r = reload(p.id());
        assertThat(r.status()).isEqualTo(PlanStatus.IN_PROGRESS);
        assertThat(r.restSeconds()).isEqualTo(3600L);
        clock.advance(Duration.ofMinutes(59));
        assertThat(reload(p.id()).restSeconds()).isEqualTo(60L);
        clock.advance(Duration.ofMinutes(1));
        r = reload(p.id());
        assertThat(r.status()).isEqualTo(PlanStatus.COMPLETED);
        assertThat(r.restSeconds()).isNull();
        assertThat(service.list(PlanStatus.COMPLETED)).extracting(PlanResponse::id).contains(p.id());
    }
}
