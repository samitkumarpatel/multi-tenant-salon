package net.samitkumar.multi_tenant_salon.notification.internal;

import net.samitkumar.multi_tenant_salon.booking.BookingCreatedEvent;
import net.samitkumar.multi_tenant_salon.booking.BookingPaymentLinkEvent;
import net.samitkumar.multi_tenant_salon.booking.BookingRescheduledEvent;
import net.samitkumar.multi_tenant_salon.booking.BookingStatus;
import net.samitkumar.multi_tenant_salon.booking.BookingStatusChangedEvent;
import net.samitkumar.multi_tenant_salon.customer.CustomerSignInCodeRequestedEvent;
import net.samitkumar.multi_tenant_salon.dashboard.PosReceiptRequestedEvent;
import net.samitkumar.multi_tenant_salon.dashboard.PosSale;
import net.samitkumar.multi_tenant_salon.loyalty.LoyaltyRedeemedEvent;
import net.samitkumar.multi_tenant_salon.membership.BillingInterval;
import net.samitkumar.multi_tenant_salon.membership.MembershipActivatedEvent;
import net.samitkumar.multi_tenant_salon.membership.MembershipCancelledEvent;
import net.samitkumar.multi_tenant_salon.membership.MembershipRenewalDueEvent;
import net.samitkumar.multi_tenant_salon.salon.Salon;
import net.samitkumar.multi_tenant_salon.salon.SalonApi;
import net.samitkumar.multi_tenant_salon.salon.SalonFeature;
import net.samitkumar.multi_tenant_salon.shop.CommunicationPreference;
import net.samitkumar.multi_tenant_salon.shop.OrderLineActivityAddedEvent;
import net.samitkumar.multi_tenant_salon.shop.OrderLineActivityType;
import net.samitkumar.multi_tenant_salon.shop.OrderPlacedEvent;
import net.samitkumar.multi_tenant_salon.shop.OrderStatus;
import net.samitkumar.multi_tenant_salon.shop.OrderStatusChangedEvent;
import net.samitkumar.multi_tenant_salon.staff.StaffOnboardedEvent;
import net.samitkumar.multi_tenant_salon.staff.StaffRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(OutputCaptureExtension.class)
class CustomerAccountLinkNotificationTest {
    private final UUID salonId = UUID.randomUUID();
    private final BigDecimal price = new BigDecimal("49.00");
    private final Instant end = Instant.parse("2026-11-21T10:00:00Z");
    private final LocalDate date = LocalDate.of(2026, 11, 10);
    private final LocalTime time = LocalTime.of(10, 0);
    private MailjetClient mailjet;
    private SalonApi salons;
    private Salon salon;
    private NotificationService notifications;

    @BeforeEach
    void setup() {
        mailjet = mock(MailjetClient.class);
        salons = mock(SalonApi.class);
        salon = mock(Salon.class);
        when(salon.id()).thenReturn(salonId);
        when(salon.name()).thenReturn("Glow Studio");
        when(salon.features()).thenReturn(List.of(new Salon.SalonFeatureRef(SalonFeature.BOOKING)));
        // No website feature or domain is needed for the booking app's account route.
        when(salons.findById(salonId)).thenReturn(Optional.of(salon));
        when(mailjet.send(any())).thenReturn(Map.of());
        notifications = new NotificationService(mailjet, mock(ApplicationEventPublisher.class), salons);
        ReflectionTestUtils.setField(notifications, "apiKey", "test-key");
        ReflectionTestUtils.setField(notifications, "bookingAppUrl", "https://book.example.test/");
        ReflectionTestUtils.setField(notifications, "salonDomain", "example.test");
        ReflectionTestUtils.setField(notifications, "sender", "salon@example.test");
        ReflectionTestUtils.setField(notifications, "senderName", "Salon");
    }

