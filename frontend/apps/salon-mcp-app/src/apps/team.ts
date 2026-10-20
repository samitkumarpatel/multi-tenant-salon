import { SalonNavigator } from "../shared/navigator";
import { SalonApp, type Data } from "../shared/runtime";

// The team, opening the connected salon guide — services, the team, stylist
// profiles, hours and booking are one tap away inside this app.
const nav = new SalonNavigator();
new SalonApp<Data>("Meet the Team", "salon_team", nav.view).start();
