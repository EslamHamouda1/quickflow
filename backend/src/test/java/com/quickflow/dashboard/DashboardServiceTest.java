package com.quickflow.dashboard;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
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

import com.quickflow.dashboard.dto.DashboardResponse;
import com.quickflow.habit.HabitCompletionRepository;
import com.quickflow.habit.HabitFrequency;
import com.quickflow.habit.HabitRepository;
import com.quickflow.habit.HabitService;
import com.quickflow.habit.dto.HabitRequest;
import com.quickflow.habit.dto.HabitResponse;
import com.quickflow.learning.LearningCardRepository;
import com.quickflow.learning.LearningService;
import com.quickflow.learning.LearningStatus;
import com.quickflow.learning.dto.LearningCardRequest;
import com.quickflow.learning.dto.LearningCardResponse;
import com.quickflow.learning.dto.MilestoneRequest;
import com.quickflow.plan.PlanItemCompletionService;
import com.quickflow.plan.PlanItemSourceType;
import com.quickflow.plan.PlanRepository;
import com.quickflow.plan.PlanService;
import com.quickflow.plan.dto.PlanItemSource;
import com.quickflow.plan.dto.PlanRequest;
import com.quickflow.plan.dto.PlanResponse;
import com.quickflow.settings.DefaultView;
import com.quickflow.settings.SettingsRepository;
import com.quickflow.settings.SettingsService;
import com.quickflow.settings.dto.SettingsDto;
import com.quickflow.task.TaskRepository;
import com.quickflow.task.TaskService;
import com.quickflow.task.TaskStatus;
import com.quickflow.task.dto.TaskRequest;
import com.quickflow.task.dto.TaskResponse;

