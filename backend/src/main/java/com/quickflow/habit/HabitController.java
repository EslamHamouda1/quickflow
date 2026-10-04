package com.quickflow.habit;

import java.time.LocalDate;
import java.util.List;

import jakarta.validation.Valid;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.ArraySchema;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.quickflow.common.Problem;
import com.quickflow.habit.dto.HabitCompletionRequest;
import com.quickflow.habit.dto.HabitCompletionResponse;
import com.quickflow.habit.dto.HabitRequest;
import com.quickflow.habit.dto.HabitResponse;

/** Habits operations of contracts/openapi.yaml (10 operations). */
@RestController
@RequestMapping(path = "/api/habits", produces = MediaType.APPLICATION_JSON_VALUE)
@Tag(name = "Habits")
public class HabitController {

    private static final String JSON = MediaType.APPLICATION_JSON_VALUE;
    private static final String PROBLEM = MediaType.APPLICATION_PROBLEM_JSON_VALUE;

    private final HabitService service;

    public HabitController(HabitService service) {
        this.service = service;
    }

    @GetMapping
    @Operation(operationId = "listHabits")
    @ApiResponse(responseCode = "200", description = "Habits with stats, newest first",
            content = @Content(mediaType = JSON,
                    array = @ArraySchema(schema = @Schema(implementation = HabitResponse.class))))
    @ApiResponse(responseCode = "400", description = "Validation error",
            content = @Content(mediaType = PROBLEM, schema = @Schema(implementation = Problem.class)))
    public List<HabitResponse> listHabits(
            @Parameter(description = "Omit for all habits") @RequestParam(required = false) Boolean active) {
        return service.list(active);
    }

    @PostMapping(consumes = JSON)
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(operationId = "createHabit")
    @ApiResponse(responseCode = "201", description = "Created",
            content = @Content(mediaType = JSON, schema = @Schema(implementation = HabitResponse.class)))
    @ApiResponse(responseCode = "400", description = "Validation error",
            content = @Content(mediaType = PROBLEM, schema = @Schema(implementation = Problem.class)))
    public HabitResponse createHabit(@Valid @RequestBody HabitRequest request) {
        return service.create(request);
    }

    @GetMapping("/{id}")
    @Operation(operationId = "getHabit")
    @ApiResponse(responseCode = "200", description = "The habit",
            content = @Content(mediaType = JSON, schema = @Schema(implementation = HabitResponse.class)))
    @ApiResponse(responseCode = "400", description = "Validation error",
            content = @Content(mediaType = PROBLEM, schema = @Schema(implementation = Problem.class)))
    @ApiResponse(responseCode = "404", description = "Resource not found",
            content = @Content(mediaType = PROBLEM, schema = @Schema(implementation = Problem.class)))
    public HabitResponse getHabit(@PathVariable long id) {
        return service.get(id);
    }

    @PutMapping(path = "/{id}", consumes = JSON)
    @Operation(operationId = "updateHabit")
    @ApiResponse(responseCode = "200", description = "Updated",
            content = @Content(mediaType = JSON, schema = @Schema(implementation = HabitResponse.class)))
    @ApiResponse(responseCode = "400", description = "Validation error",
            content = @Content(mediaType = PROBLEM, schema = @Schema(implementation = Problem.class)))
    @ApiResponse(responseCode = "404", description = "Resource not found",
            content = @Content(mediaType = PROBLEM, schema = @Schema(implementation = Problem.class)))
    public HabitResponse updateHabit(@PathVariable long id, @Valid @RequestBody HabitRequest request) {
        return service.update(id, request);
    }

    // Body-less 204: also produce problem+json so "Accept: application/problem+json" matches (see BUG-P2-001).
    @DeleteMapping(path = "/{id}", produces = {JSON, PROBLEM})
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(operationId = "deleteHabit")
    @ApiResponse(responseCode = "204", description = "Deleted with its completions")
    @ApiResponse(responseCode = "400", description = "Validation error",
            content = @Content(mediaType = PROBLEM, schema = @Schema(implementation = Problem.class)))
    @ApiResponse(responseCode = "404", description = "Resource not found",
            content = @Content(mediaType = PROBLEM, schema = @Schema(implementation = Problem.class)))
    public void deleteHabit(@PathVariable long id) {
        service.delete(id);
    }

