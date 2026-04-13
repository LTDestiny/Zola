package com.zola.chat.infrastructure.logging;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.RequestMappingInfo;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Component
public class EndpointLoggingRunner implements ApplicationRunner {

    private static final Logger logger = LoggerFactory.getLogger(EndpointLoggingRunner.class);

    private final RequestMappingHandlerMapping mapping;

    public EndpointLoggingRunner(
        @Qualifier("requestMappingHandlerMapping") RequestMappingHandlerMapping mapping
    ) {
        this.mapping = mapping;
    }

    @Override
    public void run(ApplicationArguments args) {
        List<String> endpoints = new ArrayList<>();

        for (RequestMappingInfo info : mapping.getHandlerMethods().keySet()) {
            for (String pattern : info.getPatternValues()) {
                if (!pattern.startsWith("/api/")) {
                    continue;
                }
                for (var method : info.getMethodsCondition().getMethods()) {
                    endpoints.add(method.name() + " " + pattern);
                }
            }
        }

        endpoints.sort(Comparator.naturalOrder());
        logger.info("Registered API endpoints (chat-service):");
        for (String endpoint : endpoints) {
            logger.info("{}", endpoint);
        }
    }
}
