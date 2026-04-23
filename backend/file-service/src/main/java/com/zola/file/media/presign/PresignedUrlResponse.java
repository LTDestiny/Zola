package com.zola.file.media.presign;

import java.util.List;

public record PresignedUrlResponse(List<PresignedUrlItem> items) {}
