package com.quickflow.plan;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

/**
 * One item of a plan (data-model: PlanItem). {@code sourceId} has no FK so the item survives deletion
 * of its source ("removed source", research R6/R7).
 */
@Entity
@Table(name = "plan_item", uniqueConstraints = @UniqueConstraint(name = "uk_plan_item_source",
        columnNames = {"plan_id", "source_type", "source_id"}))
public class PlanItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "plan_id", nullable = false)
    private Plan plan;

    @Enumerated(EnumType.STRING)
    @Column(name = "source_type", nullable = false, length = 20)
    private PlanItemSourceType sourceType;

    @Column(name = "source_id", nullable = false)
    private Long sourceId;

    @Column(name = "source_title", nullable = false, length = 200)
    private String sourceTitle;

    @Column(nullable = false)
    private boolean done = false;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Plan getPlan() { return plan; }
    public void setPlan(Plan plan) { this.plan = plan; }
    public PlanItemSourceType getSourceType() { return sourceType; }
    public void setSourceType(PlanItemSourceType sourceType) { this.sourceType = sourceType; }
    public Long getSourceId() { return sourceId; }
    public void setSourceId(Long sourceId) { this.sourceId = sourceId; }
    public String getSourceTitle() { return sourceTitle; }
    public void setSourceTitle(String sourceTitle) { this.sourceTitle = sourceTitle; }
    public boolean isDone() { return done; }
    public void setDone(boolean done) { this.done = done; }
}
