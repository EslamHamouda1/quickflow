package com.quickflow.habit;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface HabitRepository extends JpaRepository<Habit, Long> {

    /** All habits, newest first. */
    List<Habit> findAllByOrderByCreatedAtDescIdDesc();

    /** Active or inactive habits, newest first. */
    List<Habit> findByActiveOrderByCreatedAtDescIdDesc(boolean active);
}
