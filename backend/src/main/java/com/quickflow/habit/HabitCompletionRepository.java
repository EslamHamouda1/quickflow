package com.quickflow.habit;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface HabitCompletionRepository extends JpaRepository<HabitCompletion, Long> {

    boolean existsByHabitIdAndCompletionDate(Long habitId, LocalDate completionDate);

    /** Completions of a habit, newest date first. */
    List<HabitCompletion> findByHabitIdOrderByCompletionDateDesc(Long habitId);

    /** Completions of a habit with {@code from <= completionDate <= to}, oldest first. */
    List<HabitCompletion> findByHabitIdAndCompletionDateBetweenOrderByCompletionDateAsc(Long habitId, LocalDate from,
                                                                                         LocalDate to);

    /** Completions of several habits (stats of a habit list in one query). */
    List<HabitCompletion> findByHabitIdIn(Collection<Long> habitIds);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("delete from HabitCompletion c where c.habit.id = :habitId and c.completionDate = :date")
    int deleteByHabitIdAndCompletionDate(@Param("habitId") Long habitId, @Param("date") LocalDate date);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("delete from HabitCompletion c where c.habit.id = :habitId")
    int deleteByHabitId(@Param("habitId") Long habitId);
}
