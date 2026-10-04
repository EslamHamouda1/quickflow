package com.quickflow.settings;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.context.annotation.Import;

import jakarta.persistence.EntityManager;

import com.quickflow.settings.dto.SettingsDto;

/**
 * T089 — {@link SettingsService} against the real repository (test profile H2): defaults created once,
 * update persists and trims. Traces US6 AS2, FR-029.
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import(SettingsService.class)
class SettingsServiceTest {

    @Autowired
    SettingsService service;

    @Autowired
    SettingsRepository repository;

    @Autowired
    EntityManager em;

    @Test
    void getCreatesDefaultsOnFirstCall() {
        assertThat(repository.count()).isZero();
        SettingsDto s = service.get();
        assertThat(s).isEqualTo(new SettingsDto("Friend", true, false, DefaultView.DASHBOARD));
        assertThat(repository.count()).isEqualTo(1);
        assertThat(repository.findById(Settings.SINGLETON_ID)).isPresent();
    }

    @Test
    void defaultsCreatedOnlyOnce() {
        service.get();
        service.get();
        service.displayName();
        em.flush();
        em.clear();
        service.get();
        assertThat(repository.count()).isEqualTo(1);
    }

    @Test
    void getReturnsExistingRowWithoutOverwriting() {
        Settings existing = new Settings();
        existing.setDisplayName("Sara");
        existing.setDefaultView(DefaultView.PLANS);
        repository.saveAndFlush(existing);
        em.clear();
        assertThat(service.get().displayName()).isEqualTo("Sara");
        assertThat(service.get().defaultView()).isEqualTo(DefaultView.PLANS);
        assertThat(repository.count()).isEqualTo(1);
    }

    @Test
    void updatePersistsAllFieldsAndTrimsName() {
        SettingsDto saved = service.update(new SettingsDto("  Omar  ", false, true, DefaultView.TASKS));
        assertThat(saved).isEqualTo(new SettingsDto("Omar", false, true, DefaultView.TASKS));
        em.flush();
        em.clear();
        Settings row = repository.findById(Settings.SINGLETON_ID).orElseThrow();
        assertThat(row.getDisplayName()).isEqualTo("Omar");
        assertThat(row.isInAppNotifications()).isFalse();
        assertThat(row.isBrowserNotifications()).isTrue();
        assertThat(row.getDefaultView()).isEqualTo(DefaultView.TASKS);
        assertThat(service.get()).isEqualTo(saved);
        assertThat(repository.count()).isEqualTo(1);
    }

    @Test
    void updateOverwritesPreviousUpdateAndDisplayNameReflectsIt() {
        service.update(new SettingsDto("A", false, false, DefaultView.HABITS));
        service.update(new SettingsDto("B", true, true, DefaultView.LEARNING));
        assertThat(service.displayName()).isEqualTo("B");
        assertThat(service.get()).isEqualTo(new SettingsDto("B", true, true, DefaultView.LEARNING));
        assertThat(repository.count()).isEqualTo(1);
    }

    @Test
    void displayNameDefaultsToFriend() {
        assertThat(service.displayName()).isEqualTo("Friend");
    }
}
