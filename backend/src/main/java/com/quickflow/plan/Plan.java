package com.quickflow.plan;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;

/** A time-boxed plan built from existing items (data-model: Plan). Status is derived, not stored. */
@Entity
@Table(name = "plan")
public class Plan {

    public static final int TITLE_MAX = 200;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = TITLE_MAX)
    private String title;

    @Column(name = "estimated_duration_minutes", nullable = false)
    private int estimatedDurationMinutes;

    @Column(name = "start_date_time", nullable = false)
    private OffsetDateTime startDateTime;

    @Column(name = "end_date_time", nullable = false)
    private OffsetDateTime endDateTime;

    @Column(name = "priority_order", nullable = false)
    private int priorityOrder;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "start_notified_at")
    private OffsetDateTime startNotifiedAt;

    /** Insertion order (identity ids are increasing). */
    @OneToMany(mappedBy = "plan", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("id ASC")
    private List<PlanItem> items = new ArrayList<>();

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public int getEstimatedDurationMinutes() { return estimatedDurationMinutes; }
    public void setEstimatedDurationMinutes(int v) { this.estimatedDurationMinutes = v; }
    public OffsetDateTime getStartDateTime() { return startDateTime; }
    public void setStartDateTime(OffsetDateTime startDateTime) { this.startDateTime = startDateTime; }
    public OffsetDateTime getEndDateTime() { return endDateTime; }
    public void setEndDateTime(OffsetDateTime endDateTime) { this.endDateTime = endDateTime; }
    public int getPriorityOrder() { return priorityOrder; }
    public void setPriorityOrder(int priorityOrder) { this.priorityOrder = priorityOrder; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }
    public OffsetDateTime getStartNotifiedAt() { return startNotifiedAt; }
    public void setStartNotifiedAt(OffsetDateTime startNotifiedAt) { this.startNotifiedAt = startNotifiedAt; }
    public List<PlanItem> getItems() { return items; }

    public void addItem(PlanItem item) {
        item.setPlan(this);
        items.add(item);
    }
}
