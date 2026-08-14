package net.samitkumar.multi_tenant_salon;

import org.jspecify.annotations.NonNull;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.modulith.Modulithic;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@SpringBootApplication
@Modulithic(systemName = "MultiTenantSalon")
public class MultiTenantSalonApplication {

	public static void main(String[] args) {
		SpringApplication.run(MultiTenantSalonApplication.class, args);
	}

	@Bean
	WebMvcConfigurer corsConfigurer(@Value("${cors.allowed-origin-patterns:*}") String[] allowedOriginPatterns) {
		return new WebMvcConfigurer() {
			@Override
			public void addCorsMappings(@NonNull CorsRegistry registry) {
				registry.addMapping("/**")
						.allowedOriginPatterns(allowedOriginPatterns)
						.allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD")
						.allowedHeaders("Content-Type", "Authorization", "X-Requested-With")
						.exposedHeaders("Content-Type", "x-tenant-id")
						.allowCredentials(false)
						.maxAge(300);
			}
		};
	}

}
