package com.zola.auth.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
public class SmtpEmailSenderService implements EmailSenderService {

    private final JavaMailSender mailSender;
    private final String from;

    public SmtpEmailSenderService(JavaMailSender mailSender, @Value("${app.mail.from:${SMTP_USER:noreply@zola.app}}") String from) {
        this.mailSender = mailSender;
        this.from = from;
    }

    @Override
    public void sendOtpEmail(String email, String code, String purpose, int ttlSeconds) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(from);
        message.setTo(email);
        message.setSubject("Zola OTP - " + purpose);
        message.setText("Your OTP code is: " + code + "\nThis code expires in " + ttlSeconds + " seconds.");
        mailSender.send(message);
    }
}
