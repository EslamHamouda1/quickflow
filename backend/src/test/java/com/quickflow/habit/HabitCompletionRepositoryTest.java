package com.quickflow.habit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.dao.DataIntegrityViolationException;

/**
 * T048 — {@link HabitCompletionRepository} against the test-profile H2 file: unique (habit, date)
 * enforced (FR-009, US2 AS3) and the derived queries used by {@link HabitService}.
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class HabitCompletionRepositoryTest {

    static final OffsetDateTime NOW = OffsetDateTime.parse("2026-06-17T10:00:00Z");
    static final LocalDate TODAY = LocalDate.of(2026, 6, 17);

    @Autowired
    HabitRepository habits;

    @Autowired
    HabitCompletionRepository completions;

    Habit habit;
    Habit other;

    @BeforeEach
    void setUp() {
        completions.deleteAllInBatch();
        habits.deleteAllInBatch();
        habit = habits.save(newHabit("A"));
        other = habits.save(newHabit("B"));
    }

    private static Habit newHabit(String name) {
        Habit h = new Habit();
        h.setName(name);
        h.setFrequency(HabitFrequency.DAILY);
        h.setCreatedAt(NOW);
        return h;
    }

    private HabitCompletion completion(Habit h, LocalDate date) {
        HabitCompletion c = new HabitCompletion();
        c.setHabit(h);
        c.setCompletionDate(date);
        c.setCreatedAt(NOW);
        return c;
    }

    @Test
    void habitDefaultsActive() {
        assertThat(habits.findById(habit.getId())).get().extracting(Habit::isActive).isEqualTo(true);
    }

    @Test
    void uniqueHabitAndDateEnforced() {
        completions.saveAndFlush(completion(habit, TODAY));
        assertThatThrownBy(() -> completions.saveAndFlush(completion(habit, TODAY)))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void sameDateAllowedForDifferentHabitsAndDifferentDatesForSameHabit() {
        completions.saveAndFlush(completion(habit, TODAY));
        completions.saveAndFlush(completion(other, TODAY));
        completions.saveAndFlush(completion(habit, TODAY.minusDays(1)));
        assertThat(completions.count()).isEqualTo(3);
    }

    @Test
    void existsFindDeleteQueries() {
        completions.saveAndFlush(completion(habit, TODAY.minusDays(2)));
        completions.saveAndFlush(completion(habit, TODAY));
        completions.saveAndFlush(completion(habit, TODAY.minusDays(1)));
        completions.saveAndFlush(completion(other, TODAY));

        assertThat(completions.existsByHabitIdAndCompletionDate(habit.getId(), TODAY)).isTrue();
        assertThat(completions.existsByHabitIdAndCompletionDate(habit.getId(), TODAY.minusDays(5))).isFalse();
        assertThat(completions.findByHabitIdOrderByCompletionDateDesc(habit.getId()))
                .extracting(HabitCompletion::getCompletionDate)
                .containsExactly(TODAY, TODAY.minusDays(1), TODAY.minusDays(2));
        assertThat(completions.findByHabitIdAndCompletionDateBetweenOrderByCompletionDateAsc(habit.getId(),
                TODAY.minusDays(1), TODAY)).extracting(HabitCompletion::getCompletionDate)
                .containsExactly(TODAY.minusDays(1), TODAY);
        assertThat(completions.findByHabitIdIn(List.of(habit.getId(), other.getId()))).hasSize(4);

        assertThat(completions.deleteByHabitIdAndCompletionDate(habit.getId(), TODAY)).isEqualTo(1);
        assertThat(completions.deleteByHabitIdAndCompletionDate(habit.getId(), TODAY)).isZero();
        assertThat(completions.deleteByHabitId(habit.getId())).isEqualTo(2);
        assertThat(completions.findByHabitIdOrderByCompletionDateDesc(other.getId())).hasSize(1);
    }

    @Test
    void habitListOrderedNewestFirstAndActiveFilter() {
        Habit newer = newHabit("C");
        newer.setCreatedAt(NOW.plusMinutes(5));
        newer.setActive(false);
        habits.save(newer);
        assertThat(habits.findAllByOrderByCreatedAtDescIdDesc()).extracting(Habit::getName)
                .containsExactly("C", "B", "A");
        assertThat(habits.findByActiveOrderByCreatedAtDescIdDesc(true)).extracting(Habit::getName)
                .containsExactly("B", "A");
        assertThat(habits.findByActiveOrderByCreatedAtDescIdDesc(false)).extracting(Habit::getName)
                .containsExactly("C");
    }
}
