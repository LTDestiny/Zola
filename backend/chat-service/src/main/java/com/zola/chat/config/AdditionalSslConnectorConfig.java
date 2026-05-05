package com.zola.chat.config;

import org.apache.catalina.connector.Connector;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.embedded.tomcat.TomcatServletWebServerFactory;
import org.springframework.boot.web.server.WebServerFactoryCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class AdditionalSslConnectorConfig {

    @Bean
    public WebServerFactoryCustomizer<TomcatServletWebServerFactory> sslConnectorCustomizer(
        @Value("${app.ssl.enabled:false}") boolean enabled,
        @Value("${app.ssl.port:18443}") int port,
        @Value("${app.ssl.key-store:}") String keyStore,
        @Value("${app.ssl.key-store-password:}") String keyStorePassword,
        @Value("${app.ssl.key-store-type:PKCS12}") String keyStoreType
    ) {
        return factory -> {
            if (!enabled) {
                return;
            }

            Connector connector = new Connector(TomcatServletWebServerFactory.DEFAULT_PROTOCOL);
            connector.setScheme("https");
            connector.setSecure(true);
            connector.setPort(port);

            connector.setProperty("SSLEnabled", "true");
            connector.setProperty("keystoreFile", keyStore);
            connector.setProperty("keystorePass", keyStorePassword);
            connector.setProperty("keystoreType", keyStoreType);

            factory.addAdditionalTomcatConnectors(connector);
        };
    }
}
