package com.studycompanion.demo.controller;

import com.studycompanion.demo.dto.StartSessionRequest;
import com.studycompanion.demo.entity.StudySession;
import com.studycompanion.demo.service.StudySessionService;
import org.springframework.web.bind.annotation.*;
import com.studycompanion.demo.dto.StopSessionRequest;

import java.util.List;

@RestController
@RequestMapping("/api/study-sessions")
@CrossOrigin(origins = "*")
public class StudySessionController {

    private final StudySessionService studySessionService;

    public StudySessionController(
            StudySessionService studySessionService) {
        this.studySessionService = studySessionService;
    }

    @GetMapping
    public List<StudySession> getAllSessions() {
        return studySessionService.getAllSessions();
    }

    @GetMapping("/{id}")
    public StudySession getSessionById(@PathVariable Integer id) {
        return studySessionService
                .getSessionById(id)
                .orElseThrow(() ->
                        new RuntimeException("Study session not found"));
    }

    @PostMapping("/start")
    public StudySession startSession(
            @RequestBody StartSessionRequest request) {

        return studySessionService.startSession(
                request.getSubject()
        );
    }

    @PostMapping("/stop")
    public StudySession stopSession(
        @RequestBody StopSessionRequest request) {

        return studySessionService.stopSession(
            request.getSessionId(),
            request.getDurationSeconds(),
            request.getDistractionSeconds(),
            request.getYoutubeVisits()
        );
    }
}
