package net.samitkumar.multi_tenant_salon.notification.internal;

import net.samitkumar.multi_tenant_salon.MultiTenantSalonApplication;
import net.samitkumar.multi_tenant_salon.TestcontainersConfiguration;
import net.samitkumar.multi_tenant_salon.shop.OrderCommunicationQueuedEvent;
import net.samitkumar.multi_tenant_salon.shop.OrderMessageRequestedEvent;
import net.samitkumar.multi_tenant_salon.shop.ShopCommunicationApi;
import net.samitkumar.multi_tenant_salon.shop.ShopOrderHistoryApi;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.modulith.events.FailedEventPublications;
import org.springframework.modulith.events.ResubmissionOptions;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.test.web.servlet.client.RestTestClient;

import java.time.Duration;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.awaitility.Awaitility.await;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@SpringBootTest(classes = MultiTenantSalonApplication.class, properties = {
        "spring.application.notification.mailjet.api-key=test-key", "app.events.retry.interval=PT1H"
})
@Import(TestcontainersConfiguration.class)
class OrderCommunicationDeliveryTests {
    @Autowired JdbcTemplate jdbc;
    @Autowired ShopCommunicationApi communications;
    @Autowired ShopOrderHistoryApi history;
    @Autowired NotificationService notifications;
    @Autowired FailedEventPublications failed;
    @MockitoBean MailjetClient mailjet;
    RestTestClient client;
    UUID salonId;
    long orderId;
    String orderNumber;

    @BeforeEach
    void setup(@Autowired WebApplicationContext context) {
        reset(mailjet);
        when(mailjet.send(any())).thenReturn(Map.of());
        client = RestTestClient.bindToApplicationContext(context).build();
        salonId = UUID.randomUUID();
        jdbc.update("INSERT INTO salon(id,name,handler,owner_name,owner_email,created_at) VALUES (?,'Communication Salon',?,'Owner','owner@example.test',now())", salonId, "comm-" + salonId);
        orderNumber = "ORD-" + salonId.toString().substring(0, 8);
        orderId = jdbc.queryForObject("INSERT INTO shop_order(salon_id,order_number,customer_name,customer_email,communication_preference,created_at) VALUES (?,?,'Alex','alex@example.test','ALL',now()) RETURNING id", Long.class, salonId, orderNumber);
    }

    @Test
    void queuedMessageIsStoredBeforeTransportAndAcceptedDoesNotMeanDelivered() {
        var savedBeforeSend = new AtomicBoolean();
        when(mailjet.send(any())).thenAnswer(invocation -> {
            var message = communications.list(salonId, orderId).getFirst();
            savedBeforeSend.set(message.status().equals("SENDING") && message.recipient().equals("alex@example.test") && message.history().size() == 1);
            return Map.of();
        });
        queue();
        var message = awaitStatus("SENT");
        assertThat(savedBeforeSend).isTrue();
        assertThat(message.history()).hasSize(1);
        assertThat(message.htmlBody()).contains("Saved email");
        verify(mailjet, times(1)).send(any());
        notifications.deliverOrderCommunication(new OrderCommunicationQueuedEvent(salonId, message.id(), 0));
        verify(mailjet, times(1)).send(any());
    }

    @Test
    void permanentFailureCanBeRetriedOnceAndOlderEventsCannotSendAgain() {
        when(mailjet.send(any())).thenThrow(HttpClientErrorException.create(HttpStatus.BAD_REQUEST, "Rejected", null, null, null));
        queue();
        var original = awaitStatus("FAILED");
        assertThat(original.failureReason()).isNotBlank();
        assertThat(original.history()).hasSize(1);
        doReturn(Map.of()).when(mailjet).send(any());
        client.post().uri(base() + "/communications/" + original.id() + "/retry").exchange().expectStatus().isOk();
        var retried = awaitStatus("SENT");
        assertThat(retried.id()).isEqualTo(original.id());
        assertThat(retried.history()).hasSize(2);
        assertThat(retried.history().getFirst().status()).isEqualTo("FAILED");
        assertThat(retried.history().getLast().status()).isEqualTo("SENT");
        client.post().uri(base() + "/communications/" + original.id() + "/retry").exchange().expectStatus().isEqualTo(409);
        notifications.deliverOrderCommunication(new OrderCommunicationQueuedEvent(salonId, original.id(), 0));
        verify(mailjet, times(2)).send(any());
    }

