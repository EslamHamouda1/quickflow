package com.quickflow.settings;

import io.swagger.v3.oas.annotations.media.Schema;

/** Landing page of the app (contract schema {@code DefaultView}). */
@Schema(name = "DefaultView", enumAsRef = true)
public enum DefaultView {
    DASHBOARD, TASKS, HABITS, LEARNING, PLANS
}
