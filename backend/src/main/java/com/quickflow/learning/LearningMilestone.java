package com.quickflow.learning;

import java.time.LocalDate;
import java.time.OffsetDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

/** A milestone of exactly one learning card (FR-014). */
@Entity
@Table(name = "learning_milestone")
public class LearningMilestone {

    public static final int TITLE_MAX = 200;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "learning_card_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private LearningCard card;

    @Column(nullable = false, length = TITLE_MAX)
    private String title;

    @Column(nullable = false)
    private boolean done;

    @Column(name = "target_date")
    private LocalDate targetDate;

    /** Set when done becomes true, cleared when false. */
    @Column(name = "completed_at")
    private OffsetDateTime completedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public LearningCard getCard() { return card; }
    public void setCard(LearningCard card) { this.card = card; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public boolean isDone() { return done; }
    public void setDone(boolean done) { this.done = done; }
    public LocalDate getTargetDate() { return targetDate; }
    public void setTargetDate(LocalDate targetDate) { this.targetDate = targetDate; }
    public OffsetDateTime getCompletedAt() { return completedAt; }
    public void setCompletedAt(OffsetDateTime completedAt) { this.completedAt = completedAt; }
}
