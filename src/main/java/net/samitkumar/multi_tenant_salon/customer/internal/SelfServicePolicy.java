package net.samitkumar.multi_tenant_salon.customer.internal;

import java.time.Duration;

/**
 * What a customer may do to their own appointments from their account. The notice is how long before
 * the start the option closes; after that only the salon can change it.
 */
record SelfServicePolicy(boolean allowCancel, int cancelNoticeHours, boolean allowReschedule, int rescheduleNoticeHours) {

    static final int MAX_NOTICE_HOURS = 720;

    /** What a salon gets until its owner changes it. */
    static final SelfServicePolicy DEFAULT = new SelfServicePolicy(true, 24, true, 24);

    Duration cancelNotice() { return Duration.ofHours(cancelNoticeHours); }

    Duration rescheduleNotice() { return Duration.ofHours(rescheduleNoticeHours); }
}
