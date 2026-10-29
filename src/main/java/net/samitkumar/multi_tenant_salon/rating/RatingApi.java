package net.samitkumar.multi_tenant_salon.rating;

import java.util.UUID;

public interface RatingApi {
    String issueInvitation(Long bookingId, UUID salonId, Long staffId);
    RatingReviewTarget findReviewTarget(String token);
    default boolean submitReview(String token, Integer salonRating, Integer staffRating, String salonFeedback, String staffFeedback) {
        return submitReview(token, salonRating, staffRating, salonFeedback, staffFeedback, false);
    }
    boolean submitReview(String token, Integer salonRating, Integer staffRating, String salonFeedback, String staffFeedback, boolean publicConsent);
    SalonRatings getRatings(UUID salonId);
    java.util.List<BookingRating> getBookingRatings(UUID salonId, Long staffId);
    java.util.List<CustomerRatingOption> getCustomerRatingOptions(UUID salonId, String customerEmail);
    default boolean submitCustomerReview(UUID salonId, String customerEmail, Long bookingId, Integer salonRating, Integer staffRating, String salonFeedback, String staffFeedback) {
        return submitCustomerReview(salonId, customerEmail, bookingId, salonRating, staffRating, salonFeedback, staffFeedback, false);
    }
    boolean submitCustomerReview(UUID salonId, String customerEmail, Long bookingId, Integer salonRating, Integer staffRating, String salonFeedback, String staffFeedback, boolean publicConsent);
    /** Sets or replaces the owner's reply; never touches the customer's rating or feedback. False when there is no such review. */
    boolean replyToReview(UUID salonId, Long bookingId, String reply);
}
