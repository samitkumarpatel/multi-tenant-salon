package net.samitkumar.multi_tenant_salon.mcp.internal;

import com.fasterxml.jackson.databind.ObjectMapper;
import net.samitkumar.multi_tenant_salon.booking.BookingApi;
import net.samitkumar.multi_tenant_salon.salon.Salon;
import net.samitkumar.multi_tenant_salon.salon.SalonApi;
import net.samitkumar.multi_tenant_salon.salon.SalonOpeningDay;
import net.samitkumar.multi_tenant_salon.salonservice.SalonServiceApi;
import net.samitkumar.multi_tenant_salon.salonservice.ServiceItem;
import net.samitkumar.multi_tenant_salon.staff.StaffApi;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class SalonMcpToolsTest {

    @Test
    void servicesViewHandlesServicesWithUnspecifiedPrices() {
        UUID salonId = UUID.randomUUID();
        SalonApi salons = mock(SalonApi.class);
        SalonServiceApi services = mock(SalonServiceApi.class);
        StaffApi staff = mock(StaffApi.class);
        BookingApi bookings = mock(BookingApi.class);
        SalonMcpBookingClient bookingClient = mock(SalonMcpBookingClient.class);
        Salon salon = new Salon(salonId, "Test salon", "test-salon", null, null, null,
                List.of(), List.of(), null, null, null, null, null, null,
                Salon.SalonStatus.ACTIVE, null, null);
        when(salons.resolveId(salonId.toString())).thenReturn(salonId);
        when(salons.findById(salonId)).thenReturn(Optional.of(salon));
        when(services.findAllBySalonId(salonId)).thenReturn(List.of(new ServiceItem(
                1L, salonId, "Haircut", null, null, null, 30, null, true, List.of(), null)));

        var result = new SalonMcpTools(new SalonMcpSupport(salons, new ObjectMapper()), salons, services, staff,
                bookings, bookingClient, new ObjectMapper())
                .exploreSalon(salonId.toString(), "services", null, null, null, null);

        assertFalse(result.isError());
        Map<?, ?> structured = assertInstanceOf(Map.class, result.structuredContent());
        List<?> items = assertInstanceOf(List.class, structured.get("items"));
        Map<?, ?> service = assertInstanceOf(Map.class, items.getFirst());
        assertTrue(service.containsKey("name"));
        assertFalse(service.containsKey("price"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void hoursViewShowsTheDatedWeekWithHolidaysAndTheUpcomingClosures() {
        UUID salonId = UUID.randomUUID();
        SalonApi salons = mock(SalonApi.class);
        Salon salon = new Salon(salonId, "Test salon", "test-salon", null, null, null,
                List.of(), List.of(), null, null, null, null, null, null,
                Salon.SalonStatus.ACTIVE, null, null);
        when(salons.resolveId(salonId.toString())).thenReturn(salonId);
        when(salons.findById(salonId)).thenReturn(Optional.of(salon));
        LocalDate today = LocalDate.now();
        when(salons.openingCalendar(eq(salonId), eq(today), any())).thenReturn(today.datesUntil(today.plusDays(60))
                .map(d -> d.equals(today) || d.equals(today.plusDays(1))
                        ? new SalonOpeningDay(d, d.getDayOfWeek(), SalonOpeningDay.Status.CLOSED_HOLIDAY, null, null, "Founders' Day")
                        : new SalonOpeningDay(d, d.getDayOfWeek(), SalonOpeningDay.Status.OPEN, "09:00", "18:00", null))
                .toList());

        var result = new SalonMcpTools(new SalonMcpSupport(salons, new ObjectMapper()), salons, mock(SalonServiceApi.class),
                mock(StaffApi.class), mock(BookingApi.class), mock(SalonMcpBookingClient.class), new ObjectMapper())
                .exploreSalon(salonId.toString(), "hours", null, null, null, null);

        assertFalse(result.isError());
        var data = (Map<String, Object>) result.structuredContent();
        assertThat((Map<String, Object>) data.get("today")).containsEntry("status", "CLOSED_TODAY")
                .containsEntry("reason", "Founders' Day");
        assertThat((List<Map<String, Object>>) data.get("week")).hasSize(7)
                .first().satisfies(d -> assertThat(d).containsEntry("status", "CLOSED_HOLIDAY"));
        assertThat((List<Map<String, Object>>) data.get("upcomingClosures")).containsExactly(Map.of(
                "name", "Founders' Day", "kind", "HOLIDAY", "from", today.toString(), "to", today.plusDays(1).toString()));
    }

    @Test
    @SuppressWarnings("unchecked")
    void bookingConfirmationCarriesTheEndTimeAndHowToReachTheSalon() {
        UUID salonId = UUID.randomUUID();
        SalonApi salons = mock(SalonApi.class);
        SalonServiceApi services = mock(SalonServiceApi.class);
        BookingApi bookings = mock(BookingApi.class);
        SalonMcpBookingClient bookingClient = mock(SalonMcpBookingClient.class);
        Salon salon = mock(Salon.class);
        Salon.ContactInfo contact = mock(Salon.ContactInfo.class);
        when(salon.name()).thenReturn("Test salon");
        when(salon.status()).thenReturn(Salon.SalonStatus.ACTIVE);
        when(salon.features()).thenReturn(List.of(new Salon.SalonFeatureRef(net.samitkumar.multi_tenant_salon.salon.SalonFeature.BOOKING)));
        when(salon.location()).thenReturn(new Salon.Location("1 Main St", "Town", null, "US", "12345", "https://maps.example/1"));
        when(salon.contact()).thenReturn(contact);
        when(contact.phone()).thenReturn("+1 555 0100");
        when(salons.resolveId(salonId.toString())).thenReturn(salonId);
        when(salons.findById(salonId)).thenReturn(Optional.of(salon));
        LocalDate date = LocalDate.now().plusDays(3);
        when(services.findByIdAndSalonId(1L, salonId)).thenReturn(Optional.of(new ServiceItem(
                1L, salonId, "Haircut", null, null, null, 45, null, true, List.of(), null)));
        when(bookings.findAvailableSlots(salonId, 1L, date, null)).thenReturn(List.of(
                new net.samitkumar.multi_tenant_salon.booking.AvailableSlot(7L, java.time.LocalTime.of(10, 0), java.time.LocalTime.of(10, 45), false)));
        when(bookingClient.createBooking(eq(salonId.toString()), any()))
                .thenReturn("{\"id\":12,\"status\":\"CONFIRMED\",\"staffId\":7,\"endTime\":\"10:45:00\"}");

        var result = new SalonMcpTools(new SalonMcpSupport(salons, new ObjectMapper()), salons, services, mock(StaffApi.class),
                bookings, bookingClient, new ObjectMapper())
                .createCustomerBooking(salonId.toString(), 1L, date.toString(), "10:00", null,
                        "Ada", "ada@example.com", null, null, true, null);

        assertFalse(result.isError());
        var booking = (Map<String, Object>) ((Map<String, Object>) result.structuredContent()).get("booking");
        assertThat(booking).containsEntry("endTime", "10:45").containsEntry("salonPhone", "+1 555 0100")
                .containsEntry("bookingId", 12L);
        assertThat((Map<String, Object>) booking.get("location"))
                .containsEntry("address", "1 Main St").containsEntry("mapsUrl", "https://maps.example/1");
    }
}
