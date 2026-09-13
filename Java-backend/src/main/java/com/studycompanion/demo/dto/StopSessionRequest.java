package com.studycompanion.demo.dto;

public class StopSessionRequest {

    private Integer sessionId;
    private Integer durationSeconds;
    private Integer distractionSeconds;
    private Integer youtubeVisits;

    public StopSessionRequest() {
    }

    public Integer getSessionId() {
        return sessionId;
    }

    public void setSessionId(Integer sessionId) {
        this.sessionId = sessionId;
    }

    public Integer getDurationSeconds() {
        return durationSeconds;
    }

    public void setDurationSeconds(Integer durationSeconds) {
        this.durationSeconds = durationSeconds;
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
}