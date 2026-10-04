package com.quickflow.task;

import java.time.LocalDate;
import java.util.Locale;

import org.springframework.data.jpa.domain.Specification;

/** Composable filters for {@code GET /api/tasks}. Each returns {@code null} (no-op) when its input is null/blank. */
public final class TaskSpecifications {

    private TaskSpecifications() {
    }

    /** Case-insensitive "title contains"; LIKE wildcards in the input are matched literally. */
    public static Specification<Task> titleContains(String q) {
        if (q == null || q.isBlank()) {
            return null;
        }
        String pattern = "%" + q.trim().toLowerCase(Locale.ROOT)
                .replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
        return (root, query, cb) -> cb.like(cb.lower(root.get("title")), pattern, '\\');
    }

    public static Specification<Task> hasStatus(TaskStatus status) {
        return status == null ? null : (root, query, cb) -> cb.equal(root.get("status"), status);
    }

    public static Specification<Task> hasPriority(TaskPriority priority) {
        return priority == null ? null : (root, query, cb) -> cb.equal(root.get("priority"), priority);
    }

    public static Specification<Task> dueFrom(LocalDate from) {
        return from == null ? null : (root, query, cb) -> cb.greaterThanOrEqualTo(root.get("dueDate"), from);
    }

    public static Specification<Task> dueTo(LocalDate to) {
        return to == null ? null : (root, query, cb) -> cb.lessThanOrEqualTo(root.get("dueDate"), to);
    }

    /** overdue=true: dueDate &lt; today AND status ≠ DONE; overdue=false: the negation; null: no filter. */
    public static Specification<Task> overdue(Boolean overdue, LocalDate today) {
        if (overdue == null) {
            return null;
        }
        Specification<Task> isOverdue = (root, query, cb) -> cb.and(
                cb.isNotNull(root.get("dueDate")),
                cb.lessThan(root.get("dueDate"), today),
                cb.notEqual(root.get("status"), TaskStatus.DONE));
        return overdue ? isOverdue : Specification.not(isOverdue);
    }

    public static Specification<Task> archived(boolean archived) {
        return (root, query, cb) -> cb.equal(root.get("archived"), archived);
    }
}
