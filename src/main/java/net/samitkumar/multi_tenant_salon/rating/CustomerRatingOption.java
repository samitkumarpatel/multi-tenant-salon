package net.samitkumar.multi_tenant_salon.rating;

import java.time.Instant;
import java.time.LocalDate;

/** A completed visit belonging to the verified customer, with whether feedback has been left and the salon's reply. */
public record CustomerRatingOption(long bookingId, Long staffId, String serviceName, String staffName,
                                   LocalDate appointmentDate, boolean submitted, String feedback,
                                   String reply, Instant repliedAt) {}
