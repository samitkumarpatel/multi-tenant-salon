package net.samitkumar.multi_tenant_salon;

import org.springframework.boot.SpringApplication;

public class TestMultiTenantSalonApplication {

	public static void main(String[] args) {
		SpringApplication.from(MultiTenantSalonApplication::main).with(TestcontainersConfiguration.class).run(args);
	}

}
