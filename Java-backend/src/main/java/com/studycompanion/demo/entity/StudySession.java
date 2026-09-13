package com.studycompanion.demo.entity;

import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "study_sessions")
public class StudySession {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "started_at", nullable = false)
    private LocalDateTime startedAt;

    @Column(name = "ended_at")
    private LocalDateTime endedAt;

    @Column(name = "duration_seconds", nullable = false)
    private Integer durationSeconds = 0;

    @Column(name = "focused_seconds", nullable = false)
    private Integer focusedSeconds = 0;

    @Column(name = "distraction_seconds", nullable = false)
    private Integer distractionSeconds = 0;

    @Column(name = "youtube_visits", nullable = false)
    private Integer youtubeVisits = 0;

    @Column(name = "completed", nullable = false)
    private Boolean completed = false;

    @Column(name = "subject")
    private String subject;

    public StudySession() {
    }

    public Integer getId() {
        return id;
    }

    public LocalDateTime getStartedAt() {
        return startedAt;
    }

    public void setStartedAt(LocalDateTime startedAt) {
        this.startedAt = startedAt;
    }

    public LocalDateTime getEndedAt() {
        return endedAt;
    }

    public void setEndedAt(LocalDateTime endedAt) {
        this.endedAt = endedAt;
    }

    public Integer getDurationSeconds() {
        return durationSeconds;
    }

    public void setDurationSeconds(Integer durationSeconds) {
        this.durationSeconds = durationSeconds;
    }

    public Integer getFocusedSeconds() {
        return focusedSeconds;
    }

    public void setFocusedSeconds(Integer focusedSeconds) {
        this.focusedSeconds = focusedSeconds;
    }

    public Integer getDistractionSeconds() {
        return distractionSeconds;
    }

    public void setDistractionSeconds(Integer distractionSeconds) {
        this.distractionSeconds = distractionSeconds;
    }

    public Integer getYoutubeVisits() {
        return youtubeVisits;
    }

    public void setYoutubeVisits(Integer youtubeVisits) {
        this.youtubeVisits = youtubeVisits;
    }

    public Boolean getCompleted() {
        return completed;
    }

    public void setCompleted(Boolean completed) {
        this.completed = completed;
    }

    public String getSubject() {
        return subject;
    }

    public void setSubject(String subject) {
        this.subject = subject;
    }
}