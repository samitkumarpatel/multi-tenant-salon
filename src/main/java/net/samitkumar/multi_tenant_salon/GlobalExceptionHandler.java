package net.samitkumar.multi_tenant_salon;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

import java.time.Instant;

/**
 * Turns every uncaught exception into an RFC 9457 {@link ProblemDetail} JSON body instead of the
 * default Spring Boot whitelabel {@code /error} page.
 *
 * <p>Extending {@link ResponseEntityExceptionHandler} means all the framework's own web exceptions
 * — {@code ResponseStatusException} (e.g. {@code SalonApi.resolveId} → 404 "Salon not found"),
 * {@code NoResourceFoundException} (unknown route), {@code MethodArgumentTypeMismatchException}
 * (a non-numeric {@code {serviceId}}), bean-validation failures — are already rendered as
 * {@code ProblemDetail}; here we only add a {@code timestamp} property and a log line, plus a
 * catch-all so an unexpected exception returns a clean 500 body rather than leaking a stack trace.
 *
 * <p>Because these are handled inside the original request, no forward to {@code /error} happens
 * for them — but {@code /error} is still permitted in the security config as a safety net for
 * container-level errors.
 */
@RestControllerAdvice
@Slf4j
class GlobalExceptionHandler extends ResponseEntityExceptionHandler {

    @Override
    protected ResponseEntity<Object> handleExceptionInternal(Exception ex, Object body,
            HttpHeaders headers, HttpStatusCode statusCode, WebRequest request) {
        var response = super.handleExceptionInternal(ex, body, headers, statusCode, request);
        if (response != null && response.getBody() instanceof ProblemDetail problem) {
            enrich(problem);
        }
        if (statusCode.is5xxServerError()) {
            log.error("{} handling {}", statusCode, request.getDescription(false), ex);
        } else {
            log.warn("{} handling {}: {}", statusCode, request.getDescription(false), ex.getMessage());
        }
        return response;
    }

    /** Anything not covered by {@link ResponseEntityExceptionHandler} → 500 ProblemDetail. */
    @ExceptionHandler(Exception.class)
    ProblemDetail handleUnexpected(Exception ex, WebRequest request) {
        log.error("Unhandled exception handling {}", request.getDescription(false), ex);
        var problem = ProblemDetail.forStatusAndDetail(HttpStatus.INTERNAL_SERVER_ERROR,
                "An unexpected error occurred. Please try again later.");
        problem.setTitle("Internal Server Error");
        enrich(problem);
        return problem;
    }

    private void enrich(ProblemDetail problem) {
        problem.setProperty("timestamp", Instant.now());
    }
}
