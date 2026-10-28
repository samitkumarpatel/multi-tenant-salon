package net.samitkumar.multi_tenant_salon.loyalty.internal;

import lombok.extern.slf4j.Slf4j;
import net.samitkumar.multi_tenant_salon.booking.BookingApi;
import net.samitkumar.multi_tenant_salon.booking.BookingStatus;
import net.samitkumar.multi_tenant_salon.booking.BookingStatusChangedEvent;
import net.samitkumar.multi_tenant_salon.loyalty.CounterSaleSettledEvent;
import net.samitkumar.multi_tenant_salon.loyalty.CounterSaleVoidedEvent;
import net.samitkumar.multi_tenant_salon.salonservice.SalonServiceApi;
import net.samitkumar.multi_tenant_salon.salonservice.ServiceItem;
import net.samitkumar.multi_tenant_salon.shop.OrderPlacedEvent;
import net.samitkumar.multi_tenant_salon.shop.OrderStatus;
import net.samitkumar.multi_tenant_salon.shop.OrderStatusChangedEvent;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;

import static net.samitkumar.multi_tenant_salon.loyalty.internal.LoyaltyService.*;

/**
 * Turns completed appointments and paid shop orders into points. Delivery is at-least-once, so every
 * write is keyed on its source (see {@code loyalty_ledger_source_uq}) and a redelivery changes nothing.
 */
@Component
@Slf4j
class LoyaltyEventListeners {
    private final LoyaltyService loyalty;
    private final BookingApi bookings;
    private final SalonServiceApi services;

    LoyaltyEventListeners(LoyaltyService loyalty, BookingApi bookings, SalonServiceApi services) {
        this.loyalty = loyalty;
        this.bookings = bookings;
        this.services = services;
    }

    @ApplicationModuleListener
    void onBookingStatusChanged(BookingStatusChangedEvent event) {
        var sourceId = String.valueOf(event.bookingId());
        if (event.newStatus() == BookingStatus.COMPLETED) {
            // The event does not carry a price; it lives on the booked service.
            var price = bookings.findById(event.salonId(), event.bookingId())
                    .flatMap(booking -> services.findByIdAndSalonId(booking.serviceId(), event.salonId()))
                    .map(ServiceItem::price).orElse(null);
            loyalty.earn(event.salonId(), event.customerEmail(), EARN_BOOKING, SOURCE_BOOKING, sourceId, price);
        } else if (event.newStatus() == BookingStatus.CANCELLED || event.newStatus() == BookingStatus.NO_SHOW) {
            loyalty.reverse(event.salonId(), EARN_BOOKING, SOURCE_BOOKING, sourceId);
        }
    }

    /** Published once the order is paid (immediately for an unpaid-online checkout, after the webhook for Stripe). Shipping is not spend. */
    @ApplicationModuleListener
    void onOrderPlaced(OrderPlacedEvent event) {
        loyalty.earn(event.salonId(), event.customerEmail(), EARN_ORDER, SOURCE_ORDER, String.valueOf(event.orderId()), event.subtotal());
    }

    /** Items sold at the counter earn like a shop order; the sale id is the source, so a redelivery changes nothing. */
    @ApplicationModuleListener
    void onCounterSaleSettled(CounterSaleSettledEvent event) {
        loyalty.earn(event.salonId(), event.customerEmail(), EARN_POS, SOURCE_POS, String.valueOf(event.saleId()), event.earnableAmount());
    }

    @ApplicationModuleListener
    void onCounterSaleVoided(CounterSaleVoidedEvent event) {
        loyalty.reverse(event.salonId(), EARN_POS, SOURCE_POS, String.valueOf(event.saleId()));
    }

    @ApplicationModuleListener
    void onOrderStatusChanged(OrderStatusChangedEvent event) {
        if (event.newStatus() == OrderStatus.CANCELLED || event.newStatus() == OrderStatus.FAILED) {
            loyalty.reverse(event.salonId(), EARN_ORDER, SOURCE_ORDER, String.valueOf(event.orderId()));
        }
    }
}
