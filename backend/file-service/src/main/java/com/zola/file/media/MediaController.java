package com.zola.file.media;

import com.zola.common.response.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/media")
public class MediaController {

    private final MediaUploadService mediaUploadService;

    public MediaController(MediaUploadService mediaUploadService) {
        this.mediaUploadService = mediaUploadService;
    }

    @PostMapping("/upload")
    public ApiResponse<MediaUploadService.UploadedMedia> upload(
        @RequestPart("file") MultipartFile file,
        @RequestHeader(value = "X-User-Id", required = false) String userId,
        HttpServletRequest request
    ) {
        String currentUserId = userId;
        if (currentUserId == null || currentUserId.isBlank()) {
            Object attr = request.getAttribute("X_USER_ID");
            if (attr instanceof String value && !value.isBlank()) {
                currentUserId = value;
            }
        }
        if (currentUserId == null || currentUserId.isBlank()) {
            currentUserId = "anonymous";
        }

        return ApiResponse.ok("Upload success", mediaUploadService.upload(currentUserId, file));
    }
}
