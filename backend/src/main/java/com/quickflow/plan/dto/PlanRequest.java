package com.quickflow.plan.dto;

import java.time.OffsetDateTime;
import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import io.swagger.v3.oas.annotations.media.ArraySchema;
import io.swagger.v3.oas.annotations.media.Schema;

import com.quickflow.plan.Plan;

/** Body of create plan. end > start and source existence are checked by PlanService. */
@Schema(name = "PlanRequest")
public record PlanRequest(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, minLength = 1, maxLength = Plan.TITLE_MAX)
        @NotBlank(message = "Title is required")
        @Size(min = 1, max = Plan.TITLE_MAX, message = "Title must be 1-200 characters")
        String title,

        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, minimum = "1")
        @NotNull(message = "Estimated duration is required")
        @Min(value = 1, message = "Estimated duration must be at least 1 minute")
        Integer estimatedDurationMinutes,

        @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
        @NotNull(message = "Start date-time is required")
        OffsetDateTime startDateTime,

        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Must be after startDateTime")
        @NotNull(message = "End date-time is required")
        OffsetDateTime endDateTime,

        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, minimum = "1")
        @NotNull(message = "Priority order is required")
        @Min(value = 1, message = "Priority order must be at least 1")
        Integer priorityOrder,

        @ArraySchema(minItems = 1, schema = @Schema(implementation = PlanItemSource.class),
                arraySchema = @Schema(requiredMode = Schema.RequiredMode.REQUIRED))
        @NotEmpty(message = "Select at least one item")
        List<@NotNull(message = "Item must not be null") @Valid PlanItemSource> items) {
}
