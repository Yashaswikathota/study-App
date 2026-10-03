package com.studycompanion.demo.controller;

import com.studycompanion.demo.dto.VideoCheckRequest;
import com.studycompanion.demo.dto.VideoRelevance;
import com.studycompanion.demo.service.VideoRelevanceService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/video-check")
@CrossOrigin(origins = "*")
public class VideoCheckController {

    private final VideoRelevanceService videoRelevanceService;

    public VideoCheckController(
            VideoRelevanceService videoRelevanceService) {
        this.videoRelevanceService = videoRelevanceService;
    }

    @PostMapping
    public VideoRelevance checkVideo(
            @RequestBody VideoCheckRequest request) {

        return videoRelevanceService.check(
                request.getSubject(),
                request.getTitle()
        );
    }
}
