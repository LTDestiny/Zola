package com.zola.gateway.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
public class GatewaySecurityConfig {

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http, GatewayJwtFilter gatewayJwtFilter) throws Exception {
        http
            .csrf(AbstractHttpConfigurer::disable)
            .cors(Customizer.withDefaults())
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                .anyRequest().permitAll()
            )
            .addFilterBefore(gatewayJwtFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOriginPatterns(List.of(
            "http://localhost:*",
            "https://localhost:*",
            "https://appassets.androidplatform.net",
            "http://127.0.0.1:*",
            "https://127.0.0.1:*",
            "http://192.168.*.*:*",
            "https://192.168.*.*:*",
            "http://10.*.*.*:*",
            "https://10.*.*.*:*",
            "http://172.16.*.*:*",
            "https://172.16.*.*:*",
            "http://172.17.*.*:*",
            "https://172.17.*.*:*",
            "http://172.18.*.*:*",
            "https://172.18.*.*:*",
            "http://172.19.*.*:*",
            "https://172.19.*.*:*",
            "http://172.20.*.*:*",
            "https://172.20.*.*:*",
            "http://172.21.*.*:*",
            "https://172.21.*.*:*",
            "http://172.22.*.*:*",
            "https://172.22.*.*:*",
            "http://172.23.*.*:*",
            "https://172.23.*.*:*",
            "http://172.24.*.*:*",
            "https://172.24.*.*:*",
            "http://172.25.*.*:*",
            "https://172.25.*.*:*",
            "http://172.26.*.*:*",
            "https://172.26.*.*:*",
            "http://172.27.*.*:*",
            "https://172.27.*.*:*",
            "http://172.28.*.*:*",
            "https://172.28.*.*:*",
            "http://172.29.*.*:*",
            "https://172.29.*.*:*",
            "http://172.30.*.*:*",
            "https://172.30.*.*:*",
            "http://172.31.*.*:*",
            "https://172.31.*.*:*"
        ));
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("*"));
        configuration.setAllowCredentials(true);
        configuration.setExposedHeaders(List.of("Authorization"));
        configuration.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}
