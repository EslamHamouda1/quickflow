package com.quickflow.learning.dto;

import java.time.OffsetDateTime;
import java.util.Comparator;
import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;

import com.quickflow.learning.LearningCard;
import com.quickflow.learning.LearningMilestone;
import com.quickflow.learning.LearningNote;
import com.quickflow.learning.LearningStatus;
import com.quickflow.learning.LearningStatusCalculator;

/**
 * API view of a learning card (contract schema {@code LearningCard}): milestones in insertion order,
 * notes newest first, with derived milestone counts and progress.
 */
@Schema(name = "LearningCard")
public record LearningCardResponse(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, format = "int64") Long id,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String title,
        @Schema(types = {"string", "null"}) String description,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) LearningStatus status,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) OffsetDateTime createdAt,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<MilestoneResponse> milestones,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<NoteResponse> notes,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) int milestonesTotal,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) int milestonesDone,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, minimum = "0", maximum = "100") int progressPercent) {

    private static final Comparator<LearningMilestone> INSERTION =
            Comparator.comparing(LearningMilestone::getId, Comparator.nullsLast(Comparator.naturalOrder()));
    private static final Comparator<LearningNote> NEWEST_FIRST =
            Comparator.comparing(LearningNote::getCreatedAt, Comparator.nullsFirst(Comparator.reverseOrder()))
                    .thenComparing(LearningNote::getId, Comparator.nullsFirst(Comparator.reverseOrder()));

    public static LearningCardResponse of(LearningCard c) {
        List<MilestoneResponse> milestones = c.getMilestones().stream()
                .sorted(INSERTION).map(MilestoneResponse::of).toList();
        List<NoteResponse> notes = c.getNotes().stream()
                .sorted(NEWEST_FIRST).map(NoteResponse::of).toList();
        int total = milestones.size();
        int done = (int) milestones.stream().filter(MilestoneResponse::done).count();
        return new LearningCardResponse(c.getId(), c.getTitle(), c.getDescription(), c.getStatus(), c.getCreatedAt(),
                milestones, notes, total, done, LearningStatusCalculator.progressPercent(total, done));
    }
}
