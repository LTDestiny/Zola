package com.zola.auth.service;

public interface EmailSenderService {
    void sendOtpEmail(String email, String code, String purpose, int ttlSeconds);
}
