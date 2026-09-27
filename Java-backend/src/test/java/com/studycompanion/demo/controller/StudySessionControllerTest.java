package com.studycompanion.demo.controller;

import com.studycompanion.demo.dto.ActivityRequest;
import com.studycompanion.demo.entity.StudySession;
import com.studycompanion.demo.exception.StudySessionNotFoundException;
import com.studycompanion.demo.service.StudySessionService;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(StudySessionController.class)
class StudySessionControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private StudySessionService studySessionService;

    private StudySession session(String subject, int duration, boolean completed) {
        StudySession session = new StudySession();
        session.setSubject(subject);
        session.setDurationSeconds(duration);
        session.setCompleted(completed);
        return session;
    }

    @Test
    void getAllSessionsReturnsList() throws Exception {
        when(studySessionService.getAllSessions()).thenReturn(List.of(
                session("Math", 60, true),
                session("Physics", 0, false)));

        mockMvc.perform(get("/api/study-sessions"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].subject").value("Math"))
                .andExpect(jsonPath("$[1].completed").value(false));
    }

    @Test
    void getSessionByIdReturnsSession() throws Exception {
        when(studySessionService.getSessionById(7))
                .thenReturn(Optional.of(session("History", 120, true)));

        mockMvc.perform(get("/api/study-sessions/7"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.subject").value("History"))
                .andExpect(jsonPath("$.durationSeconds").value(120));
    }

    @Test
    void startSessionPassesSubjectToService() throws Exception {
        when(studySessionService.startSession("Chemistry"))
                .thenReturn(session("Chemistry", 0, false));

        mockMvc.perform(post("/api/study-sessions/start")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"subject\":\"Chemistry\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.subject").value("Chemistry"))
                .andExpect(jsonPath("$.completed").value(false));

        verify(studySessionService).startSession("Chemistry");
    }

    @Test
    void stopSessionPassesAllFieldsToService() throws Exception {
        when(studySessionService.stopSession(3, 600, 120))
                .thenReturn(session("Math", 600, true));

        mockMvc.perform(post("/api/study-sessions/stop")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"sessionId\":3,\"durationSeconds\":600,\"distractionSeconds\":120}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.durationSeconds").value(600))
                .andExpect(jsonPath("$.completed").value(true));

        verify(studySessionService).stopSession(3, 600, 120);
    }

    @Test
    void recordActivityMapsRequestBody() throws Exception {
        StudySession updated = session("Math", 0, false);
        updated.setYoutubeVisits(1);
        ArgumentCaptor<ActivityRequest> captor = ArgumentCaptor.forClass(ActivityRequest.class);
        when(studySessionService.recordActivity(eq(5), captor.capture())).thenReturn(updated);

        mockMvc.perform(post("/api/study-sessions/5/activity")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"application":"Chrome","title":"Video","url":"https://youtube.com/watch","timestamp":"2026-09-26T10:00:00Z"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.youtubeVisits").value(1));

        ActivityRequest request = captor.getValue();
        assertThat(request.getApplication()).isEqualTo("Chrome");
        assertThat(request.getTitle()).isEqualTo("Video");
        assertThat(request.getUrl()).isEqualTo("https://youtube.com/watch");
        assertThat(request.getTimestamp()).isEqualTo("2026-09-26T10:00:00Z");
    }

    @Test
    void getSessionByIdReturns404WhenMissing() throws Exception {
        when(studySessionService.getSessionById(99)).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/study-sessions/99"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.detail").value("Study session not found: 99"));
    }

    @Test
    void stopSessionReturns404WhenMissing() throws Exception {
        when(studySessionService.stopSession(99, 10, 0))
                .thenThrow(new StudySessionNotFoundException(99));

        mockMvc.perform(post("/api/study-sessions/stop")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"sessionId\":99,\"durationSeconds\":10,\"distractionSeconds\":0}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.detail").value("Study session not found: 99"));
    }

    @Test
    void recordActivityReturns404WhenMissing() throws Exception {
        when(studySessionService.recordActivity(eq(99), any()))
                .thenThrow(new StudySessionNotFoundException(99));

        mockMvc.perform(post("/api/study-sessions/99/activity")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void stopSessionReturns400WhenSessionIdMissing() throws Exception {
        when(studySessionService.stopSession(null, 10, 0))
                .thenThrow(new IllegalArgumentException("sessionId is required"));

        mockMvc.perform(post("/api/study-sessions/stop")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"durationSeconds\":10,\"distractionSeconds\":0}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("sessionId is required"));
    }

    @Test
    void returns400ForMalformedJson() throws Exception {
        mockMvc.perform(post("/api/study-sessions/start")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{not json"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400));
    }

    @Test
    void returns400ForNonNumericId() throws Exception {
        mockMvc.perform(get("/api/study-sessions/abc"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400));
    }

    @Test
    void returns500WithoutLeakingInternalDetails() throws Exception {
        when(studySessionService.getAllSessions())
                .thenThrow(new IllegalStateException("connection to db-host:5432 refused"));

        mockMvc.perform(get("/api/study-sessions"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.detail").value("An unexpected error occurred"));
    }

    @Test
    void allowsCrossOriginRequests() throws Exception {
        when(studySessionService.getAllSessions()).thenReturn(List.of());

        mockMvc.perform(get("/api/study-sessions").header("Origin", "http://localhost:3000"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "*"));
    }
}
