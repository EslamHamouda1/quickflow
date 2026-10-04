package com.quickflow.dashboard;

import java.time.Clock;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.quickflow.dashboard.dto.DashboardHabits;
import com.quickflow.dashboard.dto.DashboardLearning;
import com.quickflow.dashboard.dto.DashboardPlans;
import com.quickflow.dashboard.dto.DashboardResponse;
import com.quickflow.dashboard.dto.DashboardTasks;
import com.quickflow.habit.HabitService;
import com.quickflow.habit.dto.HabitResponse;
import com.quickflow.learning.LearningCardRepository;
import com.quickflow.learning.LearningMilestoneRepository;
import com.quickflow.learning.LearningStatus;
import com.quickflow.plan.PlanService;
import com.quickflow.plan.PlanStatus;
import com.quickflow.plan.PlanStatusCalculator;
import com.quickflow.plan.dto.PlanResponse;
import com.quickflow.settings.SettingsService;
import com.quickflow.task.TaskService;
import com.quickflow.task.TaskStatus;
import com.quickflow.task.dto.TaskResponse;

/**
 * Dashboard read model (US5, research R10). Aggregates the feature services so every rule (overdue,
 * habit stats, plan status) lives in exactly one place; "today" comes from the injected {@link Clock}.
 */
@Service
@Transactional
public class DashboardService {

    /** Window of {@code milestonesCompletedLast7Days}. */
    static final int MILESTONE_WINDOW_DAYS = 7;

    private final SettingsService settings;
    private final TaskService tasks;
    private final HabitService habits;
    private final PlanService plans;
    private final LearningCardRepository cards;
    private final LearningMilestoneRepository milestones;
    private final Clock clock;

    public DashboardService(SettingsService settings, TaskService tasks, HabitService habits, PlanService plans,
                            LearningCardRepository cards, LearningMilestoneRepository milestones, Clock clock) {
        this.settings = settings;
        this.tasks = tasks;
        this.habits = habits;
        this.plans = plans;
        this.cards = cards;
        this.milestones = milestones;
        this.clock = clock;
    }

    public DashboardResponse get() {
        LocalDate today = LocalDate.now(clock);
        return new DashboardResponse(settings.displayName(), today, taskSection(today), habitSection(),
                planSection(), learningSection());
    }

    private DashboardTasks taskSection(LocalDate today) {
        // Non-archived tasks; the overdue flag is computed by TaskService.isOverdue.
        List<TaskResponse> active = tasks.list(
                new TaskService.TaskQuery(null, null, null, null, null, null, false, null, null));
        List<TaskResponse> dueToday = active.stream()
                .filter(t -> today.equals(t.dueDate()) && t.status() != TaskStatus.DONE)
                .toList();
        List<TaskResponse> overdue = active.stream().filter(TaskResponse::overdue).toList();
        int completedToday = (int) active.stream()
                .filter(t -> t.completedAt() != null && localDate(t.completedAt()).equals(today))
                .count();
        int done = (int) active.stream().filter(t -> t.status() == TaskStatus.DONE).count();
        return new DashboardTasks(dueToday, overdue, completedToday, active.size(), done,
                PlanStatusCalculator.progressPercent(active.size(), done));
    }

    private DashboardHabits habitSection() {
        List<HabitResponse> active = habits.list(true);
        int completedToday = (int) active.stream().filter(HabitResponse::completedToday).count();
        return new DashboardHabits(active, active.size(), completedToday);
    }

    private DashboardPlans planSection() {
        List<PlanResponse> all = plans.list(null); // priority asc, then start asc
        return new DashboardPlans(
                all.stream().filter(p -> p.status() == PlanStatus.IN_PROGRESS).toList(),
                (int) all.stream().filter(p -> p.status() == PlanStatus.NOT_STARTED).count(),
                (int) all.stream().filter(p -> p.status() == PlanStatus.COMPLETED).count());
    }

    private DashboardLearning learningSection() {
        OffsetDateTime since = OffsetDateTime.now(clock).minusDays(MILESTONE_WINDOW_DAYS);
        return new DashboardLearning(
                (int) cards.count(),
                (int) cards.countByStatus(LearningStatus.IN_PROGRESS),
                (int) milestones.count(),
                (int) milestones.countByDoneTrue(),
                (int) milestones.countByDoneTrueAndCompletedAtGreaterThanEqual(since));
    }

    private LocalDate localDate(OffsetDateTime instant) {
        return instant.atZoneSameInstant(clock.getZone()).toLocalDate();
    }
}
