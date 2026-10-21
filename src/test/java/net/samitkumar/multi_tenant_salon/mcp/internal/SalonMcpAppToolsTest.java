package net.samitkumar.multi_tenant_salon.mcp.internal;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.modelcontextprotocol.spec.McpSchema;
import net.samitkumar.multi_tenant_salon.booking.AvailableSlot;
import net.samitkumar.multi_tenant_salon.booking.BookingApi;
import net.samitkumar.multi_tenant_salon.booking.SalonAvailability;
import net.samitkumar.multi_tenant_salon.salon.Salon;
import net.samitkumar.multi_tenant_salon.salon.SalonApi;
import net.samitkumar.multi_tenant_salon.salon.SalonFeature;
import net.samitkumar.multi_tenant_salon.salonservice.SalonServiceApi;
import net.samitkumar.multi_tenant_salon.salonservice.ServiceCategory;
import net.samitkumar.multi_tenant_salon.salonservice.ServiceItem;
import net.samitkumar.multi_tenant_salon.staff.StaffApi;
import net.samitkumar.multi_tenant_salon.staff.StaffMember;
import net.samitkumar.multi_tenant_salon.staff.StaffRole;
import net.samitkumar.multi_tenant_salon.staff.StaffStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.temporal.TemporalAdjusters;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** The dedicated Salon MCP Apps: payload shapes the app UIs rely on, and their guard rails. */
@SuppressWarnings("unchecked")
class SalonMcpAppToolsTest {

    private final UUID salonId = UUID.randomUUID();
    private final SalonApi salons = mock(SalonApi.class);
    private final SalonServiceApi services = mock(SalonServiceApi.class);
    private final StaffApi staff = mock(StaffApi.class);
    private final BookingApi bookings = mock(BookingApi.class);
    private final SalonMcpShopClient shopClient = mock(SalonMcpShopClient.class);
    private final SalonMcpMembershipClient membershipClient = mock(SalonMcpMembershipClient.class);
    private final ObjectMapper mapper = new ObjectMapper();
    private final SalonMcpSupport support = new SalonMcpSupport(salons, mapper);

    private final ServiceItem haircut = service(1L, "Haircut", ServiceCategory.HAIR, 30, "7");
    private final ServiceItem colour = service(2L, "Colour", ServiceCategory.HAIR, 90);
    private final ServiceItem manicure = service(3L, "Manicure", ServiceCategory.NAILS, 45, "8");
    private final StaffMember anna = member(7L, "Anna", true, "Balayage", "Cuts");
    private final StaffMember ben = member(8L, "Ben", true, "Nails");

    @BeforeEach
    void salonWith() {
        givenSalon(SalonFeature.BOOKING, SalonFeature.WEBSHOP);
        when(services.findAllBySalonId(salonId)).thenReturn(List.of(haircut, colour, manicure));
        when(services.findByIdAndSalonId(any(), eq(salonId))).thenAnswer(inv -> List.of(haircut, colour, manicure).stream()
                .filter(s -> s.id().equals(inv.getArgument(0))).findFirst());
        when(staff.findBySalonId(salonId)).thenReturn(List.of(anna, ben));
        when(staff.findByIdAndSalonId(any(), eq(salonId))).thenAnswer(inv -> List.of(anna, ben).stream()
                .filter(m -> m.id().equals(inv.getArgument(0))).findFirst());
    }

    @Test
    void servicesAppCountsCategoriesAndListsWhoPerformsEachService() {
        var data = structured(catalog().exploreServices(salonId.toString(), "nails", 3L, null));

        assertThat(data).containsEntry("app", "salon_services").containsEntry("category", "NAILS").containsEntry("serviceId", 3L);
        assertThat(list(data, "categories")).containsExactly(Map.of("id", "HAIR", "count", 2L), Map.of("id", "NAILS", "count", 1L));
        assertThat(list(data, "items")).extracting(i -> i.get("staffIds")).containsExactly(List.of(7L), List.of(), List.of(8L));
        assertThat(list(data, "staff")).extracting(i -> i.get("name")).containsExactly("Anna", "Ben");
    }

