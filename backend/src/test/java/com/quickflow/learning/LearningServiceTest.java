package com.quickflow.learning;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;

import jakarta.persistence.EntityManager;

import com.quickflow.common.NotFoundException;
import com.quickflow.learning.dto.LearningCardRequest;
import com.quickflow.learning.dto.LearningCardResponse;
import com.quickflow.learning.dto.MilestoneRequest;
import com.quickflow.learning.dto.MilestoneResponse;
import com.quickflow.learning.dto.NoteRequest;

/**
 * T062 — {@link LearningService} with a fixed clock against the real repositories (test profile H2).
 * Traces US3 AS1-AS6, FR-012..FR-016.
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import({LearningService.class, LearningServiceTest.ClockConfig.class})
class LearningServiceTest {

    static final Instant NOW = Instant.parse("2026-06-17T10:00:00Z");
    static final OffsetDateTime NOW_ODT = OffsetDateTime.ofInstant(NOW, ZoneOffset.UTC);

    @TestConfiguration
    static class ClockConfig {
        @Bean
        MutableClock clock() {
            return new MutableClock(NOW);
        }
    }

    @Autowired
    LearningService service;

    @Autowired
    LearningCardRepository cards;

    @Autowired
    LearningMilestoneRepository milestones;

    @Autowired
    EntityManager em;

    @Autowired
    MutableClock clock;

    @BeforeEach
    void reset() {
        cards.deleteAll();
        cards.flush();
        clock.set(NOW);
    }

    private LearningCardResponse card(String title) {
        return service.create(new LearningCardRequest(title, null, null));
    }

    private static MilestoneRequest ms(String title, Boolean done) {
        return new MilestoneRequest(title, done, null);
    }

    private LearningCardResponse reload(long id) {
        em.flush();
        em.clear();
        return service.get(id);
    }

    private static long mid(LearningCardResponse c, int i) {
        return c.milestones().get(i).id();
    }

    // --- cards (AS1, FR-012, FR-013)

    @Test
    void createTrimsTitleAndDefaults() {
        LearningCardResponse c = service.create(new LearningCardRequest("  Spring Boot  ", "book", null));
        assertThat(c.id()).isNotNull();
        assertThat(c.title()).isEqualTo("Spring Boot");
        assertThat(c.description()).isEqualTo("book");
        assertThat(c.status()).isEqualTo(LearningStatus.NOT_STARTED);
        assertThat(c.createdAt()).isEqualTo(NOW_ODT);
        assertThat(c.milestones()).isEmpty();
        assertThat(c.notes()).isEmpty();
        assertThat(c.milestonesTotal()).isZero();
        assertThat(c.progressPercent()).isZero();
    }

    @Test
    void createWithExplicitStatus() {
        LearningCardResponse c = service.create(new LearningCardRequest("x", null, LearningStatus.IN_PROGRESS));
        assertThat(reload(c.id()).status()).isEqualTo(LearningStatus.IN_PROGRESS);
    }

    @Test
    void updateReplacesFieldsAndKeepsStatusWhenOmitted() {
        LearningCardResponse c = service.create(new LearningCardRequest("a", "d", LearningStatus.IN_PROGRESS));
        LearningCardResponse u = service.update(c.id(), new LearningCardRequest(" b ", null, null));
        assertThat(u.title()).isEqualTo("b");
        assertThat(u.description()).isNull();
        assertThat(u.status()).isEqualTo(LearningStatus.IN_PROGRESS);
        assertThat(service.update(c.id(), new LearningCardRequest("b", null, LearningStatus.COMPLETED)).status())
                .isEqualTo(LearningStatus.COMPLETED);
        assertThat(reload(c.id()).status()).isEqualTo(LearningStatus.COMPLETED);
    }

    @Test
    void listNewestFirst() {
        LearningCardResponse a = card("A");
        clock.advance(Duration.ofMinutes(1));
        LearningCardResponse b = card("B");
        em.flush();
        em.clear();
        assertThat(service.list()).extracting(LearningCardResponse::id).containsExactly(b.id(), a.id());
    }

    @Test
    void deleteRemovesCardWithChildren() {
        LearningCardResponse c = card("A");
        service.addMilestone(c.id(), ms("m", true));
        service.addNote(c.id(), new NoteRequest("n"));
        em.flush();
        em.clear();
        service.delete(c.id());
        em.flush();
        assertThat(cards.findById(c.id())).isEmpty();
        assertThat(milestones.count()).isZero();
        assertThat(em.createQuery("select count(n) from LearningNote n", Long.class).getSingleResult()).isZero();
    }

    // --- milestones (AS3, AS5, FR-014, FR-016)

    @Test
    void addMilestoneDefaultsNotDoneAndRecomputes() {
        LearningCardResponse c = service.create(new LearningCardRequest("A", null, LearningStatus.COMPLETED));
        LearningCardResponse r = service.addMilestone(c.id(), new MilestoneRequest(" m1 ", null, LocalDate.of(2026, 7, 1)));
        MilestoneResponse m = r.milestones().get(0);
        assertThat(m.id()).isNotNull();
        assertThat(m.title()).isEqualTo("m1");
        assertThat(m.done()).isFalse();
        assertThat(m.completedAt()).isNull();
        assertThat(m.targetDate()).isEqualTo(LocalDate.of(2026, 7, 1));
        assertThat(r.status()).isEqualTo(LearningStatus.NOT_STARTED);
        assertThat(r.milestonesTotal()).isEqualTo(1);
    }

    @Test
    void addMilestoneCreatedDoneSetsCompletedAt() {
        LearningCardResponse c = card("A");
        service.addMilestone(c.id(), ms("m1", false));
        LearningCardResponse r = service.addMilestone(c.id(), ms("m2", true));
        assertThat(r.milestones()).extracting(MilestoneResponse::title).containsExactly("m1", "m2");
        assertThat(r.milestones().get(1).completedAt()).isEqualTo(NOW_ODT);
        assertThat(r.status()).isEqualTo(LearningStatus.IN_PROGRESS);
        assertThat(r.milestonesDone()).isEqualTo(1);
        assertThat(r.progressPercent()).isEqualTo(50);
    }

    @Test
    void toggleDoneSetsAndClearsCompletedAtAndRecomputes() {
        LearningCardResponse c = card("A");
        c = service.addMilestone(c.id(), ms("m1", false));
        c = service.addMilestone(c.id(), ms("m2", false));
        clock.advance(Duration.ofHours(1));
        LearningCardResponse r = service.updateMilestone(c.id(), mid(c, 0), ms("m1", true));
        assertThat(r.milestones().get(0).completedAt()).isEqualTo(NOW_ODT.plusHours(1));
        assertThat(r.status()).isEqualTo(LearningStatus.IN_PROGRESS);
        r = service.updateMilestone(c.id(), mid(c, 1), ms("m2", true));
        assertThat(r.status()).isEqualTo(LearningStatus.COMPLETED);
        assertThat(r.progressPercent()).isEqualTo(100);
        r = service.updateMilestone(c.id(), mid(c, 0), ms("m1", false));
        assertThat(r.milestones().get(0).completedAt()).isNull();
        assertThat(r.milestones().get(0).done()).isFalse();
        assertThat(r.status()).isEqualTo(LearningStatus.IN_PROGRESS);
        LearningCardResponse persisted = reload(c.id());
        assertThat(persisted.milestones().get(0).completedAt()).isNull();
        assertThat(persisted.milestones().get(1).completedAt()).isNotNull();
        assertThat(persisted.status()).isEqualTo(LearningStatus.IN_PROGRESS);
    }

    @Test
    void updateMilestoneOmittedDoneKeepsDoneAndCompletedAt() {
        LearningCardResponse c = card("A");
        c = service.addMilestone(c.id(), ms("m1", true));
        clock.advance(Duration.ofHours(2));
        LearningCardResponse r = service.updateMilestone(c.id(), mid(c, 0),
                new MilestoneRequest(" renamed ", null, LocalDate.of(2026, 8, 1)));
        MilestoneResponse m = r.milestones().get(0);
        assertThat(m.title()).isEqualTo("renamed");
        assertThat(m.done()).isTrue();
        assertThat(m.completedAt()).isEqualTo(NOW_ODT);
        assertThat(m.targetDate()).isEqualTo(LocalDate.of(2026, 8, 1));
        // targetDate replaced: omitted → null
        assertThat(service.updateMilestone(c.id(), mid(c, 0), ms("renamed", null)).milestones().get(0).targetDate()).isNull();
    }

    @Test
    void manualStatusKeptOnTitleOnlyUpdateAndRecomputedOnNextAdd() {
        LearningCardResponse c = card("A");
        c = service.addMilestone(c.id(), ms("m1", true));
        assertThat(c.status()).isEqualTo(LearningStatus.COMPLETED);
        service.update(c.id(), new LearningCardRequest("A", null, LearningStatus.NOT_STARTED));
        // title-only and same-done updates keep the manual status (FR-016)
        assertThat(service.updateMilestone(c.id(), mid(c, 0), ms("m1 renamed", null)).status()).isEqualTo(LearningStatus.NOT_STARTED);
        assertThat(service.updateMilestone(c.id(), mid(c, 0), ms("m1 renamed", true)).status()).isEqualTo(LearningStatus.NOT_STARTED);
        assertThat(reload(c.id()).status()).isEqualTo(LearningStatus.NOT_STARTED);
        // next add recomputes
        assertThat(service.addMilestone(c.id(), ms("m2", false)).status()).isEqualTo(LearningStatus.IN_PROGRESS);
    }

    @Test
    void manualStatusRecomputedOnNextToggle() {
        LearningCardResponse c = card("A");
        c = service.addMilestone(c.id(), ms("m1", false));
        c = service.addMilestone(c.id(), ms("m2", false));
        service.update(c.id(), new LearningCardRequest("A", null, LearningStatus.COMPLETED));
        assertThat(service.updateMilestone(c.id(), mid(c, 0), ms("m1", true)).status()).isEqualTo(LearningStatus.IN_PROGRESS);
    }

    @Test
    void manualStatusRecomputedOnNextRemove() {
        LearningCardResponse c = card("A");
        c = service.addMilestone(c.id(), ms("m1", true));
        c = service.addMilestone(c.id(), ms("m2", false));
        service.update(c.id(), new LearningCardRequest("A", null, LearningStatus.NOT_STARTED));
        LearningCardResponse r = service.deleteMilestone(c.id(), mid(c, 1));
        assertThat(r.status()).isEqualTo(LearningStatus.COMPLETED);
        assertThat(r.milestones()).hasSize(1);
        assertThat(reload(c.id()).milestonesTotal()).isEqualTo(1);
    }

    @Test
    void deletingLastMilestoneKeepsStatus() {
        LearningCardResponse c = card("A");
        c = service.addMilestone(c.id(), ms("m1", true));
        LearningCardResponse r = service.deleteMilestone(c.id(), mid(c, 0));
        assertThat(r.milestones()).isEmpty();
        assertThat(r.status()).isEqualTo(LearningStatus.COMPLETED);
        assertThat(r.progressPercent()).isZero();
        assertThat(milestones.count()).isZero();
    }

    // --- notes (AS4, FR-015)

    @Test
    void notesNewestFirstAndDelete() {
        LearningCardResponse c = card("A");
        service.addNote(c.id(), new NoteRequest("first"));
        clock.advance(Duration.ofMinutes(5));
        LearningCardResponse r = service.addNote(c.id(), new NoteRequest("second\nline"));
        assertThat(r.notes()).extracting(n -> n.text()).containsExactly("second\nline", "first");
        assertThat(r.notes().get(0).createdAt()).isEqualTo(NOW_ODT.plusMinutes(5));
        assertThat(r.notes().get(0).id()).isNotNull();
        LearningCardResponse persisted = reload(c.id());
        assertThat(persisted.notes()).extracting(n -> n.text()).containsExactly("second\nline", "first");
        r = service.deleteNote(c.id(), persisted.notes().get(0).id());
        assertThat(r.notes()).extracting(n -> n.text()).containsExactly("first");
        assertThat(reload(c.id()).notes()).hasSize(1);
    }

    @Test
    void notesDoNotChangeStatus() {
        LearningCardResponse c = service.create(new LearningCardRequest("A", null, LearningStatus.IN_PROGRESS));
        c = service.addNote(c.id(), new NoteRequest("n"));
        assertThat(c.status()).isEqualTo(LearningStatus.IN_PROGRESS);
        assertThat(service.deleteNote(c.id(), c.notes().get(0).id()).status()).isEqualTo(LearningStatus.IN_PROGRESS);
    }

    // --- 404s

    @Test
    void unknownCardIs404ForEveryOperation() {
        long x = 987654321L;
        assertThatThrownBy(() -> service.get(x)).isInstanceOf(NotFoundException.class).hasMessageContaining("987654321");
        assertThatThrownBy(() -> service.update(x, new LearningCardRequest("a", null, null))).isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.delete(x)).isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.addMilestone(x, ms("m", null))).isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.updateMilestone(x, 1, ms("m", null))).isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.deleteMilestone(x, 1)).isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.addNote(x, new NoteRequest("n"))).isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.deleteNote(x, 1)).isInstanceOf(NotFoundException.class);
    }

    @Test
    void milestoneAndNoteOfAnotherCardAre404() {
        LearningCardResponse a = card("A");
        LearningCardResponse b = card("B");
        b = service.addMilestone(b.id(), ms("mb", false));
        b = service.addNote(b.id(), new NoteRequest("nb"));
        long bm = mid(b, 0);
        long bn = b.notes().get(0).id();
        long aId = a.id();
        assertThatThrownBy(() -> service.updateMilestone(aId, bm, ms("x", true))).isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.deleteMilestone(aId, bm)).isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.deleteNote(aId, bn)).isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.updateMilestone(aId, 999999L, ms("x", true))).isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.deleteNote(aId, 999999L)).isInstanceOf(NotFoundException.class);
        LearningCardResponse bReloaded = reload(b.id());
        assertThat(bReloaded.milestones()).hasSize(1);
        assertThat(bReloaded.milestones().get(0).done()).isFalse();
        assertThat(bReloaded.notes()).hasSize(1);
    }
}
