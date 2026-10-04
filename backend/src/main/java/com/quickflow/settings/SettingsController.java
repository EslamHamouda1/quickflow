package com.quickflow.settings;

import jakarta.validation.Valid;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.quickflow.common.Problem;
import com.quickflow.settings.dto.SettingsDto;

/** Settings operations of contracts/openapi.yaml (2 operations). */
@RestController
@RequestMapping(path = "/api/settings", produces = MediaType.APPLICATION_JSON_VALUE)
@Tag(name = "Settings")
public class SettingsController {

    private static final String JSON = MediaType.APPLICATION_JSON_VALUE;
    private static final String PROBLEM = MediaType.APPLICATION_PROBLEM_JSON_VALUE;

    private final SettingsService service;

    public SettingsController(SettingsService service) {
        this.service = service;
    }

    @GetMapping
    @Operation(operationId = "getSettings")
    @ApiResponse(responseCode = "200", description = "Current settings (defaults on first call)",
            content = @Content(mediaType = JSON, schema = @Schema(implementation = SettingsDto.class)))
    public SettingsDto getSettings() {
        return service.get();
    }

    @PutMapping(consumes = JSON)
    @Operation(operationId = "updateSettings")
    @ApiResponse(responseCode = "200", description = "Saved",
            content = @Content(mediaType = JSON, schema = @Schema(implementation = SettingsDto.class)))
    @ApiResponse(responseCode = "400", description = "Validation error",
            content = @Content(mediaType = PROBLEM, schema = @Schema(implementation = Problem.class)))
    public SettingsDto updateSettings(@Valid @RequestBody SettingsDto request) {
        return service.update(request);
    }
}
