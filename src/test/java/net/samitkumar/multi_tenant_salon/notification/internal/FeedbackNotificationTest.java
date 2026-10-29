package net.samitkumar.multi_tenant_salon.notification.internal;

import net.samitkumar.multi_tenant_salon.booking.BookingStatus;
import net.samitkumar.multi_tenant_salon.booking.BookingStatusChangedEvent;
import net.samitkumar.multi_tenant_salon.salon.Salon;
import net.samitkumar.multi_tenant_salon.salon.SalonApi;
import net.samitkumar.multi_tenant_salon.shop.OrderStatus;
import net.samitkumar.multi_tenant_salon.shop.OrderStatusChangedEvent;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class FeedbackNotificationTest {
    MailjetClient mailjet;
    NotificationService notifications;
    UUID salonId = UUID.randomUUID();

    @BeforeEach void setup() {
        mailjet = mock(MailjetClient.class);
        var salons = mock(SalonApi.class);
        var salon = mock(Salon.class);
        when(salon.id()).thenReturn(salonId); when(salon.name()).thenReturn("Feedback salon");
        when(salons.findById(salonId)).thenReturn(Optional.of(salon));
        when(mailjet.send(any())).thenReturn(Map.of());
        notifications = new NotificationService(mailjet, mock(ApplicationEventPublisher.class), salons);
        ReflectionTestUtils.setField(notifications, "apiKey", "test-key");
        ReflectionTestUtils.setField(notifications, "bookingAppUrl", "https://book.example.test");
        ReflectionTestUtils.setField(notifications, "sender", "salon@example.test");
        ReflectionTestUtils.setField(notifications, "senderName", "Salon");
    }

    @Test void completionEmailHasOneBookingBoundReviewLink() {
        notifications.notifyBookingStatusChanged(new BookingStatusChangedEvent(1L, salonId, BookingStatus.COMPLETED,
                "Customer", "customer@example.test", null, null, null, null, "Feedback salon", null, null, "secret-token"));
        var request = ArgumentCaptor.forClass(MailjetRequest.class);
        verify(mailjet).send(request.capture());
        var message = request.getValue().messages().getFirst();
        assertThat(message.textPart()).contains("https://book.example.test/review/secret-token").doesNotContain("/feedback?");
        assertThat(message.htmlPart()).contains("https://book.example.test/review/secret-token");
    }

    @Test void fulfilledOrderEmailLinksDirectlyToFeedbackWithoutAccountSignIn() {
        notifications.notifyOrderStatusChanged(new OrderStatusChangedEvent(1L, salonId, "ORDER-1", OrderStatus.FULFILLED,
                "Customer", "customer@example.test", "Feedback salon", null, null, null));
        var request = ArgumentCaptor.forClass(MailjetRequest.class);
        verify(mailjet).send(request.capture());
        var message = request.getValue().messages().getFirst();
        assertThat(message.textPart()).contains("https://book.example.test/" + salonId + "/feedback?source=NOTIFICATION").doesNotContain("/account");
        assertThat(message.htmlPart()).contains("/feedback?source=NOTIFICATION");
    }
}
