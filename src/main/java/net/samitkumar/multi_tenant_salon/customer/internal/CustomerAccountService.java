package net.samitkumar.multi_tenant_salon.customer.internal;

import net.samitkumar.multi_tenant_salon.booking.Booking;
import net.samitkumar.multi_tenant_salon.booking.BookingApi;
import net.samitkumar.multi_tenant_salon.customer.internal.CustomerAccountViews.Account;
import net.samitkumar.multi_tenant_salon.customer.internal.CustomerAccountViews.BookingView;
import net.samitkumar.multi_tenant_salon.customer.internal.CustomerAccountViews.MembershipView;
import net.samitkumar.multi_tenant_salon.customer.internal.CustomerAccountViews.OrderView;
import net.samitkumar.multi_tenant_salon.customer.internal.CustomerAccountViews.Profile;
import net.samitkumar.multi_tenant_salon.membership.MembershipApi;
import net.samitkumar.multi_tenant_salon.membership.MembershipSubscription;
import net.samitkumar.multi_tenant_salon.salon.Salon;
import net.samitkumar.multi_tenant_salon.salon.SalonApi;
import net.samitkumar.multi_tenant_salon.salonservice.SalonServiceApi;
import net.samitkumar.multi_tenant_salon.salonservice.ServiceItem;
import net.samitkumar.multi_tenant_salon.shop.ShopOrderHistoryApi;
import net.samitkumar.multi_tenant_salon.staff.StaffApi;
import net.samitkumar.multi_tenant_salon.staff.StaffMember;
import net.samitkumar.multi_tenant_salon.utility.QrCodes;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.Base64;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * Everything one salon holds under one customer email — bookings, shop orders and memberships —
 * read through each module's public API. Read-only: this phase of the account changes nothing.
 */
@Service
class CustomerAccountService {

    private final SalonApi salonApi;
    private final BookingApi bookingApi;
    private final ShopOrderHistoryApi orderApi;
    private final MembershipApi membershipApi;
    private final SalonServiceApi serviceApi;
    private final StaffApi staffApi;

    CustomerAccountService(SalonApi salonApi, BookingApi bookingApi, ShopOrderHistoryApi orderApi,
                           MembershipApi membershipApi, SalonServiceApi serviceApi, StaffApi staffApi) {
        this.salonApi = salonApi;
        this.bookingApi = bookingApi;
        this.orderApi = orderApi;
        this.membershipApi = membershipApi;
        this.serviceApi = serviceApi;
        this.staffApi = staffApi;
    }

    /** The salon, or 404 when it doesn't exist or has been disabled. */
    Salon activeSalon(UUID salonId) {
        return salonApi.findById(salonId)
                .filter(s -> s.status() != Salon.SalonStatus.DISABLED)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Salon not found"));
    }

    /** Whether the salon has anything at all under this address — the condition for emailing a code. */
    boolean hasHistory(UUID salonId, String email) {
        return !bookingApi.findByCustomerEmail(salonId, email).isEmpty()
                || !membershipApi.findByCustomerEmail(salonId, email).isEmpty()
                || !orderApi.findByCustomerEmail(salonId, email).isEmpty();
    }

    Account account(UUID salonId, String email) {
        activeSalon(salonId);
        var bookings = bookingApi.findByCustomerEmail(salonId, email);
        var orders = orderApi.findByCustomerEmail(salonId, email);
        var memberships = membershipApi.findByCustomerEmail(salonId, email);

        Map<Long, ServiceItem> services = bookings.isEmpty() ? Map.of()
                : serviceApi.findAllBySalonId(salonId).stream().collect(Collectors.toMap(ServiceItem::id, Function.identity(), (a, b) -> a));
        Map<Long, StaffMember> staff = bookings.isEmpty() ? Map.of()
                : staffApi.findBySalonId(salonId).stream().collect(Collectors.toMap(StaffMember::id, Function.identity(), (a, b) -> a));

        return new Account(
                profile(email, bookings, orders, memberships),
                bookings.stream().map(b -> BookingView.of(b, services.get(b.serviceId()), staff.get(b.staffId()))).toList(),
                orders.stream().map(OrderView::of).toList(),
                memberships.stream().map(m -> MembershipView.of(m, membershipApi.payments(salonId, m.id()), qrCode(m))).toList());
    }

    /** Name and phone as most recently given to the salon, from whichever area that was. */
    private static Profile profile(String email, List<Booking> bookings, List<ShopOrderHistoryApi.CustomerOrder> orders,
                                   List<MembershipSubscription> memberships) {
        record Contact(Instant at, String name, String phone) {}
        var latest = Stream.of(
                        bookings.stream().map(b -> new Contact(b.createdAt(), b.customerName(), b.customerPhone())),
                        orders.stream().map(o -> new Contact(o.order().createdAt(), o.order().customerName(), o.order().customerPhone())),
                        memberships.stream().map(m -> new Contact(m.createdAt(), m.customerName(), m.customerPhone())))
                .flatMap(Function.identity())
                .filter(c -> c.at() != null)
                .sorted(Comparator.comparing(Contact::at).reversed())
                .toList();
        var name = latest.stream().map(Contact::name).filter(StringUtils::hasText).findFirst().orElse(null);
        var phone = latest.stream().map(Contact::phone).filter(StringUtils::hasText).findFirst().orElse(null);
        return new Profile(email, name, phone);
    }

    /** The member's check-in QR (what the welcome email carries), only while it can be used. */
    private static String qrCode(MembershipSubscription m) {
        if (!m.status().current() || !StringUtils.hasText(m.memberCode())) return null;
        return "data:image/png;base64," + Base64.getEncoder().encodeToString(QrCodes.png(m.memberCode(), 240));
    }
}
