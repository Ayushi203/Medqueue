
package com.medqueue.exception;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.DateTimeException;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<ApiErrorResponse> handleRuntimeException(
            RuntimeException exception,
            HttpServletRequest request) {

        String message = exception.getMessage();

        HttpStatus status = HttpStatus.BAD_REQUEST;

        if (message == null || message.isBlank()) {
            message = "Unable to process the request.";
        }

        return buildResponse(
                status,
                message,
                request.getRequestURI()
        );
    }

    // Unique key clash, e.g. two people grabbing the same slot at once
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ApiErrorResponse> handleDataIntegrity(
            DataIntegrityViolationException exception,
            HttpServletRequest request) {

        String message = "This record conflicts with existing data.";

        if (String.valueOf(exception.getMostSpecificCause().getMessage())
                .contains("uk_appointment_active_slot")) {
            message = "This time slot was just booked by someone else. Please choose another slot.";
        }

        return buildResponse(
                HttpStatus.CONFLICT,
                message,
                request.getRequestURI()
        );
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiErrorResponse> handleAccessDenied(
            AccessDeniedException exception,
            HttpServletRequest request) {

        return buildResponse(
                HttpStatus.FORBIDDEN,
                exception.getMessage(),
                request.getRequestURI()
        );
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ApiErrorResponse> handleResponseStatus(
            ResponseStatusException exception,
            HttpServletRequest request) {

        return buildResponse(
                HttpStatus.valueOf(exception.getStatusCode().value()),
                exception.getReason(),
                request.getRequestURI()
        );
    }

    @ExceptionHandler(DateTimeException.class)
    public ResponseEntity<ApiErrorResponse> handleDateTimeException(
            DateTimeException exception,
            HttpServletRequest request) {

        return buildResponse(
                HttpStatus.BAD_REQUEST,
                "Invalid date or time format.",
                request.getRequestURI()
        );
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiErrorResponse> handleGeneralException(
            Exception exception,
            HttpServletRequest request) {

        return buildResponse(
                HttpStatus.INTERNAL_SERVER_ERROR,
                "Something went wrong on the server.",
                request.getRequestURI()
        );
    }

    private ResponseEntity<ApiErrorResponse> buildResponse(
            HttpStatus status,
            String message,
            String path) {

        ApiErrorResponse response =
                new ApiErrorResponse(
                        status.value(),
                        status.getReasonPhrase(),
                        message,
                        path
                );

        return ResponseEntity
                .status(status)
                .body(response);
    }
}