    @ParameterizedTest
    @ValueSource(strings = {"booking", "booking-update", "booking-review", "booking-payment", "booking-rescheduled",
            "receipt", "order", "order-status", "order-line", "membership-WELCOME", "membership-RENEWED",
            "membership-RESEND", "membership-cancelled", "membership-renewal", "membership-expired", "loyalty", "sign-in"})
    void everyCustomerEmailLinksTheCorrectSalonsAccountInBothFormats(String type) {
        sendCustomerNotification(type);
        var message = sentMessage();
        var accountUrl = "https://book.example.test/" + salonId + "/account";
        assertThat(message.textPart()).containsOnlyOnce(accountUrl).contains("Manage your customer account:");
        assertThat(message.htmlPart()).containsOnlyOnce("href=\"" + accountUrl + "\"")
                .contains("Manage your customer account").doesNotContain("/null/account", "//" + salonId);
        assertThat(message.to()).extracting(MailjetEmail::email).containsExactly("customer@example.test");
        if (type.equals("booking-review")) {
            assertThat(message.textPart()).contains("/review/review-token").doesNotContain("/feedback?");
            assertThat(message.htmlPart()).contains("/review/review-token").doesNotContain("/feedback?");
        }
        if (type.equals("sign-in")) {
            assertThat(message.textPart()).contains("123456").doesNotContain("/feedback?");
            assertThat(message.htmlPart()).contains("123456").doesNotContain("/feedback?");
        }
    }

    @Test
    void missingSalonDoesNotGenerateAnInvalidAccountLink() {
        when(salons.findById(salonId)).thenReturn(Optional.empty());
        sendCustomerNotification("booking-update");
        var message = sentMessage();
        assertThat(message.textPart()).doesNotContain("/account", "Manage your customer account");
        assertThat(message.htmlPart()).doesNotContain("/account", "Manage your customer account");
    }

    @Test
    void dashboardOnlyReceiptDoesNotLinkAnUnavailableAccount() {
        when(salon.features()).thenReturn(List.of(new Salon.SalonFeatureRef(SalonFeature.DASHBOARD)));
        sendCustomerNotification("receipt");
        var message = sentMessage();
        assertThat(message.textPart()).doesNotContain("/account");
        assertThat(message.htmlPart()).doesNotContain("/account");
    }

    @Test
    void bookingSmsFallbackIncludesTheAccountLink(CapturedOutput output) {
        notifications.notifyBookingCreated(new BookingCreatedEvent(1L, salonId, 1L, 2L,
                "Customer", null, "+4512345678", date, time, time.plusHours(1), BookingStatus.CONFIRMED,
                "Glow Studio", null, null));
        assertThat(output.getOut()).contains("[SMS MOCK → CUSTOMER]", "https://book.example.test/" + salonId + "/account");
        verifyNoInteractions(mailjet);
    }

    @Test
    void staffNotificationsDoNotLinkCustomerAccounts() {
        ReflectionTestUtils.setField(notifications, "staffAppUrl", "https://staff.example.test");
        ReflectionTestUtils.setField(notifications, "helpUrl", "https://help.example.test");
        notifications.notifyStaffOnboarded(new StaffOnboardedEvent(salonId, 3L, "Sam", "sam@example.test", StaffRole.STYLIST,
                "Glow Studio", "glow", List.of()));
        var message = sentMessage();
        assertThat(message.textPart()).doesNotContain("/account", "Manage your customer account");
        assertThat(message.htmlPart()).doesNotContain("/account", "Manage your customer account");
    }

