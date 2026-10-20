import { SalonNavigator } from "../shared/navigator";
import { SalonApp, type Data } from "../shared/runtime";

// Salon home, opening hours (with holidays) and location, opening the connected salon guide — services, the team, stylist
// profiles, hours and booking are one tap away inside this app.
const nav = new SalonNavigator();
new SalonApp<Data>("Salon Info", "salon_explorer", nav.view).start();
