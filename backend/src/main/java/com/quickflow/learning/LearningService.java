package com.quickflow.learning;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.quickflow.common.NotFoundException;
import com.quickflow.learning.dto.LearningCardRequest;
import com.quickflow.learning.dto.LearningCardResponse;
import com.quickflow.learning.dto.MilestoneRequest;
import com.quickflow.learning.dto.NoteRequest;

/**
 * Learning card use cases (US3). Status is recomputed from milestones after a milestone add, delete or
 * a done-toggle (R9, FR-016); a manual status set via {@link #update} persists until then.
 */
@Service
@Transactional
public class LearningService {

    private final LearningCardRepository cards;
    private final Clock clock;

    public LearningService(LearningCardRepository cards, Clock clock) {
        this.cards = cards;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<LearningCardResponse> list() {
        return cards.findAllWithMilestonesNewestFirst().stream().map(LearningCardResponse::of).toList();
    }

    @Transactional(readOnly = true)
    public LearningCardResponse get(long id) {
        return LearningCardResponse.of(find(id));
    }

    public LearningCardResponse create(LearningCardRequest req) {
        LearningCard card = new LearningCard();
        card.setTitle(req.title().trim());
        card.setDescription(req.description());
        card.setStatus(req.status() != null ? req.status() : LearningStatus.NOT_STARTED);
        card.setCreatedAt(now());
        return LearningCardResponse.of(cards.saveAndFlush(card));
    }

    /** Replaces title/description; status is set manually when given, kept when omitted. */
    public LearningCardResponse update(long id, LearningCardRequest req) {
        LearningCard card = find(id);
        card.setTitle(req.title().trim());
        card.setDescription(req.description());
        if (req.status() != null) {
            card.setStatus(req.status());
        }
        return flushed(card);
    }

    /** Deletes the card with its milestones and notes. */
    public void delete(long id) {
        cards.delete(find(id));
    }

    /** Adds a milestone (done defaults false; completedAt set when created done) and recomputes status. */
    public LearningCardResponse addMilestone(long cardId, MilestoneRequest req) {
        LearningCard card = find(cardId);
        LearningMilestone m = new LearningMilestone();
        m.setTitle(req.title().trim());
        m.setTargetDate(req.targetDate());
        boolean done = Boolean.TRUE.equals(req.done());
        m.setDone(done);
        m.setCompletedAt(done ? now() : null);
        card.addMilestone(m);
        recompute(card);
        return flushed(card);
    }

    /**
     * Replaces title/targetDate; done is kept when omitted. A done change sets/clears completedAt and
     * recomputes the status; a title/targetDate-only update keeps a manual status (FR-016).
     */
    public LearningCardResponse updateMilestone(long cardId, long milestoneId, MilestoneRequest req) {
        LearningCard card = find(cardId);
        LearningMilestone m = findMilestone(card, milestoneId);
        m.setTitle(req.title().trim());
        m.setTargetDate(req.targetDate());
        if (req.done() != null && req.done() != m.isDone()) {
            m.setDone(req.done());
            m.setCompletedAt(req.done() ? now() : null);
            recompute(card);
        }
        return flushed(card);
    }

    /** Removes the milestone and recomputes status (no milestones left → status unchanged). */
    public LearningCardResponse deleteMilestone(long cardId, long milestoneId) {
        LearningCard card = find(cardId);
        LearningMilestone m = findMilestone(card, milestoneId);
        card.getMilestones().remove(m);
        recompute(card);
        return flushed(card);
    }

    public LearningCardResponse addNote(long cardId, NoteRequest req) {
        LearningCard card = find(cardId);
        LearningNote n = new LearningNote();
        n.setText(req.text());
        n.setCreatedAt(now());
        card.addNote(n);
        return flushed(card);
    }

    public LearningCardResponse deleteNote(long cardId, long noteId) {
        LearningCard card = find(cardId);
        LearningNote n = card.getNotes().stream()
                .filter(x -> x.getId().equals(noteId))
                .findFirst()
                .orElseThrow(() -> new NotFoundException("Note " + noteId + " not found on learning card " + cardId));
        card.getNotes().remove(n);
        return flushed(card);
    }

    /** The card is managed: flushing cascades PERSIST/orphan REMOVE to children, so new ids are assigned. */
    private LearningCardResponse flushed(LearningCard card) {
        cards.flush();
        return LearningCardResponse.of(card);
    }

    private void recompute(LearningCard card) {
        int total = card.getMilestones().size();
        int done = (int) card.getMilestones().stream().filter(LearningMilestone::isDone).count();
        card.setStatus(LearningStatusCalculator.derive(total, done, card.getStatus()));
    }

    private LearningCard find(long id) {
        return cards.findById(id).orElseThrow(() -> NotFoundException.of("Learning card", id));
    }

    private static LearningMilestone findMilestone(LearningCard card, long milestoneId) {
        return card.getMilestones().stream()
                .filter(x -> x.getId().equals(milestoneId))
                .findFirst()
                .orElseThrow(() -> new NotFoundException(
                        "Milestone " + milestoneId + " not found on learning card " + card.getId()));
    }

    private OffsetDateTime now() {
        return OffsetDateTime.now(clock).truncatedTo(ChronoUnit.MICROS);
    }
}
