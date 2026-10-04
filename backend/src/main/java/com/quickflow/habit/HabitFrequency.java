package com.quickflow.habit;

import io.swagger.v3.oas.annotations.media.Schema;

/** Period of a habit: a calendar date (DAILY) or an ISO week Monday-Sunday (WEEKLY). */
@Schema(name = "HabitFrequency", enumAsRef = true)
public enum HabitFrequency {
    DAILY, WEEKLY
}
