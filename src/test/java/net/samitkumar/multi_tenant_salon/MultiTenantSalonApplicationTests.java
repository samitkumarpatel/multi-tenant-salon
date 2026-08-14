package net.samitkumar.multi_tenant_salon;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.modulith.core.ApplicationModules;

@Import(TestcontainersConfiguration.class)
@SpringBootTest
class MultiTenantSalonApplicationTests {

	@Test
	void contextLoads() {
	}

	@Test
	void verifyModulithStructure() {
		ApplicationModules.of(MultiTenantSalonApplication.class).verify();
	}

}
