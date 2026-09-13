package com.studycompanion.demo.service;

import com.studycompanion.demo.entity.StudySession;
import com.studycompanion.demo.repository.StudySessionRepository;
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
            Integer distractionSeconds,
            Integer youtubeVisits) {

        StudySession session = studySessionRepository
                .findById(sessionId)
                .orElseThrow(() ->
                        new RuntimeException("Study session not found"));

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
        session.setYoutubeVisits(
                Math.max(
                        0,
                        youtubeVisits != null ? youtubeVisits : 0
                )
        );
        session.setCompleted(true);

        return studySessionRepository.save(session);
    }
}