package com.studycompanion.demo.dto;

public class VideoCheckRequest {

    private String subject;
    private String title;

    public VideoCheckRequest() {
    }

    public String getSubject() {
        return subject;
    }

    public void setSubject(String subject) {
        this.subject = subject;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }
}
