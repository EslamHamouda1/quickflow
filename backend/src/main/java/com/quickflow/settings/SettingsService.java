package com.quickflow.settings;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.quickflow.settings.dto.SettingsDto;

/** Reads and updates the single settings row; creates defaults on first access. */
@Service
public class SettingsService {

    private final SettingsRepository repository;

    public SettingsService(SettingsRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public SettingsDto get() {
        return SettingsDto.from(loadOrCreate());
    }

    @Transactional
    public SettingsDto update(SettingsDto request) {
        Settings s = loadOrCreate();
        s.setDisplayName(request.displayName().trim());
        s.setInAppNotifications(request.inAppNotifications());
        s.setBrowserNotifications(request.browserNotifications());
        s.setDefaultView(request.defaultView());
        return SettingsDto.from(repository.save(s));
    }

    /** Display name used by the dashboard greeting. */
    @Transactional
    public String displayName() {
        return loadOrCreate().getDisplayName();
    }

    private Settings loadOrCreate() {
        return repository.findById(Settings.SINGLETON_ID)
                .orElseGet(() -> repository.save(new Settings()));
    }
}
