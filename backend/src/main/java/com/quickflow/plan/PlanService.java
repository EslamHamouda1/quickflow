package com.quickflow.plan;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Collection;
import java.util.EnumMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.quickflow.common.BadRequestException;
import com.quickflow.common.NotFoundException;
import com.quickflow.habit.Habit;
import com.quickflow.habit.HabitRepository;
import com.quickflow.learning.LearningCard;
import com.quickflow.learning.LearningCardRepository;
import com.quickflow.plan.dto.PlanItemResponse;
import com.quickflow.plan.dto.PlanItemSource;
import com.quickflow.plan.dto.PlanRequest;
import com.quickflow.plan.dto.PlanResponse;
import com.quickflow.task.Task;
import com.quickflow.task.TaskRepository;

/**
 * Plan use cases (US4). Status, progress and rest time are derived on every read from the injected
 * {@link Clock} via {@link PlanStatusCalculator} (research R4); nothing time-dependent is stored.
 */
@Service
@Transactional
public class PlanService {

    private final PlanRepository plans;
    private final TaskRepository tasks;
    private final HabitRepository habits;
    private final LearningCardRepository cards;
    private final PlanItemCompletionService completion;
    private final Clock clock;

    public PlanService(PlanRepository plans, TaskRepository tasks, HabitRepository habits,
                       LearningCardRepository cards, PlanItemCompletionService completion, Clock clock) {
        this.plans = plans;
        this.tasks = tasks;
        this.habits = habits;
        this.cards = cards;
        this.completion = completion;
        this.clock = clock;
    }

    public PlanResponse create(PlanRequest req) {
        if (!req.endDateTime().isAfter(req.startDateTime())) {
            throw new BadRequestException("endDateTime", "End date-time must be after start date-time");
        }
        if (req.items() == null || req.items().isEmpty()) {
            throw new BadRequestException("items", "Select at least one item");
        }
        Plan plan = new Plan();
        plan.setTitle(req.title().trim());
        plan.setEstimatedDurationMinutes(req.estimatedDurationMinutes());
        plan.setStartDateTime(req.startDateTime());
        plan.setEndDateTime(req.endDateTime());
        plan.setPriorityOrder(req.priorityOrder());
        plan.setCreatedAt(now());
        Set<String> seen = new HashSet<>();
        for (PlanItemSource src : req.items()) {
            if (!seen.add(src.sourceType() + ":" + src.sourceId())) {
                throw new BadRequestException("items",
                        "Duplicate item " + src.sourceType() + " " + src.sourceId());
            }
            PlanItem item = new PlanItem();
            item.setSourceType(src.sourceType());
            item.setSourceId(src.sourceId());
            item.setSourceTitle(snapshotTitle(src));
            item.setDone(false);
            plan.addItem(item);
        }
        return toResponse(plans.save(plan));
    }

    @Transactional(readOnly = true)
    public PlanResponse get(long id) {
        return toResponse(find(id));
    }

    /** All plans (priority asc, start asc), optionally only those with the given derived status. */
    @Transactional(readOnly = true)
    public List<PlanResponse> list(PlanStatus status) {
        List<Plan> all = plans.findAllWithItemsOrdered();
        Map<PlanItemSourceType, Set<Long>> available = availableSources(
                all.stream().flatMap(p -> p.getItems().stream()).toList());
        OffsetDateTime now = now();
        return all.stream()
                .map(p -> toResponse(p, available, now))
                .filter(r -> status == null || r.status() == status)
                .toList();
    }

    /** Deletes the plan with its items; sources are untouched. */
    public void delete(long id) {
        plans.delete(find(id));
    }

    /** Marks an item done / not done; done=true applies the source side effect (research R6). */
    public PlanResponse setItemDone(long id, long itemId, boolean done) {
        Plan plan = find(id);
        PlanItem item = plan.getItems().stream()
                .filter(i -> i.getId() == itemId)
                .findFirst()
                .orElseThrow(() -> new NotFoundException("Plan " + id + " has no item " + itemId));
        completion.setDone(item, done);
        return toResponse(plan);
    }

    /** Records that the start notification was shown; idempotent (first timestamp kept). */
    public PlanResponse acknowledgeStart(long id) {
        Plan plan = find(id);
        if (plan.getStartNotifiedAt() == null) {
            plan.setStartNotifiedAt(now());
        }
        return toResponse(plan);
    }

    /** Validates that the source exists and is pickable, returning its current title. */
    private String snapshotTitle(PlanItemSource src) {
        Long sid = src.sourceId();
        return switch (src.sourceType()) {
            case TASK -> tasks.findById(sid)
                    .filter(t -> !t.isArchived())
                    .map(Task::getTitle)
                    .orElseThrow(() -> invalidSource("Task " + sid + " does not exist or is archived"));
            case HABIT -> habits.findById(sid)
                    .filter(Habit::isActive)
                    .map(Habit::getName)
                    .orElseThrow(() -> invalidSource("Habit " + sid + " does not exist or is inactive"));
            case LEARNING_RESOURCE -> cards.findById(sid)
                    .map(LearningCard::getTitle)
                    .orElseThrow(() -> invalidSource("Learning card " + sid + " does not exist"));
        };
    }

    private static BadRequestException invalidSource(String message) {
        return new BadRequestException("items", message);
    }

    /** Ids of the referenced sources that still exist, per source type (one query per type). */
    private Map<PlanItemSourceType, Set<Long>> availableSources(Collection<PlanItem> items) {
        Map<PlanItemSourceType, Set<Long>> wanted = items.stream().collect(Collectors.groupingBy(
                PlanItem::getSourceType, () -> new EnumMap<>(PlanItemSourceType.class),
                Collectors.mapping(PlanItem::getSourceId, Collectors.toSet())));
        Map<PlanItemSourceType, Set<Long>> found = new EnumMap<>(PlanItemSourceType.class);
        wanted.forEach((type, ids) -> found.put(type, switch (type) {
            case TASK -> tasks.findAllById(ids).stream().map(Task::getId).collect(Collectors.toSet());
            case HABIT -> habits.findAllById(ids).stream().map(Habit::getId).collect(Collectors.toSet());
            case LEARNING_RESOURCE -> cards.findAllById(ids).stream().map(LearningCard::getId)
                    .collect(Collectors.toSet());
        }));
        return found;
    }

    private Plan find(long id) {
        return plans.findById(id).orElseThrow(() -> NotFoundException.of("Plan", id));
    }

    private PlanResponse toResponse(Plan plan) {
        return toResponse(plan, availableSources(plan.getItems()), now());
    }

    private static PlanResponse toResponse(Plan plan, Map<PlanItemSourceType, Set<Long>> available,
                                           OffsetDateTime now) {
        List<PlanItemResponse> items = plan.getItems().stream()
                .map(i -> PlanItemResponse.of(i,
                        available.getOrDefault(i.getSourceType(), Set.of()).contains(i.getSourceId())))
                .toList();
        return PlanResponse.of(plan, items,
                PlanStatusCalculator.calculate(plan.getStartDateTime(), plan.getEndDateTime(), plan.getItems(), now));
    }

    private OffsetDateTime now() {
        return OffsetDateTime.now(clock).truncatedTo(ChronoUnit.MICROS);
    }
}
