package com.zola.file.media.presign;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.List;

public record PresignedUrlRequest(

    @NotEmpty(message = "File list must not be empty")
    @Size(max = 10, message = "Maximum 10 files per request")
    List<@Valid FileUploadItem> files

) {

    public record FileUploadItem(
        @NotBlank(message = "fileName is required") String fileName,
        @NotBlank(message = "contentType is required") String contentType,
        long sizeBytes
    ) {}
}
