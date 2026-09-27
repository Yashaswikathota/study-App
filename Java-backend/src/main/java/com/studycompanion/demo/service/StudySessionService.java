package com.studycompanion.demo.service;

import com.studycompanion.demo.entity.StudySession;
import com.studycompanion.demo.repository.StudySessionRepository;
import com.studycompanion.demo.dto.ActivityRequest;
import com.studycompanion.demo.exception.StudySessionNotFoundException;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
public class StudySessionService {

    private final StudySessionRepository studySessionRepository;

    public StudySessionService(
            StudySessionRepository studySessionRepository) {
        this.studySessionRepository = studySessionRepository;
    }

    public List<StudySession> getAllSessions() {
        return studySessionRepository.findAll();
    }

    public Optional<StudySession> getSessionById(Integer id) {
        return studySessionRepository.findById(id);
    }

    private StudySession findSessionOrThrow(Integer id) {

        if (id == null) {
            throw new IllegalArgumentException("sessionId is required");
        }

        return studySessionRepository
                .findById(id)
                .orElseThrow(() -> new StudySessionNotFoundException(id));
    }

    public StudySession saveSession(StudySession session) {
        return studySessionRepository.save(session);
    }

    public StudySession startSession(String subject) {

        StudySession session = new StudySession();

        session.setSubject(subject);
        session.setStartedAt(LocalDateTime.now());
        session.setDurationSeconds(0);
        session.setFocusedSeconds(0);
        session.setDistractionSeconds(0);
        session.setYoutubeVisits(0);
        session.setCompleted(false);

        return studySessionRepository.save(session);
    }

    public StudySession stopSession(
            Integer sessionId,
            Integer durationSeconds,
            Integer distractionSeconds) {

        StudySession session = findSessionOrThrow(sessionId);

        int duration = Math.max(
                0,
                durationSeconds != null ? durationSeconds : 0
        );

        int distraction = Math.max(
                0,
                distractionSeconds != null ? distractionSeconds : 0
        );

        // Distraction cannot be greater than total duration.
        distraction = Math.min(distraction, duration);

        int focused = duration - distraction;

        session.setEndedAt(LocalDateTime.now());
        session.setDurationSeconds(duration);
        session.setDistractionSeconds(distraction);
        session.setFocusedSeconds(focused);
        session.setCompleted(true);

        return studySessionRepository.save(session);
    }
    public StudySession recordActivity(
        Integer sessionId,
        ActivityRequest request) {

    StudySession session = findSessionOrThrow(sessionId);

    String application = request.getApplication();
    String title = request.getTitle();
    String url = request.getUrl();

    boolean isYouTube = false;

    if (url != null && !url.isBlank()) {
        String lowerUrl = url.toLowerCase();

        isYouTube =
                lowerUrl.contains("youtube.com") ||
                lowerUrl.contains("youtube-nocookie.com") ||
                lowerUrl.contains("youtu.be");
    }

    if (!isYouTube) {
        String combinedText =
                ((application != null ? application : "") + " " +
                 (title != null ? title : "")).toLowerCase();

        isYouTube = combinedText.contains("youtube");
    }

    if (isYouTube) {
        session.setYoutubeVisits(
                session.getYoutubeVisits() != null
                        ? session.getYoutubeVisits() + 1
                        : 1
        );
    }

    return studySessionRepository.save(session);
}
}