    private void sendCustomerNotification(String type) {
        switch (type) {
            case "booking" -> notifications.notifyBookingCreated(new BookingCreatedEvent(1L, salonId, 1L, 2L,
                    "Customer", "customer@example.test", null, date, time, time.plusHours(1), BookingStatus.CONFIRMED,
                    "Glow Studio", null, null));
            case "booking-update", "booking-review" -> notifications.notifyBookingStatusChanged(new BookingStatusChangedEvent(
                    1L, salonId, BookingStatus.COMPLETED, "Customer", "customer@example.test", null, date, time, time.plusHours(1),
                    "Glow Studio", null, null, type.equals("booking-review") ? "review-token" : null));
            case "booking-payment" -> notifications.notifyBookingPaymentLink(new BookingPaymentLinkEvent(1L, salonId,
                    "Customer", "customer@example.test", date, time, "Haircut", price, "EUR", "https://pay.example.test/checkout",
                    "Glow Studio", null, null));
            case "booking-rescheduled" -> notifications.notifyBookingRescheduled(new BookingRescheduledEvent(1L, salonId, 2L,
                    "Customer", "customer@example.test", null, date, time, time.plusHours(1), "Glow Studio", null, null));
            case "receipt" -> notifications.notifyPosReceipt(new PosReceiptRequestedEvent(salonId, "Glow Studio", null, null,
                    "SALE-1", "Customer", "customer@example.test", PosSale.PaymentMethod.CARD, "EUR", price, end,
                    price, BigDecimal.ZERO, BigDecimal.ZERO, List.of(new PosReceiptRequestedEvent.Line("Haircut", 1, price, price))));
            case "order" -> notifications.notifyOrderPlaced(new OrderPlacedEvent(1L, salonId, "ORDER-1", "Customer",
                    "customer@example.test", null, 1, price, "EUR", "Glow Studio", null, null, CommunicationPreference.ALL, null, null));
            case "order-status" -> notifications.notifyOrderStatusChanged(new OrderStatusChangedEvent(1L, salonId, "ORDER-1",
                    OrderStatus.FULFILLED, "Customer", "customer@example.test", "Glow Studio", null, null, null));
            case "order-line" -> notifications.notifyOrderLineUser(new OrderLineActivityAddedEvent(1L, salonId, "ORDER-1", 2L,
                    "Shampoo", OrderLineActivityType.USER_NOTIFIED, "Your order is ready", "Customer", "customer@example.test", "Glow Studio", null));
            case "membership-WELCOME", "membership-RENEWED", "membership-RESEND" -> notifications.notifyMembershipActivated(
                    new MembershipActivatedEvent(1L, salonId, "MEMBER123", "Customer", "customer@example.test", "Glow Monthly",
                            price, "EUR", BillingInterval.MONTHLY, end, List.of("Priority booking"), "Glow Studio", null, null,
                            MembershipActivatedEvent.Kind.valueOf(type.substring("membership-".length()))));
            case "membership-cancelled" -> notifications.notifyMembershipCancelled(new MembershipCancelledEvent(1L, salonId,
                    "MEMBER123", "Customer", "customer@example.test", "Glow Monthly", end, false, "Glow Studio", null, null));
            case "membership-renewal", "membership-expired" -> notifications.notifyMembershipRenewalDue(new MembershipRenewalDueEvent(
                    1L, salonId, "MEMBER123", "Customer", "customer@example.test", "Glow Monthly", price, "EUR", BillingInterval.MONTHLY,
                    end, type.equals("membership-expired"), "renew-token", "glow", "Glow Studio", null, null));
            case "loyalty" -> notifications.notifyLoyaltyRedeemed(new LoyaltyRedeemedEvent(1L, salonId, "customer@example.test",
                    "Free treatment", "REWARD123", 100, 50, "Glow Studio", null, null));
            case "sign-in" -> notifications.notifyCustomerSignInCode(new CustomerSignInCodeRequestedEvent(salonId,
                    "Glow Studio", null, null, "customer@example.test", "123456", Instant.now().plusSeconds(600)));
            default -> throw new IllegalArgumentException(type);
        }
    }

    private MailjetMessage sentMessage() {
        var request = ArgumentCaptor.forClass(MailjetRequest.class);
        verify(mailjet).send(request.capture());
        return request.getValue().messages().getFirst();
    }
}
