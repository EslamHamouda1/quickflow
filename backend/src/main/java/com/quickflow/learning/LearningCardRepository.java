package com.quickflow.learning;

import java.util.List;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface LearningCardRepository extends JpaRepository<LearningCard, Long> {

    /** All cards newest first; milestones are fetched with the cards, notes by batch on access. */
    @EntityGraph(attributePaths = "milestones")
    @Query("select c from LearningCard c order by c.createdAt desc, c.id desc")
    List<LearningCard> findAllWithMilestonesNewestFirst();

    long countByStatus(LearningStatus status);
}
