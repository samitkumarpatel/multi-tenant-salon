## Web-Shop (WEBSHOP feature)

> Uses **Example 3 — Glam & Go, Mumbai** (its features already include `WEBSHOP`; add it with
> `PUT /features` for any other salon first). Prices are in INR to match that salon's services.
>
> Admin catalogue lives under `/api/salon-admin/$SALON_ID/shop/**`; the public storefront is
> `/api/salon/$SALON_ID/shop/**` (anonymous, only active products/variants). IDs are all
> server-generated — replace `<..._ID>` placeholders with values from earlier responses.
> Recommended order: brands → categories → products (with variants) → inventory → public
> browse → customer checkout → admin order lifecycle.

### Brands

```bash
SALON_ID=luxe-hair-studio-g
# Forest Essentials
curl -s -X POST localhost:8080/api/salon-admin/$SALON_ID/shop/brands \
  -H 'Content-Type: application/json' \
  -d '{"name":"Forest Essentials","description":"Ayurvedic skincare & haircare","logoUrl":"https://cdn.example.com/brands/forest-essentials.png"}'

# Lakmé
curl -s -X POST localhost:8080/api/salon-admin/$SALON_ID/shop/brands \
  -H 'Content-Type: application/json' \
  -d '{"name":"Lakmé","description":"Everyday colour cosmetics"}'

# M·A·C
curl -s -X POST localhost:8080/api/salon-admin/$SALON_ID/shop/brands \
  -H 'Content-Type: application/json' \
  -d '{"name":"M·A·C","description":"Professional makeup"}'
```

### Categories

```bash
curl -s -X POST localhost:8080/api/salon-admin/$SALON_ID/shop/categories \
  -H 'Content-Type: application/json' -d '{"name":"Skincare","description":"Cleansers, serums & moisturisers"}'

curl -s -X POST localhost:8080/api/salon-admin/$SALON_ID/shop/categories \
  -H 'Content-Type: application/json' -d '{"name":"Haircare","description":"Shampoos, masks & oils"}'

curl -s -X POST localhost:8080/api/salon-admin/$SALON_ID/shop/categories \
  -H 'Content-Type: application/json' -d '{"name":"Makeup","description":"Face, lips & eyes"}'

curl -s -X POST localhost:8080/api/salon-admin/$SALON_ID/shop/categories \
  -H 'Content-Type: application/json' -d '{"name":"Nail Care","description":"Lacquers & tools"}'
```

### Products (with variants)

> `variants[].id` is `null` for a new variant. `quantityOnHand` seeds stock (checkout decrements
> it atomically); `reorderLevel` drives the low-stock badge on the Inventory tab. `images[0]`
> becomes the cover — `imageUrl` mirrors it automatically.

```bash
# Forest Essentials — Kashmiri Saffron Facial Cleanser (Skincare), 2 sizes
curl -s -X POST localhost:8080/api/salon-admin/$SALON_ID/shop/products \
  -H 'Content-Type: application/json' \
  -d '{"name":"Kashmiri Saffron & Neem Facial Cleanser","description":"Gentle foaming cleanser for daily use","images":["https://cdn.example.com/shop/cleanser-front.jpg","https://cdn.example.com/shop/cleanser-back.jpg"],"variants":[{"id":null,"sku":"FE-CLNS-050","label":"50 ml","price":1150.00,"currency":"INR","quantityOnHand":40,"reorderLevel":8,"active":true},{"id":null,"sku":"FE-CLNS-200","label":"200 ml","price":3400.00,"compareAtPrice":3800.00,"currency":"INR","quantityOnHand":15,"reorderLevel":4,"active":true}]}'

# Lakmé — Absolute Perfect Radiance Serum (Skincare), single variant
curl -s -X POST localhost:8080/api/salon-admin/$SALON_ID/shop/products \
  -H 'Content-Type: application/json' \
  -d '{"name":"Absolute Perfect Radiance Serum","description":"Brightening serum with niacinamide","images":["https://cdn.example.com/shop/serum.jpg"],"variants":[{"id":null,"sku":"LK-SERUM-030","label":"30 ml","price":1499.00,"currency":"INR","quantityOnHand":25,"reorderLevel":5,"active":true}]}'

# M·A·C — Retro Matte Lipstick (Makeup), 3 shades, low stock
curl -s -X POST localhost:8080/api/salon-admin/$SALON_ID/shop/products \
  -H 'Content-Type: application/json' \
  -d '{"name":"Retro Matte Lipstick","description":"Full-coverage matte finish","images":["https://cdn.example.com/shop/lipstick.jpg"],"variants":[{"id":null,"sku":"MAC-RML-RUBY","label":"Ruby Woo","price":2100.00,"currency":"INR","quantityOnHand":6,"reorderLevel":3,"active":true},{"id":null,"sku":"MAC-RML-DIVA","label":"Diva","price":2100.00,"currency":"INR","quantityOnHand":2,"reorderLevel":3,"active":true},{"id":null,"sku":"MAC-RML-CHILI","label":"Chili","price":2100.00,"currency":"INR","quantityOnHand":0,"reorderLevel":3,"active":true}]}'

# Forest Essentials — Bhringraj & Amla Hair Cleanser (Haircare), 2 sizes
curl -s -X POST localhost:8080/api/salon-admin/$SALON_ID/shop/products \
  -H 'Content-Type: application/json' \
  -d '{"name":"Bhringraj & Amla Hair Cleanser","description":"Strengthening sulphate-free shampoo","images":["https://cdn.example.com/shop/hair-cleanser.jpg"],"variants":[{"id":null,"sku":"FE-HAIR-200","label":"200 ml","price":1375.00,"currency":"INR","quantityOnHand":30,"reorderLevel":6,"active":true},{"id":null,"sku":"FE-HAIR-1000","label":"1 L refill","price":4800.00,"currency":"INR","quantityOnHand":8,"reorderLevel":2,"active":true}]}'

# Lakmé — Nail Lacquer Trio (Nail Care), single variant
curl -s -X POST localhost:8080/api/salon-admin/$SALON_ID/shop/products \
  -H 'Content-Type: application/json' \
  -d '{"name":"Nail Lacquer Trio — Festive","description":"Set of three quick-dry shades","images":["https://cdn.example.com/shop/nail-trio.jpg"],"variants":[{"id":null,"sku":"LK-NAIL-TRIO","label":"Set of 3","price":950.00,"currency":"INR","quantityOnHand":18,"reorderLevel":4,"active":true}]}'

# One inactive product (hidden from the public storefront, still visible in admin)
curl -s -X POST localhost:8080/api/salon-admin/$SALON_ID/shop/products \
  -H 'Content-Type: application/json' \
  -d '{"name":"Discontinued Glitter Gel","description":"End of line — not for sale","active":false,"variants":[{"id":null,"label":"10 ml","price":500.00,"currency":"INR","quantityOnHand":0,"reorderLevel":0,"active":false}]}'
```

