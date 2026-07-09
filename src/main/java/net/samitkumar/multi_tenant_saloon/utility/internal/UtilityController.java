package net.samitkumar.multi_tenant_saloon.utility.internal;

import net.samitkumar.multi_tenant_saloon.utility.Country;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/utility")
class UtilityController {

    private final CountryService countryService;

    UtilityController(CountryService countryService) {
        this.countryService = countryService;
    }

    @GetMapping(value = "/countries", produces = MediaType.APPLICATION_JSON_VALUE)
    List<Country> countries() {
        return countryService.findAll();
    }
}
