package com.zola.chat.web;

import com.zola.chat.exception.BusinessRuleException;
import com.zola.chat.exception.ForbiddenOperationException;
import com.zola.chat.exception.ResourceNotFoundException;
import com.zola.common.response.ApiResponse;
import java.time.Instant;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ChatGlobalExceptionHandler {

    @ExceptionHandler(ResourceNotFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public ApiResponse<Object> handleNotFound(ResourceNotFoundException ex) {
        return new ApiResponse<>(false, ex.getMessage(), null, Instant.now());
    }

    @ExceptionHandler(ForbiddenOperationException.class)
    @ResponseStatus(HttpStatus.FORBIDDEN)
    public ApiResponse<Object> handleForbidden(ForbiddenOperationException ex) {
        return new ApiResponse<>(false, ex.getMessage(), null, Instant.now());
    }

    @ExceptionHandler(IllegalArgumentException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiResponse<Object> handleBadRequest(IllegalArgumentException ex) {
        return new ApiResponse<>(false, ex.getMessage(), null, Instant.now());
    }

    @ExceptionHandler(BusinessRuleException.class)
    public ResponseEntity<ApiResponse<Map<String, Object>>> handleBusinessRule(BusinessRuleException ex) {
        ApiResponse<Map<String, Object>> body = new ApiResponse<>(
            false,
            ex.getMessage(),
            Map.of("code", ex.getCode()),
            Instant.now()
        );
        return ResponseEntity.status(ex.getStatus()).body(body);
    }
}
