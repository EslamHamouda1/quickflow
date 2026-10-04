package com.quickflow.habit;

import java.time.Clock;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.quickflow.common.BadRequestException;
import com.quickflow.common.ConflictException;
import com.quickflow.common.NotFoundException;
import com.quickflow.habit.dto.HabitCompletionResponse;
import com.quickflow.habit.dto.HabitRequest;
import com.quickflow.habit.dto.HabitResponse;

/** Habit use cases (US2). "Today" and timestamps come from the injected {@link Clock} (research R3). */
@Service
@Transactional
public class HabitService {

    private final HabitRepository habits;
    private final HabitCompletionRepository completions;
    private final Clock clock;

    public HabitService(HabitRepository habits, HabitCompletionRepository completions, Clock clock) {
        this.habits = habits;
        this.completions = completions;
        this.clock = clock;
    }

    public HabitResponse create(HabitRequest req) {
        Habit habit = new Habit();
        habit.setName(req.name().trim());
        habit.setDescription(req.description());
        habit.setFrequency(req.frequency());
        habit.setCreatedAt(now());
        habit.setActive(true);
        return toResponse(habits.save(habit));
    }

    @Transactional(readOnly = true)
    public HabitResponse get(long id) {
        return toResponse(find(id));
    }

    public HabitResponse update(long id, HabitRequest req) {
        Habit habit = find(id);
        habit.setName(req.name().trim());
        habit.setDescription(req.description());
        habit.setFrequency(req.frequency());
        return toResponse(habit);
    }

    public HabitResponse activate(long id) {
        return setActive(id, true);
    }

    /** Deactivated habits keep their completion history. */
    public HabitResponse deactivate(long id) {
        return setActive(id, false);
    }

    /** Deletes the habit with all its completions. */
    public void delete(long id) {
        Habit habit = find(id);
        completions.deleteByHabitId(habit.getId());
        habits.deleteById(habit.getId());
    }

    /** All habits ({@code active == null}) or only active/inactive ones, newest first, with stats. */
    @Transactional(readOnly = true)
    public List<HabitResponse> list(Boolean active) {
        List<Habit> list = active == null
                ? habits.findAllByOrderByCreatedAtDescIdDesc()
                : habits.findByActiveOrderByCreatedAtDescIdDesc(active);
        if (list.isEmpty()) {
            return List.of();
        }
        Map<Long, List<LocalDate>> datesByHabit = completions
                .findByHabitIdIn(list.stream().map(Habit::getId).toList()).stream()
                .collect(Collectors.groupingBy(c -> c.getHabit().getId(),
                        Collectors.mapping(HabitCompletion::getCompletionDate, Collectors.toList())));
        LocalDate today = today();
        return list.stream()
                .map(h -> HabitResponse.of(h, stats(h, datesByHabit.getOrDefault(h.getId(), List.of()), today)))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<HabitCompletionResponse> listCompletions(long id) {
        Habit habit = find(id);
        return completions.findByHabitIdOrderByCompletionDateDesc(habit.getId()).stream()
                .map(HabitCompletionResponse::of)
                .toList();
    }

    /**
     * Records a completion for {@code date} (default today). Future date → 400 on field {@code date};
     * an existing completion for that date → 409 (also when a concurrent request wins the race).
     */
    public HabitResponse complete(long id, LocalDate date) {
        Habit habit = find(id);
        LocalDate today = today();
        LocalDate day = date != null ? date : today;
        if (day.isAfter(today)) {
            throw new BadRequestException("date", "Completion date must not be in the future");
        }
        if (completions.existsByHabitIdAndCompletionDate(habit.getId(), day)) {
            throw duplicate(day);
        }
        HabitCompletion completion = new HabitCompletion();
        completion.setHabit(habit);
        completion.setCompletionDate(day);
        completion.setCreatedAt(now());
        try {
            completions.saveAndFlush(completion);
        } catch (DataIntegrityViolationException ex) {
            throw duplicate(day);
        }
        return toResponse(habit);
    }

    /**
     * Records today's completion when it is missing (plan item side effect, research R6); no-op when the
     * habit is unknown or already completed today. Returns whether a completion was created.
     */
    public boolean completeTodayIfMissing(long id) {
        Habit habit = habits.findById(id).orElse(null);
        LocalDate today = today();
        if (habit == null || completions.existsByHabitIdAndCompletionDate(habit.getId(), today)) {
            return false;
        }
        HabitCompletion completion = new HabitCompletion();
        completion.setHabit(habit);
        completion.setCompletionDate(today);
        completion.setCreatedAt(now());
        completions.save(completion);
        return true;
    }

    /** Removes the completion for {@code date}; 404 when there is none. */
    public HabitResponse uncomplete(long id, LocalDate date) {
        Habit habit = find(id);
        if (completions.deleteByHabitIdAndCompletionDate(habit.getId(), date) == 0) {
            throw new NotFoundException("Habit " + id + " has no completion on " + date);
        }
        return toResponse(habit);
    }

    private HabitResponse setActive(long id, boolean active) {
        Habit habit = find(id);
        habit.setActive(active);
        return toResponse(habit);
    }

    private Habit find(long id) {
        return habits.findById(id).orElseThrow(() -> NotFoundException.of("Habit", id));
    }

    private HabitResponse toResponse(Habit habit) {
        List<LocalDate> dates = completions.findByHabitIdOrderByCompletionDateDesc(habit.getId()).stream()
                .map(HabitCompletion::getCompletionDate)
                .toList();
        return HabitResponse.of(habit, stats(habit, dates, today()));
    }

    private HabitStatsCalculator.HabitStats stats(Habit habit, List<LocalDate> dates, LocalDate today) {
        LocalDate created = habit.getCreatedAt().atZoneSameInstant(clock.getZone()).toLocalDate();
        return HabitStatsCalculator.calculate(habit.getFrequency(), created, dates, today);
    }

    private static ConflictException duplicate(LocalDate day) {
        return new ConflictException("Habit is already completed on " + day);
    }

    private OffsetDateTime now() {
        return OffsetDateTime.now(clock).truncatedTo(ChronoUnit.MICROS);
    }

    private LocalDate today() {
        return LocalDate.now(clock);
    }
}
