package net.samitkumar.multi_tenant_salon.payments;

/** How a customer pays online in a payment area, as chosen by the salon owner. */
public enum CheckoutUi {
    /** Stripe-hosted Checkout page (in the salon's colours); the customer leaves the salon's site and comes back. */
    REDIRECT("hosted_page"),
    /** Stripe's Checkout form embedded in the salon's own page. */
    EMBEDDED("embedded_page"),
    /** The salon's own payment form, built from Stripe Elements and styled with the salon's website theme. */
    ELEMENTS("elements");

    private final String stripeUiMode;

    CheckoutUi(String stripeUiMode) { this.stripeUiMode = stripeUiMode; }

    /** Checkout Session {@code ui_mode} (API version 2026-03-25.dahlia and later). */
    public String stripeUiMode() { return stripeUiMode; }
}
