package com.studycompanion.demo.service;

import com.studycompanion.demo.dto.ActivityRequest;
import com.studycompanion.demo.entity.StudySession;
import com.studycompanion.demo.exception.StudySessionNotFoundException;
import com.studycompanion.demo.repository.StudySessionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StudySessionServiceTest {

    @Mock
    private StudySessionRepository studySessionRepository;

    private StudySessionService studySessionService;

    @BeforeEach
    void setUp() {
        studySessionService = new StudySessionService(studySessionRepository);
    }

    private void saveReturnsArgument() {
        when(studySessionRepository.save(any(StudySession.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
    }

    private ActivityRequest activity(String application, String title, String url) {
        ActivityRequest request = new ActivityRequest();
        request.setApplication(application);
        request.setTitle(title);
        request.setUrl(url);
        return request;
    }

    @Test
    void getAllSessionsReturnsRepositoryResults() {
        List<StudySession> sessions = List.of(new StudySession(), new StudySession());
        when(studySessionRepository.findAll()).thenReturn(sessions);

        assertThat(studySessionService.getAllSessions()).isSameAs(sessions);
    }

    @Test
    void getSessionByIdReturnsEmptyWhenMissing() {
        when(studySessionRepository.findById(42)).thenReturn(Optional.empty());

        assertThat(studySessionService.getSessionById(42)).isEmpty();
    }

    @Test
    void startSessionCreatesFreshIncompleteSession() {
        saveReturnsArgument();

        StudySession session = studySessionService.startSession("Math");

        assertThat(session.getSubject()).isEqualTo("Math");
        assertThat(session.getStartedAt()).isNotNull();
        assertThat(session.getEndedAt()).isNull();
        assertThat(session.getDurationSeconds()).isZero();
        assertThat(session.getFocusedSeconds()).isZero();
        assertThat(session.getDistractionSeconds()).isZero();
        assertThat(session.getYoutubeVisits()).isZero();
        assertThat(session.getCompleted()).isFalse();
        verify(studySessionRepository).save(session);
    }

    @Test
    void stopSessionComputesFocusedTimeAndCompletes() {
        StudySession existing = new StudySession();
        existing.setSubject("Physics");
        when(studySessionRepository.findById(1)).thenReturn(Optional.of(existing));
        saveReturnsArgument();

        StudySession session = studySessionService.stopSession(1, 600, 120);

        assertThat(session.getDurationSeconds()).isEqualTo(600);
        assertThat(session.getDistractionSeconds()).isEqualTo(120);
        assertThat(session.getFocusedSeconds()).isEqualTo(480);
        assertThat(session.getCompleted()).isTrue();
        assertThat(session.getEndedAt()).isNotNull();
    }

    @ParameterizedTest(name = "duration={0}, distraction={1} -> duration={2}, distraction={3}, focused={4}")
    @CsvSource(nullValues = "null", value = {
            "100,  200,  100, 100, 0",   // distraction capped at duration
            "-50,  10,   0,   0,   0",   // negative duration clamped to 0
            "100,  -10,  100, 0,   100", // negative distraction clamped to 0
            "null, null, 0,   0,   0",   // missing values treated as 0
            "300,  null, 300, 0,   300"
    })
    void stopSessionSanitisesInputs(Integer duration, Integer distraction,
                                    int expectedDuration, int expectedDistraction, int expectedFocused) {
        when(studySessionRepository.findById(1)).thenReturn(Optional.of(new StudySession()));
        saveReturnsArgument();

        StudySession session = studySessionService.stopSession(1, duration, distraction);

        assertThat(session.getDurationSeconds()).isEqualTo(expectedDuration);
        assertThat(session.getDistractionSeconds()).isEqualTo(expectedDistraction);
        assertThat(session.getFocusedSeconds()).isEqualTo(expectedFocused);
    }

    @Test
    void stopSessionThrowsWhenSessionMissing() {
        when(studySessionRepository.findById(99)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> studySessionService.stopSession(99, 10, 0))
                .isInstanceOf(StudySessionNotFoundException.class)
                .hasMessage("Study session not found: 99");
        verify(studySessionRepository, never()).save(any());
    }

    @Test
    void stopSessionRejectsNullSessionId() {
        assertThatThrownBy(() -> studySessionService.stopSession(null, 10, 0))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("sessionId is required");
        verify(studySessionRepository, never()).findById(any());
    }

    @ParameterizedTest
    @CsvSource(nullValues = "null", value = {
            "Chrome,  Lecture, https://www.youtube.com/watch?v=abc",
            "Chrome,  Lecture, https://YOUTU.BE/abc",
            "Chrome,  Lecture, https://www.youtube-nocookie.com/embed/abc",
            "YouTube, null,    null",
            "Chrome,  Funny cats - YouTube, https://example.com",
            "null,    youtube music, ''"
    })
    void recordActivityCountsYoutubeVisits(String application, String title, String url) {
        StudySession existing = new StudySession();
        existing.setYoutubeVisits(2);
        when(studySessionRepository.findById(1)).thenReturn(Optional.of(existing));
        saveReturnsArgument();

        StudySession session = studySessionService.recordActivity(1, activity(application, title, url));

        assertThat(session.getYoutubeVisits()).isEqualTo(3);
    }

    @Test
    void recordActivityIgnoresNonYoutubeActivity() {
        StudySession existing = new StudySession();
        existing.setYoutubeVisits(2);
        when(studySessionRepository.findById(1)).thenReturn(Optional.of(existing));
        saveReturnsArgument();

        StudySession session = studySessionService.recordActivity(
                1, activity("VS Code", "StudySessionService.java", "https://docs.oracle.com"));

        assertThat(session.getYoutubeVisits()).isEqualTo(2);
        verify(studySessionRepository).save(existing);
    }

    @Test
    void recordActivityHandlesAllNullFields() {
        when(studySessionRepository.findById(1)).thenReturn(Optional.of(new StudySession()));
        saveReturnsArgument();

        StudySession session = studySessionService.recordActivity(1, activity(null, null, null));

        assertThat(session.getYoutubeVisits()).isZero();
    }

    @Test
    void recordActivityStartsCountAtOneWhenVisitsNull() {
        StudySession existing = new StudySession();
        existing.setYoutubeVisits(null);
        when(studySessionRepository.findById(1)).thenReturn(Optional.of(existing));
        saveReturnsArgument();

        StudySession session = studySessionService.recordActivity(
                1, activity(null, null, "https://youtube.com"));

        assertThat(session.getYoutubeVisits()).isEqualTo(1);
    }

    @Test
    void recordActivityThrowsWhenSessionMissing() {
        when(studySessionRepository.findById(99)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> studySessionService.recordActivity(99, activity(null, null, null)))
                .isInstanceOf(StudySessionNotFoundException.class)
                .hasMessage("Study session not found: 99");
    }

    @Test
    void saveSessionDelegatesToRepository() {
        StudySession session = new StudySession();
        when(studySessionRepository.save(session)).thenReturn(session);

        assertThat(studySessionService.saveSession(session)).isSameAs(session);
        ArgumentCaptor<StudySession> captor = ArgumentCaptor.forClass(StudySession.class);
        verify(studySessionRepository).save(captor.capture());
        assertThat(captor.getValue()).isSameAs(session);
    }
}
