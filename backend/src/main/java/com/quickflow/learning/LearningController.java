package com.quickflow.learning;

import java.util.List;

import jakarta.validation.Valid;

import io.swagger.v3.oas.annotations.Operation;
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
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.quickflow.common.Problem;
import com.quickflow.learning.dto.LearningCardRequest;
import com.quickflow.learning.dto.LearningCardResponse;
import com.quickflow.learning.dto.MilestoneRequest;
import com.quickflow.learning.dto.NoteRequest;

/** Learning operations of contracts/openapi.yaml (10 operations). */
@RestController
@RequestMapping(path = "/api/learning-cards", produces = MediaType.APPLICATION_JSON_VALUE)
@Tag(name = "Learning")
public class LearningController {

    private static final String JSON = MediaType.APPLICATION_JSON_VALUE;
    private static final String PROBLEM = MediaType.APPLICATION_PROBLEM_JSON_VALUE;

    private final LearningService service;

    public LearningController(LearningService service) {
        this.service = service;
    }

    @GetMapping
    @Operation(operationId = "listLearningCards")
    @ApiResponse(responseCode = "200", description = "Cards with milestones and notes, newest first",
            content = @Content(mediaType = JSON,
                    array = @ArraySchema(schema = @Schema(implementation = LearningCardResponse.class))))
    public List<LearningCardResponse> listLearningCards() {
        return service.list();
    }

    @PostMapping(consumes = JSON)
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(operationId = "createLearningCard")
    @ApiResponse(responseCode = "201", description = "Created",
            content = @Content(mediaType = JSON, schema = @Schema(implementation = LearningCardResponse.class)))
    @ApiResponse(responseCode = "400", description = "Validation error",
            content = @Content(mediaType = PROBLEM, schema = @Schema(implementation = Problem.class)))
    public LearningCardResponse createLearningCard(@Valid @RequestBody LearningCardRequest request) {
        return service.create(request);
    }

    @GetMapping("/{id}")
    @Operation(operationId = "getLearningCard")
    @ApiResponse(responseCode = "200", description = "The card",
            content = @Content(mediaType = JSON, schema = @Schema(implementation = LearningCardResponse.class)))
    @ApiResponse(responseCode = "400", description = "Validation error",
            content = @Content(mediaType = PROBLEM, schema = @Schema(implementation = Problem.class)))
    @ApiResponse(responseCode = "404", description = "Resource not found",
            content = @Content(mediaType = PROBLEM, schema = @Schema(implementation = Problem.class)))
    public LearningCardResponse getLearningCard(@PathVariable long id) {
        return service.get(id);
    }

    @PutMapping(path = "/{id}", consumes = JSON)
    @Operation(operationId = "updateLearningCard")
    @ApiResponse(responseCode = "200", description = "Updated",
            content = @Content(mediaType = JSON, schema = @Schema(implementation = LearningCardResponse.class)))
    @ApiResponse(responseCode = "400", description = "Validation error",
            content = @Content(mediaType = PROBLEM, schema = @Schema(implementation = Problem.class)))
    @ApiResponse(responseCode = "404", description = "Resource not found",
            content = @Content(mediaType = PROBLEM, schema = @Schema(implementation = Problem.class)))
    public LearningCardResponse updateLearningCard(@PathVariable long id,
                                                   @Valid @RequestBody LearningCardRequest request) {
        return service.update(id, request);
    }

    // Body-less 204: also produce problem+json so "Accept: application/problem+json" matches (see BUG-P2-001).
    @DeleteMapping(path = "/{id}", produces = {JSON, PROBLEM})
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(operationId = "deleteLearningCard")
    @ApiResponse(responseCode = "204", description = "Deleted with milestones and notes")
    @ApiResponse(responseCode = "400", description = "Validation error",
            content = @Content(mediaType = PROBLEM, schema = @Schema(implementation = Problem.class)))
    @ApiResponse(responseCode = "404", description = "Resource not found",
            content = @Content(mediaType = PROBLEM, schema = @Schema(implementation = Problem.class)))
    public void deleteLearningCard(@PathVariable long id) {
        service.delete(id);
    }