    @Test
    void teamAppListsOnlyExplicitlyAssignedServicesPerStylistAndDistinctSpecialisations() {
        var data = structured(catalog().exploreTeam(salonId.toString(), 7L, null, null));

        assertThat(data).containsEntry("staffId", 7L);
        assertThat(list(data, "items")).extracting(i -> i.get("serviceIds")).containsExactly(List.of(1L), List.of(3L));
        assertThat((List<Object>) data.get("specializations")).containsExactly("Balayage", "Cuts", "Nails");
    }

    @Test
    void bookingAppLoadsTheMonthFromTodayAndGroupsSlotsByStartTime() {
        LocalDate today = LocalDate.now();
        LocalDate date = today.plusDays(2);
        when(bookings.queryAvailability(eq(salonId), eq(1L), eq(null), any(), any(), eq(SalonAvailability.Granularity.DAY), eq(null)))
                .thenReturn(availability(List.of(openDay(date, List.of()))));
        when(bookings.findAvailableSlots(salonId, 1L, date, null)).thenReturn(List.of(
                new AvailableSlot(7L, LocalTime.of(10, 0), LocalTime.of(10, 30), false),
                new AvailableSlot(8L, LocalTime.of(10, 0), LocalTime.of(10, 30), false),
                new AvailableSlot(7L, LocalTime.of(10, 30), LocalTime.of(11, 0), true)));

        var data = structured(booking().booking(salonId.toString(), 1L, null, null, date.toString(), null));

        var from = ArgumentCaptor.forClass(LocalDate.class);
        var to = ArgumentCaptor.forClass(LocalDate.class);
        verify(bookings).queryAvailability(eq(salonId), eq(1L), eq(null), from.capture(), to.capture(), eq(SalonAvailability.Granularity.DAY), eq(null));
        assertThat(from.getValue()).isEqualTo(date.withDayOfMonth(1).isAfter(today) ? date.withDayOfMonth(1) : today);
        assertThat(to.getValue()).isEqualTo(date.withDayOfMonth(date.lengthOfMonth()));
        assertThat(data).containsEntry("month", date.toString().substring(0, 7)).containsEntry("date", date.toString());
        assertThat(list(data, "slots")).containsExactly(Map.of("startTime", "10:00", "endTime", "10:30", "staffIds", List.of(7L, 8L)));
        assertThat(list(data, "days")).extracting(d -> d.get("status")).containsExactly("OPEN");
    }

    @Test
    void nextAvailableGivesTheSoonestTimeOpenDaysAndEachEligibleStylistsOwnSoonestTime() {
        LocalDate tomorrow = LocalDate.now().plusDays(1);
        when(bookings.queryAvailability(eq(salonId), eq(2L), any(), any(), any(), eq(SalonAvailability.Granularity.DAY), any()))
                .thenAnswer(inv -> {
                    Long staffId = inv.getArgument(2);
                    LocalTime start = staffId == null ? LocalTime.of(9, 0) : staffId == 7L ? LocalTime.of(10, 0) : LocalTime.of(14, 0);
                    var day = openDay(tomorrow, List.of(new AvailableSlot(staffId == null ? 7L : staffId, start, start.plusMinutes(90), false)));
                    return new SalonAvailability(2L, "Colour", 90, staffId, tomorrow, tomorrow, List.of(day),
                            new SalonAvailability.FirstAvailable(tomorrow, start, staffId == null ? 7L : staffId));
                });

        var data = structured(booking().nextAvailable(salonId.toString(), 2L, null, null, null));

        assertThat((Map<String, Object>) data.get("firstAvailable"))
                .containsEntry("date", tomorrow.toString()).containsEntry("startTime", "09:00");
        assertThat(list(data, "openDays")).extracting(d -> d.get("firstOpenTime")).containsExactly("09:00");
        assertThat(list(data, "byStaff")).containsExactly(
                Map.of("staffId", 7L, "date", tomorrow.toString(), "startTime", "10:00"),
                Map.of("staffId", 8L, "date", tomorrow.toString(), "startTime", "14:00"));
        verify(bookings).queryAvailability(eq(salonId), eq(2L), eq(null), any(), any(), eq(SalonAvailability.Granularity.DAY), eq(3));
    }

