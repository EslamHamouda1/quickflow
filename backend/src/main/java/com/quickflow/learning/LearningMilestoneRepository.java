package com.quickflow.learning;

import java.time.OffsetDateTime;

import org.springframework.data.jpa.repository.JpaRepository;

public interface LearningMilestoneRepository extends JpaRepository<LearningMilestone, Long> {

    long countByDoneTrue();

    /** Milestones completed at or after {@code since} (e.g. now minus N days, dashboard). */
    long countByDoneTrueAndCompletedAtGreaterThanEqual(OffsetDateTime since);
}
