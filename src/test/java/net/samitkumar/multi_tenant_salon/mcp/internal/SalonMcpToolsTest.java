package net.samitkumar.multi_tenant_salon.mcp.internal;

import com.fasterxml.jackson.databind.ObjectMapper;
import net.samitkumar.multi_tenant_salon.booking.BookingApi;
import net.samitkumar.multi_tenant_salon.salon.Salon;
import net.samitkumar.multi_tenant_salon.salon.SalonApi;
import net.samitkumar.multi_tenant_salon.salonservice.SalonServiceApi;
import net.samitkumar.multi_tenant_salon.salonservice.ServiceItem;
import net.samitkumar.multi_tenant_salon.staff.StaffApi;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertTrue;
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
}
