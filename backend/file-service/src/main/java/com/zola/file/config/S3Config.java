package com.zola.file.config;

import com.zola.common.storage.ObjectStorageProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;

@Configuration
public class S3Config {

    @Bean
    public S3Client s3Client(ObjectStorageProperties properties) {
        var builder = S3Client.builder()
            .region(Region.of(properties.getRegion()));

        if (properties.getAccessKey() != null && !properties.getAccessKey().isBlank()
            && properties.getSecretKey() != null && !properties.getSecretKey().isBlank()) {
            builder.credentialsProvider(
                StaticCredentialsProvider.create(
                    AwsBasicCredentials.create(properties.getAccessKey(), properties.getSecretKey())
                )
            );
        }

        return builder.build();
    }
}
