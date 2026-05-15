package net.samitkumar.multi_tenant_saloon;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
class SpaController {

    @GetMapping({"/saloon", "/saloon/"})
    String saloonAdmin() {
        return "forward:/saloon/index.html";
    }

    @GetMapping("/saloon/{saloonId}/manage")
    String saloonManage() {
        return "forward:/saloon/index.html";
    }
}
