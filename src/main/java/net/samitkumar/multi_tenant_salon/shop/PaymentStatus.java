package net.samitkumar.multi_tenant_salon.shop;

/** Dummy payment state — checkout marks every order {@code PAID} immediately, no gateway. */
public enum PaymentStatus {
    PENDING, PAID
}
