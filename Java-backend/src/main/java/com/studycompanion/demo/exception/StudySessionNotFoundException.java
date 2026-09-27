package com.studycompanion.demo.exception;

public class StudySessionNotFoundException extends RuntimeException {

    public StudySessionNotFoundException(Integer id) {
        super("Study session not found: " + id);
    }
}
