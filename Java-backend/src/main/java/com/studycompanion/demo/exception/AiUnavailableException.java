package com.studycompanion.demo.exception;

/**
 * The AI check could not give an answer (no API key, network error,
 * refusal, ...). The Electron app falls back to keyword matching.
 */
public class AiUnavailableException extends RuntimeException {

    public AiUnavailableException(String message) {
        super(message);
    }

    public AiUnavailableException(String message, Throwable cause) {
        super(message, cause);
    }
}
