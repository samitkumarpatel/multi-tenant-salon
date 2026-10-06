import type { Language } from "./languages";

// English source messages are stable keys and the fallback for missing translations.
// Columns: English | Danish | Swedish | Norwegian Bokmål | French | German.
const rows = `
Language|Sprog|Språk|Språk|Langue|Sprache
Languages|Sprog|Språk|Språk|Langues|Sprachen
Default language|Standardsprog|Standardspråk|Standardspråk|Langue par défaut|Standardsprache
Public website|Offentlig hjemmeside|Offentlig webbplats|Offentlig nettside|Site public|Öffentliche Website
Publish languages|Udgiv sprog|Publicera språk|Publiser språk|Publier les langues|Sprachen veröffentlichen
Publishing…|Udgiver…|Publicerar…|Publiserer…|Publication…|Wird veröffentlicht…
Languages published|Sprog udgivet|Språken har publicerats|Språk publisert|Langues publiées|Sprachen veröffentlicht
Could not publish languages. Please try again.|Kunne ikke udgive sprog. Prøv igen.|Kunde inte publicera språken. Försök igen.|Kunne ikke publisere språk. Prøv igjen.|Impossible de publier les langues. Réessayez.|Sprachen konnten nicht veröffentlicht werden. Bitte erneut versuchen.
Choose which languages customers and your team can use in each app.|Vælg de sprog, kunder og dit team kan bruge i hver app.|Välj vilka språk kunder och ditt team kan använda i varje app.|Velg hvilke språk kunder og teamet ditt kan bruke i hver app.|Choisissez les langues disponibles pour vos clients et votre équipe dans chaque application.|Wählen Sie die Sprachen für Kunden und Ihr Team in jeder App.
Onboarding and staff always offer all six languages.|Oprettelse og medarbejderportalen tilbyder altid alle seks sprog.|Registrering och personalportalen erbjuder alltid alla sex språk.|Registrering og personalportalen tilbyr alltid alle seks språk.|L'inscription et le portail du personnel proposent toujours les six langues.|Registrierung und Mitarbeiterportal bieten immer alle sechs Sprachen an.
These settings translate app controls. Salon names, descriptions, and other content you enter keep their original language.|Disse indstillinger oversætter appens betjening. Salonnavne, beskrivelser og andet indhold, du indtaster, beholder deres oprindelige sprog.|Inställningarna översätter appens gränssnitt. Salongsnamn, beskrivningar och annat innehåll du anger behåller sitt ursprungliga språk.|Innstillingene oversetter appens grensesnitt. Salongnavn, beskrivelser og annet innhold du skriver inn, beholder originalspråket.|Ces paramètres traduisent l'interface. Les noms de salons, descriptions et autres contenus saisis conservent leur langue d'origine.|Diese Einstellungen übersetzen die Bedienelemente. Salonnamen, Beschreibungen und andere eingegebene Inhalte behalten ihre ursprüngliche Sprache.
Save|Gem|Spara|Lagre|Enregistrer|Speichern
Save changes|Gem ændringer|Spara ändringar|Lagre endringer|Enregistrer les modifications|Änderungen speichern
Saving…|Gemmer…|Sparar…|Lagrer…|Enregistrement…|Wird gespeichert…
Saved|Gemt|Sparat|Lagret|Enregistré|Gespeichert
Cancel|Annuller|Avbryt|Avbryt|Annuler|Abbrechen
Close|Luk|Stäng|Lukk|Fermer|Schließen
Closed|Lukket|Stängt|Stengt|Fermé|Geschlossen
Open|Åbn|Öppna|Åpne|Ouvrir|Öffnen
Open now|Åbent nu|Öppet nu|Åpent nå|Ouvert maintenant|Jetzt geöffnet
Edit|Rediger|Redigera|Rediger|Modifier|Bearbeiten
Delete|Slet|Ta bort|Slett|Supprimer|Löschen
Remove|Fjern|Ta bort|Fjern|Retirer|Entfernen
Add|Tilføj|Lägg till|Legg til|Ajouter|Hinzufügen
Back|Tilbage|Tillbaka|Tilbake|Retour|Zurück
Next|Næste|Nästa|Neste|Suivant|Weiter
Continue|Fortsæt|Fortsätt|Fortsett|Continuer|Weiter
Continue →|Fortsæt →|Fortsätt →|Fortsett →|Continuer →|Weiter →
Next →|Næste →|Nästa →|Neste →|Suivant →|Weiter →
← Back|← Tilbage|← Tillbaka|← Tilbake|← Retour|← Zurück
Confirm|Bekræft|Bekräfta|Bekreft|Confirmer|Bestätigen
Approve|Godkend|Godkänn|Godkjenn|Approuver|Genehmigen
Reject|Afvis|Avvisa|Avvis|Refuser|Ablehnen
Retry|Prøv igen|Försök igen|Prøv igjen|Réessayer|Erneut versuchen
↻ Retry|↻ Prøv igen|↻ Försök igen|↻ Prøv igjen|↻ Réessayer|↻ Erneut versuchen
Loading…|Indlæser…|Laddar…|Laster…|Chargement…|Wird geladen…
Search|Søg|Sök|Søk|Rechercher|Suchen
Clear|Ryd|Rensa|Tøm|Effacer|Leeren
All|Alle|Alla|Alle|Tous|Alle
None|Ingen|Ingen|Ingen|Aucun|Keine
Yes|Ja|Ja|Ja|Oui|Ja
No|Nej|Nej|Nei|Non|Nein
Optional|Valgfrit|Valfritt|Valgfritt|Facultatif|Optional
optional|valgfrit|valfritt|valgfritt|facultatif|optional
(optional)|(valgfrit)|(valfritt)|(valgfritt)|(facultatif)|(optional)
— optional|— valgfrit|— valfritt|— valgfritt|— facultatif|— optional
Name|Navn|Namn|Navn|Nom|Name
Full name|Fulde navn|Fullständigt namn|Fullt navn|Nom complet|Vollständiger Name
Email|E-mail|E-post|E-post|E-mail|E-Mail
Phone|Telefon|Telefon|Telefon|Téléphone|Telefon
Address|Adresse|Adress|Adresse|Adresse|Adresse
City|By|Stad|By|Ville|Stadt
State|Region|Region|Region|Région|Bundesland
Country|Land|Land|Land|Pays|Land
Postal code|Postnummer|Postnummer|Postnummer|Code postal|Postleitzahl
ZIP|Postnummer|Postnummer|Postnummer|Code postal|PLZ
Location|Placering|Plats|Sted|Localisation|Standort
Contact|Kontakt|Kontakt|Kontakt|Contact|Kontakt
Owner|Ejer|Ägare|Eier|Propriétaire|Inhaber
Customer|Kunde|Kund|Kunde|Client|Kunde
Customers|Kunder|Kunder|Kunder|Clients|Kunden
Staff|Medarbejdere|Personal|Ansatte|Personnel|Personal
Service|Behandling|Behandling|Behandling|Prestation|Leistung
Services|Behandlinger|Behandlingar|Behandlinger|Prestations|Leistungen
Salon|Salon|Salong|Salong|Salon|Salon
Salons|Saloner|Salonger|Salonger|Salons|Salons
Website|Hjemmeside|Webbplats|Nettside|Site web|Website
Booking|Booking|Bokning|Bestilling|Réservation|Buchung
Bookings|Bookinger|Bokningar|Bestillinger|Réservations|Buchungen
Dashboard|Oversigt|Översikt|Oversikt|Tableau de bord|Dashboard
Home|Hjem|Hem|Hjem|Accueil|Startseite
Manage|Administrer|Hantera|Administrer|Gérer|Verwalten
Settings|Indstillinger|Inställningar|Innstillinger|Paramètres|Einstellungen
Help|Hjælp|Hjälp|Hjelp|Aide|Hilfe
Navigation|Navigation|Navigering|Navigasjon|Navigation|Navigation
Close navigation|Luk navigation|Stäng navigering|Lukk navigasjon|Fermer la navigation|Navigation schließen
Open navigation|Åbn navigation|Öppna navigering|Åpne navigasjon|Ouvrir la navigation|Navigation öffnen
Features|Funktioner|Funktioner|Funksjoner|Fonctionnalités|Funktionen
Description|Beskrivelse|Beskrivning|Beskrivelse|Description|Beschreibung
Status|Status|Status|Status|Statut|Status
Active|Aktiv|Aktiv|Aktiv|Actif|Aktiv
Inactive|Inaktiv|Inaktiv|Inaktiv|Inactif|Inaktiv
Enabled|Aktiveret|Aktiverad|Aktivert|Activé|Aktiviert
Disabled|Deaktiveret|Inaktiverad|Deaktivert|Désactivé|Deaktiviert
Pending|Afventer|Väntar|Venter|En attente|Ausstehend
Confirmed|Bekræftet|Bekräftad|Bekreftet|Confirmé|Bestätigt
Completed|Afsluttet|Slutförd|Fullført|Terminé|Abgeschlossen
Cancelled|Annulleret|Avbokad|Avbestilt|Annulé|Storniert
Rejected|Afvist|Avvisad|Avvist|Refusé|Abgelehnt
Approved|Godkendt|Godkänd|Godkjent|Approuvé|Genehmigt
Date|Dato|Datum|Dato|Date|Datum
Time|Tid|Tid|Tid|Heure|Uhrzeit
Today|I dag|Idag|I dag|Aujourd'hui|Heute
today|i dag|idag|i dag|aujourd'hui|heute
Tomorrow|I morgen|Imorgon|I morgen|Demain|Morgen
Week|Uge|Vecka|Uke|Semaine|Woche
Month|Måned|Månad|Måned|Mois|Monat
Year|År|År|År|Année|Jahr
Day|Dag|Dag|Dag|Jour|Tag
Monday|Mandag|Måndag|Mandag|Lundi|Montag
Tuesday|Tirsdag|Tisdag|Tirsdag|Mardi|Dienstag
Wednesday|Onsdag|Onsdag|Onsdag|Mercredi|Mittwoch
Thursday|Torsdag|Torsdag|Torsdag|Jeudi|Donnerstag
Friday|Fredag|Fredag|Fredag|Vendredi|Freitag
Saturday|Lørdag|Lördag|Lørdag|Samedi|Samstag
Sunday|Søndag|Söndag|Søndag|Dimanche|Sonntag
Mon|Man|Mån|Man|Lun|Mo
Tue|Tir|Tis|Tir|Mar|Di
Wed|Ons|Ons|Ons|Mer|Mi
Thu|Tor|Tor|Tor|Jeu|Do
Fri|Fre|Fre|Fre|Ven|Fr
Sat|Lør|Lör|Lør|Sam|Sa
Sun|Søn|Sön|Søn|Dim|So
Previous week|Forrige uge|Föregående vecka|Forrige uke|Semaine précédente|Vorherige Woche
Next week|Næste uge|Nästa vecka|Neste uke|Semaine suivante|Nächste Woche
Previous month|Forrige måned|Föregående månad|Forrige måned|Mois précédent|Vorheriger Monat
Next month|Næste måned|Nästa månad|Neste måned|Mois suivant|Nächster Monat
Expand calendar|Udvid kalender|Utöka kalendern|Utvid kalender|Agrandir le calendrier|Kalender vergrößern
Exit expanded calendar|Luk udvidet kalender|Stäng utökad kalender|Lukk utvidet kalender|Réduire le calendrier|Kalender verkleinern
Holiday|Fridag|Ledig dag|Fridag|Jour de fermeture|Ruhetag
Holidays|Fridage|Lediga dagar|Fridager|Jours de fermeture|Ruhetage
Single day|En enkelt dag|En dag|En enkelt dag|Un seul jour|Einzelner Tag
Date range|Datointerval|Datumintervall|Datoperiode|Période|Zeitraum
Opening hours|Åbningstider|Öppettider|Åpningstider|Horaires d'ouverture|Öffnungszeiten
Operating Hours|Åbningstider|Öppettider|Åpningstider|Horaires d'ouverture|Öffnungszeiten
Reason|Årsag|Anledning|Årsak|Motif|Grund
Notes|Noter|Anteckningar|Notater|Notes|Notizen
Details|Detaljer|Detaljer|Detaljer|Détails|Details
Overview|Oversigt|Översikt|Oversikt|Aperçu|Übersicht
Role|Rolle|Roll|Rolle|Rôle|Rolle
Profile|Profil|Profil|Profil|Profil|Profil
My profile|Min profil|Min profil|Min profil|Mon profil|Mein Profil
About me|Om mig|Om mig|Om meg|À propos de moi|Über mich
Appointments|Aftaler|Bokningar|Avtaler|Rendez-vous|Termine
Appointment|Aftale|Bokning|Avtale|Rendez-vous|Termin
Availability|Tilgængelighed|Tillgänglighet|Tilgjengelighet|Disponibilités|Verfügbarkeit
Schedule|Tidsplan|Schema|Timeplan|Planning|Zeitplan
Media|Medier|Media|Medier|Médias|Medien
Sign in|Log ind|Logga in|Logg inn|Se connecter|Anmelden
Sign out|Log ud|Logga ut|Logg ut|Se déconnecter|Abmelden
Sign In →|Log ind →|Logga in →|Logg inn →|Se connecter →|Anmelden →
Redirecting…|Viderestiller…|Omdirigerar…|Videresender…|Redirection…|Weiterleitung…
Enter verification code|Indtast bekræftelseskode|Ange verifieringskod|Skriv inn bekreftelseskoden|Saisissez le code de vérification|Bestätigungscode eingeben
We sent a 6-digit code to|Vi har sendt en 6-cifret kode til|Vi skickade en sexsiffrig kod till|Vi sendte en sekssifret kode til|Nous avons envoyé un code à 6 chiffres à|Wir haben einen sechsstelligen Code gesendet an
Verify & sign in →|Bekræft og log ind →|Verifiera och logga in →|Bekreft og logg inn →|Vérifier et se connecter →|Bestätigen und anmelden →
Use a different email|Brug en anden e-mail|Använd en annan e-postadress|Bruk en annen e-postadresse|Utiliser une autre adresse e-mail|Andere E-Mail-Adresse verwenden
Switch salon|Skift salon|Byt salong|Bytt salong|Changer de salon|Salon wechseln
Super Admin|Superadministrator|Superadministratör|Superadministrator|Super administrateur|Superadministrator
Get started|Kom i gang|Kom igång|Kom i gang|Commencer|Loslegen
Not specified|Ikke angivet|Ej angivet|Ikke angitt|Non précisé|Nicht angegeben
Having trouble connecting|Problemer med forbindelsen|Problem med anslutningen|Problemer med tilkoblingen|Problème de connexion|Verbindungsprobleme
The server isn't responding. Check your connection and try again.|Serveren svarer ikke. Kontrollér forbindelsen og prøv igen.|Servern svarar inte. Kontrollera anslutningen och försök igen.|Serveren svarer ikke. Sjekk tilkoblingen og prøv igjen.|Le serveur ne répond pas. Vérifiez votre connexion et réessayez.|Der Server antwortet nicht. Prüfen Sie Ihre Verbindung und versuchen Sie es erneut.
Something went wrong|Noget gik galt|Något gick fel|Noe gikk galt|Une erreur est survenue|Etwas ist schiefgelaufen
Not found|Ikke fundet|Hittades inte|Ikke funnet|Introuvable|Nicht gefunden
Error|Fejl|Fel|Feil|Erreur|Fehler
Dismiss|Luk|Stäng|Lukk|Fermer|Schließen
Coming soon|Kommer snart|Kommer snart|Kommer snart|Bientôt disponible|Demnächst verfügbar
Soon|Snart|Snart|Snart|Bientôt|Bald
soon|snart|snart|snart|bientôt|bald
· All rights reserved.|· Alle rettigheder forbeholdes.|· Alla rättigheter förbehållna.|· Alle rettigheter forbeholdt.|· Tous droits réservés.|· Alle Rechte vorbehalten.
Search countries|Søg lande|Sök länder|Søk etter land|Rechercher un pays|Länder suchen
No countries found|Ingen lande fundet|Inga länder hittades|Ingen land funnet|Aucun pays trouvé|Keine Länder gefunden
Select country code|Vælg landekode|Välj landskod|Velg landskode|Choisir l'indicatif du pays|Ländervorwahl auswählen
Search country or dial code…|Søg land eller landekode…|Sök land eller landskod…|Søk etter land eller landskode…|Rechercher un pays ou un indicatif…|Land oder Vorwahl suchen…
↑ ↓ navigate · Enter select · Esc close|↑ ↓ naviger · Enter vælg · Esc luk|↑ ↓ navigera · Enter välj · Esc stäng|↑ ↓ naviger · Enter velg · Esc lukk|↑ ↓ naviguer · Entrée sélectionner · Échap fermer|↑ ↓ navigieren · Enter auswählen · Esc schließen
Book|Book|Boka|Bestill|Réserver|Buchen
Book now|Book nu|Boka nu|Bestill nå|Réserver maintenant|Jetzt buchen
Book appointment|Book en tid|Boka tid|Bestill time|Prendre rendez-vous|Termin buchen
Book new appointment|Book en ny tid|Boka en ny tid|Bestill ny time|Prendre un nouveau rendez-vous|Neuen Termin buchen
Choose a service|Vælg en behandling|Välj en behandling|Velg en behandling|Choisissez une prestation|Leistung auswählen
Select the service you'd like to book.|Vælg den behandling, du vil booke.|Välj den behandling du vill boka.|Velg behandlingen du vil bestille.|Sélectionnez la prestation à réserver.|Wählen Sie die gewünschte Leistung.
No services available yet.|Ingen behandlinger tilgængelige endnu.|Inga behandlingar tillgängliga ännu.|Ingen behandlinger tilgjengelige ennå.|Aucune prestation disponible pour le moment.|Noch keine Leistungen verfügbar.
Search services…|Søg behandlinger…|Sök behandlingar…|Søk etter behandlinger…|Rechercher une prestation…|Leistungen suchen…
Select a service above to continue|Vælg en behandling ovenfor for at fortsætte|Välj en behandling ovan för att fortsätta|Velg en behandling ovenfor for å fortsette|Sélectionnez une prestation ci-dessus pour continuer|Wählen Sie oben eine Leistung, um fortzufahren
Choose a time|Vælg et tidspunkt|Välj en tid|Velg et tidspunkt|Choisissez un horaire|Uhrzeit auswählen
Available times|Ledige tider|Lediga tider|Ledige tider|Horaires disponibles|Verfügbare Zeiten
Pick a date|Vælg en dato|Välj ett datum|Velg en dato|Choisir une date|Datum auswählen
Week view|Ugevisning|Veckovy|Ukevisning|Vue hebdomadaire|Wochenansicht
Soonest|Tidligst|Tidigast|Tidligst|Au plus tôt|Frühestmöglich
By stylist|Efter behandler|Efter behandlare|Etter behandler|Par professionnel|Nach Fachkraft
Anyone|Alle|Vem som helst|Hvem som helst|Sans préférence|Keine Präferenz
Preferred staff member|Foretrukken medarbejder|Önskad medarbetare|Ønsket ansatt|Professionnel préféré|Bevorzugte Fachkraft
View profile|Se profil|Visa profil|Se profil|Voir le profil|Profil anzeigen
Selected stylist|Valgt behandler|Vald behandlare|Valgt behandler|Professionnel sélectionné|Ausgewählte Fachkraft
Show previous stylists|Vis forrige behandlere|Visa föregående behandlare|Vis forrige behandlere|Afficher les professionnels précédents|Vorherige Fachkräfte anzeigen
Show more stylists|Vis flere behandlere|Visa fler behandlare|Vis flere behandlere|Afficher plus de professionnels|Weitere Fachkräfte anzeigen
Scroll to previous stylists|Rul til forrige behandlere|Bläddra till föregående behandlare|Rull til forrige behandlere|Faire défiler vers les professionnels précédents|Zu vorherigen Fachkräften scrollen
Scroll to more stylists|Rul til flere behandlere|Bläddra till fler behandlare|Rull til flere behandlere|Faire défiler vers d'autres professionnels|Zu weiteren Fachkräften scrollen
Scroll to see all stylists|Rul for at se alle behandlere|Bläddra för att se alla behandlare|Rull for å se alle behandlere|Faites défiler pour voir tous les professionnels|Scrollen, um alle Fachkräfte zu sehen
Scroll staff list left|Rul medarbejderlisten til venstre|Bläddra personallistan åt vänster|Rull ansattlisten til venstre|Faire défiler le personnel vers la gauche|Personalliste nach links scrollen
Scroll staff list right|Rul medarbejderlisten til højre|Bläddra personallistan åt höger|Rull ansattlisten til høyre|Faire défiler le personnel vers la droite|Personalliste nach rechts scrollen
Choose a stylist; scroll horizontally to see everyone|Vælg en behandler; rul vandret for at se alle|Välj en behandlare; bläddra horisontellt för att se alla|Velg en behandler; rull vannrett for å se alle|Choisissez un professionnel ; faites défiler horizontalement pour tous les voir|Wählen Sie eine Fachkraft; scrollen Sie horizontal, um alle zu sehen
Choose a stylist to see their available times.|Vælg en behandler for at se ledige tider.|Välj en behandlare för att se lediga tider.|Velg en behandler for å se ledige tider.|Choisissez un professionnel pour voir ses disponibilités.|Wählen Sie eine Fachkraft, um verfügbare Zeiten zu sehen.
No stylists are available for this service.|Ingen behandlere er tilgængelige til denne behandling.|Inga behandlare är tillgängliga för denna behandling.|Ingen behandlere er tilgjengelige for denne behandlingen.|Aucun professionnel n'est disponible pour cette prestation.|Für diese Leistung sind keine Fachkräfte verfügbar.
Checking times…|Tjekker tider…|Kontrollerar tider…|Sjekker tider…|Vérification des horaires…|Zeiten werden geprüft…
Times unavailable|Tider ikke tilgængelige|Tider inte tillgängliga|Tider utilgjengelige|Horaires indisponibles|Zeiten nicht verfügbar
No times this week|Ingen tider denne uge|Inga tider denna vecka|Ingen tider denne uken|Aucun horaire cette semaine|Keine Zeiten diese Woche
No times|Ingen tider|Inga tider|Ingen tider|Aucun horaire|Keine Zeiten
Not open yet|Ikke åbnet endnu|Inte öppet ännu|Ikke åpnet ennå|Pas encore ouvert|Noch nicht geöffnet
Full|Fuldt booket|Fullbokat|Fullbooket|Complet|Ausgebucht
Booked|Booket|Bokad|Bestilt|Réservé|Gebucht
No availability this week — try the next one.|Ingen ledige tider denne uge — prøv næste uge.|Inga lediga tider denna vecka — prova nästa.|Ingen ledige tider denne uken — prøv neste.|Aucune disponibilité cette semaine — essayez la suivante.|Diese Woche keine freien Zeiten — versuchen Sie die nächste.
No available times on this day.|Ingen ledige tider denne dag.|Inga lediga tider denna dag.|Ingen ledige tider denne dagen.|Aucun horaire disponible ce jour-là.|An diesem Tag sind keine Zeiten verfügbar.
Pick a date to see available times.|Vælg en dato for at se ledige tider.|Välj ett datum för att se lediga tider.|Velg en dato for å se ledige tider.|Choisissez une date pour voir les disponibilités.|Wählen Sie ein Datum, um verfügbare Zeiten zu sehen.
Finding the earliest available times…|Finder de tidligste ledige tider…|Söker de tidigaste lediga tiderna…|Finner de tidligste ledige tidene…|Recherche des premiers horaires disponibles…|Die frühesten verfügbaren Zeiten werden gesucht…
No available times within the booking window. Try another stylist or service.|Ingen ledige tider i bookingperioden. Prøv en anden behandler eller behandling.|Inga lediga tider inom bokningsperioden. Prova en annan behandlare eller behandling.|Ingen ledige tider i bestillingsperioden. Prøv en annen behandler eller behandling.|Aucun horaire disponible pendant la période de réservation. Essayez un autre professionnel ou une autre prestation.|Im Buchungszeitraum sind keine Zeiten frei. Versuchen Sie eine andere Fachkraft oder Leistung.
Find the earliest available appointment for your service.|Find den tidligste ledige tid til din behandling.|Hitta den tidigaste lediga tiden för din behandling.|Finn den tidligste ledige timen for behandlingen din.|Trouvez le premier rendez-vous disponible pour votre prestation.|Finden Sie den frühesten verfügbaren Termin für Ihre Leistung.
Pick an available time straight from the week overview.|Vælg en ledig tid direkte fra ugeoversigten.|Välj en ledig tid direkt i veckovyn.|Velg en ledig tid direkte fra ukeoversikten.|Choisissez un horaire directement dans la vue hebdomadaire.|Wählen Sie eine freie Zeit direkt aus der Wochenübersicht.
Choose your stylist, then pick an available time from their week.|Vælg din behandler og derefter en ledig tid i deres uge.|Välj din behandlare och sedan en ledig tid i veckan.|Velg behandleren din og deretter en ledig tid i uken deres.|Choisissez votre professionnel, puis un horaire dans sa semaine.|Wählen Sie Ihre Fachkraft und dann eine freie Zeit in deren Woche.
Choose when you'd like your appointment.|Vælg, hvornår du ønsker din aftale.|Välj när du vill ha din tid.|Velg når du ønsker timen din.|Choisissez la date et l'heure de votre rendez-vous.|Wählen Sie Ihren Wunschtermin.
Swipe to see all options|Swipe for at se alle muligheder|Svep för att se alla alternativ|Sveip for å se alle alternativer|Balayez pour voir toutes les options|Wischen, um alle Optionen zu sehen
Appointment time view|Visning af aftaletider|Vy för bokningstider|Visning av avtaletider|Vue des horaires de rendez-vous|Terminzeitansicht
Date & time|Dato og tid|Datum och tid|Dato og tid|Date et heure|Datum und Uhrzeit
Select a time above to continue|Vælg et tidspunkt ovenfor for at fortsætte|Välj en tid ovan för att fortsätta|Velg et tidspunkt ovenfor for å fortsette|Sélectionnez un horaire ci-dessus pour continuer|Wählen Sie oben eine Zeit, um fortzufahren
No available slots for this date and service.|Ingen ledige tider til denne dato og behandling.|Inga lediga tider för detta datum och denna behandling.|Ingen ledige tider for denne datoen og behandlingen.|Aucun créneau disponible pour cette date et cette prestation.|Keine freien Termine für dieses Datum und diese Leistung.
Try a different date or staff member.|Prøv en anden dato eller medarbejder.|Prova ett annat datum eller en annan medarbetare.|Prøv en annen dato eller ansatt.|Essayez une autre date ou un autre professionnel.|Versuchen Sie ein anderes Datum oder eine andere Fachkraft.
Your details|Dine oplysninger|Dina uppgifter|Dine opplysninger|Vos coordonnées|Ihre Angaben
We'll use this to confirm your appointment.|Vi bruger disse oplysninger til at bekræfte din aftale.|Vi använder uppgifterna för att bekräfta din bokning.|Vi bruker dette til å bekrefte timen din.|Nous utiliserons ces informations pour confirmer votre rendez-vous.|Wir verwenden diese Angaben zur Terminbestätigung.
Booking…|Booker…|Bokar…|Bestiller…|Réservation…|Wird gebucht…
Confirm booking|Bekræft booking|Bekräfta bokning|Bekreft bestilling|Confirmer la réservation|Buchung bestätigen
Request received!|Anmodning modtaget!|Förfrågan mottagen!|Forespørsel mottatt!|Demande reçue !|Anfrage erhalten!
You're booked!|Din tid er booket!|Din tid är bokad!|Timen din er bestilt!|Votre rendez-vous est réservé !|Ihr Termin ist gebucht!
pending confirmation|afventer bekræftelse|väntar på bekräftelse|venter på bekreftelse|en attente de confirmation|wartet auf Bestätigung
Payment received. Your appointment is being confirmed by the salon.|Betaling modtaget. Salonen bekræfter din aftale.|Betalning mottagen. Salongen bekräftar din bokning.|Betaling mottatt. Salongen bekrefter timen din.|Paiement reçu. Le salon confirme votre rendez-vous.|Zahlung erhalten. Ihr Termin wird vom Salon bestätigt.
Back to website|Tilbage til hjemmesiden|Tillbaka till webbplatsen|Tilbake til nettsiden|Retour au site|Zurück zur Website
View all services|Se alle behandlinger|Visa alla behandlingar|Se alle behandlinger|Voir toutes les prestations|Alle Leistungen anzeigen
Our services|Vores behandlinger|Våra behandlingar|Våre behandlinger|Nos prestations|Unsere Leistungen
Our team|Vores team|Vårt team|Teamet vårt|Notre équipe|Unser Team
About|Om os|Om oss|Om oss|À propos|Über uns
Find us|Find os|Hitta oss|Finn oss|Nous trouver|So finden Sie uns
Open in Maps|Åbn i Maps|Öppna i Maps|Åpne i Maps|Ouvrir dans Maps|In Maps öffnen
Show on public website|Vis på offentlig hjemmeside|Visa på offentlig webbplats|Vis på offentlig nettside|Afficher sur le site public|Auf öffentlicher Website anzeigen
Share links|Del links|Dela länkar|Del lenker|Liens de partage|Links teilen
Copy link|Kopiér link|Kopiera länk|Kopier lenke|Copier le lien|Link kopieren
Copied|Kopieret|Kopierad|Kopiert|Copié|Kopiert
Preview|Forhåndsvisning|Förhandsvisning|Forhåndsvisning|Aperçu|Vorschau
Publish|Udgiv|Publicera|Publiser|Publier|Veröffentlichen
Shop|Butik|Butik|Butikk|Boutique|Shop
Products|Produkter|Produkter|Produkter|Produits|Produkte
Product|Produkt|Produkt|Produkt|Produit|Produkt
Category|Kategori|Kategori|Kategori|Catégorie|Kategorie
Categories|Kategorier|Kategorier|Kategorier|Catégories|Kategorien
Brand|Mærke|Varumärke|Merke|Marque|Marke
Brands|Mærker|Varumärken|Merker|Marques|Marken
Inventory|Lager|Lager|Lager|Stock|Lagerbestand
Order|Ordre|Beställning|Ordre|Commande|Bestellung
Orders|Ordrer|Beställningar|Ordrer|Commandes|Bestellungen
Total|I alt|Totalt|Totalt|Total|Gesamt
Subtotal|Subtotal|Delsumma|Delsum|Sous-total|Zwischensumme
Price|Pris|Pris|Pris|Prix|Preis
Currency|Valuta|Valuta|Valuta|Devise|Währung
Quantity|Antal|Antal|Antall|Quantité|Menge
Amount|Beløb|Belopp|Beløp|Montant|Betrag
Discount|Rabat|Rabatt|Rabatt|Remise|Rabatt
Tax|Moms|Moms|Mva.|Taxes|Steuer
Payment|Betaling|Betalning|Betaling|Paiement|Zahlung
Payments|Betalinger|Betalningar|Betalinger|Paiements|Zahlungen
Paid|Betalt|Betald|Betalt|Payé|Bezahlt
Unpaid|Ubetalt|Obetald|Ubetalt|Impayé|Unbezahlt
Refund|Refusion|Återbetalning|Refusjon|Remboursement|Erstattung
Refunds|Refusioner|Återbetalningar|Refusjoner|Remboursements|Erstattungen
Returns|Returneringer|Returer|Returer|Retours|Retouren
Credit notes|Kreditnotaer|Kreditnotor|Kreditnotaer|Avoirs|Gutschriften
Out of stock|Udsolgt|Slut i lager|Utsolgt|Rupture de stock|Ausverkauft
In stock|På lager|I lager|På lager|En stock|Auf Lager
Add to cart|Læg i kurv|Lägg i varukorgen|Legg i handlekurven|Ajouter au panier|In den Warenkorb
Cart|Kurv|Varukorg|Handlekurv|Panier|Warenkorb
Checkout|Til kassen|Till kassan|Til kassen|Passer commande|Zur Kasse
Cashier|Kasse|Kassa|Kasse|Caisse|Kasse
Till / POS|Kasse / POS|Kassa / POS|Kasse / POS|Caisse / point de vente|Kasse / POS
Invoices|Fakturaer|Fakturor|Fakturaer|Factures|Rechnungen
Invoice|Faktura|Faktura|Faktura|Facture|Rechnung
Cash|Kontant|Kontant|Kontant|Espèces|Bar
Card|Kort|Kort|Kort|Carte|Karte
Print|Udskriv|Skriv ut|Skriv ut|Imprimer|Drucken
Download|Download|Ladda ner|Last ned|Télécharger|Herunterladen
Send|Send|Skicka|Send|Envoyer|Senden
Message|Besked|Meddelande|Melding|Message|Nachricht
Notifications|Notifikationer|Aviseringar|Varsler|Notifications|Benachrichtigungen
Analytics|Analyse|Analys|Analyse|Statistiques|Analysen
Revenue|Omsætning|Intäkter|Omsetning|Chiffre d'affaires|Umsatz
More|Mere|Mer|Mer|Plus|Mehr
Less|Mindre|Mindre|Mindre|Moins|Weniger
New|Ny|Ny|Ny|Nouveau|Neu
New booking|Ny booking|Ny bokning|Ny bestilling|Nouvelle réservation|Neue Buchung
Add service|Tilføj behandling|Lägg till behandling|Legg til behandling|Ajouter une prestation|Leistung hinzufügen
Add staff|Tilføj medarbejder|Lägg till personal|Legg til ansatt|Ajouter un membre du personnel|Personal hinzufügen
Add product|Tilføj produkt|Lägg till produkt|Legg til produkt|Ajouter un produit|Produkt hinzufügen
Add holiday|Tilføj fridag|Lägg till ledig dag|Legg til fridag|Ajouter un jour de fermeture|Ruhetag hinzufügen
Create salon|Opret salon|Skapa salong|Opprett salong|Créer un salon|Salon erstellen
Salon name|Salonnavn|Salongsnamn|Salongnavn|Nom du salon|Salonname
Your name|Dit navn|Ditt namn|Ditt navn|Votre nom|Ihr Name
Your email|Din e-mail|Din e-post|Din e-post|Votre e-mail|Ihre E-Mail
Business details|Virksomhedsoplysninger|Företagsuppgifter|Bedriftsopplysninger|Informations de l'entreprise|Unternehmensdaten
Business registration|Virksomhedsregistrering|Företagsregistrering|Bedriftsregistrering|Immatriculation de l'entreprise|Unternehmensregistrierung
Terms and conditions|Vilkår og betingelser|Allmänna villkor|Vilkår og betingelser|Conditions générales|Allgemeine Geschäftsbedingungen
Privacy policy|Privatlivspolitik|Integritetspolicy|Personvernerklæring|Politique de confidentialité|Datenschutzerklärung
Terms & Conditions|Vilkår og betingelser|Allmänna villkor|Vilkår og betingelser|Conditions générales|Allgemeine Geschäftsbedingungen
Privacy Policy|Privatlivspolitik|Integritetspolicy|Personvernerklæring|Politique de confidentialité|Datenschutzerklärung
Explore salons|Udforsk saloner|Utforska salonger|Utforsk salonger|Découvrir les salons|Salons entdecken
Find a salon|Find en salon|Hitta en salong|Finn en salong|Trouver un salon|Salon finden
Contact details|Kontaktoplysninger|Kontaktuppgifter|Kontaktopplysninger|Coordonnées|Kontaktdaten
Bookable weeks|Uger med booking|Bokningsbara veckor|Uker for bestilling|Semaines réservables|Buchbare Wochen
min|min|min|min|min|Min.
min ·|min ·|min ·|min ·|min ·|Min. ·
match|resultat|träff|treff|résultat|Treffer
matches|resultater|träffar|treff|résultats|Treffer
Times ·|Tider ·|Tider ·|Tider ·|Horaires ·|Zeiten ·
Times with|Tider hos|Tider hos|Tider hos|Horaires avec|Zeiten bei
Earliest ·|Tidligst ·|Tidigast ·|Tidligst ·|Au plus tôt ·|Frühestens ·
Your booking is|Din booking er|Din bokning är|Bestillingen din er|Votre réservation est|Ihre Buchung ist
. We'll notify|. Vi giver besked til|. Vi meddelar|. Vi varsler|. Nous informerons|. Wir benachrichtigen
once it's confirmed.|når den er bekræftet.|när den har bekräftats.|når den er bekreftet.|une fois la réservation confirmée.|sobald sie bestätigt ist.
A confirmation has been sent to|En bekræftelse er sendt til|En bekräftelse har skickats till|En bekreftelse er sendt til|Une confirmation a été envoyée à|Eine Bestätigung wurde gesendet an
Available slots for|Ledige tider for|Lediga tider för|Ledige tider for|Créneaux disponibles pour|Verfügbare Termine für
The salon is closed on|Salonen er lukket den|Salongen är stängd den|Salongen er stengt den|Le salon est fermé le|Der Salon ist geschlossen am
— pick another date.|— vælg en anden dato.|— välj ett annat datum.|— velg en annen dato.|— choisissez une autre date.|— wählen Sie ein anderes Datum.
No available times on|Ingen ledige tider den|Inga lediga tider den|Ingen ledige tider den|Aucun horaire disponible le|Keine freien Zeiten am
— try another date.|— prøv en anden dato.|— prova ett annat datum.|— prøv en annen dato.|— essayez une autre date.|— versuchen Sie ein anderes Datum.
Back to|Tilbage til|Tillbaka till|Tilbake til|Retour à|Zurück zu
at|kl.|kl.|kl.|à|um
to|til|till|til|à|bis
{count} free|{count} ledige|{count} lediga|{count} ledige|{count} libres|{count} frei
Book at {name}|Book hos {name}|Boka hos {name}|Bestill hos {name}|Réserver chez {name}|Bei {name} buchen
Loading your salon desk…|Indlæser din salonoversigt…|Laddar din salongsöversikt…|Laster salongoversikten…|Chargement du tableau de bord du salon…|Salon-Dashboard wird geladen…
Salon not found|Salon ikke fundet|Salongen hittades inte|Salongen ble ikke funnet|Salon introuvable|Salon nicht gefunden
Booking link not found|Bookinglink ikke fundet|Bokningslänken hittades inte|Bestillingslenken ble ikke funnet|Lien de réservation introuvable|Buchungslink nicht gefunden
Online booking unavailable|Onlinebooking ikke tilgængelig|Onlinebokning är inte tillgänglig|Nettbestilling er utilgjengelig|Réservation en ligne indisponible|Onlinebuchung nicht verfügbar
Rating link unavailable|Bedømmelseslink ikke tilgængeligt|Omdömeslänken är inte tillgänglig|Vurderingslenken er utilgjengelig|Lien d'évaluation indisponible|Bewertungslink nicht verfügbar
How was your visit?|Hvordan var dit besøg?|Hur var ditt besök?|Hvordan var besøket ditt?|Comment s'est passée votre visite ?|Wie war Ihr Besuch?
Thank you for your ratings|Tak for dine bedømmelser|Tack för dina omdömen|Takk for vurderingene dine|Merci pour vos évaluations|Vielen Dank für Ihre Bewertungen
Submit ratings|Send bedømmelser|Skicka omdömen|Send vurderinger|Envoyer les évaluations|Bewertungen absenden
Submitting…|Sender…|Skickar…|Sender…|Envoi…|Wird gesendet…
No-show|Udeblevet|Utebliven|Ikke møtt|Absent|Nicht erschienen
Hair|Hår|Hår|Hår|Cheveux|Haare
Nails|Negle|Naglar|Negler|Ongles|Nägel
Skin|Hud|Hud|Hud|Peau|Haut
Massage|Massage|Massage|Massasje|Massage|Massage
Other|Andet|Övrigt|Annet|Autre|Sonstiges
Stylist|Frisør|Frisör|Frisør|Coiffeur|Stylist
Barber|Barber|Barberare|Barberer|Barbier|Barbier
Therapist|Terapeut|Terapeut|Terapeut|Thérapeute|Therapeut
Receptionist|Receptionist|Receptionist|Resepsjonist|Réceptionniste|Empfangskraft
Assistant|Assistent|Assistent|Assistent|Assistant|Assistent
Manager|Leder|Chef|Leder|Responsable|Leitung
Membership|Medlemskab|Medlemskap|Medlemskap|Abonnement|Mitgliedschaft
Loyalty program|Loyalitetsprogram|Lojalitetsprogram|Lojalitetsprogram|Programme de fidélité|Treueprogramm
Webshop|Webshop|Webbutik|Nettbutikk|Boutique en ligne|Onlineshop
Design|Design|Design|Design|Design|Design
Domain|Domæne|Domän|Domene|Domaine|Domain
Social Media|Sociale medier|Sociala medier|Sosiale medier|Réseaux sociaux|Soziale Medien
Created|Oprettet|Skapad|Opprettet|Créé|Erstellt
Copy ID|Kopiér ID|Kopiera ID|Kopier ID|Copier l'identifiant|ID kopieren
Web name|Webnavn|Webbnamn|Nettnavn|Nom web|Webname
View share links|Se delingslinks|Visa delningslänkar|Se delingslenker|Voir les liens de partage|Links zum Teilen anzeigen
Share your salon|Del din salon|Dela din salong|Del salongen din|Partager votre salon|Ihren Salon teilen
Share with your team|Del med dit team|Dela med ditt team|Del med teamet ditt|Partager avec votre équipe|Mit Ihrem Team teilen
Show all|Vis alle|Visa alla|Vis alle|Tout afficher|Alle anzeigen
View details|Se detaljer|Visa detaljer|Se detaljer|Voir les détails|Details anzeigen
Refresh|Opdater|Uppdatera|Oppdater|Actualiser|Aktualisieren
Reset|Nulstil|Återställ|Tilbakestill|Réinitialiser|Zurücksetzen
Apply|Anvend|Tillämpa|Bruk|Appliquer|Anwenden
Filter|Filtrer|Filtrera|Filtrer|Filtrer|Filtern
Filters|Filtre|Filter|Filtre|Filtres|Filter
Export|Eksportér|Exportera|Eksporter|Exporter|Exportieren
Actions|Handlinger|Åtgärder|Handlinger|Actions|Aktionen
Duration|Varighed|Längd|Varighet|Durée|Dauer
Minutes|Minutter|Minuter|Minutter|Minutes|Minuten
Start time|Starttid|Starttid|Starttid|Heure de début|Startzeit
End time|Sluttid|Sluttid|Sluttid|Heure de fin|Endzeit
Start date|Startdato|Startdatum|Startdato|Date de début|Startdatum
End date|Slutdato|Slutdatum|Sluttdato|Date de fin|Enddatum
All services|Alle behandlinger|Alla behandlingar|Alle behandlinger|Toutes les prestations|Alle Leistungen
All staff|Alle medarbejdere|All personal|Alle ansatte|Tout le personnel|Alle Mitarbeiter
All statuses|Alle statusser|Alla statusar|Alle statuser|Tous les statuts|Alle Status
Search customers…|Søg kunder…|Sök kunder…|Søk etter kunder…|Rechercher des clients…|Kunden suchen…
Search products…|Søg produkter…|Sök produkter…|Søk etter produkter…|Rechercher des produits…|Produkte suchen…
Search salons…|Søg saloner…|Sök salonger…|Søk etter salonger…|Rechercher des salons…|Salons suchen…
No results|Ingen resultater|Inga resultat|Ingen resultater|Aucun résultat|Keine Ergebnisse
No bookings|Ingen bookinger|Inga bokningar|Ingen bestillinger|Aucune réservation|Keine Buchungen
No appointments|Ingen aftaler|Inga bokningar|Ingen avtaler|Aucun rendez-vous|Keine Termine
Save profile|Gem profil|Spara profil|Lagre profil|Enregistrer le profil|Profil speichern
Upload|Upload|Ladda upp|Last opp|Importer|Hochladen
Uploading…|Uploader…|Laddar upp…|Laster opp…|Importation…|Wird hochgeladen…
Photo|Foto|Foto|Bilde|Photo|Foto
Photos|Fotos|Foton|Bilder|Photos|Fotos
Add photos|Tilføj fotos|Lägg till foton|Legg til bilder|Ajouter des photos|Fotos hinzufügen
View|Se|Visa|Vis|Voir|Anzeigen
Update|Opdater|Uppdatera|Oppdater|Mettre à jour|Aktualisieren
Delete booking|Slet booking|Ta bort bokning|Slett bestilling|Supprimer la réservation|Buchung löschen
Cancel booking|Annuller booking|Avboka|Avbestill|Annuler la réservation|Buchung stornieren
Reschedule|Flyt aftale|Boka om|Flytt avtale|Reprogrammer|Termin verschieben
Mark completed|Markér som afsluttet|Markera som slutförd|Merk som fullført|Marquer comme terminé|Als abgeschlossen markieren
Send message|Send besked|Skicka meddelande|Send melding|Envoyer un message|Nachricht senden
Sending…|Sender…|Skickar…|Sender…|Envoi…|Wird gesendet…
Required|Påkrævet|Obligatoriskt|Påkrevd|Obligatoire|Erforderlich
Select|Vælg|Välj|Velg|Sélectionner|Auswählen
Select a service|Vælg en behandling|Välj en behandling|Velg en behandling|Sélectionner une prestation|Leistung auswählen
Select staff|Vælg medarbejder|Välj personal|Velg ansatt|Sélectionner un professionnel|Personal auswählen
Select a date|Vælg en dato|Välj ett datum|Velg en dato|Sélectionner une date|Datum auswählen
Select a time|Vælg et tidspunkt|Välj en tid|Velg et tidspunkt|Sélectionner un horaire|Uhrzeit auswählen
Add to wishlist|Føj til ønskeliste|Lägg till i önskelistan|Legg til i ønskelisten|Ajouter aux favoris|Zur Wunschliste hinzufügen
Wishlist|Ønskeliste|Önskelista|Ønskeliste|Favoris|Wunschliste
Continue shopping|Fortsæt med at handle|Fortsätt handla|Fortsett å handle|Continuer les achats|Weiter einkaufen
Your cart is empty|Din kurv er tom|Din varukorg är tom|Handlekurven er tom|Votre panier est vide|Ihr Warenkorb ist leer
Shipping|Levering|Frakt|Frakt|Livraison|Versand
Shipping address|Leveringsadresse|Leveransadress|Leveringsadresse|Adresse de livraison|Lieferadresse
Billing address|Faktureringsadresse|Faktureringsadress|Fakturaadresse|Adresse de facturation|Rechnungsadresse
Payment method|Betalingsmetode|Betalningsmetod|Betalingsmåte|Mode de paiement|Zahlungsart
Receipt|Kvittering|Kvitto|Kvittering|Reçu|Beleg
Refunded|Refunderet|Återbetald|Refundert|Remboursé|Erstattet
Processing|Behandler|Behandlas|Behandler|En cours|In Bearbeitung
Draft|Kladde|Utkast|Utkast|Brouillon|Entwurf
Published|Udgivet|Publicerad|Publisert|Publié|Veröffentlicht
Unpublished|Ikke udgivet|Ej publicerad|Ikke publisert|Non publié|Unveröffentlicht
Enable|Aktivér|Aktivera|Aktiver|Activer|Aktivieren
Disable|Deaktivér|Inaktivera|Deaktiver|Désactiver|Deaktivieren
Delete permanently|Slet permanent|Ta bort permanent|Slett permanent|Supprimer définitivement|Endgültig löschen
Are you sure?|Er du sikker?|Är du säker?|Er du sikker?|Êtes-vous sûr ?|Sind Sie sicher?
This action cannot be undone.|Denne handling kan ikke fortrydes.|Den här åtgärden kan inte ångras.|Denne handlingen kan ikke angres.|Cette action est irréversible.|Diese Aktion kann nicht rückgängig gemacht werden.
Welcome|Velkommen|Välkommen|Velkommen|Bienvenue|Willkommen
Welcome back|Velkommen tilbage|Välkommen tillbaka|Velkommen tilbake|Bon retour|Willkommen zurück
Finish|Afslut|Slutför|Fullfør|Terminer|Fertigstellen
Done|Færdig|Klart|Ferdig|Terminé|Fertig
Skip|Spring over|Hoppa över|Hopp over|Passer|Überspringen
Setup|Opsætning|Konfiguration|Oppsett|Configuration|Einrichtung
Summary|Oversigt|Sammanfattning|Sammendrag|Récapitulatif|Zusammenfassung
Review|Gennemse|Granska|Se gjennom|Vérifier|Prüfen
Account|Konto|Konto|Konto|Compte|Konto
Support|Support|Support|Brukerstøtte|Assistance|Support
Session renewed|Session fornyet|Sessionen förnyad|Økten fornyet|Session renouvelée|Sitzung erneuert
Your session has expired. Please sign in again.|Din session er udløbet. Log ind igen.|Din session har gått ut. Logga in igen.|Økten din har utløpt. Logg inn igjen.|Votre session a expiré. Veuillez vous reconnecter.|Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.
You don't have permission to perform this action.|Du har ikke tilladelse til denne handling.|Du har inte behörighet att utföra den här åtgärden.|Du har ikke tillatelse til denne handlingen.|Vous n'avez pas l'autorisation d'effectuer cette action.|Sie haben keine Berechtigung für diese Aktion.
Please try again.|Prøv igen.|Försök igen.|Prøv igjen.|Veuillez réessayer.|Bitte versuchen Sie es erneut.
No features enabled|Ingen funktioner aktiveret|Inga funktioner aktiverade|Ingen funksjoner aktivert|Aucune fonctionnalité activée|Keine Funktionen aktiviert
More features available|Flere funktioner tilgængelige|Fler funktioner tillgängliga|Flere funksjoner tilgjengelige|Autres fonctionnalités disponibles|Weitere Funktionen verfügbar
Edit Salon → Features|Rediger salon → Funktioner|Redigera salong → Funktioner|Rediger salong → Funksjoner|Modifier le salon → Fonctionnalités|Salon bearbeiten → Funktionen
Go to Edit Salon|Gå til Rediger salon|Gå till Redigera salong|Gå til Rediger salong|Modifier le salon|Salon bearbeiten
None shown on your website|Ingen vist på din hjemmeside|Inga visas på din webbplats|Ingen vises på nettsiden din|Aucun affiché sur votre site|Keine auf Ihrer Website angezeigt
shown, no link yet|vist, intet link endnu|visas, ingen länk ännu|vises, ingen lenke ennå|affiché, sans lien pour le moment|angezeigt, noch kein Link
Copy web name|Kopiér webnavn|Kopiera webbnamn|Kopier nettnavn|Copier le nom web|Webnamen kopieren
Edit Salon|Rediger salon|Redigera salong|Rediger salong|Modifier le salon|Salon bearbeiten
Business ID|Virksomheds-ID|Organisationsnummer|Organisasjonsnummer|Identifiant d'entreprise|Unternehmens-ID
Reg. ID|CVR-nr.|Org.nr.|Org.nr.|N° d'immatriculation|Registrierungsnr.
Admin|Administrator|Administratör|Administrator|Administrateur|Administrator
Staff portal|Medarbejderportal|Personalportal|Personalportal|Portail du personnel|Mitarbeiterportal
Booking link|Bookinglink|Bokningslänk|Bestillingslenke|Lien de réservation|Buchungslink
Salon details|Salonoplysninger|Salongsuppgifter|Salongopplysninger|Informations du salon|Salondetails
Customer name|Kundenavn|Kundnamn|Kundenavn|Nom du client|Kundenname
Customer email|Kundens e-mail|Kundens e-post|Kundens e-post|E-mail du client|E-Mail des Kunden
Customer phone|Kundens telefon|Kundens telefon|Kundens telefon|Téléphone du client|Telefon des Kunden
Add a note|Tilføj en note|Lägg till en anteckning|Legg til et notat|Ajouter une note|Notiz hinzufügen
Select country|Vælg land|Välj land|Velg land|Sélectionner un pays|Land auswählen
Select currency|Vælg valuta|Välj valuta|Velg valuta|Sélectionner une devise|Währung auswählen
Free|Gratis|Gratis|Gratis|Gratuit|Kostenlos
Available|Ledig|Tillgänglig|Ledig|Disponible|Verfügbar
Unavailable|Ikke tilgængelig|Ej tillgänglig|Utilgjengelig|Indisponible|Nicht verfügbar
No data|Ingen data|Inga data|Ingen data|Aucune donnée|Keine Daten
No results found|Ingen resultater fundet|Inga resultat hittades|Ingen resultater funnet|Aucun résultat trouvé|Keine Ergebnisse gefunden
See all|Se alle|Se alla|Se alle|Tout voir|Alle ansehen
Show more|Vis mere|Visa mer|Vis mer|Afficher plus|Mehr anzeigen
Show less|Vis mindre|Visa mindre|Vis mindre|Afficher moins|Weniger anzeigen
Select all|Vælg alle|Välj alla|Velg alle|Tout sélectionner|Alle auswählen
Deselect all|Fravælg alle|Avmarkera alla|Fjern alle valg|Tout désélectionner|Alle abwählen
Create|Opret|Skapa|Opprett|Créer|Erstellen
Creating…|Opretter…|Skapar…|Oppretter…|Création…|Wird erstellt…
Updating…|Opdaterer…|Uppdaterar…|Oppdaterer…|Mise à jour…|Wird aktualisiert…
Deleting…|Sletter…|Tar bort…|Sletter…|Suppression…|Wird gelöscht…
Removing…|Fjerner…|Tar bort…|Fjerner…|Suppression…|Wird entfernt…
Add new|Tilføj ny|Lägg till ny|Legg til ny|Ajouter|Neu hinzufügen
Optional note|Valgfri note|Valfri anteckning|Valgfritt notat|Note facultative|Optionale Notiz
Contact us|Kontakt os|Kontakta oss|Kontakt oss|Contactez-nous|Kontaktieren Sie uns
Get directions|Få rutevejledning|Hämta vägbeskrivning|Få veibeskrivelse|Itinéraire|Wegbeschreibung
Meet the team|Mød teamet|Träffa teamet|Møt teamet|Rencontrez l'équipe|Lernen Sie das Team kennen
Browse services|Se behandlinger|Se behandlingar|Se behandlinger|Parcourir les prestations|Leistungen ansehen
Choose your service|Vælg din behandling|Välj din behandling|Velg behandlingen din|Choisissez votre prestation|Wählen Sie Ihre Leistung
Select your preferred time|Vælg dit foretrukne tidspunkt|Välj önskad tid|Velg ønsket tidspunkt|Choisissez votre horaire préféré|Wählen Sie Ihre Wunschzeit
No staff available|Ingen medarbejdere tilgængelige|Ingen personal tillgänglig|Ingen ansatte tilgjengelige|Aucun professionnel disponible|Kein Personal verfügbar
Online booking|Onlinebooking|Onlinebokning|Nettbestilling|Réservation en ligne|Onlinebuchung
Duration (minutes)|Varighed (minutter)|Längd (minuter)|Varighet (minutter)|Durée (minutes)|Dauer (Minuten)
Price ({currency})|Pris ({currency})|Pris ({currency})|Pris ({currency})|Prix ({currency})|Preis ({currency})
Ratings|Bedømmelser|Omdömen|Vurderinger|Évaluations|Bewertungen
Reviews|Anmeldelser|Recensioner|Anmeldelser|Avis|Rezensionen
No reviews yet|Ingen anmeldelser endnu|Inga recensioner ännu|Ingen anmeldelser ennå|Aucun avis pour le moment|Noch keine Rezensionen
Not rated yet|Ikke bedømt endnu|Inte betygsatt ännu|Ikke vurdert ennå|Pas encore évalué|Noch nicht bewertet
Loading services…|Indlæser behandlinger…|Laddar behandlingar…|Laster behandlinger…|Chargement des prestations…|Leistungen werden geladen…
Loading appointments…|Indlæser aftaler…|Laddar bokningar…|Laster avtaler…|Chargement des rendez-vous…|Termine werden geladen…
Loading bookings…|Indlæser bookinger…|Laddar bokningar…|Laster bestillinger…|Chargement des réservations…|Buchungen werden geladen…
Pending approval|Afventer godkendelse|Väntar på godkännande|Venter på godkjenning|En attente d'approbation|Genehmigung ausstehend
Request holiday|Anmod om ferie|Ansök om ledighet|Søk om ferie|Demander un congé|Urlaub beantragen
My appointments|Mine aftaler|Mina bokningar|Mine avtaler|Mes rendez-vous|Meine Termine
My holidays|Min ferie|Min ledighet|Min ferie|Mes congés|Mein Urlaub
My media|Mine medier|Mina medier|Mine medier|Mes médias|Meine Medien
Personal information|Personlige oplysninger|Personuppgifter|Personopplysninger|Informations personnelles|Persönliche Angaben
Biography|Biografi|Biografi|Biografi|Biographie|Biografie
Save Changes|Gem ændringer|Spara ändringar|Lagre endringer|Enregistrer les modifications|Änderungen speichern
Save Profile|Gem profil|Spara profil|Lagre profil|Enregistrer le profil|Profil speichern
Upcoming|Kommende|Kommande|Kommende|À venir|Bevorstehend
Past|Tidligere|Tidigare|Tidligere|Passés|Vergangen
All time|Hele perioden|Hela perioden|Hele perioden|Toute la période|Gesamter Zeitraum
This week|Denne uge|Denna vecka|Denne uken|Cette semaine|Diese Woche
This month|Denne måned|Denna månad|Denne måneden|Ce mois-ci|Diesen Monat
Last 7 days|Seneste 7 dage|Senaste 7 dagarna|Siste 7 dager|7 derniers jours|Letzte 7 Tage
Last 30 days|Seneste 30 dage|Senaste 30 dagarna|Siste 30 dager|30 derniers jours|Letzte 30 Tage
Custom|Tilpasset|Anpassat|Tilpasset|Personnalisé|Benutzerdefiniert
From|Fra|Från|Fra|De|Von
To|Til|Till|Til|À|Bis
Send notification|Send besked|Skicka avisering|Send varsel|Envoyer une notification|Benachrichtigung senden
Discount code|Rabatkode|Rabattkod|Rabattkode|Code de réduction|Rabattcode
Apply discount|Anvend rabat|Tillämpa rabatt|Bruk rabatt|Appliquer la remise|Rabatt anwenden
Balance|Saldo|Saldo|Saldo|Solde|Saldo
Payment status|Betalingsstatus|Betalningsstatus|Betalingsstatus|Statut du paiement|Zahlungsstatus
Order status|Ordrestatus|Orderstatus|Ordrestatus|Statut de la commande|Bestellstatus
Order details|Ordreoplysninger|Orderuppgifter|Ordredetaljer|Détails de la commande|Bestelldetails
Order number|Ordrenummer|Ordernummer|Ordrenummer|Numéro de commande|Bestellnummer
Order date|Ordredato|Orderdatum|Ordredato|Date de commande|Bestelldatum
Items|Varer|Artiklar|Varer|Articles|Artikel
Item|Vare|Artikel|Vare|Article|Artikel
Stock|Lager|Lager|Lager|Stock|Bestand
SKU|Varenummer|Artikelnummer|Varenummer|Référence|Artikelnummer
Variant|Variant|Variant|Variant|Variante|Variante
Variants|Varianter|Varianter|Varianter|Variantes|Varianten
Image|Billede|Bild|Bilde|Image|Bild
Images|Billeder|Bilder|Bilder|Images|Bilder
No image|Intet billede|Ingen bild|Ingen bilde|Aucune image|Kein Bild
View order|Se ordre|Visa beställning|Se ordre|Voir la commande|Bestellung ansehen
View invoice|Se faktura|Visa faktura|Se faktura|Voir la facture|Rechnung ansehen
Download invoice|Download faktura|Ladda ner faktura|Last ned faktura|Télécharger la facture|Rechnung herunterladen
Print receipt|Udskriv kvittering|Skriv ut kvitto|Skriv ut kvittering|Imprimer le reçu|Beleg drucken
Complete sale|Afslut salg|Slutför försäljning|Fullfør salg|Finaliser la vente|Verkauf abschließen
New sale|Nyt salg|Ny försäljning|Nytt salg|Nouvelle vente|Neuer Verkauf
Charge|Opkræv|Debitera|Belast|Encaisser|Abrechnen
Pay|Betal|Betala|Betal|Payer|Bezahlen
Pay now|Betal nu|Betala nu|Betal nå|Payer maintenant|Jetzt bezahlen
Change|Byttepenge|Växel|Vekslepenger|Monnaie|Wechselgeld
Amount paid|Betalt beløb|Betalt belopp|Betalt beløp|Montant payé|Bezahlter Betrag
Amount due|Skyldigt beløb|Belopp att betala|Utestående beløp|Montant dû|Fälliger Betrag
Send invoice|Send faktura|Skicka faktura|Send faktura|Envoyer la facture|Rechnung senden
No items|Ingen varer|Inga artiklar|Ingen varer|Aucun article|Keine Artikel
Clear cart|Tøm kurv|Töm varukorgen|Tøm handlekurven|Vider le panier|Warenkorb leeren
Add item|Tilføj vare|Lägg till artikel|Legg til vare|Ajouter un article|Artikel hinzufügen
Search items…|Søg varer…|Sök artiklar…|Søk etter varer…|Rechercher des articles…|Artikel suchen…
Payment complete|Betaling gennemført|Betalning klar|Betaling fullført|Paiement effectué|Zahlung abgeschlossen
Payment failed|Betaling mislykkedes|Betalningen misslyckades|Betalingen mislyktes|Échec du paiement|Zahlung fehlgeschlagen
Try again|Prøv igen|Försök igen|Prøv igjen|Réessayer|Erneut versuchen
Go back|Gå tilbage|Gå tillbaka|Gå tilbake|Retour|Zurück
Go home|Gå til forsiden|Gå till startsidan|Gå til forsiden|Aller à l'accueil|Zur Startseite
No services yet|Ingen behandlinger endnu|Inga behandlingar ännu|Ingen behandlinger ennå|Aucune prestation pour le moment|Noch keine Leistungen
No staff yet|Ingen medarbejdere endnu|Ingen personal ännu|Ingen ansatte ennå|Aucun personnel pour le moment|Noch kein Personal
Add your first service|Tilføj din første behandling|Lägg till din första behandling|Legg til din første behandling|Ajoutez votre première prestation|Erste Leistung hinzufügen
Add your first staff member|Tilføj din første medarbejder|Lägg till din första medarbetare|Legg til din første ansatt|Ajoutez votre premier collaborateur|Ersten Mitarbeiter hinzufügen
Website preview|Forhåndsvisning af hjemmeside|Förhandsvisning av webbplats|Forhåndsvisning av nettside|Aperçu du site|Website-Vorschau
View website|Se hjemmeside|Visa webbplats|Se nettside|Voir le site|Website ansehen
Open website|Åbn hjemmeside|Öppna webbplats|Åpne nettside|Ouvrir le site|Website öffnen
Edit website|Rediger hjemmeside|Redigera webbplats|Rediger nettside|Modifier le site|Website bearbeiten
Book a service|Book en behandling|Boka en behandling|Bestill en behandling|Réserver une prestation|Leistung buchen
Book a visit|Book et besøg|Boka ett besök|Bestill et besøk|Réserver une visite|Besuch buchen
Learn more|Læs mere|Läs mer|Les mer|En savoir plus|Mehr erfahren
Read more|Læs mere|Läs mer|Les mer|Lire la suite|Weiterlesen
Read less|Læs mindre|Läs mindre|Les mindre|Réduire|Weniger lesen
View gallery|Se galleri|Visa galleri|Se galleri|Voir la galerie|Galerie ansehen
Gallery|Galleri|Galleri|Galleri|Galerie|Galerie
See availability|Se ledige tider|Se lediga tider|Se ledige tider|Voir les disponibilités|Verfügbarkeit ansehen
Contact salon|Kontakt salonen|Kontakta salongen|Kontakt salongen|Contacter le salon|Salon kontaktieren
Call|Ring|Ring|Ring|Appeler|Anrufen
Call us|Ring til os|Ring oss|Ring oss|Appelez-nous|Rufen Sie uns an
Email us|Send os en e-mail|Mejla oss|Send oss e-post|Écrivez-nous|Schreiben Sie uns
Business hours|Åbningstider|Öppettider|Åpningstider|Horaires d'ouverture|Öffnungszeiten
View on map|Se på kort|Visa på karta|Se på kart|Voir sur la carte|Auf Karte anzeigen
Getting started|Kom godt i gang|Kom igång|Kom i gang|Premiers pas|Erste Schritte
Salon setup|Salonopsætning|Salongsinställningar|Salongoppsett|Configuration du salon|Saloneinrichtung
Create your salon|Opret din salon|Skapa din salong|Opprett salongen din|Créez votre salon|Erstellen Sie Ihren Salon
Get started free|Kom gratis i gang|Kom igång gratis|Kom i gang gratis|Commencer gratuitement|Kostenlos starten
Start free|Start gratis|Börja gratis|Start gratis|Commencer gratuitement|Kostenlos starten
No credit card required|Intet kreditkort påkrævet|Inget kreditkort krävs|Ingen kredittkort kreves|Aucune carte bancaire requise|Keine Kreditkarte erforderlich
Back to home|Tilbage til forsiden|Tillbaka till startsidan|Tilbake til forsiden|Retour à l'accueil|Zurück zur Startseite
Back to salons|Tilbage til saloner|Tillbaka till salonger|Tilbake til salonger|Retour aux salons|Zurück zu den Salons
Select a salon|Vælg en salon|Välj en salong|Velg en salong|Sélectionner un salon|Salon auswählen
Choose a salon|Vælg en salon|Välj en salong|Velg en salong|Choisir un salon|Salon auswählen
Your salons|Dine saloner|Dina salonger|Dine salonger|Vos salons|Ihre Salons
My salons|Mine saloner|Mina salonger|Mine salonger|Mes salons|Meine Salons
Add salon|Tilføj salon|Lägg till salong|Legg til salong|Ajouter un salon|Salon hinzufügen
All salons|Alle saloner|Alla salonger|Alle salonger|Tous les salons|Alle Salons
Search by name…|Søg efter navn…|Sök efter namn…|Søk etter navn…|Rechercher par nom…|Nach Namen suchen…
Search by name or email…|Søg efter navn eller e-mail…|Sök efter namn eller e-post…|Søk etter navn eller e-post…|Rechercher par nom ou e-mail…|Nach Name oder E-Mail suchen…
Welcome to SalonSaaS|Velkommen til SalonSaaS|Välkommen till SalonSaaS|Velkommen til SalonSaaS|Bienvenue sur SalonSaaS|Willkommen bei SalonSaaS
Account details|Kontooplysninger|Kontouppgifter|Kontoopplysninger|Informations du compte|Kontodaten
Email address|E-mailadresse|E-postadress|E-postadresse|Adresse e-mail|E-Mail-Adresse
Phone number|Telefonnummer|Telefonnummer|Telefonnummer|Numéro de téléphone|Telefonnummer
Enter your email|Indtast din e-mail|Ange din e-post|Skriv inn e-postadressen din|Saisissez votre e-mail|E-Mail-Adresse eingeben
Enter your name|Indtast dit navn|Ange ditt namn|Skriv inn navnet ditt|Saisissez votre nom|Namen eingeben
Send code|Send kode|Skicka kod|Send kode|Envoyer le code|Code senden
Resend code|Send kode igen|Skicka koden igen|Send koden på nytt|Renvoyer le code|Code erneut senden
Verify|Bekræft|Verifiera|Bekreft|Vérifier|Bestätigen
Verifying…|Bekræfter…|Verifierar…|Bekrefter…|Vérification…|Wird bestätigt…
Sign in to continue|Log ind for at fortsætte|Logga in för att fortsätta|Logg inn for å fortsette|Connectez-vous pour continuer|Zum Fortfahren anmelden
Remember me|Husk mig|Kom ihåg mig|Husk meg|Se souvenir de moi|Angemeldet bleiben
Admin portal|Administratorportal|Administratörsportal|Administratorportal|Portail administrateur|Administratorportal
Owner portal|Ejerportal|Ägarportal|Eierportal|Portail propriétaire|Inhaberportal
My schedule|Min tidsplan|Mitt schema|Min timeplan|Mon planning|Mein Zeitplan
Work hours|Arbejdstider|Arbetstider|Arbeidstider|Horaires de travail|Arbeitszeiten
Working hours|Arbejdstider|Arbetstider|Arbeidstider|Horaires de travail|Arbeitszeiten
Time off|Fri|Ledighet|Fri|Congés|Abwesenheit
Request time off|Anmod om fri|Ansök om ledighet|Søk om fri|Demander un congé|Abwesenheit beantragen
Pending requests|Afventende anmodninger|Väntande ansökningar|Ventende forespørsler|Demandes en attente|Ausstehende Anträge
Approved requests|Godkendte anmodninger|Godkända ansökningar|Godkjente forespørsler|Demandes approuvées|Genehmigte Anträge
No appointments today|Ingen aftaler i dag|Inga bokningar idag|Ingen avtaler i dag|Aucun rendez-vous aujourd'hui|Heute keine Termine
No upcoming appointments|Ingen kommende aftaler|Inga kommande bokningar|Ingen kommende avtaler|Aucun rendez-vous à venir|Keine bevorstehenden Termine
View appointments|Se aftaler|Visa bokningar|Se avtaler|Voir les rendez-vous|Termine ansehen
Today's appointments|Dagens aftaler|Dagens bokningar|Dagens avtaler|Rendez-vous du jour|Heutige Termine
Total bookings|Samlede bookinger|Totala bokningar|Totale bestillinger|Total des réservations|Buchungen insgesamt
Total revenue|Samlet omsætning|Totala intäkter|Total omsetning|Chiffre d'affaires total|Gesamtumsatz
Completed appointments|Afsluttede aftaler|Slutförda bokningar|Fullførte avtaler|Rendez-vous terminés|Abgeschlossene Termine
Customer details|Kundeoplysninger|Kunduppgifter|Kundeopplysninger|Coordonnées du client|Kundendaten
Booking details|Bookingoplysninger|Bokningsuppgifter|Bestillingsdetaljer|Détails de la réservation|Buchungsdetails
Service details|Behandlingsoplysninger|Behandlingsuppgifter|Behandlingsdetaljer|Détails de la prestation|Leistungsdetails
Appointment details|Aftaleoplysninger|Bokningsuppgifter|Avtaledetaljer|Détails du rendez-vous|Termindetails
No notes|Ingen noter|Inga anteckningar|Ingen notater|Aucune note|Keine Notizen
Internal notes|Interne noter|Interna anteckningar|Interne notater|Notes internes|Interne Notizen
Visible to customers|Synlig for kunder|Synlig för kunder|Synlig for kunder|Visible par les clients|Für Kunden sichtbar
Hide|Skjul|Dölj|Skjul|Masquer|Ausblenden
Show|Vis|Visa|Vis|Afficher|Anzeigen
Visible|Synlig|Synlig|Synlig|Visible|Sichtbar
Hidden|Skjult|Dold|Skjult|Masqué|Ausgeblendet
Enabled features|Aktiverede funktioner|Aktiverade funktioner|Aktiverte funksjoner|Fonctionnalités activées|Aktivierte Funktionen
No changes|Ingen ændringer|Inga ändringar|Ingen endringer|Aucune modification|Keine Änderungen
Changes saved|Ændringer gemt|Ändringar sparade|Endringer lagret|Modifications enregistrées|Änderungen gespeichert
Successfully saved|Gemt|Sparat|Lagret|Enregistré avec succès|Erfolgreich gespeichert
Please wait…|Vent venligst…|Vänta…|Vennligst vent…|Veuillez patienter…|Bitte warten…
Required fields|Påkrævede felter|Obligatoriska fält|Påkrevde felt|Champs obligatoires|Pflichtfelder
Select an option|Vælg en mulighed|Välj ett alternativ|Velg et alternativ|Sélectionner une option|Option auswählen
Not available|Ikke tilgængelig|Ej tillgänglig|Ikke tilgjengelig|Non disponible|Nicht verfügbar
No data available|Ingen data tilgængelige|Inga data tillgängliga|Ingen data tilgjengelige|Aucune donnée disponible|Keine Daten verfügbar
Not set|Ikke angivet|Ej angivet|Ikke angitt|Non défini|Nicht festgelegt
Set up|Opsæt|Konfigurera|Sett opp|Configurer|Einrichten
Complete setup|Afslut opsætning|Slutför konfiguration|Fullfør oppsett|Terminer la configuration|Einrichtung abschließen
Start|Start|Starta|Start|Démarrer|Starten
Stop|Stop|Stoppa|Stopp|Arrêter|Stoppen
Refresh data|Opdater data|Uppdatera data|Oppdater data|Actualiser les données|Daten aktualisieren
Manage bookings|Administrer bookinger|Hantera bokningar|Administrer bestillinger|Gérer les réservations|Buchungen verwalten
Manage staff|Administrer medarbejdere|Hantera personal|Administrer ansatte|Gérer le personnel|Personal verwalten
Manage services|Administrer behandlinger|Hantera behandlingar|Administrer behandlinger|Gérer les prestations|Leistungen verwalten
Manage products|Administrer produkter|Hantera produkter|Administrer produkter|Gérer les produits|Produkte verwalten
Manage orders|Administrer ordrer|Hantera beställningar|Administrer ordrer|Gérer les commandes|Bestellungen verwalten
Print invoice|Udskriv faktura|Skriv ut faktura|Skriv ut faktura|Imprimer la facture|Rechnung drucken
Download PDF|Download PDF|Ladda ner PDF|Last ned PDF|Télécharger le PDF|PDF herunterladen
View receipt|Se kvittering|Visa kvitto|Se kvittering|Voir le reçu|Beleg ansehen
Add discount|Tilføj rabat|Lägg till rabatt|Legg til rabatt|Ajouter une remise|Rabatt hinzufügen
Remove discount|Fjern rabat|Ta bort rabatt|Fjern rabatt|Retirer la remise|Rabatt entfernen
No discount|Ingen rabat|Ingen rabatt|Ingen rabatt|Aucune remise|Kein Rabatt
Total amount|Samlet beløb|Totalbelopp|Totalbeløp|Montant total|Gesamtbetrag
Unit price|Enhedspris|Styckpris|Enhetspris|Prix unitaire|Stückpreis
Line total|Linjetotal|Radsumma|Linjesum|Total de la ligne|Positionssumme
New order|Ny ordre|Ny beställning|Ny ordre|Nouvelle commande|Neue Bestellung
Create order|Opret ordre|Skapa beställning|Opprett ordre|Créer une commande|Bestellung erstellen
Cancel order|Annuller ordre|Avbryt beställning|Avbryt ordre|Annuler la commande|Bestellung stornieren
Order placed|Ordre afgivet|Beställning lagd|Ordre lagt inn|Commande passée|Bestellung aufgegeben
Order confirmed|Ordre bekræftet|Beställning bekräftad|Ordre bekreftet|Commande confirmée|Bestellung bestätigt
Pending payment|Afventer betaling|Väntar på betalning|Venter på betaling|En attente de paiement|Zahlung ausstehend
Awaiting payment|Afventer betaling|Väntar på betalning|Venter på betaling|En attente de paiement|Zahlung ausstehend
Payment received|Betaling modtaget|Betalning mottagen|Betaling mottatt|Paiement reçu|Zahlung erhalten
Payment pending|Betaling afventer|Betalning väntar|Betaling venter|Paiement en attente|Zahlung ausstehend
Partially paid|Delvist betalt|Delvis betald|Delvis betalt|Partiellement payé|Teilweise bezahlt
Partially refunded|Delvist refunderet|Delvis återbetald|Delvis refundert|Partiellement remboursé|Teilweise erstattet
Fully refunded|Fuldt refunderet|Helt återbetald|Fullt refundert|Entièrement remboursé|Vollständig erstattet
Shipped|Afsendt|Skickad|Sendt|Expédié|Versendet
Delivered|Leveret|Levererad|Levert|Livré|Geliefert
Fulfilled|Ekspederet|Expedierad|Ekspedert|Exécuté|Erfüllt
Pending fulfilment|Afventer ekspedition|Väntar på expediering|Venter på ekspedering|En attente de traitement|Bearbeitung ausstehend
Return requested|Returnering anmodet|Retur begärd|Retur forespurt|Retour demandé|Retoure angefordert
Return approved|Returnering godkendt|Retur godkänd|Retur godkjent|Retour approuvé|Retoure genehmigt
Refund amount|Refusionsbeløb|Återbetalningsbelopp|Refusjonsbeløp|Montant du remboursement|Erstattungsbetrag
Return reason|Årsag til returnering|Returorsak|Returårsak|Motif du retour|Retourengrund
Issue refund|Udsted refusion|Utför återbetalning|Utsted refusjon|Effectuer un remboursement|Erstattung veranlassen
Issue credit note|Udsted kreditnota|Utfärda kreditnota|Utsted kreditnota|Émettre un avoir|Gutschrift erstellen
View refunds|Se refusioner|Visa återbetalningar|Se refusjoner|Voir les remboursements|Erstattungen anzeigen
View returns|Se returneringer|Visa returer|Se returer|Voir les retours|Retouren anzeigen
Add category|Tilføj kategori|Lägg till kategori|Legg til kategori|Ajouter une catégorie|Kategorie hinzufügen
Add brand|Tilføj mærke|Lägg till varumärke|Legg til merke|Ajouter une marque|Marke hinzufügen
Edit product|Rediger produkt|Redigera produkt|Rediger produkt|Modifier le produit|Produkt bearbeiten
Edit service|Rediger behandling|Redigera behandling|Rediger behandling|Modifier la prestation|Leistung bearbeiten
Edit staff|Rediger medarbejder|Redigera personal|Rediger ansatt|Modifier le personnel|Personal bearbeiten
Edit category|Rediger kategori|Redigera kategori|Rediger kategori|Modifier la catégorie|Kategorie bearbeiten
Edit brand|Rediger mærke|Redigera varumärke|Rediger merke|Modifier la marque|Marke bearbeiten
Stock level|Lagerbeholdning|Lagernivå|Lagernivå|Niveau de stock|Lagerbestand
Low stock|Lav lagerbeholdning|Lågt lagersaldo|Lav lagerbeholdning|Stock faible|Niedriger Bestand
Stock adjustment|Lagerjustering|Lagerjustering|Lagerjustering|Ajustement du stock|Bestandskorrektur
Adjust stock|Juster lager|Justera lager|Juster lager|Ajuster le stock|Bestand anpassen
Restock|Genopfyld|Fyll på|Fyll på|Réapprovisionner|Auffüllen
Stock history|Lagerhistorik|Lagerhistorik|Lagerhistorikk|Historique du stock|Bestandsverlauf
Product name|Produktnavn|Produktnamn|Produktnavn|Nom du produit|Produktname
Service name|Behandlingsnavn|Behandlingsnamn|Behandlingsnavn|Nom de la prestation|Leistungsname
Category name|Kategorinavn|Kategorinamn|Kategorinavn|Nom de la catégorie|Kategoriename
Brand name|Mærkenavn|Varumärkesnamn|Merkenavn|Nom de la marque|Markenname
No products|Ingen produkter|Inga produkter|Ingen produkter|Aucun produit|Keine Produkte
No orders|Ingen ordrer|Inga beställningar|Ingen ordrer|Aucune commande|Keine Bestellungen
No categories|Ingen kategorier|Inga kategorier|Ingen kategorier|Aucune catégorie|Keine Kategorien
No brands|Ingen mærker|Inga varumärken|Ingen merker|Aucune marque|Keine Marken
No refunds|Ingen refusioner|Inga återbetalningar|Ingen refusjoner|Aucun remboursement|Keine Erstattungen
No returns|Ingen returneringer|Inga returer|Ingen returer|Aucun retour|Keine Retouren
No credit notes|Ingen kreditnotaer|Inga kreditnotor|Ingen kreditnotaer|Aucun avoir|Keine Gutschriften
No customers|Ingen kunder|Inga kunder|Ingen kunder|Aucun client|Keine Kunden
No holidays|Ingen fridage|Inga lediga dagar|Ingen fridager|Aucun jour de fermeture|Keine Ruhetage
No media|Ingen medier|Inga medier|Ingen medier|Aucun média|Keine Medien
No photos|Ingen fotos|Inga foton|Ingen bilder|Aucune photo|Keine Fotos
No upcoming bookings|Ingen kommende bookinger|Inga kommande bokningar|Ingen kommende bestillinger|Aucune réservation à venir|Keine bevorstehenden Buchungen
No bookings today|Ingen bookinger i dag|Inga bokningar idag|Ingen bestillinger i dag|Aucune réservation aujourd'hui|Heute keine Buchungen
No matching services|Ingen matchende behandlinger|Inga matchande behandlingar|Ingen samsvarende behandlinger|Aucune prestation correspondante|Keine passenden Leistungen
No matching products|Ingen matchende produkter|Inga matchande produkter|Ingen samsvarende produkter|Aucun produit correspondant|Keine passenden Produkte
No matching customers|Ingen matchende kunder|Inga matchande kunder|Ingen samsvarende kunder|Aucun client correspondant|Keine passenden Kunden
No matching salons|Ingen matchende saloner|Inga matchande salonger|Ingen samsvarende salonger|Aucun salon correspondant|Keine passenden Salons
Clear filters|Ryd filtre|Rensa filter|Tøm filtre|Effacer les filtres|Filter zurücksetzen
Clear search|Ryd søgning|Rensa sökning|Tøm søk|Effacer la recherche|Suche löschen
Search…|Søg…|Sök…|Søk…|Rechercher…|Suchen…
Search by name|Søg efter navn|Sök efter namn|Søk etter navn|Rechercher par nom|Nach Namen suchen
Back to dashboard|Tilbage til oversigt|Tillbaka till översikt|Tilbake til oversikt|Retour au tableau de bord|Zurück zum Dashboard
Open dashboard|Åbn oversigt|Öppna översikt|Åpne oversikt|Ouvrir le tableau de bord|Dashboard öffnen
Open booking|Åbn booking|Öppna bokning|Åpne bestilling|Ouvrir la réservation|Buchung öffnen
View bookings|Se bookinger|Visa bokningar|Se bestillinger|Voir les réservations|Buchungen anzeigen
View staff|Se medarbejdere|Visa personal|Se ansatte|Voir le personnel|Personal anzeigen
View services|Se behandlinger|Visa behandlingar|Se behandlinger|Voir les prestations|Leistungen anzeigen
Edit profile|Rediger profil|Redigera profil|Rediger profil|Modifier le profil|Profil bearbeiten
Change photo|Skift foto|Byt foto|Bytt bilde|Changer la photo|Foto ändern
Remove photo|Fjern foto|Ta bort foto|Fjern bilde|Supprimer la photo|Foto entfernen
Upload photo|Upload foto|Ladda upp foto|Last opp bilde|Importer une photo|Foto hochladen
Add media|Tilføj medier|Lägg till media|Legg til medier|Ajouter des médias|Medien hinzufügen
Delete photo|Slet foto|Ta bort foto|Slett bilde|Supprimer la photo|Foto löschen
Delete media|Slet medier|Ta bort media|Slett medier|Supprimer le média|Medien löschen
Drag to reorder|Træk for at ændre rækkefølgen|Dra för att ändra ordning|Dra for å endre rekkefølge|Glisser pour réorganiser|Zum Sortieren ziehen
Move up|Flyt op|Flytta upp|Flytt opp|Monter|Nach oben
Move down|Flyt ned|Flytta ner|Flytt ned|Descendre|Nach unten
Make primary|Gør til primært|Gör till primär|Gjør til primær|Définir comme principal|Als Hauptbild festlegen
Cover photo|Forsidefoto|Omslagsfoto|Forsidebilde|Photo de couverture|Titelbild
Profile photo|Profilfoto|Profilfoto|Profilbilde|Photo de profil|Profilfoto
Add biography|Tilføj biografi|Lägg till biografi|Legg til biografi|Ajouter une biographie|Biografie hinzufügen
About your salon|Om din salon|Om din salong|Om salongen din|À propos de votre salon|Über Ihren Salon
Tell us about yourself|Fortæl om dig selv|Berätta om dig själv|Fortell om deg selv|Parlez-nous de vous|Erzählen Sie uns von sich
Save settings|Gem indstillinger|Spara inställningar|Lagre innstillinger|Enregistrer les paramètres|Einstellungen speichern
Booking settings|Bookingindstillinger|Bokningsinställningar|Bestillingsinnstillinger|Paramètres de réservation|Buchungseinstellungen
Dashboard settings|Oversigtsindstillinger|Översiktsinställningar|Oversiktsinnstillinger|Paramètres du tableau de bord|Dashboard-Einstellungen
Website settings|Hjemmesideindstillinger|Webbplatsinställningar|Nettsideinnstillinger|Paramètres du site|Website-Einstellungen
Payment settings|Betalingsindstillinger|Betalningsinställningar|Betalingsinnstillinger|Paramètres de paiement|Zahlungseinstellungen
Notification settings|Notifikationsindstillinger|Aviseringsinställningar|Varslingsinnstillinger|Paramètres de notification|Benachrichtigungseinstellungen
Send email|Send e-mail|Skicka e-post|Send e-post|Envoyer un e-mail|E-Mail senden
Send SMS|Send SMS|Skicka SMS|Send SMS|Envoyer un SMS|SMS senden
Booking confirmation|Bookingbekræftelse|Bokningsbekräftelse|Bestillingsbekreftelse|Confirmation de réservation|Buchungsbestätigung
Appointment reminder|Aftalepåmindelse|Bokningspåminnelse|Avtalepåminnelse|Rappel de rendez-vous|Terminerinnerung
No notifications|Ingen notifikationer|Inga aviseringar|Ingen varsler|Aucune notification|Keine Benachrichtigungen
Notification sent|Besked sendt|Avisering skickad|Varsel sendt|Notification envoyée|Benachrichtigung gesendet
Message sent|Besked sendt|Meddelande skickat|Melding sendt|Message envoyé|Nachricht gesendet
Send to customer|Send til kunden|Skicka till kunden|Send til kunden|Envoyer au client|An Kunden senden
Customer notes|Kundenoter|Kundanteckningar|Kundenotater|Notes client|Kundennotizen
Walk-in|Uden aftale|Drop-in|Drop-in|Sans rendez-vous|Ohne Termin
Walk-in customer|Kunde uden aftale|Drop-in-kund|Drop-in-kunde|Client sans rendez-vous|Kunde ohne Termin
Add customer|Tilføj kunde|Lägg till kund|Legg til kunde|Ajouter un client|Kunden hinzufügen
Edit customer|Rediger kunde|Redigera kund|Rediger kunde|Modifier le client|Kunden bearbeiten
Select customer|Vælg kunde|Välj kund|Velg kunde|Sélectionner un client|Kunden auswählen
New customer|Ny kunde|Ny kund|Ny kunde|Nouveau client|Neuer Kunde
Existing customer|Eksisterende kunde|Befintlig kund|Eksisterende kunde|Client existant|Bestehender Kunde
Returning customer|Tilbagevendende kunde|Återkommande kund|Tilbakevendende kunde|Client régulier|Stammkunde
No customer selected|Ingen kunde valgt|Ingen kund vald|Ingen kunde valgt|Aucun client sélectionné|Kein Kunde ausgewählt
Complete booking|Afslut booking|Slutför bokning|Fullfør bestilling|Terminer la réservation|Buchung abschließen
Confirm appointment|Bekræft aftale|Bekräfta bokning|Bekreft avtale|Confirmer le rendez-vous|Termin bestätigen
Cancel appointment|Annuller aftale|Avboka tid|Avbestill time|Annuler le rendez-vous|Termin absagen
Reschedule appointment|Flyt aftale|Boka om tid|Flytt avtale|Reprogrammer le rendez-vous|Termin verschieben
Mark as no-show|Markér som udeblevet|Markera som utebliven|Merk som ikke møtt|Marquer comme absent|Als nicht erschienen markieren
Mark as completed|Markér som afsluttet|Markera som slutförd|Merk som fullført|Marquer comme terminé|Als abgeschlossen markieren
Mark as paid|Markér som betalt|Markera som betald|Merk som betalt|Marquer comme payé|Als bezahlt markieren
Send reminder|Send påmindelse|Skicka påminnelse|Send påminnelse|Envoyer un rappel|Erinnerung senden
Change date|Skift dato|Byt datum|Endre dato|Changer la date|Datum ändern
Change time|Skift tidspunkt|Byt tid|Endre tidspunkt|Changer l'horaire|Uhrzeit ändern
Change service|Skift behandling|Byt behandling|Endre behandling|Changer de prestation|Leistung ändern
Change staff|Skift medarbejder|Byt personal|Endre ansatt|Changer de professionnel|Personal ändern
Select time|Vælg tidspunkt|Välj tid|Velg tidspunkt|Sélectionner l'horaire|Uhrzeit auswählen
Select date|Vælg dato|Välj datum|Velg dato|Sélectionner la date|Datum auswählen
Previous day|Forrige dag|Föregående dag|Forrige dag|Jour précédent|Vorheriger Tag
Next day|Næste dag|Nästa dag|Neste dag|Jour suivant|Nächster Tag
Go to today|Gå til i dag|Gå till idag|Gå til i dag|Aller à aujourd'hui|Zu heute
Calendar|Kalender|Kalender|Kalender|Calendrier|Kalender
List|Liste|Lista|Liste|Liste|Liste
Day view|Dagsvisning|Dagsvy|Dagsvisning|Vue quotidienne|Tagesansicht
Month view|Månedsvisning|Månadsvy|Månedsvisning|Vue mensuelle|Monatsansicht
List view|Listevisning|Listvy|Listevisning|Vue en liste|Listenansicht
No available slots|Ingen ledige tider|Inga lediga tider|Ingen ledige tider|Aucun créneau disponible|Keine freien Termine
Select another date|Vælg en anden dato|Välj ett annat datum|Velg en annen dato|Choisir une autre date|Anderes Datum auswählen
Fully booked|Fuldt booket|Fullbokat|Fullbooket|Complet|Ausgebucht
Salon closed|Salonen er lukket|Salongen är stängd|Salongen er stengt|Salon fermé|Salon geschlossen
Staff unavailable|Medarbejder ikke tilgængelig|Personal ej tillgänglig|Ansatt utilgjengelig|Professionnel indisponible|Personal nicht verfügbar
On holiday|På ferie|På semester|På ferie|En congé|Im Urlaub
Off duty|Har fri|Ledig|Har fri|Hors service|Nicht im Dienst
On duty|På arbejde|I tjänst|På jobb|En service|Im Dienst
Available today|Ledig i dag|Tillgänglig idag|Ledig i dag|Disponible aujourd'hui|Heute verfügbar
Available tomorrow|Ledig i morgen|Tillgänglig imorgon|Ledig i morgen|Disponible demain|Morgen verfügbar
Earliest available|Tidligste ledige|Tidigast tillgängliga|Tidligste ledige|Première disponibilité|Frühester verfügbarer Termin
Book this time|Book dette tidspunkt|Boka denna tid|Bestill denne tiden|Réserver cet horaire|Diese Zeit buchen
Choose this service|Vælg denne behandling|Välj denna behandling|Velg denne behandlingen|Choisir cette prestation|Diese Leistung wählen
Selected|Valgt|Vald|Valgt|Sélectionné|Ausgewählt
Not selected|Ikke valgt|Ej vald|Ikke valgt|Non sélectionné|Nicht ausgewählt
Booking summary|Bookingoversigt|Bokningsöversikt|Bestillingsoversikt|Récapitulatif de réservation|Buchungsübersicht
Your appointment|Din aftale|Din bokning|Din avtale|Votre rendez-vous|Ihr Termin
Your booking|Din booking|Din bokning|Bestillingen din|Votre réservation|Ihre Buchung
Contact information|Kontaktoplysninger|Kontaktuppgifter|Kontaktinformasjon|Coordonnées|Kontaktinformationen
Additional information|Yderligere oplysninger|Ytterligare information|Tilleggsinformasjon|Informations complémentaires|Zusätzliche Informationen
Special requests|Særlige ønsker|Särskilda önskemål|Spesielle ønsker|Demandes particulières|Besondere Wünsche
Confirm your booking|Bekræft din booking|Bekräfta din bokning|Bekreft bestillingen din|Confirmez votre réservation|Bestätigen Sie Ihre Buchung
Booking confirmed|Booking bekræftet|Bokning bekräftad|Bestilling bekreftet|Réservation confirmée|Buchung bestätigt
Booking requested|Booking anmodet|Bokning begärd|Bestilling forespurt|Réservation demandée|Buchung angefragt
Thank you!|Tak!|Tack!|Takk!|Merci !|Vielen Dank!
See you soon!|Vi ses snart!|Vi ses snart!|Vi ses snart!|À bientôt !|Bis bald!
Book another appointment|Book en anden aftale|Boka en ny tid|Bestill en ny time|Prendre un autre rendez-vous|Weiteren Termin buchen
Return to website|Tilbage til hjemmesiden|Tillbaka till webbplatsen|Tilbake til nettsiden|Retour au site|Zurück zur Website
Confirmation|Bekræftelse|Bekräftelse|Bekreftelse|Confirmation|Bestätigung
Your name and contact details|Dit navn og kontaktoplysninger|Ditt namn och dina kontaktuppgifter|Navnet ditt og kontaktopplysninger|Votre nom et vos coordonnées|Ihr Name und Ihre Kontaktdaten
Please enter your name|Indtast dit navn|Ange ditt namn|Skriv inn navnet ditt|Veuillez saisir votre nom|Bitte geben Sie Ihren Namen ein
Please enter your email|Indtast din e-mail|Ange din e-post|Skriv inn e-postadressen din|Veuillez saisir votre e-mail|Bitte geben Sie Ihre E-Mail ein
Please enter your phone number|Indtast dit telefonnummer|Ange ditt telefonnummer|Skriv inn telefonnummeret ditt|Veuillez saisir votre numéro de téléphone|Bitte geben Sie Ihre Telefonnummer ein
Invalid email address|Ugyldig e-mailadresse|Ogiltig e-postadress|Ugyldig e-postadresse|Adresse e-mail invalide|Ungültige E-Mail-Adresse
Invalid phone number|Ugyldigt telefonnummer|Ogiltigt telefonnummer|Ugyldig telefonnummer|Numéro de téléphone invalide|Ungültige Telefonnummer
Please select a service|Vælg en behandling|Välj en behandling|Velg en behandling|Veuillez sélectionner une prestation|Bitte wählen Sie eine Leistung
Please select a date|Vælg en dato|Välj ett datum|Velg en dato|Veuillez sélectionner une date|Bitte wählen Sie ein Datum
Please select a time|Vælg et tidspunkt|Välj en tid|Velg et tidspunkt|Veuillez sélectionner un horaire|Bitte wählen Sie eine Uhrzeit
Please fill in all required fields|Udfyld alle påkrævede felter|Fyll i alla obligatoriska fält|Fyll ut alle påkrevde felt|Veuillez remplir tous les champs obligatoires|Bitte füllen Sie alle Pflichtfelder aus
Something went wrong. Please try again.|Noget gik galt. Prøv igen.|Något gick fel. Försök igen.|Noe gikk galt. Prøv igjen.|Une erreur est survenue. Veuillez réessayer.|Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.
Network error. Please try again.|Netværksfejl. Prøv igen.|Nätverksfel. Försök igen.|Nettverksfeil. Prøv igjen.|Erreur réseau. Veuillez réessayer.|Netzwerkfehler. Bitte versuchen Sie es erneut.
Loading failed|Indlæsning mislykkedes|Laddningen misslyckades|Lasting mislyktes|Échec du chargement|Laden fehlgeschlagen
Save failed|Kunne ikke gemme|Kunde inte spara|Kunne ikke lagre|Échec de l'enregistrement|Speichern fehlgeschlagen
Please try again later|Prøv igen senere|Försök igen senare|Prøv igjen senere|Veuillez réessayer plus tard|Bitte versuchen Sie es später erneut
Connection lost|Forbindelsen er afbrudt|Anslutningen bröts|Tilkoblingen ble brutt|Connexion perdue|Verbindung unterbrochen
Reconnecting…|Genopretter forbindelse…|Återansluter…|Kobler til på nytt…|Reconnexion…|Verbindung wird wiederhergestellt…
Access denied|Adgang nægtet|Åtkomst nekad|Tilgang nektet|Accès refusé|Zugriff verweigert
Session expired|Session udløbet|Sessionen har gått ut|Økten har utløpt|Session expirée|Sitzung abgelaufen
Please sign in again|Log ind igen|Logga in igen|Logg inn igjen|Veuillez vous reconnecter|Bitte erneut anmelden
Back to login|Tilbage til login|Tillbaka till inloggningen|Tilbake til innlogging|Retour à la connexion|Zurück zur Anmeldung
Return to login|Tilbage til login|Tillbaka till inloggningen|Tilbake til innlogging|Retour à la connexion|Zurück zur Anmeldung
Loading your salon…|Indlæser din salon…|Laddar din salong…|Laster salongen din…|Chargement de votre salon…|Ihr Salon wird geladen…
Please contact the salon|Kontakt venligst salonen|Kontakta salongen|Kontakt salongen|Veuillez contacter le salon|Bitte kontaktieren Sie den Salon
This salon page doesn't exist or the link is incorrect.|Denne salonside findes ikke, eller linket er forkert.|Den här salongssidan finns inte eller länken är felaktig.|Denne salongsiden finnes ikke, eller lenken er feil.|Cette page de salon n'existe pas ou le lien est incorrect.|Diese Salonseite existiert nicht oder der Link ist falsch.
This booking link is invalid. Please check the URL and try again.|Dette bookinglink er ugyldigt. Kontrollér adressen og prøv igen.|Den här bokningslänken är ogiltig. Kontrollera adressen och försök igen.|Denne bestillingslenken er ugyldig. Sjekk adressen og prøv igjen.|Ce lien de réservation est invalide. Vérifiez l'adresse et réessayez.|Dieser Buchungslink ist ungültig. Prüfen Sie die Adresse und versuchen Sie es erneut.
This salon hasn't enabled online booking yet. Please contact them directly to make an appointment.|Denne salon har endnu ikke aktiveret onlinebooking. Kontakt salonen direkte for at bestille tid.|Den här salongen har inte aktiverat onlinebokning än. Kontakta salongen direkt för att boka tid.|Denne salongen har ikke aktivert nettbestilling ennå. Kontakt salongen direkte for å bestille time.|Ce salon n'a pas encore activé la réservation en ligne. Contactez-le directement pour prendre rendez-vous.|Dieser Salon hat die Onlinebuchung noch nicht aktiviert. Kontaktieren Sie ihn direkt für einen Termin.
This rating link has expired or is invalid. Please contact the salon if you need help.|Dette bedømmelseslink er udløbet eller ugyldigt. Kontakt salonen, hvis du har brug for hjælp.|Den här omdömeslänken har gått ut eller är ogiltig. Kontakta salongen om du behöver hjälp.|Denne vurderingslenken er utløpt eller ugyldig. Kontakt salongen hvis du trenger hjelp.|Ce lien d'évaluation a expiré ou est invalide. Contactez le salon si vous avez besoin d'aide.|Dieser Bewertungslink ist abgelaufen oder ungültig. Wenden Sie sich bei Fragen an den Salon.
Admin Portal|Administratorportal|Administratörsportal|Administratorportal|Portail administrateur|Administratorportal
Staff Portal|Medarbejderportal|Personalportal|Personalportal|Portail du personnel|Mitarbeiterportal
My Portal|Min portal|Min portal|Min portal|Mon portail|Mein Portal
My Profile|Min profil|Min profil|Min profil|Mon profil|Mein Profil
My Work Media|Mine arbejdsmedier|Mina arbetsbilder|Mine arbeidsmedier|Mes réalisations|Meine Arbeitsmedien
My Work Media (photo or video)|Mine arbejdsmedier (foto eller video)|Mina arbetsbilder (foto eller video)|Mine arbeidsmedier (bilde eller video)|Mes réalisations (photo ou vidéo)|Meine Arbeitsmedien (Foto oder Video)
My Appointments|Mine aftaler|Mina bokningar|Mine avtaler|Mes rendez-vous|Meine Termine
My Holidays|Mine fridage|Mina lediga dagar|Mine fridager|Mes congés|Meine freien Tage
Your account|Din konto|Ditt konto|Kontoen din|Votre compte|Ihr Konto
Customer contact|Kundekontakt|Kundkontakt|Kundekontakt|Contact client|Kundenkontakt
Salon tools|Salonværktøjer|Salongsverktyg|Salongverktøy|Outils du salon|Salonwerkzeuge
Start with the name your customers know.|Start med det navn, dine kunder kender.|Börja med namnet dina kunder känner till.|Start med navnet kundene dine kjenner.|Commencez par le nom que vos clients connaissent.|Beginnen Sie mit dem Namen, den Ihre Kunden kennen.
Use an email you can access. You’ll use it to sign in and manage your salon.|Brug en e-mail, du har adgang til. Du bruger den til at logge ind og administrere din salon.|Använd en e-postadress du har tillgång till. Du använder den för att logga in och hantera din salong.|Bruk en e-postadresse du har tilgang til. Du bruker den til å logge inn og administrere salongen.|Utilisez une adresse e-mail accessible. Elle vous servira à vous connecter et à gérer votre salon.|Verwenden Sie eine erreichbare E-Mail-Adresse. Damit melden Sie sich an und verwalten Ihren Salon.
Select your country. The other address details are optional.|Vælg dit land. De øvrige adresseoplysninger er valgfrie.|Välj ditt land. Övriga adressuppgifter är valfria.|Velg landet ditt. De øvrige adresseopplysningene er valgfrie.|Sélectionnez votre pays. Les autres coordonnées sont facultatives.|Wählen Sie Ihr Land. Die übrigen Adressangaben sind optional.
Choose the details customers can use to reach you. You can leave these blank and add them later.|Vælg de oplysninger, kunderne kan bruge til at kontakte dig. Du kan lade dem stå tomme og tilføje dem senere.|Välj de uppgifter kunderna kan använda för att kontakta dig. Du kan lämna dem tomma och lägga till dem senare.|Velg opplysningene kundene kan bruke for å kontakte deg. Du kan la dem stå tomme og legge dem til senere.|Choisissez les coordonnées pour vos clients. Vous pouvez les laisser vides et les ajouter plus tard.|Wählen Sie Ihre Kontaktdaten für Kunden. Sie können diese Felder leer lassen und später ausfüllen.
Choose what you need to start. You can change your choices in the admin screen later.|Vælg det, du skal bruge for at komme i gang. Du kan ændre dine valg i administrationen senere.|Välj det du behöver för att börja. Du kan ändra dina val i administrationen senare.|Velg det du trenger for å komme i gang. Du kan endre valgene i administrasjonen senere.|Choisissez ce qu'il vous faut pour démarrer. Vous pourrez modifier vos choix dans l'administration.|Wählen Sie, was Sie zum Start benötigen. Sie können Ihre Auswahl später in der Verwaltung ändern.
Check the suggested times and mark the days you’re closed.|Kontrollér de foreslåede tider og markér de dage, du holder lukket.|Kontrollera de föreslagna tiderna och markera de dagar du har stängt.|Sjekk de foreslåtte tidene og merk dagene du holder stengt.|Vérifiez les horaires proposés et indiquez vos jours de fermeture.|Prüfen Sie die vorgeschlagenen Zeiten und markieren Sie Ihre Ruhetage.
Check your details before creating your salon. Nothing is submitted until you select Create salon.|Kontrollér dine oplysninger, før du opretter salonen. Intet indsendes, før du vælger Opret salon.|Kontrollera uppgifterna innan du skapar salongen. Inget skickas förrän du väljer Skapa salong.|Sjekk opplysningene før du oppretter salongen. Ingenting sendes før du velger Opprett salong.|Vérifiez vos informations. Rien n'est envoyé avant de sélectionner Créer un salon.|Prüfen Sie Ihre Angaben. Sie werden erst übermittelt, wenn Sie Salon erstellen wählen.
Full name (required)|Fulde navn (påkrævet)|Fullständigt namn (obligatoriskt)|Fullt navn (påkrevd)|Nom complet (obligatoire)|Vollständiger Name (erforderlich)
Sign-in email (required)|Login-e-mail (påkrævet)|E-post för inloggning (obligatoriskt)|E-post for innlogging (påkrevd)|E-mail de connexion (obligatoire)|Anmelde-E-Mail (erforderlich)
Phone (optional)|Telefon (valgfrit)|Telefon (valfritt)|Telefon (valgfritt)|Téléphone (facultatif)|Telefon (optional)
Country or region (required)|Land eller region (påkrævet)|Land eller region (obligatoriskt)|Land eller region (påkrevd)|Pays ou région (obligatoire)|Land oder Region (erforderlich)
Street address (optional)|Adresse (valgfrit)|Gatuadress (valfritt)|Gateadresse (valgfritt)|Adresse (facultatif)|Straße und Hausnummer (optional)
Postal code (optional)|Postnummer (valgfrit)|Postnummer (valfritt)|Postnummer (valgfritt)|Code postal (facultatif)|Postleitzahl (optional)
City (optional)|By (valgfrit)|Stad (valfritt)|By (valgfritt)|Ville (facultatif)|Stadt (optional)
Customer-facing phone (optional)|Kundetelefon (valgfrit)|Kundtelefon (valfritt)|Kundetelefon (valgfritt)|Téléphone public (facultatif)|Telefon für Kunden (optional)
Customer-facing email (optional)|Kunde-e-mail (valgfrit)|Kund-e-post (valfritt)|Kunde-e-post (valgfritt)|E-mail public (facultatif)|E-Mail für Kunden (optional)
Website (optional)|Hjemmeside (valgfrit)|Webbplats (valfritt)|Nettside (valgfritt)|Site web (facultatif)|Website (optional)
Add social links (optional)|Tilføj sociale links (valgfrit)|Lägg till sociala länkar (valfritt)|Legg til sosiale lenker (valgfritt)|Ajouter des liens sociaux (facultatif)|Social-Media-Links hinzufügen (optional)
(required)|(påkrævet)|(obligatoriskt)|(påkrevd)|(obligatoire)|(erforderlich)
Go back one step|Gå et trin tilbage|Gå tillbaka ett steg|Gå ett trinn tilbake|Revenir à l'étape précédente|Einen Schritt zurück
Signup progress|Oprettelsesstatus|Registreringsförlopp|Registreringsfremdrift|Progression de l'inscription|Registrierungsfortschritt
Step|Trin|Steg|Trinn|Étape|Schritt
of|af|av|av|sur|von
Completed signup steps|Afsluttede trin|Slutförda registreringssteg|Fullførte registreringstrinn|Étapes terminées|Abgeschlossene Registrierungsschritte
Save & return to review →|Gem og gå til oversigt →|Spara och återgå till granskning →|Lagre og gå til gjennomgang →|Enregistrer et vérifier →|Speichern und zur Übersicht →
Creating salon…|Opretter salon…|Skapar salong…|Oppretter salong…|Création du salon…|Salon wird erstellt…
Suggested web address:|Foreslået webadresse:|Föreslagen webbadress:|Foreslått nettadresse:|Adresse web proposée :|Vorgeschlagene Webadresse:
These details are shown to customers on your salon page. We’ve left them blank so you can choose what to share.|Disse oplysninger vises til kunderne på din salonside. De er tomme, så du selv kan vælge, hvad du vil dele.|Dessa uppgifter visas för kunder på din salongssida. De är tomma så att du kan välja vad du vill dela.|Disse opplysningene vises til kundene på salongsiden. De er tomme slik at du kan velge hva du vil dele.|Ces coordonnées sont affichées aux clients sur votre page. Elles sont vides pour vous laisser choisir quoi partager.|Diese Angaben werden Kunden auf Ihrer Salonseite angezeigt. Sie sind leer, damit Sie selbst entscheiden können, was Sie teilen.
Weekly opening hours|Ugentlige åbningstider|Veckans öppettider|Ukentlige åpningstider|Horaires hebdomadaires|Wöchentliche Öffnungszeiten
Copy Monday’s times to other open days|Kopiér mandagens tider til andre åbne dage|Kopiera måndagens tider till andra öppna dagar|Kopier mandagens tider til andre åpne dager|Copier les horaires du lundi aux autres jours ouverts|Montagszeiten auf andere Öffnungstage übertragen
Uncheck the days you’re closed. You can change these hours later.|Fjern markeringen for de dage, du holder lukket. Du kan ændre tiderne senere.|Avmarkera de dagar du har stängt. Du kan ändra tiderna senare.|Fjern avmerkingen for dagene du holder stengt. Du kan endre tidene senere.|Décochez vos jours de fermeture. Vous pourrez modifier ces horaires plus tard.|Deaktivieren Sie Ihre Ruhetage. Sie können die Zeiten später ändern.
Opens|Åbner|Öppnar|Åpner|Ouverture|Öffnet
Closes|Lukker|Stänger|Stenger|Fermeture|Schließt
Your salon is created!|Din salon er oprettet!|Din salong har skapats!|Salongen din er opprettet!|Votre salon est créé !|Ihr Salon wurde erstellt!
Sign in to finish setting up|Log ind for at afslutte opsætningen|Logga in för att slutföra inställningarna|Logg inn for å fullføre oppsettet|Connectez-vous pour terminer la configuration|Melden Sie sich an, um die Einrichtung abzuschließen
Continue to salon admin →|Fortsæt til salonadministration →|Fortsätt till salongsadministration →|Fortsett til salongadministrasjon →|Accéder à l'administration →|Zur Salonverwaltung →
Your salon and team links|Links til din salon og dit team|Länkar till din salong och ditt team|Lenker til salongen og teamet ditt|Liens de votre salon et de votre équipe|Links für Ihren Salon und Ihr Team
Admin panel|Administrationspanel|Administrationspanel|Administrasjonspanel|Panneau d'administration|Verwaltung
Share with your team members|Del med dine medarbejdere|Dela med dina medarbetare|Del med teammedlemmene dine|Partager avec votre équipe|Mit Ihren Teammitgliedern teilen
Operations Dashboard|Driftsoversigt|Driftsöversikt|Driftsoversikt|Tableau de bord opérationnel|Betriebsdashboard
Appointments and in-salon checkout|Aftaler og betaling i salonen|Bokningar och betalning i salongen|Avtaler og betaling i salongen|Rendez-vous et encaissement au salon|Termine und Kasse im Salon
Register another salon →|Opret en anden salon →|Registrera en annan salong →|Registrer en annen salong →|Inscrire un autre salon →|Weiteren Salon registrieren →
No appointments found|Ingen aftaler fundet|Inga bokningar hittades|Ingen avtaler funnet|Aucun rendez-vous trouvé|Keine Termine gefunden
You have no appointments yet.|Du har ingen aftaler endnu.|Du har inga bokningar ännu.|Du har ingen avtaler ennå.|Vous n'avez pas encore de rendez-vous.|Sie haben noch keine Termine.
Welcome back,|Velkommen tilbage,|Välkommen tillbaka,|Velkommen tilbake,|Bon retour,|Willkommen zurück,
Working at|Arbejder hos|Arbetar hos|Jobber hos|En poste chez|Tätig bei
· here's your schedule.|· her er din tidsplan.|· här är ditt schema.|· her er timeplanen din.|· voici votre planning.|· hier ist Ihr Zeitplan.
Here's your schedule at a glance.|Her er et overblik over din tidsplan.|Här är ditt schema i korthet.|Her er en oversikt over timeplanen din.|Voici un aperçu de votre planning.|Hier ist Ihr Zeitplan auf einen Blick.
View all|Se alle|Visa alla|Se alle|Tout voir|Alle anzeigen
No appointments scheduled for today.|Ingen aftaler planlagt i dag.|Inga bokningar planerade idag.|Ingen avtaler planlagt i dag.|Aucun rendez-vous prévu aujourd'hui.|Für heute sind keine Termine geplant.
Upcoming appointments|Kommende aftaler|Kommande bokningar|Kommende avtaler|Rendez-vous à venir|Bevorstehende Termine
My days off|Mine fridage|Mina lediga dagar|Mine fridager|Mes jours de congé|Meine freien Tage
Book day off|Registrer fridag|Registrera ledig dag|Registrer fridag|Poser un jour de congé|Freien Tag eintragen
Book a day off|Registrer en fridag|Registrera en ledig dag|Registrer en fridag|Poser un jour de congé|Freien Tag eintragen
Remove this day off|Fjern denne fridag|Ta bort denna lediga dag|Fjern denne fridagen|Supprimer ce jour de congé|Diesen freien Tag entfernen
Reason (optional)|Årsag (valgfrit)|Anledning (valfritt)|Årsak (valgfritt)|Motif (facultatif)|Grund (optional)
Member since|Medlem siden|Medlem sedan|Medlem siden|Membre depuis|Mitglied seit
My work|Mit arbejde|Mitt arbete|Arbeidet mitt|Mes réalisations|Meine Arbeiten
Specializations|Specialer|Specialiseringar|Spesialiseringer|Spécialisations|Spezialisierungen
Available for booking|Kan bookes|Kan bokas|Kan bestilles|Disponible à la réservation|Buchbar
Staff member|Medarbejder|Medarbetare|Ansatt|Membre du personnel|Mitarbeiter
Not bookable|Kan ikke bookes|Kan inte bokas|Kan ikke bestilles|Non réservable|Nicht buchbar
Staff email address|Medarbejderens e-mailadresse|Personalens e-postadress|Ansattes e-postadresse|E-mail du personnel|E-Mail-Adresse des Mitarbeiters
Sign in to Staff Portal|Log ind på medarbejderportalen|Logga in på personalportalen|Logg inn på personalportalen|Se connecter au portail du personnel|Beim Mitarbeiterportal anmelden
Looking up your account…|Finder din konto…|Söker efter ditt konto…|Finner kontoen din…|Recherche de votre compte…|Ihr Konto wird gesucht…
Select your account|Vælg din konto|Välj ditt konto|Velg kontoen din|Sélectionnez votre compte|Wählen Sie Ihr Konto
Signing in as|Logger ind som|Loggar in som|Logger inn som|Connexion en tant que|Anmeldung als
Add your first photo or video|Tilføj dit første foto eller din første video|Lägg till ditt första foto eller din första video|Legg til ditt første bilde eller din første video|Ajoutez votre première photo ou vidéo|Fügen Sie Ihr erstes Foto oder Video hinzu
Video|Video|Video|Video|Vidéo|Video
· images or short videos|· billeder eller korte videoer|· bilder eller korta videor|· bilder eller korte videoer|· images ou courtes vidéos|· Bilder oder kurze Videos
← Go to dashboard|← Gå til oversigt|← Gå till översikt|← Gå til oversikt|← Aller au tableau de bord|← Zum Dashboard
Preferred contact method|Foretrukken kontaktmetode|Önskat kontaktsätt|Foretrukket kontaktmåte|Moyen de contact préféré|Bevorzugter Kontaktweg
Anything we should know?|Er der noget, vi bør vide?|Är det något vi bör veta?|Er det noe vi bør vite?|Y a-t-il quelque chose à nous signaler ?|Gibt es etwas, das wir wissen sollten?
Book an appointment|Book en tid|Boka en tid|Bestill en time|Prendre rendez-vous|Termin buchen
Closed now|Lukket nu|Stängt nu|Stengt nå|Fermé actuellement|Jetzt geschlossen
Book with|Book hos|Boka hos|Bestill hos|Réserver avec|Buchen bei
Choose your stylist|Vælg din behandler|Välj din behandlare|Velg behandleren din|Choisissez votre professionnel|Wählen Sie Ihre Fachkraft
See available times|Se ledige tider|Se lediga tider|Se ledige tider|Voir les horaires disponibles|Verfügbare Zeiten anzeigen
Review booking|Gennemse booking|Granska bokning|Se gjennom bestillingen|Vérifier la réservation|Buchung prüfen
Pick a day|Vælg en dag|Välj en dag|Velg en dag|Choisir un jour|Tag auswählen
Check this day|Tjek denne dag|Kontrollera denna dag|Sjekk denne dagen|Vérifier ce jour|Diesen Tag prüfen
Book now →|Book nu →|Boka nu →|Bestill nå →|Réserver →|Jetzt buchen →
Booking request sent!|Bookinganmodning sendt!|Bokningsförfrågan skickad!|Bestillingsforespørsel sendt!|Demande de réservation envoyée !|Buchungsanfrage gesendet!
Review your booking|Gennemse din booking|Granska din bokning|Se gjennom bestillingen din|Vérifiez votre réservation|Prüfen Sie Ihre Buchung
With|Hos|Hos|Hos|Avec|Bei
When|Hvornår|När|Når|Quand|Wann
Never mind|Annuller|Avbryt|Avbryt|Annuler|Abbrechen
Thinking…|Tænker…|Tänker…|Tenker…|Réflexion…|Wird überlegt…
Clear chat|Ryd chat|Rensa chatt|Tøm chat|Effacer la discussion|Chat leeren
New conversation|Ny samtale|Ny konversation|Ny samtale|Nouvelle conversation|Neues Gespräch
Start a new conversation|Start en ny samtale|Starta en ny konversation|Start en ny samtale|Démarrer une nouvelle conversation|Neues Gespräch starten
Expand to fullscreen|Vis i fuld skærm|Visa i helskärm|Vis i fullskjerm|Passer en plein écran|Vollbild öffnen
Exit fullscreen|Afslut fuld skærm|Avsluta helskärm|Avslutt fullskjerm|Quitter le plein écran|Vollbild verlassen
Exit fullscreen (Esc)|Afslut fuld skærm (Esc)|Avsluta helskärm (Esc)|Avslutt fullskjerm (Esc)|Quitter le plein écran (Échap)|Vollbild verlassen (Esc)
What we offer|Det tilbyder vi|Det vi erbjuder|Dette tilbyr vi|Nos prestations|Unser Angebot
Services & pricing|Behandlinger og priser|Behandlingar och priser|Behandlinger og priser|Prestations et tarifs|Leistungen und Preise
Meet our team|Mød vores team|Träffa vårt team|Møt teamet vårt|Rencontrez notre équipe|Unser Team kennenlernen
Upcoming holidays|Kommende fridage|Kommande lediga dagar|Kommende fridager|Prochains jours de fermeture|Bevorstehende Ruhetage
Close menu|Luk menu|Stäng meny|Lukk meny|Fermer le menu|Menü schließen
Open menu|Åbn menu|Öppna meny|Åpne meny|Ouvrir le menu|Menü öffnen
Back to top|Til toppen|Till toppen|Til toppen|Retour en haut|Nach oben
Today ·|I dag ·|Idag ·|I dag ·|Aujourd'hui ·|Heute ·
Closed today|Lukket i dag|Stängt idag|Stengt i dag|Fermé aujourd'hui|Heute geschlossen
More appointments in this time slot|Flere aftaler på dette tidspunkt|Fler bokningar vid denna tid|Flere avtaler i dette tidsrommet|Autres rendez-vous sur ce créneau|Weitere Termine in diesem Zeitfenster
Book your appointment|Book din tid|Boka din tid|Bestill timen din|Prenez rendez-vous|Buchen Sie Ihren Termin
Current sale|Aktuelt salg|Aktuell försäljning|Gjeldende salg|Vente en cours|Aktueller Verkauf
Recent sales|Seneste salg|Senaste försäljningar|Siste salg|Ventes récentes|Letzte Verkäufe
Services and products|Behandlinger og produkter|Behandlingar och produkter|Behandlinger og produkter|Prestations et produits|Leistungen und Produkte
Select a service or product to begin.|Vælg en behandling eller et produkt for at begynde.|Välj en behandling eller produkt för att börja.|Velg en behandling eller et produkt for å begynne.|Sélectionnez une prestation ou un produit pour commencer.|Wählen Sie zum Start eine Leistung oder ein Produkt.
Customer name (optional)|Kundenavn (valgfrit)|Kundnamn (valfritt)|Kundenavn (valgfritt)|Nom du client (facultatif)|Kundenname (optional)
Record payment|Registrer betaling|Registrera betalning|Registrer betaling|Enregistrer le paiement|Zahlung erfassen
Continue to card payment|Fortsæt til kortbetaling|Fortsätt till kortbetalning|Fortsett til kortbetaling|Continuer vers le paiement par carte|Weiter zur Kartenzahlung
Add to current sale|Tilføj til aktuelt salg|Lägg till i aktuell försäljning|Legg til i gjeldende salg|Ajouter à la vente en cours|Zum aktuellen Verkauf hinzufügen
No items match your search.|Ingen varer matcher din søgning.|Inga artiklar matchar din sökning.|Ingen varer samsvarer med søket.|Aucun article ne correspond à votre recherche.|Keine Artikel entsprechen Ihrer Suche.
No invoices found for this period.|Ingen fakturaer fundet for perioden.|Inga fakturor hittades för perioden.|Ingen fakturaer funnet for perioden.|Aucune facture trouvée pour cette période.|Keine Rechnungen für diesen Zeitraum gefunden.
Overall|Samlet|Samlat|Samlet|Global|Gesamt
Choose date|Vælg dato|Välj datum|Velg dato|Choisir une date|Datum auswählen
New appointment|Ny aftale|Ny bokning|Ny avtale|Nouveau rendez-vous|Neuer Termin
Create appointment|Opret aftale|Skapa bokning|Opprett avtale|Créer un rendez-vous|Termin erstellen
Edit appointment|Rediger aftale|Redigera bokning|Rediger avtale|Modifier le rendez-vous|Termin bearbeiten
Save appointment|Gem aftale|Spara bokning|Lagre avtale|Enregistrer le rendez-vous|Termin speichern
Edit / reschedule|Rediger / flyt|Redigera / boka om|Rediger / flytt|Modifier / reprogrammer|Bearbeiten / verschieben
Mark no-show|Markér som udeblevet|Markera som utebliven|Merk som ikke møtt|Marquer comme absent|Als nicht erschienen markieren
Complete|Afslut|Slutför|Fullfør|Terminer|Abschließen
Select stylist|Vælg behandler|Välj behandlare|Velg behandler|Sélectionner un professionnel|Fachkraft auswählen
Any available stylist — auto-assign|Enhver ledig behandler — automatisk tildeling|Valfri ledig behandlare — automatisk tilldelning|Enhver ledig behandler — automatisk tildeling|Tout professionnel disponible — attribution automatique|Beliebige verfügbare Fachkraft — automatische Zuweisung
Notes (optional)|Noter (valgfrit)|Anteckningar (valfritt)|Notater (valgfritt)|Notes (facultatif)|Notizen (optional)
Loading times…|Indlæser tider…|Laddar tider…|Laster tider…|Chargement des horaires…|Zeiten werden geladen…
Loading stylists…|Indlæser behandlere…|Laddar behandlare…|Laster behandlere…|Chargement des professionnels…|Fachkräfte werden geladen…
Checking available services…|Tjekker tilgængelige behandlinger…|Kontrollerar tillgängliga behandlingar…|Sjekker tilgjengelige behandlinger…|Vérification des prestations disponibles…|Verfügbare Leistungen werden geprüft…
Customise message|Tilpas besked|Anpassa meddelande|Tilpass melding|Personnaliser le message|Nachricht anpassen
Send custom message|Send tilpasset besked|Skicka anpassat meddelande|Send tilpasset melding|Envoyer le message personnalisé|Eigene Nachricht senden
Send default message|Send standardbesked|Skicka standardmeddelande|Send standardmelding|Envoyer le message par défaut|Standardnachricht senden
Salon desk|Salondesk|Salongsdisk|Salongdisk|Accueil du salon|Salonarbeitsplatz
Salon Dashboard|Salonoversigt|Salongsöversikt|Salongoversikt|Tableau de bord du salon|Salon-Dashboard
Dashboard not enabled|Oversigt ikke aktiveret|Översikt inte aktiverad|Oversikt ikke aktivert|Tableau de bord non activé|Dashboard nicht aktiviert
Open your Dashboard|Åbn din oversigt|Öppna din översikt|Åpne oversikten din|Ouvrez votre tableau de bord|Öffnen Sie Ihr Dashboard
Open admin portal →|Åbn administratorportal →|Öppna administratörsportalen →|Åpne administratorportalen →|Ouvrir le portail administrateur →|Administratorportal öffnen →
Admin email address|Administratorens e-mailadresse|Administratörens e-postadress|Administratorens e-postadresse|E-mail administrateur|Administrator-E-Mail-Adresse
Owner email address|Ejerens e-mailadresse|Ägarens e-postadress|Eierens e-postadresse|E-mail du propriétaire|E-Mail-Adresse des Inhabers
Sign in to your salon|Log ind på din salon|Logga in på din salong|Logg inn på salongen din|Connectez-vous à votre salon|Bei Ihrem Salon anmelden
No salon found|Ingen salon fundet|Ingen salong hittades|Ingen salong funnet|Aucun salon trouvé|Kein Salon gefunden
Looking up your salon…|Finder din salon…|Söker efter din salong…|Finner salongen din…|Recherche de votre salon…|Ihr Salon wird gesucht…
Use a different account|Brug en anden konto|Använd ett annat konto|Bruk en annen konto|Utiliser un autre compte|Anderes Konto verwenden
You are not authorized|Du har ikke adgang|Du saknar behörighet|Du har ikke tilgang|Vous n'êtes pas autorisé|Sie sind nicht berechtigt
Not authorized|Ingen adgang|Ej behörig|Ingen tilgang|Non autorisé|Nicht berechtigt
Page not found|Siden blev ikke fundet|Sidan hittades inte|Siden ble ikke funnet|Page introuvable|Seite nicht gefunden
This page doesn't exist.|Denne side findes ikke.|Den här sidan finns inte.|Denne siden finnes ikke.|Cette page n'existe pas.|Diese Seite existiert nicht.
You don't have permission to view this page.|Du har ikke adgang til denne side.|Du har inte behörighet att visa sidan.|Du har ikke tilgang til denne siden.|Vous n'avez pas l'autorisation de voir cette page.|Sie haben keine Berechtigung, diese Seite aufzurufen.
An error occurred while loading this page.|Der opstod en fejl under indlæsning af siden.|Ett fel uppstod när sidan laddades.|Det oppstod en feil under lasting av siden.|Une erreur est survenue lors du chargement de cette page.|Beim Laden dieser Seite ist ein Fehler aufgetreten.
Morning|Formiddag|Förmiddag|Formiddag|Matin|Vormittag
Afternoon|Eftermiddag|Eftermiddag|Ettermiddag|Après-midi|Nachmittag
Evening|Aften|Kväll|Kveld|Soir|Abend
Colorist|Farvespecialist|Färgspecialist|Fargespesialist|Coloriste|Colorist
Makeup Artist|Makeupartist|Makeupartist|Makeupartist|Maquilleur|Visagist
Nail Tech|Negletekniker|Nagelteknolog|Negletekniker|Prothésiste ongulaire|Nageldesigner
Makeup|Makeup|Smink|Sminke|Maquillage|Make-up
Skin Care|Hudpleje|Hudvård|Hudpleie|Soins de la peau|Hautpflege
Beard|Skæg|Skägg|Skjegg|Barbe|Bart
Waxing|Voksbehandling|Vaxning|Voksing|Épilation|Waxing
Loyalty|Loyalitet|Lojalitet|Lojalitet|Fidélité|Treueprogramm
On Leave|På ferie|Ledig|I permisjon|En congé|Abwesend
Monday to Friday|Mandag til fredag|Måndag till fredag|Mandag til fredag|Du lundi au vendredi|Montag bis Freitag
Details & contact|Oplysninger og kontakt|Uppgifter och kontakt|Opplysninger og kontakt|Informations et contact|Details und Kontakt
AI Receptionist|AI-receptionist|AI-receptionist|KI-resepsjonist|Réceptionniste IA|KI-Rezeptionist
Static Website|Almindelig hjemmeside|Vanlig webbplats|Vanlig nettside|Site classique|Klassische Website
Register yours →|Registrer din →|Registrera din →|Registrer din →|Inscrivez le vôtre →|Ihren Salon registrieren →
No salons yet|Ingen saloner endnu|Inga salonger ännu|Ingen salonger ennå|Aucun salon pour le moment|Noch keine Salons
Search by name or city…|Søg efter navn eller by…|Sök efter namn eller stad…|Søk etter navn eller by…|Rechercher par nom ou ville…|Nach Name oder Stadt suchen…
Visit salon|Besøg salon|Besök salong|Besøk salong|Voir le salon|Salon besuchen
Book a visit.|Book et besøg.|Boka ett besök.|Bestill et besøk.|Réservez une visite.|Buchen Sie einen Besuch.
Or open your doors.|Eller åbn dørene.|Eller öppna dina dörrar.|Eller åpne dørene dine.|Ou ouvrez vos portes.|Oder öffnen Sie Ihre Türen.
I'm an owner|Jeg er ejer|Jag är ägare|Jeg er eier|Je suis propriétaire|Ich bin Inhaber
I'm a customer|Jeg er kunde|Jag är kund|Jeg er kunde|Je suis client|Ich bin Kunde
Already have a salon? Sign in|Har du allerede en salon? Log ind|Har du redan en salong? Logga in|Har du allerede en salong? Logg inn|Vous avez déjà un salon ? Connectez-vous|Sie haben bereits einen Salon? Anmelden
We use cookies|Vi bruger cookies|Vi använder cookies|Vi bruker informasjonskapsler|Nous utilisons des cookies|Wir verwenden Cookies
Essential only|Kun nødvendige|Endast nödvändiga|Kun nødvendige|Essentiels uniquement|Nur notwendige
Accept all cookies|Acceptér alle cookies|Acceptera alla cookies|Godta alle informasjonskapsler|Accepter tous les cookies|Alle Cookies akzeptieren
Terms|Vilkår|Villkor|Vilkår|Conditions|Bedingungen
Privacy|Privatliv|Integritet|Personvern|Confidentialité|Datenschutz
cookie policy|cookiepolitik|cookiepolicy|retningslinjer for informasjonskapsler|politique relative aux cookies|Cookie-Richtlinie
Finish setting up your salon|Afslut opsætningen af din salon|Slutför inställningarna för din salong|Fullfør oppsettet av salongen din|Terminez la configuration de votre salon|Schließen Sie die Saloneinrichtung ab
Continue setup|Fortsæt opsætning|Fortsätt konfigurationen|Fortsett oppsettet|Continuer la configuration|Einrichtung fortsetzen
Open your daily workspace|Åbn din daglige arbejdsplads|Öppna din dagliga arbetsyta|Åpne din daglige arbeidsplass|Ouvrez votre espace de travail quotidien|Öffnen Sie Ihren täglichen Arbeitsbereich
What would you like to do?|Hvad vil du gerne gøre?|Vad vill du göra?|Hva vil du gjøre?|Que souhaitez-vous faire ?|Was möchten Sie tun?
Help & Support|Hjælp og support|Hjälp och support|Hjelp og støtte|Aide et assistance|Hilfe und Support
Need a hand? Visit help & support|Brug for hjælp? Besøg hjælp og support|Behöver du hjälp? Besök hjälp och support|Trenger du hjelp? Besøk hjelp og støtte|Besoin d'aide ? Consultez l'assistance|Brauchen Sie Hilfe? Besuchen Sie Hilfe und Support
Changes saved!|Ændringer gemt!|Ändringar sparade!|Endringer lagret!|Modifications enregistrées !|Änderungen gespeichert!
Saved!|Gemt!|Sparat!|Lagret!|Enregistré !|Gespeichert!
Toggle navigation|Vis eller skjul navigation|Visa eller dölj navigering|Vis eller skjul navigasjon|Afficher ou masquer la navigation|Navigation ein-/ausblenden
You're all set!|Du er klar!|Allt är klart!|Alt er klart!|Tout est prêt !|Alles ist bereit!
Hours|Tider|Tider|Tider|Horaires|Zeiten
All days closed|Lukket alle dage|Stängt alla dagar|Stengt alle dager|Fermé tous les jours|An allen Tagen geschlossen
None selected|Intet valgt|Inget valt|Ingenting valgt|Aucune sélection|Nichts ausgewählt
Copy|Kopiér|Kopiera|Kopier|Copier|Kopieren
Adding…|Tilføjer…|Lägger till…|Legger til…|Ajout…|Wird hinzugefügt…
Pay as you go|Betal efter forbrug|Betala efter användning|Betal etter bruk|Paiement à l'usage|Zahlung nach Nutzung
Available tools|Tilgængelige værktøjer|Tillgängliga verktyg|Tilgjengelige verktøy|Outils disponibles|Verfügbare Werkzeuge
Default customer message|Standardbesked til kunden|Standardmeddelande till kunden|Standardmelding til kunden|Message client par défaut|Standardnachricht an Kunden
Country / Region|Land / region|Land / region|Land / region|Pays / région|Land / Region
Town|By|Ort|By|Ville|Ort
Social media|Sociale medier|Sociala medier|Sosiale medier|Réseaux sociaux|Soziale Medien
Recurring|Tilbagevendende|Återkommande|Gjentakende|Récurrent|Wiederkehrend
One-time|Engangs|Engångs|Engangs|Ponctuel|Einmalig
Every year|Hvert år|Varje år|Hvert år|Chaque année|Jedes Jahr
Specific year|Bestemt år|Specifikt år|Bestemt år|Année précise|Bestimmtes Jahr
Repeats|Gentages|Upprepas|Gjentas|Répétition|Wiederholt sich
Holiday name|Navn på fridag|Namn på ledig dag|Navn på fridag|Nom du jour de fermeture|Name des Ruhetags
Restore|Gendan|Återställ|Gjenopprett|Restaurer|Wiederherstellen
Restoring…|Gendanner…|Återställer…|Gjenoppretter…|Restauration…|Wird wiederhergestellt…
Enabling…|Aktiverer…|Aktiverar…|Aktiverer…|Activation…|Wird aktiviert…
Disabling…|Deaktiverer…|Inaktiverar…|Deaktiverer…|Désactivation…|Wird deaktiviert…
Deleted|Slettet|Borttagen|Slettet|Supprimé|Gelöscht
Delete salon|Slet salon|Ta bort salong|Slett salong|Supprimer le salon|Salon löschen
Disable salon|Deaktivér salon|Inaktivera salong|Deaktiver salong|Désactiver le salon|Salon deaktivieren
Enable salon|Aktivér salon|Aktivera salong|Aktiver salong|Activer le salon|Salon aktivieren
This salon is disabled|Denne salon er deaktiveret|Denna salong är inaktiverad|Denne salongen er deaktivert|Ce salon est désactivé|Dieser Salon ist deaktiviert
Salon is disabled|Salonen er deaktiveret|Salongen är inaktiverad|Salongen er deaktivert|Le salon est désactivé|Salon ist deaktiviert
Your admin panel|Dit administrationspanel|Din administrationspanel|Administrasjonspanelet ditt|Votre panneau d'administration|Ihre Verwaltung
Create your salon →|Opret din salon →|Skapa din salong →|Opprett salongen din →|Créez votre salon →|Ihren Salon erstellen →
Same phone & email as the owner?|Samme telefon og e-mail som ejeren?|Samma telefon och e-post som ägaren?|Samme telefon og e-post som eieren?|Même téléphone et e-mail que le propriétaire ?|Telefon und E-Mail wie beim Inhaber?
Yes, use owner's|Ja, brug ejerens|Ja, använd ägarens|Ja, bruk eierens|Oui, utiliser ceux du propriétaire|Ja, Angaben des Inhabers verwenden
No, enter new|Nej, indtast nye|Nej, ange nya|Nei, skriv inn nye|Non, saisir de nouvelles coordonnées|Nein, neue eingeben
Launch salon|Start salon|Starta salong|Start salong|Lancer le salon|Salon starten
Launching…|Starter…|Startar…|Starter…|Lancement…|Wird gestartet…
Assign Staff|Tildel medarbejdere|Tilldela personal|Tildel ansatte|Affecter le personnel|Personal zuweisen
Brief description shown to customers|Kort beskrivelse til kunder|Kort beskrivning för kunder|Kort beskrivelse for kunder|Courte description pour les clients|Kurze Beschreibung für Kunden
Duration (min)|Varighed (min)|Längd (min)|Varighet (min)|Durée (min)|Dauer (Min.)
What services do you offer?|Hvilke behandlinger tilbyder du?|Vilka behandlingar erbjuder du?|Hvilke behandlinger tilbyr du?|Quelles prestations proposez-vous ?|Welche Leistungen bieten Sie an?
Who's on your team?|Hvem er på dit team?|Vilka ingår i ditt team?|Hvem er på teamet ditt?|Qui compose votre équipe ?|Wer gehört zu Ihrem Team?
Add Team Member|Tilføj medarbejder|Lägg till medarbetare|Legg til ansatt|Ajouter un collaborateur|Teammitglied hinzufügen
Add Team Member →|Tilføj medarbejder →|Lägg till medarbetare →|Legg til ansatt →|Ajouter un collaborateur →|Teammitglied hinzufügen →
Add Service →|Tilføj behandling →|Lägg till behandling →|Legg til behandling →|Ajouter une prestation →|Leistung hinzufügen →
Work gallery|Arbejdsgalleri|Arbetsgalleri|Arbeidsgalleri|Galerie des réalisations|Arbeitsgalerie
Calendar availability|Kalendertilgængelighed|Kalendertillgänglighet|Kalendertilgjengelighet|Disponibilités du calendrier|Kalenderverfügbarkeit
Day off|Fridag|Ledig dag|Fridag|Jour de congé|Freier Tag
Hide advanced options|Skjul avancerede indstillinger|Dölj avancerade alternativ|Skjul avanserte alternativer|Masquer les options avancées|Erweiterte Optionen ausblenden
Add Staff Member|Tilføj medarbejder|Lägg till medarbetare|Legg til ansatt|Ajouter un membre du personnel|Mitarbeiter hinzufügen
Edit Staff Member|Rediger medarbejder|Redigera medarbetare|Rediger ansatt|Modifier le membre du personnel|Mitarbeiter bearbeiten
Bio|Biografi|Biografi|Biografi|Biographie|Biografie
Renewing session…|Fornyer session…|Förnyar sessionen…|Fornyer økten…|Renouvellement de la session…|Sitzung wird erneuert…
Time until your session expires|Tid til din session udløber|Tid tills sessionen går ut|Tid til økten utløper|Temps avant l'expiration de votre session|Zeit bis zum Ablauf Ihrer Sitzung
Expired|Udløbet|Utgången|Utløpt|Expiré|Abgelaufen
Fix with AI|Ret med AI|Förbättra med AI|Forbedre med KI|Améliorer avec l'IA|Mit KI verbessern
Assist with AI|Hjælp med AI|Hjälp med AI|Hjelp med KI|Aide de l'IA|KI-Unterstützung
Improving…|Forbedrer…|Förbättrar…|Forbedrer…|Amélioration…|Wird verbessert…
Improving your text|Forbedrer din tekst|Förbättrar din text|Forbedrer teksten din|Amélioration de votre texte|Ihr Text wird verbessert
Choose a version|Vælg en version|Välj en version|Velg en versjon|Choisir une version|Version auswählen
Suggestion style|Forslagsstil|Förslagsstil|Forslagsstil|Style de suggestion|Vorschlagsstil
Use this text|Brug denne tekst|Använd den här texten|Bruk denne teksten|Utiliser ce texte|Diesen Text verwenden
Quick questions|Hurtige spørgsmål|Snabba frågor|Raske spørsmål|Questions rapides|Kurze Fragen
About this service|Om denne behandling|Om denna behandling|Om denne behandlingen|À propos de cette prestation|Über diese Leistung
Performed by|Udføres af|Utförs av|Utføres av|Réalisée par|Durchgeführt von
Available with any of our team|Tilgængelig hos alle på vores team|Tillgänglig hos alla i vårt team|Tilgjengelig hos alle på teamet vårt|Disponible avec toute notre équipe|Bei allen Teammitgliedern verfügbar
Book this service|Book denne behandling|Boka denna behandling|Bestill denne behandlingen|Réserver cette prestation|Diese Leistung buchen
Your cart is empty.|Din kurv er tom.|Din varukorg är tom.|Handlekurven din er tom.|Votre panier est vide.|Ihr Warenkorb ist leer.
Proceed to checkout|Fortsæt til kassen|Fortsätt till kassan|Fortsett til kassen|Passer à la caisse|Zur Kasse
Back to shop|Tilbage til butikken|Tillbaka till butiken|Tilbake til butikken|Retour à la boutique|Zurück zum Shop
← Back to shop|← Tilbage til butikken|← Tillbaka till butiken|← Tilbake til butikken|← Retour à la boutique|← Zurück zum Shop
Order summary|Ordreoversigt|Ordersammanfattning|Ordreoversikt|Récapitulatif de commande|Bestellübersicht
Order notifications|Ordrebeskeder|Orderaviseringar|Ordrevarsler|Notifications de commande|Bestellbenachrichtigungen
Important only|Kun vigtige|Endast viktiga|Kun viktige|Importantes uniquement|Nur wichtige
All updates|Alle opdateringer|Alla uppdateringar|Alle oppdateringer|Toutes les mises à jour|Alle Aktualisierungen
Address line 1|Adresselinje 1|Adressrad 1|Adresselinje 1|Adresse ligne 1|Adresszeile 1
Address line 2|Adresselinje 2|Adressrad 2|Adresselinje 2|Adresse ligne 2|Adresszeile 2
State / region|Region|Region|Region|Région|Bundesland / Region
ZIP / postcode|Postnummer|Postnummer|Postnummer|Code postal|Postleitzahl
— Select country —|— Vælg land —|— Välj land —|— Velg land —|— Sélectionner un pays —|— Land auswählen —
My Account|Min konto|Mitt konto|Kontoen min|Mon compte|Mein Konto
Sort|Sorter|Sortera|Sorter|Trier|Sortieren
Price range|Prisinterval|Prisintervall|Prisintervall|Fourchette de prix|Preisbereich
Only available|Kun tilgængelige|Endast tillgängliga|Kun tilgjengelige|Disponibles uniquement|Nur verfügbare
No matches|Ingen resultater|Inga träffar|Ingen treff|Aucun résultat|Keine Treffer
Minimum price|Minimumspris|Lägsta pris|Minstepris|Prix minimum|Mindestpreis
Maximum price|Maksimumspris|Högsta pris|Makspris|Prix maximum|Höchstpreis
Remove from favourites|Fjern fra favoritter|Ta bort från favoriter|Fjern fra favoritter|Retirer des favoris|Aus Favoriten entfernen
Save to favourites|Gem som favorit|Spara som favorit|Lagre som favoritt|Ajouter aux favoris|Zu Favoriten hinzufügen
Previous image|Forrige billede|Föregående bild|Forrige bilde|Image précédente|Vorheriges Bild
Next image|Næste billede|Nästa bild|Neste bilde|Image suivante|Nächstes Bild
Sold out|Udsolgt|Slutsåld|Utsolgt|Épuisé|Ausverkauft
This option is out of stock|Denne variant er udsolgt|Denna variant är slut i lager|Denne varianten er utsolgt|Cette variante est épuisée|Diese Variante ist ausverkauft
Options|Muligheder|Alternativ|Alternativer|Options|Optionen
Mobile number|Mobilnummer|Mobilnummer|Mobilnummer|Numéro de portable|Mobilnummer
Total paid|Betalt i alt|Totalt betalt|Totalt betalt|Total payé|Insgesamt bezahlt
Previous|Forrige|Föregående|Forrige|Précédent|Zurück
Large|Stor|Stor|Stor|Grand|Groß
Compact|Kompakt|Kompakt|Kompakt|Compact|Kompakt
Card size|Kortstørrelse|Kortstorlek|Kortstørrelse|Taille des cartes|Kartengröße
{count} appointment|{count} aftale|{count} bokning|{count} avtale|{count} rendez-vous|{count} Termin
{count} appointments|{count} aftaler|{count} bokningar|{count} avtaler|{count} rendez-vous|{count} Termine
{count} service|{count} behandling|{count} behandling|{count} behandling|{count} prestation|{count} Leistung
{count} services|{count} behandlinger|{count} behandlingar|{count} behandlinger|{count} prestations|{count} Leistungen
{count} rating|{count} bedømmelse|{count} omdöme|{count} vurdering|{count} évaluation|{count} Bewertung
{count} ratings|{count} bedømmelser|{count} omdömen|{count} vurderinger|{count} évaluations|{count} Bewertungen
{count} match|{count} resultat|{count} träff|{count} treff|{count} résultat|{count} Treffer
{count} matches|{count} resultater|{count} träffar|{count} treff|{count} résultats|{count} Treffer
Your booking is pending confirmation. We'll notify {email} once it's confirmed.|Din booking afventer bekræftelse. Vi giver besked til {email}, når den er bekræftet.|Din bokning väntar på bekräftelse. Vi meddelar {email} när den är bekräftad.|Bestillingen din venter på bekreftelse. Vi varsler {email} når den er bekreftet.|Votre réservation attend confirmation. Nous informerons {email} une fois confirmée.|Ihre Buchung wartet auf Bestätigung. Wir benachrichtigen {email}, sobald sie bestätigt ist.
A confirmation has been sent to {email}.|En bekræftelse er sendt til {email}.|En bekräftelse har skickats till {email}.|En bekreftelse er sendt til {email}.|Une confirmation a été envoyée à {email}.|Eine Bestätigung wurde an {email} gesendet.
No services match “{query}”.|Ingen behandlinger matcher “{query}”.|Inga behandlingar matchar “{query}”.|Ingen behandlinger samsvarer med “{query}”.|Aucune prestation ne correspond à « {query} ».|Keine Leistungen passen zu „{query}“.
The salon is closed on {date} — pick another date.|Salonen er lukket den {date} — vælg en anden dato.|Salongen är stängd den {date} — välj ett annat datum.|Salongen er stengt den {date} — velg en annen dato.|Le salon est fermé le {date} — choisissez une autre date.|Der Salon ist am {date} geschlossen — wählen Sie ein anderes Datum.
No available times on {date} — try another date.|Ingen ledige tider den {date} — prøv en anden dato.|Inga lediga tider den {date} — prova ett annat datum.|Ingen ledige tider den {date} — prøv en annen dato.|Aucun horaire disponible le {date} — essayez une autre date.|Am {date} sind keine Zeiten frei — versuchen Sie ein anderes Datum.
Salon name is required.|Salonnavn er påkrævet.|Salongsnamn krävs.|Salongnavn er påkrevd.|Le nom du salon est obligatoire.|Der Salonname ist erforderlich.
Owner name is required.|Ejerens navn er påkrævet.|Ägarens namn krävs.|Eierens navn er påkrevd.|Le nom du propriétaire est obligatoire.|Der Name des Inhabers ist erforderlich.
Owner email is required.|Ejerens e-mail er påkrævet.|Ägarens e-post krävs.|Eierens e-post er påkrevd.|L'e-mail du propriétaire est obligatoire.|Die E-Mail des Inhabers ist erforderlich.
Country is required.|Land er påkrævet.|Land krävs.|Land er påkrevd.|Le pays est obligatoire.|Das Land ist erforderlich.
Enter a valid email address.|Indtast en gyldig e-mailadresse.|Ange en giltig e-postadress.|Skriv inn en gyldig e-postadresse.|Saisissez une adresse e-mail valide.|Geben Sie eine gültige E-Mail-Adresse ein.
Select a country code for the phone number.|Vælg en landekode til telefonnummeret.|Välj en landskod för telefonnumret.|Velg en landskode for telefonnummeret.|Sélectionnez un indicatif pour le numéro de téléphone.|Wählen Sie eine Ländervorwahl für die Telefonnummer.
Phone number must contain only digits.|Telefonnummeret må kun indeholde tal.|Telefonnumret får bara innehålla siffror.|Telefonnummeret må bare inneholde sifre.|Le numéro de téléphone ne doit contenir que des chiffres.|Die Telefonnummer darf nur Ziffern enthalten.
Each open day needs a closing time later than its opening time.|Hver åben dag skal have en lukketid efter åbningstiden.|Varje öppen dag måste ha en stängningstid efter öppningstiden.|Hver åpen dag må ha en stengetid etter åpningstiden.|Chaque jour ouvert doit avoir une heure de fermeture après l'ouverture.|An jedem Öffnungstag muss die Schließzeit nach der Öffnungszeit liegen.
Enter a website address starting with https:// (for example, https://yoursalon.com).|Indtast en webadresse, der begynder med https:// (f.eks. https://yoursalon.com).|Ange en webbadress som börjar med https:// (till exempel https://yoursalon.com).|Skriv inn en nettadresse som starter med https:// (for eksempel https://yoursalon.com).|Saisissez une adresse commençant par https:// (par exemple https://yoursalon.com).|Geben Sie eine Webadresse ein, die mit https:// beginnt (z. B. https://yoursalon.com).
Please read and accept the terms and privacy policy to continue.|Læs og acceptér vilkårene og privatlivspolitikken for at fortsætte.|Läs och godkänn villkoren och integritetspolicyn för att fortsätta.|Les og godta vilkårene og personvernerklæringen for å fortsette.|Veuillez lire et accepter les conditions et la politique de confidentialité pour continuer.|Lesen und akzeptieren Sie die Bedingungen und die Datenschutzerklärung, um fortzufahren.
We couldn’t load the country list. Try again to choose your salon’s country.|Vi kunne ikke indlæse landelisten. Prøv igen for at vælge salonens land.|Vi kunde inte ladda landslistan. Försök igen för att välja salongens land.|Vi kunne ikke laste landlisten. Prøv igjen for å velge salongens land.|Impossible de charger la liste des pays. Réessayez pour choisir le pays du salon.|Die Länderliste konnte nicht geladen werden. Versuchen Sie es erneut, um das Land Ihres Salons auszuwählen.
`.trim().split("\n").map((row) => row.split("|"));

export const messages: Record<string, Record<Exclude<Language, "en">, string>> = Object.fromEntries(
  rows.map(([en, da, sv, nb, fr, de]) => [en, { da, sv, nb, fr, de }]),
);

export const normalizedMessages = Object.fromEntries(Object.entries(messages).map(([key, value]) => [key.toLowerCase(), value]));
