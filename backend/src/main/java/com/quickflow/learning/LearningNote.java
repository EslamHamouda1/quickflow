package com.quickflow.learning;

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

/** A free-text note of a learning card (FR-015). */
@Entity
@Table(name = "learning_note")
public class LearningNote {

    public static final int TEXT_MAX = 5000;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "learning_card_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private LearningCard card;

    @Column(nullable = false, length = TEXT_MAX)
    private String text;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public LearningCard getCard() { return card; }
    public void setCard(LearningCard card) { this.card = card; }
    public String getText() { return text; }
    public void setText(String text) { this.text = text; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }
}
