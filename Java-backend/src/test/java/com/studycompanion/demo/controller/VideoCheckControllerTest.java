package com.studycompanion.demo.controller;

import com.studycompanion.demo.dto.VideoRelevance;
import com.studycompanion.demo.exception.AiUnavailableException;
import com.studycompanion.demo.service.VideoRelevanceService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(VideoCheckController.class)
class VideoCheckControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private VideoRelevanceService videoRelevanceService;

    private static final String BODY =
            "{\"subject\":\"Java\",\"title\":\"Spring Boot crash course\"}";

    @Test
    void returnsRelatedVerdict() throws Exception {
        when(videoRelevanceService.check("Java", "Spring Boot crash course"))
                .thenReturn(new VideoRelevance(true));

        mockMvc.perform(post("/api/video-check")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(BODY))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.related").value(true));
    }

    @Test
    void returnsUnrelatedVerdict() throws Exception {
        when(videoRelevanceService.check("Java", "Java coffee review"))
                .thenReturn(new VideoRelevance(false));

        mockMvc.perform(post("/api/video-check")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"subject\":\"Java\",\"title\":\"Java coffee review\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.related").value(false));
    }

    @Test
    void returns400ForMissingFields() throws Exception {
        when(videoRelevanceService.check(any(), any()))
                .thenThrow(new IllegalArgumentException("title is required"));

        mockMvc.perform(post("/api/video-check")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"subject\":\"Java\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("title is required"));
    }

    @Test
    void returns503WhenAiUnavailable() throws Exception {
        when(videoRelevanceService.check(any(), any()))
                .thenThrow(new AiUnavailableException("AI video check is not configured"));

        mockMvc.perform(post("/api/video-check")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(BODY))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.status").value(503));
    }
}