    @Test
    void temporaryFailureIsVisibleAndAutomaticRetryUsesSameSavedMessage() {
        when(mailjet.send(any())).thenThrow(new ResourceAccessException("offline")).thenReturn(Map.of());
        queue();
        var original = awaitStatus("RETRYING");
        assertThat(original.history().getFirst().status()).isEqualTo("FAILED");
        client.post().uri(base() + "/communications/" + original.id() + "/retry").exchange().expectStatus().isEqualTo(409);
        await().atMost(Duration.ofSeconds(15)).untilAsserted(() -> {
            failed.resubmit(ResubmissionOptions.defaults());
            assertThat(communications.list(salonId, orderId).getFirst().status()).isEqualTo("SENT");
        });
        assertThat(communications.list(salonId, orderId)).hasSize(1);
        assertThat(communications.list(salonId, orderId).getFirst().history()).hasSize(2);
    }

    @Test
    void providerErrorsInSuccessfulHttpResponsesAreRecordedAsFailed() {
        when(mailjet.send(any())).thenReturn(Map.of("Messages", java.util.List.of(Map.of("Status", "error"))));
        queue();
        assertThat(awaitStatus("FAILED").history().getFirst().status()).isEqualTo("FAILED");
    }

    @Test
    void exhaustedAutomaticRetriesBecomeManuallyRetryable() {
        when(mailjet.send(any())).thenThrow(new ResourceAccessException("offline"));
        queue();
        awaitStatus("RETRYING");
        await().atMost(Duration.ofSeconds(15)).untilAsserted(() -> {
            failed.resubmit(ResubmissionOptions.defaults());
            assertThat(communications.list(salonId, orderId).getFirst().status()).isEqualTo("FAILED");
        });
        var message = communications.list(salonId, orderId).getFirst();
        assertThat(message.history()).hasSize(3);
        doReturn(Map.of()).when(mailjet).send(any());
        client.post().uri(base() + "/communications/" + message.id() + "/retry").exchange().expectStatus().isOk();
        assertThat(awaitStatus("SENT").history()).hasSize(4);
    }

    @Test
    void anotherSalonOrAnotherOrderCannotInspectOrRetryTheMessage() {
        when(mailjet.send(any())).thenThrow(HttpClientErrorException.create(HttpStatus.BAD_REQUEST, "Rejected", null, null, null));
        queue();
        var message = awaitStatus("FAILED");
        assertThatThrownBy(() -> communications.list(UUID.randomUUID(), orderId)).isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
        assertThatThrownBy(() -> communications.retry(UUID.randomUUID(), orderId, message.id())).isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
        var other = jdbc.queryForObject("INSERT INTO shop_order(salon_id,order_number,customer_name,customer_email,created_at) VALUES (?,'OTHER','Other','other@example.test',now()) RETURNING id", Long.class, salonId);
        client.post().uri("/api/salon-admin/" + salonId + "/shop/orders/" + other + "/communications/" + message.id() + "/retry").exchange().expectStatus().isNotFound();
        verify(mailjet, times(1)).send(any());
    }

