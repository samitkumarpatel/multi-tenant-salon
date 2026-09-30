package net.samitkumar.multi_tenant_salon.website.internal;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.service.annotation.GetExchange;
import org.springframework.web.service.annotation.HttpExchange;
import java.util.List;

/** Fixed DNS-over-HTTPS endpoint: never fetch customer-controlled URLs. */
@HttpExchange(value = "https://cloudflare-dns.com", accept = "application/dns-json")
interface DomainDnsClient {
    @JsonIgnoreProperties(ignoreUnknown = true)
    record Answer(String name, int type, String data) {}
    @JsonIgnoreProperties(ignoreUnknown = true)
    record Reply(@JsonProperty("Status") int status, @JsonProperty("Answer") List<Answer> answers,
                 @JsonProperty("Authority") List<Answer> authority) {
        Reply(int status, List<Answer> answers) { this(status, answers, null); }
    }
    @GetExchange("/dns-query")
    Reply lookup(@RequestParam String name, @RequestParam String type);
}
