package net.samitkumar.multi_tenant_salon.rating;

import java.time.Instant;
import java.time.LocalDate;

public record BookingRating(long bookingId, String customerName, String serviceName, String staffName,
                            LocalDate appointmentDate, int salonRating, int staffRating, Instant submittedAt) {}