    @Test
    void manualCustomerMessageActuallySendsAndLinksItsSourceActivity() {
        client.post().uri(base() + "/notify").contentType(MediaType.APPLICATION_JSON)
                .body("{\"message\":\"Your order is ready <today>\"}").exchange().expectStatus().isOk();
        var message = awaitStatus("SENT");
        assertThat(message.body()).contains("Your order is ready <today>");
        assertThat(message.htmlBody()).contains("&lt;today&gt;");
        assertThat(message.sourceActivityId()).isNotNull();
        assertThat(jdbc.queryForObject("SELECT notified FROM shop_order_activity WHERE id=?", Boolean.class, message.sourceActivityId())).isFalse();
        notifications.notifyOrderMessage(new OrderMessageRequestedEvent(salonId, orderId, message.sourceActivityId(), orderNumber,
                "Alex", "alex@example.test", "Your order is ready <today>", "Communication Salon", false));
        assertThat(communications.list(salonId, orderId)).hasSize(1);
        verify(mailjet, times(1)).send(any());
    }

    @Test
    void itemMessagesAndInvoiceNotificationsHaveSavedCommunicationDetails() {
        var lineId = jdbc.queryForObject("INSERT INTO shop_order_line(order_id,order_key,product_name,quantity) VALUES (?,0,'Shampoo',1) RETURNING id", Long.class, orderId);
        client.post().uri(base() + "/lines/" + lineId + "/notify").contentType(MediaType.APPLICATION_JSON)
                .body("{\"message\":\"Your shampoo is ready\"}").exchange().expectStatus().isOk();
        var message = awaitStatus("SENT");
        assertThat(message.sourceLineActivityId()).isNotNull();
        assertThat(message.body()).contains("Your shampoo is ready");
        client.post().uri(base() + "/invoice").exchange().expectStatus().isOk();
        await().atMost(Duration.ofSeconds(15)).untilAsserted(() -> {
            var messages = communications.list(salonId, orderId);
            assertThat(messages).hasSize(2);
            assertThat(messages.getLast().status()).isEqualTo("SENT");
            assertThat(messages.getLast().body()).contains("Invoice reference INV-");
        });
    }

    @Test
    void preferenceSkipsAutomaticMessagesAndDeletedCustomersCannotBeRetried() {
        jdbc.update("UPDATE shop_order SET communication_preference='IMPORTANT_ONLY' WHERE id=?", orderId);
        client.post().uri(base() + "/status").contentType(MediaType.APPLICATION_JSON).body("{\"status\":\"PROCESSING\"}")
                .exchange().expectStatus().isOk();
        assertThat(awaitStatus("SKIPPED").failureReason()).contains("important updates only");
        verifyNoInteractions(mailjet);
        // A second explicit message tests redaction of the saved recipient and HTML.
        when(mailjet.send(any())).thenThrow(HttpClientErrorException.create(HttpStatus.BAD_REQUEST, "Rejected", null, null, null));
        queue();
        await().atMost(Duration.ofSeconds(15)).until(() -> communications.list(salonId, orderId).stream().anyMatch(c -> "FAILED".equals(c.status())));
        history.anonymizeCustomer(salonId, "alex@example.test", "deleted@anonymized.invalid");
        var erased = communications.list(salonId, orderId).getLast();
        assertThat(erased.recipient()).isNull();
        assertThat(erased.body()).isNull();
        assertThat(erased.htmlBody()).isNull();
        client.post().uri(base() + "/communications/" + erased.id() + "/retry").exchange().expectStatus().isEqualTo(409);
    }

    private String base() { return "/api/salon-admin/" + salonId + "/shop/orders/" + orderId; }
    private void queue() {
        communications.queue(salonId, orderNumber, new ShopCommunicationApi.Message("alex@example.test", "Alex", "Order update", "Saved email", "<p>Saved email</p>"), false);
    }
    private ShopCommunicationApi.Communication awaitStatus(String expected) {
        return await().atMost(Duration.ofSeconds(15)).pollInterval(Duration.ofMillis(100)).until(() -> {
            var rows = communications.list(salonId, orderId);
            return rows.isEmpty() ? null : rows.getFirst();
        }, row -> row != null && expected.equals(row.status()));
    }
}
