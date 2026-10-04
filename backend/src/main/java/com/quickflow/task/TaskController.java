package com.quickflow.task;

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
import com.quickflow.task.dto.TaskRequest;
import com.quickflow.task.dto.TaskResponse;

/** Tasks operations of contracts/openapi.yaml (8 operations). */
@RestController
@RequestMapping(path = "/api/tasks", produces = MediaType.APPLICATION_JSON_VALUE)
@Tag(name = "Tasks")
public class TaskController {

    private static final String PROBLEM = MediaType.APPLICATION_PROBLEM_JSON_VALUE;

    private final TaskService service;

    public TaskController(TaskService service) {
        this.service = service;
    }

    @GetMapping
    @Operation(operationId = "listTasks",
            summary = "List tasks (non-archived by default) with search, filters and sorting")
    @ApiResponse(responseCode = "200",
            description = "Matching tasks (tasks without due date sort last when sort=DUE_DATE)",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                    array = @ArraySchema(schema = @Schema(implementation = TaskResponse.class))))
    @ApiResponse(responseCode = "400", description = "Validation error",
            content = @Content(mediaType = PROBLEM, schema = @Schema(implementation = Problem.class)))
    public List<TaskResponse> listTasks(
            @Parameter(description = "Case-insensitive title contains") @RequestParam(required = false) String q,
            @RequestParam(required = false) TaskStatus status,
            @RequestParam(required = false) TaskPriority priority,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dueFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dueTo,
            @Parameter(description = "true = only overdue tasks") @RequestParam(required = false) Boolean overdue,
            @Parameter(description = "true = only archived tasks")
            @RequestParam(required = false, defaultValue = "false") Boolean archived,
            @RequestParam(required = false) TaskSort sort,
            @RequestParam(required = false) SortDirection direction) {
        return service.list(new TaskService.TaskQuery(q, status, priority, dueFrom, dueTo, overdue, archived, sort,
                direction));
    }

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(operationId = "createTask")
    @ApiResponse(responseCode = "201", description = "Created",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                    schema = @Schema(implementation = TaskResponse.class)))
    @ApiResponse(responseCode = "400", description = "Validation error",
            content = @Content(mediaType = PROBLEM, schema = @Schema(implementation = Problem.class)))
    public TaskResponse createTask(@Valid @RequestBody TaskRequest request) {
        return service.create(request);
    }

    @GetMapping("/{id}")
    @Operation(operationId = "getTask")
    @ApiResponse(responseCode = "200", description = "The task",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                    schema = @Schema(implementation = TaskResponse.class)))
    @ApiResponse(responseCode = "400", description = "Validation error",
            content = @Content(mediaType = PROBLEM, schema = @Schema(implementation = Problem.class)))
    @ApiResponse(responseCode = "404", description = "Resource not found",
            content = @Content(mediaType = PROBLEM, schema = @Schema(implementation = Problem.class)))
    public TaskResponse getTask(@PathVariable long id) {
        return service.get(id);
    }

    @PutMapping(path = "/{id}", consumes = MediaType.APPLICATION_JSON_VALUE)
    @Operation(operationId = "updateTask")
    @ApiResponse(responseCode = "200", description = "Updated",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                    schema = @Schema(implementation = TaskResponse.class)))
    @ApiResponse(responseCode = "400", description = "Validation error",
            content = @Content(mediaType = PROBLEM, schema = @Schema(implementation = Problem.class)))
    @ApiResponse(responseCode = "404", description = "Resource not found",
            content = @Content(mediaType = PROBLEM, schema = @Schema(implementation = Problem.class)))
    public TaskResponse updateTask(@PathVariable long id, @Valid @RequestBody TaskRequest request) {
        return service.update(id, request);
    }

    // Body-less 204: the only representations are the problem+json errors, so a client sending
    // "Accept: application/problem+json" (as the generated client does) must match (BUG-P2-001).
    @DeleteMapping(path = "/{id}", produces = {MediaType.APPLICATION_JSON_VALUE, PROBLEM})
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(operationId = "deleteTask")
    @ApiResponse(responseCode = "204", description = "Deleted")
    @ApiResponse(responseCode = "400", description = "Validation error",
            content = @Content(mediaType = PROBLEM, schema = @Schema(implementation = Problem.class)))
    @ApiResponse(responseCode = "404", description = "Resource not found",
            content = @Content(mediaType = PROBLEM, schema = @Schema(implementation = Problem.class)))
    public void deleteTask(@PathVariable long id) {
        service.delete(id);
    }

    @PostMapping("/{id}/complete")
    @Operation(operationId = "completeTask", summary = "Set status DONE and completedAt")
    @ApiResponse(responseCode = "200", description = "Completed",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                    schema = @Schema(implementation = TaskResponse.class)))
    @ApiResponse(responseCode = "400", description = "Validation error",
            content = @Content(mediaType = PROBLEM, schema = @Schema(implementation = Problem.class)))
    @ApiResponse(responseCode = "404", description = "Resource not found",
            content = @Content(mediaType = PROBLEM, schema = @Schema(implementation = Problem.class)))
    public TaskResponse completeTask(@PathVariable long id) {
        return service.complete(id);
    }

    @PostMapping("/{id}/archive")
    @Operation(operationId = "archiveTask")
    @ApiResponse(responseCode = "200", description = "Archived",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                    schema = @Schema(implementation = TaskResponse.class)))
    @ApiResponse(responseCode = "400", description = "Validation error",
            content = @Content(mediaType = PROBLEM, schema = @Schema(implementation = Problem.class)))
    @ApiResponse(responseCode = "404", description = "Resource not found",
            content = @Content(mediaType = PROBLEM, schema = @Schema(implementation = Problem.class)))
    public TaskResponse archiveTask(@PathVariable long id) {
        return service.archive(id);
    }

    @PostMapping("/{id}/restore")
    @Operation(operationId = "restoreTask")
    @ApiResponse(responseCode = "200", description = "Restored",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                    schema = @Schema(implementation = TaskResponse.class)))
    @ApiResponse(responseCode = "400", description = "Validation error",
            content = @Content(mediaType = PROBLEM, schema = @Schema(implementation = Problem.class)))
    @ApiResponse(responseCode = "404", description = "Resource not found",
            content = @Content(mediaType = PROBLEM, schema = @Schema(implementation = Problem.class)))
    public TaskResponse restoreTask(@PathVariable long id) {
        return service.restore(id);
    }
}