    @Test
    void bookingAppsRefuseSalonsWithoutOnlineBooking() {
        givenSalon(SalonFeature.WEBSHOP);

        var result = booking().bookingWeek(salonId.toString(), 1L, null, null, null);

        assertThat(result.isError()).isTrue();
        assertThat(text(result)).isEqualTo("Online booking is not available at this salon.");
    }

    @Test
    void weekAppAlwaysReturnsMondayToSundayAndMarksPastDays() {
        LocalDate monday = LocalDate.now().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        LocalDate today = LocalDate.now();
        when(bookings.queryAvailability(eq(salonId), eq(1L), eq(7L), eq(today), eq(monday.plusDays(6)),
                eq(SalonAvailability.Granularity.SLOT), eq(null)))
                .thenReturn(availability(today.datesUntil(monday.plusDays(7))
                        .map(d -> openDay(d, List.of(new AvailableSlot(7L, LocalTime.of(23, 59), LocalTime.of(23, 59), false))))
                        .toList()));

        var data = structured(booking().bookingWeek(salonId.toString(), 1L, 7L, today.toString(), null));

        assertThat(data).containsEntry("weekStart", monday.toString()).containsEntry("hasPreviousWeek", false);
        var days = list(data, "days");
        assertThat(days).hasSize(7);
        assertThat(days.getFirst()).containsEntry("date", monday.toString());
        days.stream().filter(d -> LocalDate.parse((String) d.get("date")).isBefore(today))
                .forEach(d -> assertThat(d).containsEntry("status", "PAST"));
        assertThat(days.stream().filter(d -> d.get("date").equals(today.toString())).findFirst().orElseThrow())
                .containsEntry("status", "OPEN");
    }

    @Test
    void stylistAppOffersAssignedAndUnassignedServicesOnly() {
        when(bookings.queryAvailability(eq(salonId), eq(null), eq(8L), any(), any(), eq(SalonAvailability.Granularity.DAY), eq(null)))
                .thenReturn(availability(List.of()));

        var data = structured(booking().bookingByStylist(salonId.toString(), 8L, null, null, null, null));

        assertThat((List<Object>) data.get("stylistServiceIds")).containsExactly(2L, 3L);
        assertThat(data).containsEntry("staffId", 8L).doesNotContainKey("slots");
    }

    @Test
    void stylistAppRejectsStylistsWhoDoNotTakeOnlineBookings() {
        when(staff.findByIdAndSalonId(9L, salonId)).thenReturn(Optional.of(member(9L, "Cara", false)));

        var result = booking().bookingByStylist(salonId.toString(), 9L, null, null, null, null);

        assertThat(result.isError()).isTrue();
        assertThat(text(result)).contains("takes online bookings");
    }

