package com.quickflow.habit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doReturn;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

import com.quickflow.common.BadRequestException;
import com.quickflow.common.ConflictException;
import com.quickflow.common.NotFoundException;
import com.quickflow.habit.dto.HabitCompletionResponse;
import com.quickflow.habit.dto.HabitRequest;
import com.quickflow.habit.dto.HabitResponse;

/**
 * T047 — {@link HabitService} with a fixed {@link java.time.Clock} (today = Wed 2026-06-17 UTC) against
 * the real repositories (test profile H2 file). Traces US2 AS1-AS6, FR-007..FR-011.
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import({HabitService.class, HabitServiceTest.ClockConfig.class})
class HabitServiceTest {

    static final Instant NOW = Instant.parse("2026-06-17T10:00:00Z");
    static final LocalDate TODAY = LocalDate.of(2026, 6, 17);

    @TestConfiguration
    static class ClockConfig {
        @Bean
        MutableClock clock() {
            return new MutableClock(NOW);
        }
    }

    @Autowired
    HabitService service;

    @Autowired
    HabitRepository habits;

    @MockitoSpyBean
    HabitCompletionRepository completions;

    @Autowired
    MutableClock clock;

    @BeforeEach
    void reset() {
        completions.deleteAllInBatch();
        habits.deleteAllInBatch();
        clock.set(NOW);
    }

    private static HabitRequest req(String name, HabitFrequency f) {
        return new HabitRequest(name, null, f);
    }

    private HabitResponse daily(String name) {
        return service.create(req(name, HabitFrequency.DAILY));
    }

    // --- create / update (AS1)

    @Test
    void createTrimsNameAndDefaultsActiveWithZeroStats() {
        HabitResponse h = service.create(new HabitRequest("  Read  ", "desc", HabitFrequency.WEEKLY));
        assertThat(h.id()).isNotNull();
        assertThat(h.name()).isEqualTo("Read");
        assertThat(h.description()).isEqualTo("desc");
        assertThat(h.frequency()).isEqualTo(HabitFrequency.WEEKLY);
        assertThat(h.active()).isTrue();
        assertThat(h.createdAt()).isEqualTo(OffsetDateTime.ofInstant(NOW, ZoneOffset.UTC));
        assertThat(h.completedToday()).isFalse();
        assertThat(h.doneForCurrentPeriod()).isFalse();
        assertThat(h.currentStreak()).isZero();
        assertThat(h.completionRate()).isZero();
        assertThat(h.lastCompletedDate()).isNull();
    }

    @Test
    void updateChangesFieldsAndKeepsActiveFlag() {
        HabitResponse h = daily("Walk");
        service.deactivate(h.id());
        HabitResponse u = service.update(h.id(), new HabitRequest(" Run ", "far", HabitFrequency.WEEKLY));
        assertThat(u.name()).isEqualTo("Run");
        assertThat(u.description()).isEqualTo("far");
        assertThat(u.frequency()).isEqualTo(HabitFrequency.WEEKLY);
        assertThat(u.active()).isFalse();
        assertThat(service.get(h.id()).name()).isEqualTo("Run");
    }

    @Test
    void unknownIdReturns404ForEveryOperation() {
        assertThatThrownBy(() -> service.get(999)).isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.update(999, req("x", HabitFrequency.DAILY)))
                .isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.activate(999)).isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.deactivate(999)).isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.delete(999)).isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.listCompletions(999)).isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.complete(999, null)).isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.uncomplete(999, TODAY)).isInstanceOf(NotFoundException.class);
    }

    // --- complete (AS2, AS3)

    @Test
    void completeDefaultsToTodayAndUpdatesStats() {
        HabitResponse h = daily("Water");
        HabitResponse c = service.complete(h.id(), null);
        assertThat(c.completedToday()).isTrue();
        assertThat(c.doneForCurrentPeriod()).isTrue();
        assertThat(c.currentStreak()).isEqualTo(1);
        assertThat(c.completionRate()).isEqualTo(100);
        assertThat(c.lastCompletedDate()).isEqualTo(TODAY);
        List<HabitCompletionResponse> list = service.listCompletions(h.id());
        assertThat(list).hasSize(1);
        assertThat(list.get(0).completionDate()).isEqualTo(TODAY);
    }

    @Test
    void duplicateCompletionReturns409AndKeepsOneRecord() {
        HabitResponse h = daily("Water");
        service.complete(h.id(), null);
        assertThatThrownBy(() -> service.complete(h.id(), null))
                .isInstanceOf(ConflictException.class).hasMessageContaining(TODAY.toString());
        assertThatThrownBy(() -> service.complete(h.id(), TODAY)).isInstanceOf(ConflictException.class);
        assertThat(service.listCompletions(h.id())).hasSize(1);
    }

    @Test
    void uniqueConstraintRaceIsMappedTo409() {
        HabitResponse h = daily("Water");
        service.complete(h.id(), null);
        // simulate a concurrent request that passed the pre-check: the unique constraint must still win
        doReturn(false).when(completions).existsByHabitIdAndCompletionDate(anyLong(), any());
        assertThatThrownBy(() -> service.complete(h.id(), null)).isInstanceOf(ConflictException.class);
    }

    @Test
    void futureDateReturns400OnDateField() {
        HabitResponse h = daily("Water");
        assertThatThrownBy(() -> service.complete(h.id(), TODAY.plusDays(1)))
                .isInstanceOfSatisfying(BadRequestException.class, e -> assertThat(e.getField()).isEqualTo("date"));
        assertThat(service.listCompletions(h.id())).isEmpty();
    }

    @Test
    void pastDateIsRecordedAndListedNewestFirst() {
        HabitResponse h = daily("Water");
        service.complete(h.id(), TODAY.minusDays(2));
        service.complete(h.id(), TODAY.minusDays(1));
        HabitResponse c = service.complete(h.id(), null);
        assertThat(c.currentStreak()).isEqualTo(3);
        assertThat(service.listCompletions(h.id())).extracting(HabitCompletionResponse::completionDate)
                .containsExactly(TODAY, TODAY.minusDays(1), TODAY.minusDays(2));
    }

    @Test
    void todayFollowsTheClock() {
        HabitResponse h = daily("Water");
        service.complete(h.id(), null);
        clock.advance(Duration.ofDays(1));
        HabitResponse next = service.get(h.id());
        assertThat(next.completedToday()).isFalse();
        assertThat(next.currentStreak()).isEqualTo(1); // yesterday still counts
        assertThat(service.complete(h.id(), null).currentStreak()).isEqualTo(2);
    }

    @Test
    void weeklyCompletionEarlierInWeekIsDoneForCurrentPeriod() {
        HabitResponse h = service.create(req("Long run", HabitFrequency.WEEKLY));
        clock.advance(Duration.ofDays(2)); // Friday
        HabitResponse c = service.complete(h.id(), TODAY);
        assertThat(c.completedToday()).isFalse();
        assertThat(c.doneForCurrentPeriod()).isTrue();
        assertThat(c.currentStreak()).isEqualTo(1);
    }

    // --- uncomplete (AS4)

    @Test
    void uncompleteRemovesTheRecord() {
        HabitResponse h = daily("Water");
        service.complete(h.id(), null);
        HabitResponse u = service.uncomplete(h.id(), TODAY);
        assertThat(u.completedToday()).isFalse();
        assertThat(u.currentStreak()).isZero();
        assertThat(u.lastCompletedDate()).isNull();
        assertThat(service.listCompletions(h.id())).isEmpty();
    }

    @Test
    void uncompleteMissingReturns404() {
        HabitResponse h = daily("Water");
        assertThatThrownBy(() -> service.uncomplete(h.id(), TODAY))
                .isInstanceOf(NotFoundException.class).hasMessageContaining(TODAY.toString());
    }

    // --- deactivate / activate / delete (AS6)

    @Test
    void deactivateKeepsHistoryAndActivateRestores() {
        HabitResponse h = daily("Water");
        service.complete(h.id(), TODAY.minusDays(1));
        service.complete(h.id(), null);
        HabitResponse d = service.deactivate(h.id());
        assertThat(d.active()).isFalse();
        assertThat(d.currentStreak()).isEqualTo(2);
        assertThat(service.listCompletions(h.id())).hasSize(2);
        assertThat(service.list(true)).isEmpty();
        assertThat(service.list(false)).extracting(HabitResponse::id).containsExactly(h.id());
        HabitResponse a = service.activate(h.id());
        assertThat(a.active()).isTrue();
        assertThat(service.list(true)).extracting(HabitResponse::id).containsExactly(h.id());
        assertThat(service.listCompletions(h.id())).hasSize(2);
    }

    @Test
    void deleteRemovesHabitAndCompletions() {
        HabitResponse h = daily("Water");
        HabitResponse other = daily("Other");
        service.complete(h.id(), null);
        service.complete(other.id(), null);
        service.delete(h.id());
        assertThat(habits.existsById(h.id())).isFalse();
        assertThat(completions.findByHabitIdOrderByCompletionDateDesc(h.id())).isEmpty();
        assertThat(completions.findByHabitIdOrderByCompletionDateDesc(other.id())).hasSize(1);
        assertThatThrownBy(() -> service.get(h.id())).isInstanceOf(NotFoundException.class);
    }

    // --- list

    @Test
    void listNewestFirstWithStatsAndActiveFilter() {
        HabitResponse a = daily("A");
        clock.advance(Duration.ofMinutes(1));
        HabitResponse b = daily("B");
        clock.advance(Duration.ofMinutes(1));
        HabitResponse c = daily("C");
        service.complete(b.id(), null);
        service.deactivate(c.id());
        List<HabitResponse> all = service.list(null);
        assertThat(all).extracting(HabitResponse::name).containsExactly("C", "B", "A");
        assertThat(all.get(1).completedToday()).isTrue();
        assertThat(all.get(2).completedToday()).isFalse();
        assertThat(service.list(true)).extracting(HabitResponse::id).containsExactly(b.id(), a.id());
        assertThat(service.list(false)).extracting(HabitResponse::id).containsExactly(c.id());
    }

    @Test
    void listEmpty() {
        assertThat(service.list(null)).isEmpty();
    }
}
