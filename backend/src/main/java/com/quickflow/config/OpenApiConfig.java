package com.quickflow.config;

import java.util.List;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.servers.Server;
import io.swagger.v3.oas.models.tags.Tag;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Swagger metadata matching {@code info}, {@code servers} and {@code tags} of contracts/openapi.yaml. */
@Configuration(proxyBeanMethods = false)
public class OpenApiConfig {

    @Bean
    public OpenAPI quickFlowOpenApi() {
        return new OpenAPI()
                .info(new Info()
                        .title("QuickFlow API")
                        .version("1.0.0")
                        .description("REST API of QuickFlow (single-user personal productivity). Source of truth for the "
                                + "backend springdoc swagger and the generated typescript-angular client. Errors use "
                                + "RFC 9457 application/problem+json."))
                .servers(List.of(new Server().url("http://localhost:8080")))
                .tags(List.of(
                        new Tag().name("Tasks"),
                        new Tag().name("Habits"),
                        new Tag().name("Learning"),
                        new Tag().name("Plans"),
                        new Tag().name("Dashboard"),
                        new Tag().name("Settings")));
    }
}