    @Test
    void shopAppMapsStorefrontProductsAndHidesInactiveVariants() {
        when(shopClient.categories(salonId.toString())).thenReturn("[{\"id\":4,\"name\":\"Care\"}]");
        when(shopClient.brands(salonId.toString())).thenReturn("[]");
        when(shopClient.products(salonId.toString())).thenReturn("""
                [{"id":11,"name":"Shampoo","categoryId":4,"categoryName":"Care","imageUrl":"https://img/a.jpg","images":[],
                  "variants":[{"id":21,"label":"250 ml","price":12.5,"currency":"EUR","quantityOnHand":40,"active":true},
                              {"id":22,"label":"1 l","price":30,"currency":"EUR","quantityOnHand":3,"active":false}]},
                 {"id":12,"name":"Retired","variants":[{"id":23,"active":false}]}]""");

        var data = structured(shop().shop(salonId.toString(), 4L, null, null, " shampoo ", null));

        assertThat(data).containsEntry("categoryId", 4L).containsEntry("query", "shampoo");
        var items = list(data, "items");
        assertThat(items).hasSize(1);
        assertThat(items.getFirst()).containsEntry("images", List.of("https://img/a.jpg")).doesNotContainKey("brandId");
        assertThat((List<Map<String, Object>>) items.getFirst().get("variants"))
                .singleElement().satisfies(v -> assertThat(v).containsEntry("id", 21L).containsEntry("maxQuantity", 10));
    }

    @Test
    void shopAppRequiresTheWebshopFeature() {
        givenSalon(SalonFeature.BOOKING);

        var result = shop().shop(salonId.toString(), null, null, null, null, null);

        assertThat(result.isError()).isTrue();
        assertThat(text(result)).isEqualTo("This salon doesn't have an online shop.");
    }

    @Test
    void shopOrderNeedsTheVisitorsConfirmationBeforeCallingCheckout() {
        var result = shop().createShopOrder(salonId.toString(), List.of(new SalonMcpShopAppTools.OrderItem(21L, 1)),
                "Jane", "jane@example.com", null, null, null, null, null, null, null, false, null);

        assertThat(result.isError()).isTrue();
        verify(shopClient, never()).placeOrder(any(), any());
    }

    @Test
    void shopOrderSendsCappedLinesAndReturnsTheConfirmation() {
        when(shopClient.placeOrder(eq(salonId.toString()), any())).thenReturn("""
                {"id":5,"orderNumber":"ORD-5","status":"NEW","paymentStatus":"PAID","subtotal":125.0,"currency":"EUR",
                 "lines":[{"productName":"Shampoo","variantLabel":"250 ml","quantity":10,"lineTotal":125.0}]}""");

        var result = shop().createShopOrder(salonId.toString(), List.of(new SalonMcpShopAppTools.OrderItem(21L, 50),
                        new SalonMcpShopAppTools.OrderItem(22L, 0)),
                " Jane ", "jane@example.com", "", "", null, "", null, null, "", true, null);

        var request = ArgumentCaptor.forClass(SalonMcpShopClient.CheckoutRequest.class);
        verify(shopClient).placeOrder(eq(salonId.toString()), request.capture());
        assertThat(request.getValue().items()).containsExactly(new SalonMcpShopClient.Item(21L, 10));
        assertThat(request.getValue().customerName()).isEqualTo("Jane");
        assertThat(request.getValue().shippingAddress()).isNull();
        Map<?, ?> order = (Map<?, ?>) structured(result).get("order");
        assertThat(order.get("orderNumber")).isEqualTo("ORD-5");
        assertThat(order.get("message")).isEqualTo("Order placed.");
        // No address given → collected in the salon, so the confirmation says where.
        assertThat(order.get("fulfilment")).isEqualTo("COLLECT");
        assertThat(order.containsKey("salonLocation")).isTrue();
        assertThat(order.containsKey("shipTo")).isFalse();
    }

    @Test
    void membershipAppMapsThePublicCatalogue() {
        givenSalon(SalonFeature.MEMBERSHIP);
        when(membershipClient.plans(salonId.toString())).thenReturn("""
                {"onlineSignup":true,"plans":[{"id":3,"name":"Glow","price":49.0,"currency":"EUR","billingInterval":"MONTHLY",
                  "signupFee":10,"serviceDiscountPercent":10,"spotsLeft":2,"soldOut":false,"highlighted":true,"includedValue":70,
                  "perks":["Priority booking"],"includedServices":[{"serviceId":1,"name":"Haircut","quantityPerCycle":2,"price":35}]}]}""");

        var data = structured(membership().membership(salonId.toString(), 3L, null));

        assertThat(data).containsEntry("app", "salon_membership").containsEntry("onlineSignup", true)
                .containsEntry("planId", 3L).containsEntry("membershipEnabled", true);
        var plan = list(data, "plans").getFirst();
        assertThat(plan).containsEntry("name", "Glow").containsEntry("billingInterval", "MONTHLY")
                .containsEntry("spotsLeft", 2).containsEntry("perks", List.of("Priority booking"));
        assertThat((List<Map<String, Object>>) plan.get("includedServices"))
                .singleElement().satisfies(s -> assertThat(s).containsEntry("name", "Haircut").containsEntry("quantityPerCycle", 2));
    }

