package net.samitkumar.multi_tenant_saloon;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.modulith.core.ApplicationModules;

@Import(TestcontainersConfiguration.class)
@SpringBootTest
class MultiTenantSaloonApplicationTests {

	@Test
	void contextLoads() {
	}

	@Test
	void verifyModulithStructure() {
		ApplicationModules.of(MultiTenantSaloonApplication.class).verify();
	}

}
