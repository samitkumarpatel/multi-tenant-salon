package net.samitkumar.multi_tenant_salon.superadmin;

import com.jayway.jsonpath.JsonPath;
import net.samitkumar.multi_tenant_salon.TestcontainersConfiguration;
import net.samitkumar.multi_tenant_salon.accesscontrol.UserAccessPolicy;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.client.RestTestClient;
import java.time.Instant;
import java.util.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT, properties={
        "spring.flyway.enabled=true", "spring.sql.init.mode=never", "app.security.permit-all=false",
        "spring.security.oauth2.resourceserver.jwt.issuer-uri=https://auth.test"})
@Import(TestcontainersConfiguration.class)
class UserManagementIntegrationTest {
    @Autowired JdbcTemplate jdbc;
    @Autowired UserAccessPolicy access;
    @MockitoBean JwtDecoder decoder;
    @Value("${local.server.port}") int port;
    RestTestClient client;
    UUID a,b;
    String admin,owner,user;
    final Map<String,Jwt> tokens=new java.util.concurrent.ConcurrentHashMap<>();

    @BeforeEach void setup() {
        String tag=UUID.randomUUID().toString().substring(0,8);
        admin="admin-"+tag+"@users.test"; owner="owner-"+tag+"@users.test"; user="user-"+tag+"@users.test";
        jdbc.update("INSERT INTO super_admin(email,active) VALUES(?,true)",admin);
        a=salon(owner); b=salon(owner);
        client=RestTestClient.bindToServer().baseUrl("http://localhost:"+port).build();
        when(decoder.decode(anyString())).thenAnswer(inv->tokens.get(inv.getArgument(0)));
    }
    UUID salon(String email) {
        UUID id=UUID.randomUUID();
        jdbc.update("INSERT INTO salon(id,name,handler,owner_name,owner_email,created_at) VALUES(?,'Test salon',?,'Owner',?,now())",id,"users-"+id,email);
        return id;
    }
    String token(String email,String role) {
        String id=UUID.randomUUID().toString();
        tokens.put(id,Jwt.withTokenValue(id).header("alg","RS256").subject(email).issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(600))
                .claim("roles",List.of(role)).claim("salons",List.of(Map.of("salonId",a.toString(),"role",role,"active",true))).build());
        return "Bearer "+id;
    }
    long customer(UUID salon) {
        return jdbc.queryForObject("INSERT INTO salon_customer(salon_id,name,email) VALUES(?,'Customer',?) RETURNING id",Long.class,salon,user);
    }
    long staff(UUID salon,String email) {
        return jdbc.queryForObject("INSERT INTO staff_member(salon_id,name,email,role,status,created_at) VALUES(?,'Employee',?,'STYLIST','ACTIVE',now()) RETURNING id",Long.class,salon,email);
    }
    @Test void directoryShowsRawRolesAndReverseRelationships() {
        customer(a);customer(b);staff(a,user);
        jdbc.update("UPDATE salon SET owner_email=? WHERE id=?",user,a);
        var json=client.get().uri("/api/salon-super-admin/users/detail?email="+user).header("Authorization",token(admin,"SUPER_ADMIN"))
                .exchange().expectStatus().isOk().expectBody(String.class).returnResult().getResponseBody();
        assertThat(JsonPath.<List<String>>read(json,"$.grants[*].role")).contains("OWNER","STAFF","CUSTOMER");
        assertThat(JsonPath.<List<String>>read(json,"$.grants[?(@.role=='STAFF')].effectiveRole")).containsExactly("OWNER");
        assertThat(JsonPath.<List<Object>>read(json,"$.customers")).hasSize(2);
        client.get().uri("/api/salon-super-admin/users?role=CUSTOMER&q="+user+"&size=1")
                .header("Authorization",token(admin,"SUPER_ADMIN")).exchange().expectStatus().isOk()
                .expectBody().jsonPath("$.totalElements").isEqualTo(1).jsonPath("$.content[0].salonCount").isEqualTo(2);
    }

    @Test void removedGenericUserMutationEndpointsCannotChangeAnything() {
        customer(a);customer(b);
        for(String path:List.of("removal-preview","removals"))
            client.post().uri("/api/salon-super-admin/users/"+path).header("Authorization",token(admin,"SUPER_ADMIN"))
                    .contentType(MediaType.APPLICATION_JSON).body(Map.of("email",user,"action","DELETE","reason","Attempt","confirmation",user,"revision","old","operationId",UUID.randomUUID()))
                    .exchange().expectStatus().is4xxClientError();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM salon_customer WHERE email=?",Integer.class,user)).isEqualTo(2);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM pg_tables WHERE schemaname=current_schema() AND tablename IN ('user_access_block','user_removal_operation')",Integer.class)).isZero();
    }

    @Test void superAdminCanInspectPeopleButCannotMutateTenantCustomerOrStaffRecords() {
        long customer=customer(a), staff=staff(a,user);
        String auth=token(admin,"SUPER_ADMIN"), base="/api/salon-admin/"+a;
        for(String path:List.of("/staff","/staff/"+staff,"/customers","/customers/"+customer))
            client.get().uri(base+path).header("Authorization",auth).exchange().expectStatus().isOk();
        client.post().uri(base+"/staff").header("Authorization",auth).contentType(MediaType.APPLICATION_JSON).body("{}").exchange().expectStatus().isForbidden();
        client.put().uri(base+"/staff/"+staff).header("Authorization",auth).contentType(MediaType.APPLICATION_JSON).body("{}").exchange().expectStatus().isForbidden();
        client.delete().uri(base+"/staff/"+staff).header("Authorization",auth).exchange().expectStatus().isForbidden();
        client.post().uri(base+"/customers").header("Authorization",auth).contentType(MediaType.APPLICATION_JSON).body("{}").exchange().expectStatus().isForbidden();
        client.put().uri(base+"/customers/"+customer).header("Authorization",auth).contentType(MediaType.APPLICATION_JSON).body("{}").exchange().expectStatus().isForbidden();
        client.delete().uri(base+"/customers/"+customer).header("Authorization",auth).exchange().expectStatus().isForbidden();
        client.delete().uri(java.net.URI.create(base+"/%73taff/"+staff)).header("Authorization",auth).exchange().expectStatus().is4xxClientError();
        client.delete().uri(java.net.URI.create(base+"/%63ustomers/"+customer)).header("Authorization",auth).exchange().expectStatus().is4xxClientError();
        assertThat(jdbc.queryForObject("SELECT status FROM staff_member WHERE id=?",String.class,staff)).isEqualTo("ACTIVE");
    }

    @Test void ownerOffboardingStaysScopedAndCannotDeleteAPlatformGrant() {
        long customer=customer(a), staff=staff(a,user);customer(b);
        jdbc.update("INSERT INTO super_admin(email,active) VALUES(?,true)",user);
        String auth=token(owner,"OWNER"), base="/api/salon-admin/"+a;
        client.delete().uri(base+"/staff/"+staff).header("Authorization",auth).exchange().expectStatus().isNoContent();
        client.delete().uri(base+"/customers/"+customer).header("Authorization",auth).exchange().expectStatus().isNoContent();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM salon_customer WHERE salon_id=? AND email=?",Integer.class,b,user)).isEqualTo(1);
        assertThat(access.hasRole(user,null,"SUPER_ADMIN")).isTrue();
        client.get().uri("/api/salon-super-admin/users").header("Authorization",token(user,"SUPER_ADMIN")).exchange().expectStatus().isOk();
        client.get().uri("/api/salon-super-admin/users").header("Authorization",auth).exchange().expectStatus().isForbidden();
    }

    @Test void anotherSalonOwnerCannotRemoveThisSalonsPeople() {
        long customer=customer(a), staff=staff(a,user);
        String other="other-"+UUID.randomUUID()+"@users.test";salon(other);
        String auth=token(other,"OWNER");
        client.delete().uri("/api/salon-admin/"+a+"/customers/"+customer).header("Authorization",auth).exchange().expectStatus().isForbidden();
        client.delete().uri("/api/salon-admin/"+a+"/staff/"+staff).header("Authorization",auth).exchange().expectStatus().isForbidden();
    }

    @Test void ownershipTransferRejectsOldOwnerTokenWithoutASeparateBanTable() {
        String stale=token(owner,"OWNER");
        client.get().uri("/api/salon-admin/"+a).header("Authorization",stale).exchange().expectStatus().isOk();
        jdbc.update("UPDATE salon SET owner_email='replacement@users.test' WHERE id=?",a);
        client.get().uri("/api/salon-admin/"+a).header("Authorization",stale).exchange().expectStatus().isForbidden();
        client.get().uri("/api/salon-admin/"+b).header("Authorization",stale).exchange().expectStatus().isOk();
        var detail=client.get().uri("/api/salon-super-admin/users/detail?email="+owner).header("Authorization",token(admin,"SUPER_ADMIN"))
                .exchange().expectStatus().isOk().expectBody(String.class).returnResult().getResponseBody();
        assertThat(JsonPath.<List<String>>read(detail,"$.grants[*].salonId")).containsExactly(b.toString());
    }

    @Test void removedStaffCannotUseTheirOldToken() {
        long staff=staff(a,user); String stale=token(user,"STAFF");
        client.get().uri("/api/salon-staff/"+staff).header("Authorization",stale).exchange().expectStatus().isOk();
        client.delete().uri("/api/salon-admin/"+a+"/staff/"+staff).header("Authorization",token(owner,"OWNER")).exchange().expectStatus().isNoContent();
        client.get().uri("/api/salon-staff/"+staff).header("Authorization",stale).exchange().expectStatus().isForbidden();
    }

    @Test void disabledSalonCannotBeAccessedWithAnOldStaffTokenOrEncodedPath() {
        long staff=staff(a,user); String stale=token(user,"STAFF");
        jdbc.update("UPDATE salon SET status='DISABLED' WHERE id=?",a);
        client.get().uri("/api/salon-staff/"+staff).header("Authorization",stale).exchange().expectStatus().isForbidden();
        client.get().uri(java.net.URI.create("http://localhost:"+port+"/api/%73alon-staff/"+staff))
                .header("Authorization",stale).exchange().expectStatus().is4xxClientError();
        client.get().uri("/api/salon-staff/me").header("Authorization",stale).exchange().expectStatus().isNotFound();
    }
}
