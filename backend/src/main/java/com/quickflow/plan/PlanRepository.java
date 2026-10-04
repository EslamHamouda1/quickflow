package com.quickflow.plan;

import java.util.List;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface PlanRepository extends JpaRepository<Plan, Long> {

    /** All plans with their items, ordered by priorityOrder asc, then startDateTime asc (then id). */
    @EntityGraph(attributePaths = "items")
    @Query("select p from Plan p order by p.priorityOrder asc, p.startDateTime asc, p.id asc")
    List<Plan> findAllWithItemsOrdered();
}
