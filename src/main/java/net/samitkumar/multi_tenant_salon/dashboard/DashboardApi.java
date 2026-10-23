package net.samitkumar.multi_tenant_salon.dashboard;

import java.util.UUID;

/**
 * What other modules may ask the front-desk module. The desk's capability switches are an
 * authorization input, not just a UI preference: {@code SalonDeskAccess} consults them before letting
 * a staff token through to the booking endpoints, and the membership module checks them before taking
 * money at the desk. Both need an answer without reaching into {@code dashboard.internal}.
 */
public interface DashboardApi {

    /**
     * The salon's desk capability switches, falling back to the defaults when the salon has never
     * saved any. Never throws for a salon without the DASHBOARD feature — callers are asking
     * "may the desk do this?", and the answer for such a salon is simply no.
     */
    Capabilities capabilities(UUID salonId);

    /** @param dashboardEnabled whether the salon has the DASHBOARD feature at all */
    record Capabilities(boolean dashboardEnabled, boolean bookingManagementEnabled, boolean cashierEnabled) {

        public static final Capabilities NONE = new Capabilities(false, false, false);

        /** Managing appointments from the desk needs both the feature and the switch. */
        public boolean canManageBookings() {
            return dashboardEnabled && bookingManagementEnabled;
        }

        /** Taking money at the desk — till sales and membership desk sales alike. */
        public boolean canTakeMoney() {
            return dashboardEnabled && cashierEnabled;
        }
    }
}
