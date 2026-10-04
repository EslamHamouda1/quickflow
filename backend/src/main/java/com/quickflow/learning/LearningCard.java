package com.quickflow.learning;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;

import org.hibernate.annotations.BatchSize;

/** A learning resource with milestones and notes (data-model: LearningCard). */
@Entity
@Table(name = "learning_card")
public class LearningCard {

    public static final int TITLE_MAX = 200;
    public static final int DESCRIPTION_MAX = 2000;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = TITLE_MAX)
    private String title;

    @Column(length = DESCRIPTION_MAX)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private LearningStatus status = LearningStatus.NOT_STARTED;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    /** Insertion order (identity ids are increasing). */
    @OneToMany(mappedBy = "card", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("id ASC")
    private List<LearningMilestone> milestones = new ArrayList<>();

    /** Newest first. */
    @OneToMany(mappedBy = "card", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("createdAt DESC, id DESC")
    @BatchSize(size = 50)
    private List<LearningNote> notes = new ArrayList<>();

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public LearningStatus getStatus() { return status; }
    public void setStatus(LearningStatus status) { this.status = status; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }
    public List<LearningMilestone> getMilestones() { return milestones; }
    public List<LearningNote> getNotes() { return notes; }

    public void addMilestone(LearningMilestone m) {
        m.setCard(this);
        milestones.add(m);
    }

    public void addNote(LearningNote n) {
        n.setCard(this);
        notes.add(n);
    }
}