    @PostMapping("/{id}/deactivate")
    @Operation(operationId = "deactivateHabit")
    @ApiResponse(responseCode = "200", description = "Deactivated",
            content = @Content(mediaType = JSON, schema = @Schema(implementation = HabitResponse.class)))
    @ApiResponse(responseCode = "400", description = "Validation error",
            content = @Content(mediaType = PROBLEM, schema = @Schema(implementation = Problem.class)))
    @ApiResponse(responseCode = "404", description = "Resource not found",
            content = @Content(mediaType = PROBLEM, schema = @Schema(implementation = Problem.class)))
    public HabitResponse deactivateHabit(@PathVariable long id) {
        return service.deactivate(id);
    }

    @PostMapping("/{id}/activate")
    @Operation(operationId = "activateHabit")
    @ApiResponse(responseCode = "200", description = "Activated",
            content = @Content(mediaType = JSON, schema = @Schema(implementation = HabitResponse.class)))
    @ApiResponse(responseCode = "400", description = "Validation error",
            content = @Content(mediaType = PROBLEM, schema = @Schema(implementation = Problem.class)))
    @ApiResponse(responseCode = "404", description = "Resource not found",
            content = @Content(mediaType = PROBLEM, schema = @Schema(implementation = Problem.class)))
    public HabitResponse activateHabit(@PathVariable long id) {
        return service.activate(id);
    }

    @GetMapping("/{id}/completions")
    @Operation(operationId = "listHabitCompletions")
    @ApiResponse(responseCode = "200", description = "Completions, newest first",
            content = @Content(mediaType = JSON,
                    array = @ArraySchema(schema = @Schema(implementation = HabitCompletionResponse.class))))
    @ApiResponse(responseCode = "400", description = "Validation error",
            content = @Content(mediaType = PROBLEM, schema = @Schema(implementation = Problem.class)))
    @ApiResponse(responseCode = "404", description = "Resource not found",
            content = @Content(mediaType = PROBLEM, schema = @Schema(implementation = Problem.class)))
    public List<HabitCompletionResponse> listHabitCompletions(@PathVariable long id) {
        return service.listCompletions(id);
    }

    // No "consumes": the body is optional, so a POST without Content-Type must still match.
    @PostMapping("/{id}/completions")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(operationId = "completeHabit",
            summary = "Record a completion (default today); one per habit per date",
            requestBody = @io.swagger.v3.oas.annotations.parameters.RequestBody(required = false,
                    content = @Content(mediaType = JSON,
                            schema = @Schema(implementation = HabitCompletionRequest.class))))
    @ApiResponse(responseCode = "201", description = "Recorded; returns the habit with updated stats",
            content = @Content(mediaType = JSON, schema = @Schema(implementation = HabitResponse.class)))
    @ApiResponse(responseCode = "400", description = "Validation error",
            content = @Content(mediaType = PROBLEM, schema = @Schema(implementation = Problem.class)))
    @ApiResponse(responseCode = "404", description = "Resource not found",
            content = @Content(mediaType = PROBLEM, schema = @Schema(implementation = Problem.class)))
    @ApiResponse(responseCode = "409", description = "Conflict (e.g. duplicate habit completion)",
            content = @Content(mediaType = PROBLEM, schema = @Schema(implementation = Problem.class)))
    public HabitResponse completeHabit(@PathVariable long id,
                                       @RequestBody(required = false) HabitCompletionRequest request) {
        return service.complete(id, request != null ? request.date() : null);
    }

    @DeleteMapping("/{id}/completions/{date}")
    @Operation(operationId = "uncompleteHabit", summary = "Remove the completion for a date")
    @ApiResponse(responseCode = "200", description = "Removed; returns the habit with updated stats",
            content = @Content(mediaType = JSON, schema = @Schema(implementation = HabitResponse.class)))
    @ApiResponse(responseCode = "400", description = "Validation error",
            content = @Content(mediaType = PROBLEM, schema = @Schema(implementation = Problem.class)))
    @ApiResponse(responseCode = "404", description = "Resource not found",
            content = @Content(mediaType = PROBLEM, schema = @Schema(implementation = Problem.class)))
    public HabitResponse uncompleteHabit(@PathVariable long id,
                                         @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return service.uncomplete(id, date);
    }
}
