package com.quickflow.task;

import java.time.Clock;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.stream.Stream;

import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.quickflow.common.NotFoundException;
import com.quickflow.task.dto.TaskRequest;
import com.quickflow.task.dto.TaskResponse;

/** Task use cases (US1). "Today" and timestamps come from the injected {@link Clock} (research R3). */
@Service
@Transactional
public class TaskService {

    /** Filters of {@code GET /api/tasks}; any field may be null. */
    public record TaskQuery(String q, TaskStatus status, TaskPriority priority, LocalDate dueFrom, LocalDate dueTo,
                            Boolean overdue, Boolean archived, TaskSort sort, SortDirection direction) {
    }

    private final TaskRepository repository;
    private final Clock clock;

    public TaskService(TaskRepository repository, Clock clock) {
        this.repository = repository;
        this.clock = clock;
    }

    /** Overdue rule (FR-006): dueDate before today and status not DONE. */
    public static boolean isOverdue(Task task, LocalDate today) {
        return task.getDueDate() != null && task.getDueDate().isBefore(today) && task.getStatus() != TaskStatus.DONE;
    }

    public TaskResponse create(TaskRequest req) {
        OffsetDateTime now = now();
        Task task = new Task();
        task.setTitle(req.title().trim());
        task.setDescription(req.description());
        task.setStatus(req.status() != null ? req.status() : TaskStatus.TODO);
        task.setPriority(req.priority() != null ? req.priority() : TaskPriority.MEDIUM);
        task.setDueDate(req.dueDate());
        task.setCreatedAt(now);
        task.setUpdatedAt(now);
        task.setCompletedAt(task.getStatus() == TaskStatus.DONE ? now : null);
        return toResponse(repository.save(task));
    }

    @Transactional(readOnly = true)
    public TaskResponse get(long id) {
        return toResponse(find(id));
    }

    public TaskResponse update(long id, TaskRequest req) {
        Task task = find(id);
        OffsetDateTime now = now();
        task.setTitle(req.title().trim());
        task.setDescription(req.description());
        task.setDueDate(req.dueDate());
        if (req.priority() != null) {
            task.setPriority(req.priority());
        }
        if (req.status() != null) {
            applyStatus(task, req.status(), now);
        }
        task.setUpdatedAt(now);
        return toResponse(task);
    }

    /** Idempotent: an already-DONE task keeps its completedAt. */
    public TaskResponse complete(long id) {
        Task task = find(id);
        if (task.getStatus() != TaskStatus.DONE) {
            OffsetDateTime now = now();
            applyStatus(task, TaskStatus.DONE, now);
            task.setUpdatedAt(now);
        }
        return toResponse(task);
    }

    public TaskResponse archive(long id) {
        return setArchived(id, true);
    }

    public TaskResponse restore(long id) {
        return setArchived(id, false);
    }

    public void delete(long id) {
        repository.delete(find(id));
    }

    @Transactional(readOnly = true)
    public List<TaskResponse> list(TaskQuery query) {
        LocalDate today = today();
        Specification<Task> spec = Stream.of(
                        TaskSpecifications.titleContains(query.q()),
                        TaskSpecifications.hasStatus(query.status()),
                        TaskSpecifications.hasPriority(query.priority()),
                        TaskSpecifications.dueFrom(query.dueFrom()),
                        TaskSpecifications.dueTo(query.dueTo()),
                        TaskSpecifications.overdue(query.overdue(), today))
                .filter(Objects::nonNull)
                .reduce(TaskSpecifications.archived(Boolean.TRUE.equals(query.archived())), Specification::and);
        return repository.findAll(spec).stream()
                .sorted(comparator(query.sort(), query.direction()))
                .map(t -> TaskResponse.of(t, isOverdue(t, today)))
                .toList();
    }

    /**
     * CREATED_AT (default) / DUE_DATE, ASC / DESC (default). For DUE_DATE tasks without a due date
     * always sort last; ties fall back to createdAt then id in the same direction.
     */
    static Comparator<Task> comparator(TaskSort sort, SortDirection direction) {
        boolean desc = direction == null || direction == SortDirection.DESC;
        Comparator<Task> byCreated = Comparator.comparing(Task::getCreatedAt)
                .thenComparing(Task::getId, Comparator.nullsLast(Comparator.naturalOrder()));
        if (desc) {
            byCreated = byCreated.reversed();
        }
        if (sort != TaskSort.DUE_DATE) {
            return byCreated;
        }
        Comparator<LocalDate> dates = desc ? Comparator.reverseOrder() : Comparator.naturalOrder();
        return Comparator.comparing(Task::getDueDate, Comparator.nullsLast(dates)).thenComparing(byCreated);
    }

    private TaskResponse setArchived(long id, boolean archived) {
        Task task = find(id);
        if (task.isArchived() != archived) {
            task.setArchived(archived);
            task.setUpdatedAt(now());
        }
        return toResponse(task);
    }

    /** completedAt set when status becomes DONE, cleared when it leaves DONE. */
    private static void applyStatus(Task task, TaskStatus status, OffsetDateTime now) {
        if (status == TaskStatus.DONE && task.getStatus() != TaskStatus.DONE) {
            task.setCompletedAt(now);
        } else if (status != TaskStatus.DONE) {
            task.setCompletedAt(null);
        }
        task.setStatus(status);
    }

    private Task find(long id) {
        return repository.findById(id).orElseThrow(() -> NotFoundException.of("Task", id));
    }

    private TaskResponse toResponse(Task task) {
        return TaskResponse.of(task, isOverdue(task, today()));
    }

    private OffsetDateTime now() {
        return OffsetDateTime.now(clock).truncatedTo(ChronoUnit.MICROS);
    }

    private LocalDate today() {
        return LocalDate.now(clock);
    }
}
