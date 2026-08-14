package net.samitkumar.multi_tenant_salon.booking;

import java.time.LocalTime;

public record AvailableSlot(Long staffId, LocalTime startTime, LocalTime endTime, boolean booked) {}
