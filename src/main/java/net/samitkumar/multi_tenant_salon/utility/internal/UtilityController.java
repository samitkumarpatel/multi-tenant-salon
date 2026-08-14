package net.samitkumar.multi_tenant_salon.utility.internal;

import net.samitkumar.multi_tenant_salon.utility.Country;
import net.samitkumar.multi_tenant_salon.utility.Currency;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/salon-utility")
class UtilityController {

    private final CountryService countryService;

    UtilityController(CountryService countryService) {
        this.countryService = countryService;
    }

    @GetMapping(value = "/countries", produces = MediaType.APPLICATION_JSON_VALUE)
    List<Country> countries() {
        return countryService.findAll();
    }

    @GetMapping(value = "/currencies", produces = MediaType.APPLICATION_JSON_VALUE)
    List<Currency> currencies() {
        return countryService.findAllCurrencies();
    }
}
