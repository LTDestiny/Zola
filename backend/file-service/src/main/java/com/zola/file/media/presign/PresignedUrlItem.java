package com.zola.file.media.presign;

public record PresignedUrlItem(
    String fileName,
    String fileKey,
    String uploadUrl,
    String publicUrl
) {}
