package com.quickflow.settings;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;

import com.quickflow.settings.dto.SettingsDto;

/**
 * T089 — {@link SettingsController} web slice with a mocked {@link SettingsService}: both operations,
 * request-DTO validation 400 problem+json. Traces US6 AS2, FR-029.
 */
@WebMvcTest(SettingsController.class)
class SettingsControllerTest {

    static final String URI = "/api/settings";
    static final String N80 = "a".repeat(80);
    static final String N81 = "a".repeat(81);

    @Autowired
    MockMvcTester mvc;

    @MockitoBean
    SettingsService service;

    private MvcTestResult put(String body) {
        return mvc.put().uri(URI).contentType(MediaType.APPLICATION_JSON).content(body).exchange();
    }

    private static String body(String name, String inApp, String browser, String view) {
        StringBuilder sb = new StringBuilder("{");
        if (name != null) sb.append("\"displayName\":").append(name).append(',');
        if (inApp != null) sb.append("\"inAppNotifications\":").append(inApp).append(',');
        if (browser != null) sb.append("\"browserNotifications\":").append(browser).append(',');
        if (view != null) sb.append("\"defaultView\":").append(view).append(',');
        if (sb.length() > 1) sb.setLength(sb.length() - 1);
        return sb.append('}').toString();
    }

    private void assertValidation(MvcTestResult r, String field) {
        assertThat(r).hasStatus(400).hasContentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON);
        assertThat(r).bodyJson().extractingPath("$.status").isEqualTo(400);
        assertThat(r).bodyJson().extractingPath("$.errors[*].field").asArray().contains(field);
        verifyNoInteractions(service);
    }

    @Test
    void getReturns200WithAllFields() {
        given(service.get()).willReturn(new SettingsDto("Friend", true, false, DefaultView.DASHBOARD));
        MvcTestResult r = mvc.get().uri(URI).exchange();
        assertThat(r).hasStatusOk().hasContentTypeCompatibleWith(MediaType.APPLICATION_JSON);
        assertThat(r).bodyJson().extractingPath("$.displayName").isEqualTo("Friend");
        assertThat(r).bodyJson().extractingPath("$.inAppNotifications").isEqualTo(true);
        assertThat(r).bodyJson().extractingPath("$.browserNotifications").isEqualTo(false);
        assertThat(r).bodyJson().extractingPath("$.defaultView").isEqualTo("DASHBOARD");
    }

    @Test
    void putValidReturns200AndPassesDto() {
        SettingsDto req = new SettingsDto("Sara", false, true, DefaultView.TASKS);
        given(service.update(any())).willReturn(req);
        MvcTestResult r = put(body("\"Sara\"", "false", "true", "\"TASKS\""));
        assertThat(r).hasStatusOk();
        assertThat(r).bodyJson().extractingPath("$.defaultView").isEqualTo("TASKS");
        assertThat(r).bodyJson().extractingPath("$.displayName").isEqualTo("Sara");
        verify(service).update(req);
    }

    @Test
    void putAccepts80CharName() {
        given(service.update(any())).willReturn(new SettingsDto(N80, true, false, DefaultView.HABITS));
        assertThat(put(body("\"" + N80 + "\"", "true", "false", "\"HABITS\""))).hasStatusOk();
    }

    @ParameterizedTest
    @ValueSource(strings = {"DASHBOARD", "TASKS", "HABITS", "LEARNING", "PLANS"})
    void putAcceptsEveryDefaultView(String view) {
        given(service.update(any())).willReturn(new SettingsDto("x", true, false, DefaultView.valueOf(view)));
        assertThat(put(body("\"x\"", "true", "false", "\"" + view + "\""))).hasStatusOk();
    }

    @Test
    void blankDisplayName400() {
        assertValidation(put(body("\"   \"", "true", "false", "\"TASKS\"")), "displayName");
    }

    @Test
    void emptyDisplayName400() {
        assertValidation(put(body("\"\"", "true", "false", "\"TASKS\"")), "displayName");
    }

    @Test
    void displayName81Chars400() {
        assertValidation(put(body("\"" + N81 + "\"", "true", "false", "\"TASKS\"")), "displayName");
    }

    @Test
    void missingDisplayName400() {
        assertValidation(put(body(null, "true", "false", "\"TASKS\"")), "displayName");
    }

    @Test
    void nullDisplayName400() {
        assertValidation(put(body("null", "true", "false", "\"TASKS\"")), "displayName");
    }

    @Test
    void missingInAppNotifications400() {
        assertValidation(put(body("\"x\"", null, "false", "\"TASKS\"")), "inAppNotifications");
    }

    @Test
    void missingBrowserNotifications400() {
        assertValidation(put(body("\"x\"", "true", null, "\"TASKS\"")), "browserNotifications");
    }

    @Test
    void missingDefaultView400() {
        assertValidation(put(body("\"x\"", "true", "false", null)), "defaultView");
    }

    @Test
    void emptyBodyReportsAllFourFields() {
        MvcTestResult r = put("{}");
        assertThat(r).hasStatus(400).hasContentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON);
        assertThat(r).bodyJson().extractingPath("$.errors[*].field").asArray()
                .contains("displayName", "inAppNotifications", "browserNotifications", "defaultView");
        verifyNoInteractions(service);
    }

    @Test
    void invalidDefaultViewEnum400() {
        MvcTestResult r = put(body("\"x\"", "true", "false", "\"CALENDAR\""));
        assertThat(r).hasStatus(400).hasContentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON);
        assertThat(r).bodyJson().extractingPath("$.status").isEqualTo(400);
        verifyNoInteractions(service);
    }

    @Test
    void malformedJson400() {
        MvcTestResult r = put("{");
        assertThat(r).hasStatus(400).hasContentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON);
        verifyNoInteractions(service);
    }
}
