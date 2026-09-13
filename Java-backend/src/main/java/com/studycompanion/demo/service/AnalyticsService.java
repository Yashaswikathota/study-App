package com.studycompanion.demo.service;

import com.studycompanion.demo.entity.StudySession;
import com.studycompanion.demo.repository.StudySessionRepository;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class AnalyticsService {

    private final StudySessionRepository studySessionRepository;

    public AnalyticsService(
            StudySessionRepository studySessionRepository) {
        this.studySessionRepository = studySessionRepository;
    }

    public Map<String, Object> getAnalytics() {

        List<StudySession> sessions =
                studySessionRepository.findAll();

        int totalSeconds = 0;
        int focusedSeconds = 0;
        int distractionSeconds = 0;
        int youtubeVisits = 0;

        for (StudySession session : sessions) {

            totalSeconds += safe(session.getDurationSeconds());

            focusedSeconds +=
                    safe(session.getFocusedSeconds());

            distractionSeconds +=
                    safe(session.getDistractionSeconds());

            youtubeVisits +=
                    safe(session.getYoutubeVisits());
        }

        double focusScore = 0;

        if (totalSeconds > 0) {
            focusScore =
                    ((double) focusedSeconds / totalSeconds) * 100;
        }

        Map<String, Object> totals = new HashMap<>();

        totals.put("totalSeconds", totalSeconds);
        totals.put("focusedSeconds", focusedSeconds);
        totals.put("distractionSeconds", distractionSeconds);
        totals.put("youtubeVisits", youtubeVisits);
        totals.put("focusScore", Math.round(focusScore * 100.0) / 100.0);

        Map<String, Object> response = new HashMap<>();

        response.put("totals", totals);
        response.put("sessions", sessions);

        return response;
    }

    private int safe(Integer value) {
        return value != null ? value : 0;
    }
}