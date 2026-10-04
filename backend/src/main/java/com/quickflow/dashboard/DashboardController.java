package com.quickflow.dashboard;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.quickflow.dashboard.dto.DashboardResponse;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;

/** Dashboard operation of contracts/openapi.yaml (1 operation). */
@RestController
@RequestMapping(path = "/api/dashboard", produces = MediaType.APPLICATION_JSON_VALUE)
@Tag(name = "Dashboard")
public class DashboardController {

    private final DashboardService service;

    public DashboardController(DashboardService service) {
        this.service = service;
    }

    @GetMapping
    @Operation(operationId = "getDashboard")
    @ApiResponse(responseCode = "200", description = "Dashboard summary computed from current data",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                    schema = @Schema(implementation = DashboardResponse.class)))
    public DashboardResponse getDashboard() {
        return service.get();
    }
}
