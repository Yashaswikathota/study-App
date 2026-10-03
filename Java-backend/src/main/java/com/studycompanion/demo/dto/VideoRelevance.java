package com.studycompanion.demo.dto;

import com.fasterxml.jackson.annotation.JsonPropertyDescription;

/**
 * Claude's structured answer, and the JSON returned to the Electron app.
 */
public record VideoRelevance(

        @JsonPropertyDescription(
                "true if the video helps the student study the subject, false otherwise")
        boolean related) {
}