/**
 * T098 — {@link DashboardService} with a fixed clock against the real repositories (test profile DB):
 * every metric equals the expected counts for seeded data, archived tasks / inactive habits excluded,
 * zero-division (no tasks), plan ordering, learning 7-day window. Traces US5 AS1-AS6 / FR-026, FR-027, SC-004.
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import({DashboardService.class, SettingsService.class, TaskService.class, HabitService.class, PlanService.class,
        PlanItemCompletionService.class, LearningService.class, DashboardServiceTest.ClockConfig.class})
class DashboardServiceTest {

    static final Instant NOW = Instant.parse("2026-06-17T10:00:00Z");
    static final OffsetDateTime NOW_ODT = OffsetDateTime.ofInstant(NOW, ZoneOffset.UTC);
    static final LocalDate TODAY = LocalDate.of(2026, 6, 17);

    @TestConfiguration
    static class ClockConfig {
        @Bean
        MutableClock clock() {
            return new MutableClock(NOW);
        }
    }

    @Autowired DashboardService service;
    @Autowired SettingsService settingsService;
    @Autowired TaskService taskService;
    @Autowired HabitService habitService;
    @Autowired PlanService planService;
    @Autowired LearningService learningService;
    @Autowired PlanRepository plans;
    @Autowired HabitCompletionRepository completions;
    @Autowired HabitRepository habits;
    @Autowired TaskRepository tasks;
    @Autowired LearningCardRepository cards;
    @Autowired SettingsRepository settings;
    @Autowired EntityManager em;
    @Autowired MutableClock clock;

    @BeforeEach
    void reset() {
        plans.deleteAll();
        completions.deleteAll();
        habits.deleteAll();
        tasks.deleteAll();
        cards.deleteAll();
        settings.deleteAll();
        em.flush();
        em.clear();
        clock.set(NOW);
    }

    private long task(String title, TaskStatus status, LocalDate due) {
        return taskService.create(new TaskRequest(title, null, status, null, due)).id();
    }

    private DashboardResponse dashboard() {
        em.flush();
        em.clear();
        return service.get();
    }

    // ---- empty state / zero division ----

    @Test
    void emptyDataGivesZeroMetricsWithoutDivisionError() {
        DashboardResponse d = dashboard();
        assertThat(d.greetingName()).isEqualTo("Friend");
        assertThat(d.today()).isEqualTo(TODAY);
        assertThat(d.tasks().dueToday()).isEmpty();
        assertThat(d.tasks().overdue()).isEmpty();
        assertThat(d.tasks().completedTodayCount()).isZero();
        assertThat(d.tasks().totalActive()).isZero();
        assertThat(d.tasks().doneCount()).isZero();
        assertThat(d.tasks().completionPercent()).isZero();
        assertThat(d.habits().today()).isEmpty();
        assertThat(d.habits().activeCount()).isZero();
        assertThat(d.habits().completedTodayCount()).isZero();
        assertThat(d.plans().inProgress()).isEmpty();
        assertThat(d.plans().upcomingCount()).isZero();
        assertThat(d.plans().completedCount()).isZero();
        assertThat(d.learning().cardsTotal()).isZero();
        assertThat(d.learning().inProgressCount()).isZero();
        assertThat(d.learning().milestonesTotal()).isZero();
        assertThat(d.learning().milestonesDone()).isZero();
        assertThat(d.learning().milestonesCompletedLast7Days()).isZero();
    }

    @Test
    void onlyArchivedTasksGiveZeroPercent() {
        long t = task("Archived done", TaskStatus.DONE, TODAY);
        taskService.archive(t);
        DashboardResponse d = dashboard();
        assertThat(d.tasks().totalActive()).isZero();
        assertThat(d.tasks().doneCount()).isZero();
        assertThat(d.tasks().completedTodayCount()).isZero();
        assertThat(d.tasks().completionPercent()).isZero();
    }

    // ---- greeting / today (AS1) ----

    @Test
    void greetingUsesSettingsDisplayNameAndTodayFromClock() {
        settingsService.update(new SettingsDto("Sara", true, false, DefaultView.DASHBOARD));
        clock.set(Instant.parse("2026-06-18T23:30:00Z"));
        DashboardResponse d = dashboard();
        assertThat(d.greetingName()).isEqualTo("Sara");
        assertThat(d.today()).isEqualTo(LocalDate.of(2026, 6, 18));
    }

    // ---- tasks (AS2) ----

    @Test
    void taskMetricsMatchSeededData() {
        long dueToday = task("Due today", TaskStatus.TODO, TODAY);
        long dueTodayInProgress = task("Due today in progress", TaskStatus.IN_PROGRESS, TODAY);
        task("Due today done", TaskStatus.DONE, TODAY); // completed today, not in dueToday
        long overdue = task("Overdue", TaskStatus.TODO, TODAY.minusDays(2));
        task("Overdue but done", TaskStatus.DONE, TODAY.minusDays(3)); // not overdue
        task("Future", TaskStatus.TODO, TODAY.plusDays(1));
        task("No due date", TaskStatus.TODO, null);
        long archivedDueToday = task("Archived due today", TaskStatus.TODO, TODAY);
        taskService.archive(archivedDueToday);
        long archivedOverdue = task("Archived overdue", TaskStatus.TODO, TODAY.minusDays(1));
        taskService.archive(archivedOverdue);
        long archivedDone = task("Archived done", TaskStatus.DONE, null);
        taskService.archive(archivedDone);
        // done yesterday: counts as done, not completed today
        clock.set(NOW.minus(Duration.ofDays(1)));
        long doneYesterday = task("Done yesterday", TaskStatus.TODO, null);
        taskService.complete(doneYesterday);
        clock.set(NOW);

        DashboardResponse d = dashboard();
        assertThat(d.tasks().dueToday()).extracting(TaskResponse::id)
                .containsExactlyInAnyOrder(dueToday, dueTodayInProgress);
        assertThat(d.tasks().overdue()).extracting(TaskResponse::id).containsExactly(overdue);
        assertThat(d.tasks().overdue()).allSatisfy(t -> assertThat(t.overdue()).isTrue());
        // non-archived: 8 tasks; done: Due today done, Overdue but done, Done yesterday
        assertThat(d.tasks().totalActive()).isEqualTo(8);
        assertThat(d.tasks().doneCount()).isEqualTo(3);
        assertThat(d.tasks().completedTodayCount()).isEqualTo(2);
        assertThat(d.tasks().completionPercent()).isEqualTo(38); // round(3*100/8 = 37.5)
    }

    @Test
    void completingTaskUpdatesMetrics() {
        long a = task("A", TaskStatus.TODO, TODAY);
        task("B", TaskStatus.TODO, TODAY);
        task("C", TaskStatus.TODO, null);
        DashboardResponse before = dashboard();
        assertThat(before.tasks().dueToday()).hasSize(2);
        assertThat(before.tasks().completionPercent()).isZero();

        taskService.complete(a);
        DashboardResponse after = dashboard();
        assertThat(after.tasks().dueToday()).hasSize(1);
        assertThat(after.tasks().completedTodayCount()).isEqualTo(1);
        assertThat(after.tasks().doneCount()).isEqualTo(1);
        assertThat(after.tasks().completionPercent()).isEqualTo(33);
    }

    @Test
    void completionPercentRoundsHalfUpAndReaches100() {
        long a = task("A", TaskStatus.TODO, null);
        task("B", TaskStatus.DONE, null);
        task("C", TaskStatus.DONE, null);
        assertThat(dashboard().tasks().completionPercent()).isEqualTo(67); // 66.67
        taskService.complete(a);
        assertThat(dashboard().tasks().completionPercent()).isEqualTo(100);
    }

    @Test
    void taskBecomesOverdueWhenDayRollsOver() {
        task("Due today", TaskStatus.TODO, TODAY);
        assertThat(dashboard().tasks().overdue()).isEmpty();
        clock.set(NOW.plus(Duration.ofDays(1)));
        DashboardResponse d = dashboard();
        assertThat(d.tasks().dueToday()).isEmpty();
        assertThat(d.tasks().overdue()).hasSize(1);
    }

    // ---- habits (AS3) ----

    @Test
    void habitMetricsCountActiveHabitsOnly() {
        long daily = habitService.create(new HabitRequest("Read", null, HabitFrequency.DAILY)).id();
        long dailyOpen = habitService.create(new HabitRequest("Stretch", null, HabitFrequency.DAILY)).id();
        long weekly = habitService.create(new HabitRequest("Run", null, HabitFrequency.WEEKLY)).id();
        long inactive = habitService.create(new HabitRequest("Old", null, HabitFrequency.DAILY)).id();
        habitService.complete(daily, TODAY);
        habitService.complete(weekly, TODAY.minusDays(1)); // done this week, not today
        habitService.complete(inactive, TODAY);
        habitService.deactivate(inactive);

        DashboardResponse d = dashboard();
        assertThat(d.habits().today()).extracting(HabitResponse::id)
                .containsExactlyInAnyOrder(daily, dailyOpen, weekly);
        assertThat(d.habits().activeCount()).isEqualTo(3);
        assertThat(d.habits().completedTodayCount()).isEqualTo(1);
        HabitResponse w = d.habits().today().stream().filter(h -> h.id() == weekly).findFirst().orElseThrow();
        assertThat(w.completedToday()).isFalse();
        assertThat(w.doneForCurrentPeriod()).isTrue();

        habitService.complete(dailyOpen, TODAY);
        assertThat(dashboard().habits().completedTodayCount()).isEqualTo(2);
        habitService.uncomplete(daily, TODAY);
        assertThat(dashboard().habits().completedTodayCount()).isEqualTo(1);
    }

    // ---- plans (AS4) ----

    private PlanResponse plan(String title, OffsetDateTime start, OffsetDateTime end, int priority, long taskId) {
        return planService.create(new PlanRequest(title, 60, start, end, priority,
                List.of(new PlanItemSource(PlanItemSourceType.TASK, taskId))));
    }

    @Test
    void planMetricsByDerivedStatusAndOrder() {
        long t = task("Plan source", TaskStatus.TODO, null);
        long p2 = plan("P2 early", NOW_ODT.minusMinutes(30), NOW_ODT.plusHours(1), 2, t).id();
        long p1late = plan("P1 late", NOW_ODT.minusMinutes(5), NOW_ODT.plusHours(1), 1, t).id();
        long p1early = plan("P1 early", NOW_ODT.minusMinutes(20), NOW_ODT.plusHours(1), 1, t).id();
        plan("Upcoming A", NOW_ODT.plusHours(1), NOW_ODT.plusHours(2), 1, t);
        plan("Upcoming B", NOW_ODT.plusDays(1), NOW_ODT.plusDays(1).plusHours(1), 3, t);
        // completed by time: create while running, then clock passes end
        clock.set(NOW.minus(Duration.ofHours(3)));
        plan("Ended", NOW_ODT.minusHours(3), NOW_ODT.minusHours(2), 1, t);
        clock.set(NOW);
        // completed by all items done
        PlanResponse allDone = plan("All done", NOW_ODT.minusMinutes(10), NOW_ODT.plusHours(1), 1, t);
        planService.setItemDone(allDone.id(), allDone.items().get(0).id(), true);
        // setting the item done completed the source task, which the other plans also reference;
        // their own items stay not done so they keep their time-derived status.

        DashboardResponse d = dashboard();
        assertThat(d.plans().inProgress()).extracting(PlanResponse::id).containsExactly(p1early, p1late, p2);
        assertThat(d.plans().inProgress()).allSatisfy(p -> {
            assertThat(p.restSeconds()).isPositive();
            assertThat(p.progressPercent()).isZero();
        });
        assertThat(d.plans().upcomingCount()).isEqualTo(2);
        assertThat(d.plans().completedCount()).isEqualTo(2);
    }

    @Test
    void planProgressShownOnDashboardAfterItemToggle() {
        long a = task("A", TaskStatus.TODO, null);
        long b = task("B", TaskStatus.TODO, null);
        PlanResponse p = planService.create(new PlanRequest("Focus", 60, NOW_ODT.minusMinutes(5),
                NOW_ODT.plusHours(1), 1, List.of(new PlanItemSource(PlanItemSourceType.TASK, a),
                        new PlanItemSource(PlanItemSourceType.TASK, b))));
        planService.setItemDone(p.id(), p.items().get(0).id(), true);
        DashboardResponse d = dashboard();
        assertThat(d.plans().inProgress()).singleElement().satisfies(r -> {
            assertThat(r.itemsDone()).isEqualTo(1);
            assertThat(r.progressPercent()).isEqualTo(50);
            assertThat(r.restSeconds()).isEqualTo(3600L);
        });
        // side effect: source task DONE → task metrics follow
        assertThat(d.tasks().doneCount()).isEqualTo(1);
        assertThat(d.tasks().completedTodayCount()).isEqualTo(1);
    }

    // ---- learning (AS5) ----

    @Test
    void learningMetricsWithSevenDayWindow() {
        LearningCardResponse c1 = learningService.create(new LearningCardRequest("Course", null, null));
        learningService.create(new LearningCardRequest("Book", null, LearningStatus.IN_PROGRESS));
        learningService.create(new LearningCardRequest("Done", null, LearningStatus.COMPLETED));
        // milestone done 8 days ago → outside window
        clock.set(NOW.minus(Duration.ofDays(8)));
        learningService.addMilestone(c1.id(), new MilestoneRequest("Old", true, null));
        // milestone done exactly 7 days ago → inside window (>=)
        clock.set(NOW.minus(Duration.ofDays(7)));
        learningService.addMilestone(c1.id(), new MilestoneRequest("Edge", true, null));
        clock.set(NOW);
        LearningCardResponse c = learningService.addMilestone(c1.id(), new MilestoneRequest("Open", false, null));
        learningService.addMilestone(c1.id(), new MilestoneRequest("Recent", true, null));
        long open = c.milestones().stream().filter(m -> m.title().equals("Open")).findFirst().orElseThrow().id();

        DashboardResponse d = dashboard();
        assertThat(d.learning().cardsTotal()).isEqualTo(3);
        // c1 has 3/4 done → IN_PROGRESS by milestone rule; plus manual IN_PROGRESS "Book"
        assertThat(d.learning().inProgressCount()).isEqualTo(2);
        assertThat(d.learning().milestonesTotal()).isEqualTo(4);
        assertThat(d.learning().milestonesDone()).isEqualTo(3);
        assertThat(d.learning().milestonesCompletedLast7Days()).isEqualTo(2);

        learningService.updateMilestone(c1.id(), open, new MilestoneRequest("Open", true, null));
        DashboardResponse after = dashboard();
        assertThat(after.learning().milestonesDone()).isEqualTo(4);
        assertThat(after.learning().milestonesCompletedLast7Days()).isEqualTo(3);
        assertThat(after.learning().inProgressCount()).isEqualTo(1); // c1 now COMPLETED

        clock.set(NOW.plus(Duration.ofDays(8)));
        assertThat(dashboard().learning().milestonesCompletedLast7Days()).isZero();
    }
}