### Inventory

```bash
# List every variant with stock levels (admin)
curl -s localhost:8080/api/salon-admin/$SALON_ID/shop/inventory

# Restock a variant / change its reorder level
curl -s -X PUT localhost:8080/api/salon-admin/$SALON_ID/shop/inventory/<VARIANT_ID> \
  -H 'Content-Type: application/json' -d '{"quantityOnHand":50,"reorderLevel":10}'
```

### Public storefront (anonymous)

```bash
curl -s localhost:8080/api/salon/$SALON_ID/shop/brands
curl -s localhost:8080/api/salon/$SALON_ID/shop/categories
curl -s localhost:8080/api/salon/$SALON_ID/shop/products
curl -s "localhost:8080/api/salon/$SALON_ID/shop/products?categoryId=<SKINCARE_CAT_ID>&brandId=<FOREST_BRAND_ID>"
curl -s localhost:8080/api/salon/$SALON_ID/shop/products/<PRODUCT_ID>
```

### Customer checkout

> `items[].variantId` comes from a product response's `variants[].id`. Stock is decremented
> atomically; ordering more than `quantityOnHand` returns `409`. The order is returned
> `status: NEW`, `paymentStatus: PAID` (dummy payment step).

```bash
# Order 1 — two lines
curl -s -X POST localhost:8080/api/salon/$SALON_ID/shop/orders \
  -H 'Content-Type: application/json' \
  -d '{"customerName":"Riya Kapoor","customerEmail":"riya.kapoor@example.com","customerPhone":"+91 90040 11223","shippingAddress":{"line1":"402 Sea Breeze Apts","line2":"Carter Road","city":"Mumbai","state":"Maharashtra","country":"India","zipCode":"400050"},"items":[{"variantId":<CLEANSER_50ML_VARIANT_ID>,"quantity":1},{"variantId":<SERUM_VARIANT_ID>,"quantity":2}]}'

# Order 2 — single line, no shipping address
curl -s -X POST localhost:8080/api/salon/$SALON_ID/shop/orders \
  -H 'Content-Type: application/json' \
  -d '{"customerName":"Aditya Menon","customerEmail":"aditya.menon@example.com","items":[{"variantId":<LIPSTICK_RUBY_VARIANT_ID>,"quantity":1}]}'

# Order 3 — trips the atomic stock guard (Diva shade has only 2 in stock)
curl -s -X POST localhost:8080/api/salon/$SALON_ID/shop/orders \
  -H 'Content-Type: application/json' \
  -d '{"customerName":"Test Overbuy","customerEmail":"overbuy@example.com","items":[{"variantId":<LIPSTICK_DIVA_VARIANT_ID>,"quantity":5}]}'   # -> 409
```

### Admin — orders list (paginated / searchable / sortable)

> `GET /shop/orders` returns a **page envelope**, not a bare array:
> `{ content, page, size, totalElements, totalPages, statusCounts }`. `statusCounts` is faceted
> on `q` + date range but not on `status`. All query params are optional.

