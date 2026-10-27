package net.samitkumar.multi_tenant_salon.rating;

import java.time.LocalDate;

/** A completed visit belonging to the verified customer, with whether feedback has been left. */
public record CustomerRatingOption(long bookingId, String serviceName, String staffName,
                                   LocalDate appointmentDate, boolean submitted) {}
