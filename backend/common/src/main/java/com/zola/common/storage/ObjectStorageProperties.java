package com.zola.common.storage;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * AWS S3 storage settings.
 */
@ConfigurationProperties(prefix = "storage")
public class ObjectStorageProperties {

    private String accessKey;
    private String secretKey;
    private String bucket;
    private String region;

    public String getAccessKey() {
        return accessKey;
    }

    public void setAccessKey(String accessKey) {
        this.accessKey = accessKey;
    }

    public String getSecretKey() {
        return secretKey;
    }

    public void setSecretKey(String secretKey) {
        this.secretKey = secretKey;
    }

    public String getBucket() {
        return bucket;
    }

    public void setBucket(String bucket) {
        this.bucket = bucket;
    }

    public String getRegion() {
        return region;
    }

    public void setRegion(String region) {
        this.region = region;
    }
}
