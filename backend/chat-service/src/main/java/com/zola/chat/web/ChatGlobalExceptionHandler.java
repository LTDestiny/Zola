package com.zola.chat.web;

import com.zola.chat.exception.ForbiddenOperationException;
import com.zola.chat.exception.RelationshipValidationException;
import com.zola.chat.exception.ResourceNotFoundException;
import com.zola.common.response.ApiResponse;
import java.time.Instant;
import org.springframework.http.HttpStatus;
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

    @ExceptionHandler(RelationshipValidationException.class)
    @ResponseStatus(HttpStatus.SERVICE_UNAVAILABLE)
    public ApiResponse<Object> handleRelationshipValidationFailure(RelationshipValidationException ex) {
        return new ApiResponse<>(false, ex.getMessage(), null, Instant.now());
    }
}