```bash
# First page, newest first (defaults: page=0, size=20, sort=newest)
curl -s localhost:8080/api/salon-admin/$SALON_ID/shop/orders

# Page 2, 5 per page, oldest first
curl -s "localhost:8080/api/salon-admin/$SALON_ID/shop/orders?page=1&size=5&sort=oldest"

# Free-text search — order number, customer name/email/phone, payment ref,
# tracking number, or any line's product name
curl -s "localhost:8080/api/salon-admin/$SALON_ID/shop/orders?q=riya"
curl -s "localhost:8080/api/salon-admin/$SALON_ID/shop/orders?q=Retro%20Matte"
curl -s "localhost:8080/api/salon-admin/$SALON_ID/shop/orders?q=SO-"

# Filter by status
curl -s "localhost:8080/api/salon-admin/$SALON_ID/shop/orders?status=NEW"
curl -s "localhost:8080/api/salon-admin/$SALON_ID/shop/orders?status=SHIPPED"

# Order-date range (yyyy-MM-dd, 'to' day included, UTC)
curl -s "localhost:8080/api/salon-admin/$SALON_ID/shop/orders?from=2026-09-01&to=2026-09-30"

# Combined: shipped orders for a customer this month, oldest first
curl -s "localhost:8080/api/salon-admin/$SALON_ID/shop/orders?q=aditya&status=SHIPPED&from=2026-09-01&sort=oldest&page=0&size=10"
```

### Admin — single order lifecycle

```bash
# Full order incl. the order timeline and each line's activity timeline
curl -s localhost:8080/api/salon-admin/$SALON_ID/shop/orders/<ORDER_ID>

# Advance status: NEW -> PROCESSING -> SHIPPED -> FULFILLED (or CANCELLED any time)
curl -s -X POST localhost:8080/api/salon-admin/$SALON_ID/shop/orders/<ORDER_ID>/status \
  -H 'Content-Type: application/json' -d '{"status":"PROCESSING"}'

# Add tracking (also flips the order to SHIPPED and emails the customer)
curl -s -X POST localhost:8080/api/salon-admin/$SALON_ID/shop/orders/<ORDER_ID>/shipping \
  -H 'Content-Type: application/json' -d '{"carrier":"Blue Dart","trackingNumber":"BD123456789IN"}'

curl -s -X POST localhost:8080/api/salon-admin/$SALON_ID/shop/orders/<ORDER_ID>/status \
  -H 'Content-Type: application/json' -d '{"status":"FULFILLED"}'

# Send the invoice email
curl -s -X POST localhost:8080/api/salon-admin/$SALON_ID/shop/orders/<ORDER_ID>/invoice

# Message the customer about the whole order
curl -s -X POST localhost:8080/api/salon-admin/$SALON_ID/shop/orders/<ORDER_ID>/notify \
  -H 'Content-Type: application/json' -d '{"message":"Your order is packed and ships today."}'

# Message the customer about one line
curl -s -X POST localhost:8080/api/salon-admin/$SALON_ID/shop/orders/<ORDER_ID>/lines/<LINE_ID>/notify \
  -H 'Content-Type: application/json' -d '{"message":"The 200 ml size is back-ordered by 3 days."}'

# Internal note on a line (no email)
curl -s -X POST localhost:8080/api/salon-admin/$SALON_ID/shop/orders/<ORDER_ID>/lines/<LINE_ID>/notes \
  -H 'Content-Type: application/json' -d '{"note":"Customer called to confirm the shade."}'

# Internal note on the order
curl -s -X POST localhost:8080/api/salon-admin/$SALON_ID/shop/orders/<ORDER_ID>/work-note \
  -H 'Content-Type: application/json' -d '{"note":"Gift wrap requested."}'
```

### Admin — refunds & credit notes

```bash
# Raise a refund against an order (notifies the customer)
curl -s -X POST localhost:8080/api/salon-admin/$SALON_ID/shop/orders/<ORDER_ID>/refunds \
  -H 'Content-Type: application/json' -d '{"amount":1150.00,"reason":"Cleanser arrived damaged"}'

# Accept it -> auto-creates a matching credit note
curl -s -X POST localhost:8080/api/salon-admin/$SALON_ID/shop/refunds/<REFUND_ID>/accept
# ...or reject it
curl -s -X POST localhost:8080/api/salon-admin/$SALON_ID/shop/refunds/<REFUND_ID>/reject

# Issue a stand-alone credit note (goodwill)
curl -s -X POST localhost:8080/api/salon-admin/$SALON_ID/shop/orders/<ORDER_ID>/credit-notes \
  -H 'Content-Type: application/json' -d '{"amount":300.00,"reason":"Late delivery goodwill","reference":"CN-GLAM-001"}'

# Mark a credit note paid back
curl -s -X POST localhost:8080/api/salon-admin/$SALON_ID/shop/credit-notes/<CREDIT_NOTE_ID>/pay

# Lists (salon-wide and per-order)
curl -s localhost:8080/api/salon-admin/$SALON_ID/shop/refunds
curl -s localhost:8080/api/salon-admin/$SALON_ID/shop/orders/<ORDER_ID>/refunds
curl -s localhost:8080/api/salon-admin/$SALON_ID/shop/credit-notes
curl -s localhost:8080/api/salon-admin/$SALON_ID/shop/orders/<ORDER_ID>/credit-notes
```

---
