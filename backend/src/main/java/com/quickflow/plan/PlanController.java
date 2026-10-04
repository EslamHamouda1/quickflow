package com.quickflow.plan;

import java.util.List;

import jakarta.validation.Valid;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.ArraySchema;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;

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
import com.quickflow.plan.dto.PlanItemUpdateRequest;
import com.quickflow.plan.dto.PlanRequest;
import com.quickflow.plan.dto.PlanResponse;

/** Plans operations of contracts/openapi.yaml (6 operations). */
@RestController
@RequestMapping(path = "/api/plans", produces = MediaType.APPLICATION_JSON_VALUE)
@Tag(name = "Plans")
public class PlanController {

    private static final String JSON = MediaType.APPLICATION_JSON_VALUE;
    private static final String PROBLEM = MediaType.APPLICATION_PROBLEM_JSON_VALUE;

    private final PlanService service;

    public PlanController(PlanService service) {
        this.service = service;
    }

    @GetMapping
    @Operation(operationId = "listPlans", summary = "All plans with derived status, progress and rest time")
    @ApiResponse(responseCode = "200", description = "Plans ordered by priorityOrder asc, then startDateTime asc",
            content = @Content(mediaType = JSON,
                    array = @ArraySchema(schema = @Schema(implementation = PlanResponse.class))))
    @ApiResponse(responseCode = "400", description = "Validation error",
            content = @Content(mediaType = PROBLEM, schema = @Schema(implementation = Problem.class)))
    public List<PlanResponse> listPlans(
            @Parameter(name = "status", required = false) @RequestParam(required = false) PlanStatus status) {
        return service.list(status);
    }

    @PostMapping(consumes = JSON)
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(operationId = "createPlan")
    @ApiResponse(responseCode = "201", description = "Created",
            content = @Content(mediaType = JSON, schema = @Schema(implementation = PlanResponse.class)))
    @ApiResponse(responseCode = "400", description = "Validation error",
            content = @Content(mediaType = PROBLEM, schema = @Schema(implementation = Problem.class)))
    public PlanResponse createPlan(@Valid @RequestBody PlanRequest request) {
        return service.create(request);
    }

    @GetMapping("/{id}")
    @Operation(operationId = "getPlan")
    @ApiResponse(responseCode = "200", description = "The plan",
            content = @Content(mediaType = JSON, schema = @Schema(implementation = PlanResponse.class)))
    @ApiResponse(responseCode = "400", description = "Validation error",
            content = @Content(mediaType = PROBLEM, schema = @Schema(implementation = Problem.class)))
    @ApiResponse(responseCode = "404", description = "Resource not found",
            content = @Content(mediaType = PROBLEM, schema = @Schema(implementation = Problem.class)))
    public PlanResponse getPlan(@PathVariable long id) {
        return service.get(id);
    }

    // Body-less 204: also produce problem+json so "Accept: application/problem+json" matches (see BUG-P2-001).
    @DeleteMapping(path = "/{id}", produces = {JSON, PROBLEM})
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(operationId = "deletePlan")
    @ApiResponse(responseCode = "204", description = "Deleted with its items; sources untouched")
    @ApiResponse(responseCode = "400", description = "Validation error",
            content = @Content(mediaType = PROBLEM, schema = @Schema(implementation = Problem.class)))
    @ApiResponse(responseCode = "404", description = "Resource not found",
            content = @Content(mediaType = PROBLEM, schema = @Schema(implementation = Problem.class)))
    public void deletePlan(@PathVariable long id) {
        service.delete(id);
    }

    @PutMapping(path = "/{id}/items/{itemId}", consumes = JSON)
    @Operation(operationId = "setPlanItemDone",
            summary = "Mark a plan item done / not done (task/habit side effects per business rule 13)")
    @ApiResponse(responseCode = "200", description = "Updated; returns the plan",
            content = @Content(mediaType = JSON, schema = @Schema(implementation = PlanResponse.class)))
    @ApiResponse(responseCode = "400", description = "Validation error",
            content = @Content(mediaType = PROBLEM, schema = @Schema(implementation = Problem.class)))
    @ApiResponse(responseCode = "404", description = "Resource not found",
            content = @Content(mediaType = PROBLEM, schema = @Schema(implementation = Problem.class)))
    public PlanResponse setPlanItemDone(@PathVariable long id, @PathVariable long itemId,
                                        @Valid @RequestBody PlanItemUpdateRequest request) {
        return service.setItemDone(id, itemId, request.done());
    }

    @PostMapping("/{id}/start-notification")
    @Operation(operationId = "acknowledgePlanStart",
            summary = "Record that the start notification was shown (idempotent)")
    @ApiResponse(responseCode = "200", description = "Acknowledged; returns the plan",
            content = @Content(mediaType = JSON, schema = @Schema(implementation = PlanResponse.class)))
    @ApiResponse(responseCode = "400", description = "Validation error",
            content = @Content(mediaType = PROBLEM, schema = @Schema(implementation = Problem.class)))
    @ApiResponse(responseCode = "404", description = "Resource not found",
            content = @Content(mediaType = PROBLEM, schema = @Schema(implementation = Problem.class)))
    public PlanResponse acknowledgePlanStart(@PathVariable long id) {
        return service.acknowledgeStart(id);
    }
}
