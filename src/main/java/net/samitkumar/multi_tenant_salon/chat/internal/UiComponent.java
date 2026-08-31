package net.samitkumar.multi_tenant_salon.chat.internal;

import java.util.Map;

/**
 * One interactive element the frontend should render for this turn. The assistant appends these
 * by calling the {@code show*} / {@code start*} render tools on {@link SalonDataTools} — a single
 * turn can carry several (e.g. a services card <em>and</em> a button group). The frontend maps
 * {@code type} to a React component via its registry and silently ignores any type it doesn't
 * know, so a mis-named component can never break a turn.
 *
 * <p>{@code props} only ever carries UI scaffolding — ids, flags, labels, field specs — never
 * salon data (prices, availability, slots): data-bearing cards hydrate themselves from the live
 * public API on the frontend, so the model can't bake a stale price or a made-up time into the
 * page. Booking <em>creation</em> is unaffected — that still flows through {@code proposeBooking}
 * / {@link PendingBooking}.
 */
record UiComponent(String type, Map<String, Object> props) {

    static UiComponent of(String type) {
        return new UiComponent(type, Map.of());
    }
}
