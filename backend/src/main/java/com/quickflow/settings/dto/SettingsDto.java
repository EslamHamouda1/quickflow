package com.quickflow.settings.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import io.swagger.v3.oas.annotations.media.Schema;

import com.quickflow.settings.DefaultView;
import com.quickflow.settings.Settings;

/** Request and response body of the settings operations (contract schema {@code Settings}). */
@Schema(name = "Settings")
public record SettingsDto(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, minLength = 1, maxLength = Settings.DISPLAY_NAME_MAX)
        @NotBlank(message = "Display name is required")
        @Size(min = 1, max = Settings.DISPLAY_NAME_MAX, message = "Display name must be 1-80 characters")
        String displayName,

        @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
        @NotNull(message = "In-app notifications flag is required")
        Boolean inAppNotifications,

        @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
        @NotNull(message = "Browser notifications flag is required")
        Boolean browserNotifications,

        @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
        @NotNull(message = "Default view is required")
        DefaultView defaultView) {

    public static SettingsDto from(Settings s) {
        return new SettingsDto(s.getDisplayName(), s.isInAppNotifications(), s.isBrowserNotifications(),
                s.getDefaultView());
    }
}
