package com.quickflow.plan;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.quickflow.habit.HabitService;
import com.quickflow.task.TaskRepository;
import com.quickflow.task.TaskService;

/**
 * Side effects of marking a plan item done (business rule 13 / research R6, FR-024):
 * TASK → task becomes DONE (completedAt kept if already DONE); HABIT → today's completion recorded if missing;
 * LEARNING_RESOURCE → nothing. Undoing (done=false) never reverts the source; a missing source has no effect.
 */
@Service
@Transactional
public class PlanItemCompletionService {

    private final TaskRepository tasks;
    private final TaskService taskService;
    private final HabitService habitService;

    public PlanItemCompletionService(TaskRepository tasks, TaskService taskService, HabitService habitService) {
        this.tasks = tasks;
        this.taskService = taskService;
        this.habitService = habitService;
    }

    /** Applies the item's new done flag; done=true triggers the (idempotent) source side effect. */
    public void setDone(PlanItem item, boolean done) {
        item.setDone(done);
        if (done) {
            applySideEffect(item.getSourceType(), item.getSourceId());
        }
    }

    void applySideEffect(PlanItemSourceType type, Long sourceId) {
        if (type == null || sourceId == null) {
            return;
        }
        switch (type) {
            case TASK -> {
                if (tasks.existsById(sourceId)) {
                    taskService.complete(sourceId);
                }
            }
            case HABIT -> habitService.completeTodayIfMissing(sourceId);
            case LEARNING_RESOURCE -> { /* no side effect */ }
        }
    }
}
