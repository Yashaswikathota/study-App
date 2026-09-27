package com.studycompanion.demo.controller;

import com.studycompanion.demo.service.AnalyticsService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(AnalyticsController.class)
class AnalyticsControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private AnalyticsService analyticsService;

    @Test
    void returnsAnalyticsFromService() throws Exception {
        when(analyticsService.getAnalytics()).thenReturn(Map.of(
                "totals", Map.of(
                        "totalSeconds", 1000,
                        "focusedSeconds", 880,
                        "distractionSeconds", 120,
                        "youtubeVisits", 3,
                        "focusScore", 88.0),
                "sessions", List.of()));

        mockMvc.perform(get("/api/analytics"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totals.totalSeconds").value(1000))
                .andExpect(jsonPath("$.totals.focusScore").value(88.0))
                .andExpect(jsonPath("$.totals.youtubeVisits").value(3))
                .andExpect(jsonPath("$.sessions").isEmpty());
    }
}
