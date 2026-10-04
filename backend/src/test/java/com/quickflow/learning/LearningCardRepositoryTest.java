package com.quickflow.learning;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.OffsetDateTime;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;

import jakarta.persistence.EntityManager;

/**
 * T063 — {@link LearningCardRepository} / {@link LearningMilestoneRepository} against the test-profile H2:
 * cascade delete of milestones and notes (US3 AS6), ordering and the counting queries.
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class LearningCardRepositoryTest {

    static final OffsetDateTime NOW = OffsetDateTime.parse("2026-06-17T10:00:00Z");

    @Autowired
    LearningCardRepository cards;

    @Autowired
    LearningMilestoneRepository milestones;

    @Autowired
    EntityManager em;

    @BeforeEach
    void setUp() {
        cards.deleteAll();
        cards.flush();
    }

    private LearningCard newCard(String title, OffsetDateTime createdAt, int ms, int doneMs, int notes) {
        LearningCard c = new LearningCard();
        c.setTitle(title);
        c.setCreatedAt(createdAt);
        for (int i = 0; i < ms; i++) {
            LearningMilestone m = new LearningMilestone();
            m.setTitle(title + " m" + i);
            m.setDone(i < doneMs);
            m.setCompletedAt(i < doneMs ? createdAt.plusDays(i) : null);
            c.addMilestone(m);
        }
        for (int i = 0; i < notes; i++) {
            LearningNote n = new LearningNote();
            n.setText(title + " n" + i);
            n.setCreatedAt(createdAt.plusMinutes(i));
            c.addNote(n);
        }
        return cards.saveAndFlush(c);
    }

    private long noteCount() {
        return em.createQuery("select count(n) from LearningNote n", Long.class).getSingleResult();
    }

    @Test
    void deleteCascadesMilestonesAndNotes() {
        LearningCard a = newCard("A", NOW, 3, 1, 2);
        LearningCard b = newCard("B", NOW, 1, 0, 1);
        em.clear();
        assertThat(milestones.count()).isEqualTo(4);
        assertThat(noteCount()).isEqualTo(3);
        cards.delete(cards.findById(a.getId()).orElseThrow());
        cards.flush();
        em.clear();
        assertThat(cards.findById(a.getId())).isEmpty();
        assertThat(milestones.count()).isEqualTo(1);
        assertThat(noteCount()).isEqualTo(1);
        assertThat(cards.findById(b.getId()).orElseThrow().getMilestones()).hasSize(1);
    }

    @Test
    void bulkDeleteCascadesAtDatabaseLevel() {
        LearningCard a = newCard("A", NOW, 2, 0, 2);
        em.clear();
        em.createQuery("delete from LearningCard c where c.id = :id").setParameter("id", a.getId()).executeUpdate();
        em.clear();
        assertThat(milestones.count()).isZero();
        assertThat(noteCount()).isZero();
    }

    @Test
    void orphanRemovalDeletesRemovedChildren() {
        LearningCard a = newCard("A", NOW, 2, 0, 2);
        em.clear();
        LearningCard loaded = cards.findById(a.getId()).orElseThrow();
        loaded.getMilestones().remove(0);
        loaded.getNotes().remove(0);
        cards.flush();
        em.clear();
        assertThat(milestones.count()).isEqualTo(1);
        assertThat(noteCount()).isEqualTo(1);
    }

    @Test
    void listNewestFirstWithMilestonesInInsertionOrderAndNotesNewestFirst() {
        LearningCard older = newCard("Old", NOW.minusDays(1), 0, 0, 0);
        LearningCard newer = newCard("New", NOW, 3, 0, 3);
        em.clear();
        List<LearningCard> all = cards.findAllWithMilestonesNewestFirst();
        assertThat(all).extracting(LearningCard::getId).containsExactly(newer.getId(), older.getId());
        assertThat(all.get(0).getMilestones()).extracting(LearningMilestone::getTitle)
                .containsExactly("New m0", "New m1", "New m2");
        assertThat(all.get(0).getNotes()).extracting(LearningNote::getText).containsExactly("New n2", "New n1", "New n0");
        assertThat(all.get(1).getStatus()).isEqualTo(LearningStatus.NOT_STARTED);
    }

    @Test
    void countQueries() {
        LearningCard a = newCard("A", NOW, 3, 2, 0);
        a.setStatus(LearningStatus.IN_PROGRESS);
        cards.saveAndFlush(a);
        newCard("B", NOW.minusDays(30), 2, 2, 0);
        assertThat(cards.countByStatus(LearningStatus.IN_PROGRESS)).isEqualTo(1);
        assertThat(cards.countByStatus(LearningStatus.NOT_STARTED)).isEqualTo(1);
        assertThat(milestones.countByDoneTrue()).isEqualTo(4);
        // A's completedAt: NOW, NOW+1d; B's: NOW-30d, NOW-29d
        assertThat(milestones.countByDoneTrueAndCompletedAtGreaterThanEqual(NOW.minusDays(7))).isEqualTo(2);
        assertThat(milestones.countByDoneTrueAndCompletedAtGreaterThanEqual(NOW.minusDays(30))).isEqualTo(4);
    }
}
