package com.quickflow.settings;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** User preferences (data-model: Settings). Single row with id = {@link #SINGLETON_ID}. */
@Entity
@Table(name = "settings")
public class Settings {

    public static final long SINGLETON_ID = 1L;
    public static final int DISPLAY_NAME_MAX = 80;
    public static final String DEFAULT_DISPLAY_NAME = "Friend";

    @Id
    private Long id = SINGLETON_ID;

    @Column(name = "display_name", nullable = false, length = DISPLAY_NAME_MAX)
    private String displayName = DEFAULT_DISPLAY_NAME;

    @Column(name = "in_app_notifications", nullable = false)
    private boolean inAppNotifications = true;

    @Column(name = "browser_notifications", nullable = false)
    private boolean browserNotifications = false;

    @Enumerated(EnumType.STRING)
    @Column(name = "default_view", nullable = false, length = 20)
    private DefaultView defaultView = DefaultView.DASHBOARD;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getDisplayName() { return displayName; }
    public void setDisplayName(String displayName) { this.displayName = displayName; }
    public boolean isInAppNotifications() { return inAppNotifications; }
    public void setInAppNotifications(boolean inAppNotifications) { this.inAppNotifications = inAppNotifications; }
    public boolean isBrowserNotifications() { return browserNotifications; }
    public void setBrowserNotifications(boolean browserNotifications) { this.browserNotifications = browserNotifications; }
    public DefaultView getDefaultView() { return defaultView; }
    public void setDefaultView(DefaultView defaultView) { this.defaultView = defaultView; }
}
