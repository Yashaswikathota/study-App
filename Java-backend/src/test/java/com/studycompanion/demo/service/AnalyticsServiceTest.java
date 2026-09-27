package com.studycompanion.demo.service;

import com.studycompanion.demo.entity.StudySession;
import com.studycompanion.demo.repository.StudySessionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AnalyticsServiceTest {

    @Mock
    private StudySessionRepository studySessionRepository;

    private AnalyticsService analyticsService;

    @BeforeEach
    void setUp() {
        analyticsService = new AnalyticsService(studySessionRepository);
    }

    private StudySession session(Integer duration, Integer focused, Integer distraction, Integer youtube) {
        StudySession session = new StudySession();
        session.setDurationSeconds(duration);
        session.setFocusedSeconds(focused);
        session.setDistractionSeconds(distraction);
        session.setYoutubeVisits(youtube);
        return session;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> totals(Map<String, Object> analytics) {
        return (Map<String, Object>) analytics.get("totals");
    }

    @Test
    void returnsZeroTotalsWhenNoSessions() {
        when(studySessionRepository.findAll()).thenReturn(List.of());

        Map<String, Object> analytics = analyticsService.getAnalytics();

        assertThat(totals(analytics))
                .containsEntry("totalSeconds", 0)
                .containsEntry("focusedSeconds", 0)
                .containsEntry("distractionSeconds", 0)
                .containsEntry("youtubeVisits", 0)
                .containsEntry("focusScore", 0.0);
        assertThat((List<?>) analytics.get("sessions")).isEmpty();
    }

    @Test
    void sumsTotalsAcrossSessions() {
        List<StudySession> sessions = List.of(
                session(600, 480, 120, 1),
                session(400, 400, 0, 2));
        when(studySessionRepository.findAll()).thenReturn(sessions);

        Map<String, Object> analytics = analyticsService.getAnalytics();

        assertThat(totals(analytics))
                .containsEntry("totalSeconds", 1000)
                .containsEntry("focusedSeconds", 880)
                .containsEntry("distractionSeconds", 120)
                .containsEntry("youtubeVisits", 3)
                .containsEntry("focusScore", 88.0);
        assertThat(analytics.get("sessions")).isSameAs(sessions);
    }

    @Test
    void roundsFocusScoreToTwoDecimals() {
        when(studySessionRepository.findAll()).thenReturn(List.of(session(3, 2, 1, 0)));

        assertThat(totals(analyticsService.getAnalytics()))
                .containsEntry("focusScore", 66.67);
    }

    @Test
    void treatsNullFieldsAsZero() {
        when(studySessionRepository.findAll()).thenReturn(List.of(
                session(null, null, null, null),
                session(100, 50, 50, 1)));

        assertThat(totals(analyticsService.getAnalytics()))
                .containsEntry("totalSeconds", 100)
                .containsEntry("focusedSeconds", 50)
                .containsEntry("distractionSeconds", 50)
                .containsEntry("youtubeVisits", 1)
                .containsEntry("focusScore", 50.0);
    }
}
