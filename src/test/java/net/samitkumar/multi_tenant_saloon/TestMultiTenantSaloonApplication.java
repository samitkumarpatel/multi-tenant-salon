package net.samitkumar.multi_tenant_saloon;

import org.springframework.boot.SpringApplication;

public class TestMultiTenantSaloonApplication {

	public static void main(String[] args) {
		SpringApplication.from(MultiTenantSaloonApplication::main).with(TestcontainersConfiguration.class).run(args);
	}

}
