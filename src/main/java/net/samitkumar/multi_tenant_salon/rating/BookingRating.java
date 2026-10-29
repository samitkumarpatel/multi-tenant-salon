package net.samitkumar.multi_tenant_salon.rating;

import java.time.Instant;
import java.time.LocalDate;

public record BookingRating(Long bookingId, String customerName, String serviceName, String staffName,
                            LocalDate appointmentDate, Integer salonRating, Integer staffRating, Instant submittedAt,
                            String salonFeedback, String staffFeedback, String reply, Instant repliedAt, Long feedbackId, String source, boolean publicConsent, boolean publicHidden) {}
