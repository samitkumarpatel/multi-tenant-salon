package net.samitkumar.multi_tenant_salon.rating;

import java.util.UUID;

public interface RatingApi {
    String issueInvitation(Long bookingId, UUID salonId, Long staffId);
    RatingReviewTarget findReviewTarget(String token);
    boolean submitReview(String token, int salonRating, int staffRating, String salonFeedback, String staffFeedback);
    SalonRatings getRatings(UUID salonId);
    java.util.List<BookingRating> getBookingRatings(UUID salonId, Long staffId);
    java.util.List<CustomerRatingOption> getCustomerRatingOptions(UUID salonId, String customerEmail);
    boolean submitCustomerReview(UUID salonId, String customerEmail, Long bookingId, int salonRating, int staffRating, String salonFeedback, String staffFeedback);
    /** Sets or replaces the owner's reply; never touches the customer's rating or feedback. False when there is no such review. */
    boolean replyToReview(UUID salonId, Long bookingId, String reply);
}