    @Test
    void membershipAppRequiresTheMembershipFeature() {
        var result = membership().membership(salonId.toString(), null, null);

        assertThat(result.isError()).isTrue();
        assertThat(text(result)).isEqualTo("This salon doesn't offer memberships.");
    }

    @Test
    void membershipCheckoutNeedsConfirmationThenReturnsTheStripeUrl() {
        givenSalon(SalonFeature.MEMBERSHIP);
        var refused = membership().createMembershipCheckout(salonId.toString(), 3L, "Jane", "jane@example.com", null, false, null);
        assertThat(refused.isError()).isTrue();
        verify(membershipClient, never()).checkout(any(), any());

        when(membershipClient.checkout(eq(salonId.toString()), any()))
                .thenReturn("{\"subscriptionId\":9,\"checkoutUrl\":\"https://checkout.stripe.com/c/pay/cs_1\"}");
        var result = membership().createMembershipCheckout(salonId.toString(), 3L, " Jane ", "jane@example.com", "", true, null);

        var request = ArgumentCaptor.forClass(SalonMcpMembershipClient.CheckoutRequest.class);
        verify(membershipClient).checkout(eq(salonId.toString()), request.capture());
        assertThat(request.getValue()).isEqualTo(new SalonMcpMembershipClient.CheckoutRequest(3L, "Jane", "jane@example.com", null, null));
        Map<?, ?> checkout = (Map<?, ?>) structured(result).get("checkout");
        assertThat(checkout.get("checkoutUrl")).isEqualTo("https://checkout.stripe.com/c/pay/cs_1");
        assertThat(checkout.get("subscriptionId")).isEqualTo(9L);
    }

    @Test
    void membershipCheckoutPassesTheApisReasonThrough() {
        givenSalon(SalonFeature.MEMBERSHIP);
        when(membershipClient.checkout(eq(salonId.toString()), any())).thenThrow(new org.springframework.web.client.HttpClientErrorException(
                org.springframework.http.HttpStatus.CONFLICT, "Conflict", "{\"detail\":\"This plan is full\"}".getBytes(), null));

        var result = membership().createMembershipCheckout(salonId.toString(), 3L, "Jane", "jane@example.com", null, true, null);

        assertThat(result.isError()).isTrue();
        assertThat(text(result)).isEqualTo("This plan is full");
    }

    @Test
    void chatGatewayRoutesEachAppToolAndReportsErrorsAsAnErrorView() {
        var explorer = new SalonMcpTools(support, salons, services, staff, bookings, mock(SalonMcpBookingClient.class), mapper);
        var gateway = new SalonMcpChatGatewayImpl(explorer, catalog(), booking(), shop(), membership());

        assertThat(gateway.open("salon_team", salonId.toString(), Map.of("staffId", "7")))
                .containsEntry("app", "salon_team").containsEntry("staffId", 7L);
        givenSalon();
        assertThat(gateway.open("salon_booking", salonId.toString(), Map.of()))
                .containsEntry("view", "error").containsEntry("error", "Online booking is not available at this salon.");
        assertThat(gateway.open("nope", salonId.toString(), Map.of())).containsEntry("error", "Unknown salon app.");
    }

