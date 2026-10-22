package net.samitkumar.multi_tenant_salon.payments.internal;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.server.ResponseStatusException;

import java.net.URI;
import java.util.Map;

/**
 * The platform's calls to Stripe: v1 form requests (Checkout, Terminal, refunds, account sessions — sent
 * on the salon's connected account via {@code Stripe-Account}) and v2 JSON requests (Accounts v2). Every
 * call pins {@code Stripe-Version}, so the enums used here (e.g. Checkout's {@code ui_mode}) don't drift
 * with the account's default API version.
 */
@Component
class StripeClient {
    private final RestClient stripe;
    private final String secretKey;
    private final String publishableKey;
    private final String apiVersion;

    StripeClient(RestClient.Builder clientBuilder,
                 @Value("${spring.application.payments.stripe-secret-key:}") String secretKey,
                 @Value("${spring.application.payments.stripe-publishable-key:}") String publishableKey,
                 @Value("${spring.application.payments.stripe-api-version:2026-08-26.dahlia}") String apiVersion) {
        this.stripe = clientBuilder.baseUrl("https://api.stripe.com").build();
        this.secretKey = secretKey;
        this.publishableKey = publishableKey;
        this.apiVersion = apiVersion;
    }

    boolean secretConfigured() { return secretKey != null && !secretKey.isBlank(); }

    boolean testMode() { return secretConfigured() && secretKey.startsWith("sk_test_"); }

    /** Null when unset: then only the redirect checkout can be offered. */
    String publishableKey() { return publishableKey == null || publishableKey.isBlank() ? null : publishableKey; }

    @SuppressWarnings("unchecked")
    Map<String, Object> post(String path, MultiValueMap<String, String> form, String idempotencyKey, String connectedAccount) {
        requireSecret();
        try {
            var request = stripe.post().uri(path).header("Authorization", "Bearer " + secretKey)
                    .header("Stripe-Version", apiVersion)
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED);
            if (idempotencyKey != null) request.header("Idempotency-Key", idempotencyKey);
            if (connectedAccount != null) request.header("Stripe-Account", connectedAccount);
            return request.body(form).retrieve().body(Map.class);
        } catch (Exception e) {
            throw failure("Stripe request failed", e);
        }
    }

    @SuppressWarnings("unchecked")
    Map<String, Object> get(String pathAndQuery, String connectedAccount) {
        requireSecret();
        try {
            var request = stripe.get().uri(URI.create("https://api.stripe.com" + pathAndQuery))
                    .header("Authorization", "Bearer " + secretKey).header("Stripe-Version", apiVersion);
            if (connectedAccount != null) request.header("Stripe-Account", connectedAccount);
            return request.retrieve().body(Map.class);
        } catch (Exception e) {
            throw failure("Stripe request failed", e);
        }
    }

    @SuppressWarnings("unchecked")
    Map<String, Object> delete(String path, String connectedAccount) {
        requireSecret();
        try {
            var request = stripe.delete().uri(path).header("Authorization", "Bearer " + secretKey)
                    .header("Stripe-Version", apiVersion);
            if (connectedAccount != null) request.header("Stripe-Account", connectedAccount);
            return request.retrieve().body(Map.class);
        } catch (Exception e) {
            throw failure("Stripe request failed", e);
        }
    }

    @SuppressWarnings("unchecked")
    Map<String, Object> postV2(String path, Map<String, Object> body, String idempotencyKey) {
        requireSecret();
        try {
            var request = stripe.post().uri(path).header("Authorization", "Bearer " + secretKey)
                    .header("Stripe-Version", apiVersion).contentType(MediaType.APPLICATION_JSON);
            if (idempotencyKey != null) request.header("Idempotency-Key", idempotencyKey);
            return request.body(body).retrieve().body(Map.class);
        } catch (Exception e) {
            throw failure("Stripe request failed", e);
        }
    }

    @SuppressWarnings("unchecked")
    Map<String, Object> getV2(String pathAndQuery) {
        try {
            return stripe.get().uri(URI.create("https://api.stripe.com" + pathAndQuery))
                    .header("Authorization", "Bearer " + secretKey).header("Stripe-Version", apiVersion)
                    .retrieve().body(Map.class);
        } catch (Exception e) {
            throw failure("Could not retrieve Stripe account status", e);
        }
    }

    private void requireSecret() {
        if (!secretConfigured()) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Stripe payments are not configured");
    }

    /** Stripe's error {@code code} (e.g. {@code terminal_reader_busy}) when {@code e} came from a Stripe error response. */
    static String errorCode(Throwable e) {
        var cause = e instanceof ResponseStatusException r && r.getCause() != null ? r.getCause() : e;
        if (!(cause instanceof RestClientResponseException response)) return null;
        try {
            @SuppressWarnings("unchecked") var error = (Map<String, Object>) new tools.jackson.databind.ObjectMapper()
                    .readValue(response.getResponseBodyAsString(), Map.class).get("error");
            return error != null && error.get("code") instanceof String code ? code : null;
        } catch (RuntimeException ignored) {
            return null;
        }
    }

    /** Surfaces Stripe's own error message (never the key) so admins see why Stripe refused a request. */
    static ResponseStatusException failure(String summary, Exception e) {
        if (e instanceof ResponseStatusException status) return status;
        if (e instanceof RestClientResponseException response) {
            try {
                @SuppressWarnings("unchecked") var error = (Map<String, Object>) new tools.jackson.databind.ObjectMapper()
                        .readValue(response.getResponseBodyAsString(), Map.class).get("error");
                if (error != null && error.get("message") instanceof String message && !message.isBlank()) {
                    return new ResponseStatusException(HttpStatus.BAD_GATEWAY, summary + ": " + message, e);
                }
            } catch (RuntimeException ignored) {
                // Fall through to the generic message when Stripe's body isn't the usual error envelope.
            }
        }
        return new ResponseStatusException(HttpStatus.BAD_GATEWAY, summary, e);
    }
}
