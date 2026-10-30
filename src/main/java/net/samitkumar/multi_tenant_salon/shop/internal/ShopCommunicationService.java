package net.samitkumar.multi_tenant_salon.shop.internal;

import net.samitkumar.multi_tenant_salon.shop.OrderCommunicationQueuedEvent;
import net.samitkumar.multi_tenant_salon.shop.ShopCommunicationApi;
import net.samitkumar.multi_tenant_salon.shop.ShopOrderActivity;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@Transactional(propagation = Propagation.REQUIRES_NEW)
class ShopCommunicationService implements ShopCommunicationApi {
    private final JdbcClient jdbc;
    private final ShopOrderRepository orders;
    private final ShopOrderActivityRepository activities;
    private final ApplicationEventPublisher events;

    ShopCommunicationService(JdbcClient jdbc, ShopOrderRepository orders, ShopOrderActivityRepository activities, ApplicationEventPublisher events) {
        this.jdbc = jdbc;
        this.orders = orders;
        this.activities = activities;
        this.events = events;
    }

    @Override
    public void queue(UUID salonId, String orderNumber, Message message, boolean skipped) {
        jdbc.sql("SELECT id FROM shop_order WHERE salon_id=:salon AND order_number=:number FOR UPDATE")
                .param("salon", salonId).param("number", orderNumber).query(Long.class).optional().orElseThrow(() -> missing());
        var order = orders.findByOrderNumberAndSalonId(orderNumber, salonId).orElseThrow(() -> missing());
        if (message.sourceActivityId() != null && jdbc.sql("SELECT count(*) FROM shop_order_communication WHERE source_activity_id=:source AND salon_id=:salon")
                .param("source", message.sourceActivityId()).param("salon", salonId).query(Integer.class).single() > 0) return;
        if (message.sourceLineActivityId() != null && jdbc.sql("SELECT count(*) FROM shop_order_communication WHERE source_line_activity_id=:source AND salon_id=:salon")
                .param("source", message.sourceLineActivityId()).param("salon", salonId).query(Integer.class).single() > 0) return;
        var removed = order.customerEmail() == null || order.customerEmail().endsWith("@anonymized.invalid");
        var status = removed ? "FAILED" : skipped ? "SKIPPED" : "QUEUED";
        var activity = activities.save(new ShopOrderActivity(null, order.id(), salonId, "CUSTOMER_NOTIFIED",
                message.subject(), "system", false, "EMAIL", message.subject(), removed ? null : message.text(), status, Instant.now()));
        var id = jdbc.sql("""
                INSERT INTO shop_order_communication(salon_id, order_id, activity_id, recipient, recipient_name, html_body, failure_reason, source_activity_id, source_line_activity_id)
                VALUES (:salon, :order, :activity, :recipient, :name, :html, :reason, :source, :lineSource) RETURNING id
                """).param("salon", salonId).param("order", order.id()).param("activity", activity.id())
                .param("recipient", removed ? null : message.recipient()).param("name", removed ? null : message.recipientName()).param("html", removed ? null : message.html())
                .param("source", message.sourceActivityId()).param("lineSource", message.sourceLineActivityId()).param("reason", removed ? "Customer contact details have been removed." : skipped ? "Skipped because the customer requested important updates only." : null)
                .query(Long.class).single();
        if (!skipped && !removed) events.publishEvent(new OrderCommunicationQueuedEvent(salonId, id, 0));
    }

    @Override
    public Claimed claim(UUID salonId, Long id, int generation) {
        var row = locked(salonId, id);
        if (row.generation() != generation || !(row.status().equals("QUEUED") || row.status().equals("RETRYING") || row.status().equals("SENDING"))) return null;
        if (row.status().equals("SENDING")) {
            // A duplicate listener must wait. The event registry retries interrupted deliveries.
            if (row.updatedAt().isAfter(Instant.now().minusSeconds(300))) throw new IllegalStateException("Message is already sending");
            jdbc.sql("UPDATE shop_order_communication_attempt SET status='FAILED', failure_reason='Sending was interrupted; delivery is unconfirmed', finished_at=now() WHERE communication_id=:id AND finished_at IS NULL")
                    .param("id", id).update();
        }
        var order = orders.findByIdAndSalonId(orderId(salonId, id), salonId).orElseThrow(() -> missing());
        if (order.customerEmail() == null || order.customerEmail().endsWith("@anonymized.invalid")) {
            setStatus(salonId, id, "FAILED", "Customer contact details have been removed.");
            return null;
        }
        setStatus(salonId, id, "SENDING", null);
        var attemptId = jdbc.sql("INSERT INTO shop_order_communication_attempt(communication_id,generation,status) VALUES (:id,:generation,'SENDING') RETURNING id")
                .param("id", id).param("generation", generation).query(Long.class).single();
        jdbc.sql("UPDATE shop_order_communication SET attempts=attempts+1 WHERE id=:id").param("id", id).update();
        var name = jdbc.sql("SELECT recipient_name FROM shop_order_communication WHERE id=:id").param("id", id).query(String.class).optional().orElse("");
        return new Claimed(attemptId, new Message(row.recipient(), name, row.subject(), row.body(), row.htmlBody()));
    }