    @PostMapping(path = "/{id}/milestones", consumes = JSON)
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(operationId = "addMilestone")
    @ApiResponse(responseCode = "201", description = "Added; returns the updated card",
            content = @Content(mediaType = JSON, schema = @Schema(implementation = LearningCardResponse.class)))
    @ApiResponse(responseCode = "400", description = "Validation error",
            content = @Content(mediaType = PROBLEM, schema = @Schema(implementation = Problem.class)))
    @ApiResponse(responseCode = "404", description = "Resource not found",
            content = @Content(mediaType = PROBLEM, schema = @Schema(implementation = Problem.class)))
    public LearningCardResponse addMilestone(@PathVariable long id, @Valid @RequestBody MilestoneRequest request) {
        return service.addMilestone(id, request);
    }

    @PutMapping(path = "/{id}/milestones/{milestoneId}", consumes = JSON)
    @Operation(operationId = "updateMilestone")
    @ApiResponse(responseCode = "200", description = "Updated; returns the updated card",
            content = @Content(mediaType = JSON, schema = @Schema(implementation = LearningCardResponse.class)))
    @ApiResponse(responseCode = "400", description = "Validation error",
            content = @Content(mediaType = PROBLEM, schema = @Schema(implementation = Problem.class)))
    @ApiResponse(responseCode = "404", description = "Resource not found",
            content = @Content(mediaType = PROBLEM, schema = @Schema(implementation = Problem.class)))
    public LearningCardResponse updateMilestone(@PathVariable long id, @PathVariable long milestoneId,
                                                @Valid @RequestBody MilestoneRequest request) {
        return service.updateMilestone(id, milestoneId, request);
    }

    @DeleteMapping("/{id}/milestones/{milestoneId}")
    @Operation(operationId = "deleteMilestone")
    @ApiResponse(responseCode = "200", description = "Removed; returns the updated card",
            content = @Content(mediaType = JSON, schema = @Schema(implementation = LearningCardResponse.class)))
    @ApiResponse(responseCode = "400", description = "Validation error",
            content = @Content(mediaType = PROBLEM, schema = @Schema(implementation = Problem.class)))
    @ApiResponse(responseCode = "404", description = "Resource not found",
            content = @Content(mediaType = PROBLEM, schema = @Schema(implementation = Problem.class)))
    public LearningCardResponse deleteMilestone(@PathVariable long id, @PathVariable long milestoneId) {
        return service.deleteMilestone(id, milestoneId);
    }

    @PostMapping(path = "/{id}/notes", consumes = JSON)
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(operationId = "addNote")
    @ApiResponse(responseCode = "201", description = "Added; returns the updated card",
            content = @Content(mediaType = JSON, schema = @Schema(implementation = LearningCardResponse.class)))
    @ApiResponse(responseCode = "400", description = "Validation error",
            content = @Content(mediaType = PROBLEM, schema = @Schema(implementation = Problem.class)))
    @ApiResponse(responseCode = "404", description = "Resource not found",
            content = @Content(mediaType = PROBLEM, schema = @Schema(implementation = Problem.class)))
    public LearningCardResponse addNote(@PathVariable long id, @Valid @RequestBody NoteRequest request) {
        return service.addNote(id, request);
    }

    @DeleteMapping("/{id}/notes/{noteId}")
    @Operation(operationId = "deleteNote")
    @ApiResponse(responseCode = "200", description = "Removed; returns the updated card",
            content = @Content(mediaType = JSON, schema = @Schema(implementation = LearningCardResponse.class)))
    @ApiResponse(responseCode = "400", description = "Validation error",
            content = @Content(mediaType = PROBLEM, schema = @Schema(implementation = Problem.class)))
    @ApiResponse(responseCode = "404", description = "Resource not found",
            content = @Content(mediaType = PROBLEM, schema = @Schema(implementation = Problem.class)))
    public LearningCardResponse deleteNote(@PathVariable long id, @PathVariable long noteId) {
        return service.deleteNote(id, noteId);
    }
}