    @Test
    void aSalonSpecificUrlBindsTheSalonSoNoArgumentIsNeeded() {
        var bound = io.modelcontextprotocol.common.McpTransportContext.create(
                Map.of(SalonMcpTransportConfiguration.SALON_CONTEXT_KEY, salonId.toString()));

        var data = structured(catalog().exploreServices(null, null, null, bound));

        assertThat(data).containsEntry("salonId", salonId.toString());
    }

    @Test
    void theBoundSalonWinsOverAnyOtherSalonArgument() {
        var bound = io.modelcontextprotocol.common.McpTransportContext.create(
                Map.of(SalonMcpTransportConfiguration.SALON_CONTEXT_KEY, salonId.toString()));

        // "someone-else" is never resolved: the URL's salon is used instead.
        var data = structured(catalog().exploreTeam("someone-else", null, null, bound));

        assertThat(data).containsEntry("salonId", salonId.toString());
        verify(salons, never()).resolveId("someone-else");
    }

    @Test
    void theSharedEndpointAsksWhichSalonWhenNoneIsGiven() {
        var result = booking().bookingWeek(" ", 1L, null, null, null);

        assertThat(result.isError()).isTrue();
        assertThat(text(result)).startsWith("Which salon?").contains("/mcp/<salon-handle>");
    }

    // ── fixtures ────────────────────────────────────────────────────────────

    private SalonMcpCatalogAppTools catalog() { return new SalonMcpCatalogAppTools(support, services, staff); }
    private SalonMcpBookingAppTools booking() { return new SalonMcpBookingAppTools(support, services, staff, bookings); }
    private SalonMcpShopAppTools shop() { return new SalonMcpShopAppTools(support, shopClient, mapper); }
    private SalonMcpMembershipAppTools membership() { return new SalonMcpMembershipAppTools(support, membershipClient, mapper); }

    private void givenSalon(SalonFeature... features) {
        Salon salon = new Salon(salonId, "Test salon", "test-salon", null, null, null, List.of(),
                Arrays.stream(features).map(Salon.SalonFeatureRef::new).toList(), 30, null, null, null, null, null,
                Salon.SalonStatus.ACTIVE, null, null);
        when(salons.resolveId(salonId.toString())).thenReturn(salonId);
        when(salons.findById(salonId)).thenReturn(Optional.of(salon));
    }

    private ServiceItem service(Long id, String name, ServiceCategory category, int minutes, String... staffIds) {
        return new ServiceItem(id, salonId, name, null, BigDecimal.TEN, "EUR", minutes, category, true,
                Arrays.stream(staffIds).map(ServiceItem.AssignedStaff::new).toList(), null);
    }

    private StaffMember member(Long id, String name, boolean bookable, String... specializations) {
        return new StaffMember(id, salonId, name, null, null, StaffRole.STYLIST, StaffStatus.ACTIVE, false, bookable,
                null, null, Arrays.stream(specializations).map(StaffMember.Specialization::new).toList(), List.of(), null);
    }

    private SalonAvailability availability(List<SalonAvailability.DayAvailability> days) {
        return new SalonAvailability(1L, "Haircut", 30, null, LocalDate.now(), LocalDate.now(), days, null);
    }

    private static SalonAvailability.DayAvailability openDay(LocalDate date, List<AvailableSlot> slots) {
        return new SalonAvailability.DayAvailability(date, date.getDayOfWeek(), SalonAvailability.DayStatus.OPEN, null,
                slots.size(), slots.isEmpty() ? null : slots.getFirst().startTime(), List.of(), slots);
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> structured(McpSchema.CallToolResult result) {
        assertThat(result.isError()).as(() -> text(result)).isNotEqualTo(Boolean.TRUE);
        return (Map<String, Object>) result.structuredContent();
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> list(Map<String, Object> data, String key) {
        return (List<Map<String, Object>>) data.get(key);
    }

    private static String text(McpSchema.CallToolResult result) {
        return ((McpSchema.TextContent) result.content().getFirst()).text();
    }
}