    @Override
    public boolean finish(UUID salonId, Long id, Long attemptId, String status, String reason, boolean temporary) {
        var row = locked(salonId, id);
        var generationAttempts = jdbc.sql("SELECT count(*) FROM shop_order_communication_attempt WHERE communication_id=:id AND generation=:generation")
                .param("id", id).param("generation", row.generation()).query(Integer.class).single();
        var retry = temporary && generationAttempts < 3;
        var changed = jdbc.sql("UPDATE shop_order_communication_attempt SET status=:status, failure_reason=:reason, finished_at=now() WHERE id=:attempt AND communication_id=:id AND finished_at IS NULL")
                .param("status", status).param("reason", reason).param("attempt", attemptId).param("id", id).update();
        if (changed == 0) return false; // A stale worker cannot overwrite a later attempt.
        setStatus(salonId, id, retry ? "RETRYING" : status, reason);
        return retry;
    }

    @Override
    public void retry(UUID salonId, Long orderId, Long id) {
        orders.findByIdAndSalonId(orderId, salonId).orElseThrow(() -> missing());
        var row = locked(salonId, id);
        if (!orderId(salonId, id).equals(orderId)) throw missing();
        if (!"FAILED".equals(row.status()) || !"EMAIL".equals(row.channel()) || row.body() == null || row.recipient() == null || row.recipient().endsWith("@anonymized.invalid")) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Only a failed email with saved contact details can be retried.");
        }
        jdbc.sql("UPDATE shop_order_communication SET generation=generation+1 WHERE id=:id").param("id", id).update();
        setStatus(salonId, id, "QUEUED", null);
        events.publishEvent(new OrderCommunicationQueuedEvent(salonId, id, row.generation() + 1));
    }

    @Override
    @Transactional(readOnly = true)
    public List<Communication> list(UUID salonId, Long orderId) {
        orders.findByIdAndSalonId(orderId, salonId).orElseThrow(() -> missing());
        return jdbc.sql(SELECT + " WHERE c.salon_id=:salon AND c.order_id=:order ORDER BY c.id")
                .param("salon", salonId).param("order", orderId).query(this::map).list();
    }

    private Communication locked(UUID salonId, Long id) {
        return jdbc.sql(SELECT + " WHERE c.salon_id=:salon AND c.id=:id FOR UPDATE OF c")
                .param("salon", salonId).param("id", id).query(this::map).optional().orElseThrow(() -> missing());
    }

    private Long orderId(UUID salonId, Long id) {
        return jdbc.sql("SELECT order_id FROM shop_order_communication WHERE salon_id=:salon AND id=:id")
                .param("salon", salonId).param("id", id).query(Long.class).optional().orElseThrow(() -> missing());
    }

    private void setStatus(UUID salonId, Long id, String status, String reason) {
        jdbc.sql("UPDATE shop_order_communication SET failure_reason=:reason,updated_at=now() WHERE salon_id=:salon AND id=:id")
                .param("reason", reason).param("salon", salonId).param("id", id).update();
        jdbc.sql("UPDATE shop_order_activity SET status=:status,notified=:sent WHERE id=(SELECT activity_id FROM shop_order_communication WHERE salon_id=:salon AND id=:id)")
                .param("status", status).param("sent", "SENT".equals(status)).param("salon", salonId).param("id", id).update();
    }

    private Communication map(ResultSet rs, int index) throws SQLException {
        long id = rs.getLong("id");
        var history = jdbc.sql("SELECT id,generation,status,failure_reason,started_at,finished_at FROM shop_order_communication_attempt WHERE communication_id=:id ORDER BY id")
                .param("id", id).query((r, i) -> new Attempt(r.getLong("id"), r.getInt("generation"), r.getString("status"), r.getString("failure_reason"), r.getTimestamp("started_at").toInstant(), r.getTimestamp("finished_at") == null ? null : r.getTimestamp("finished_at").toInstant())).list();
        return new Communication(id, rs.getLong("activity_id"), rs.getObject("source_activity_id", Long.class), rs.getObject("source_line_activity_id", Long.class), rs.getString("channel"), rs.getString("recipient"), rs.getString("subject"), rs.getString("body"), rs.getString("html_body"), rs.getString("status"), rs.getString("failure_reason"), rs.getInt("generation"), rs.getInt("attempts"), rs.getTimestamp("created_at").toInstant(), rs.getTimestamp("updated_at").toInstant(), history);
    }

    private static final String SELECT = "SELECT c.*,a.channel,a.subject,a.body,a.status,a.created_at FROM shop_order_communication c JOIN shop_order_activity a ON a.id=c.activity_id";
    private static ResponseStatusException missing() { return new ResponseStatusException(HttpStatus.NOT_FOUND, "Order communication not found"); }
}
