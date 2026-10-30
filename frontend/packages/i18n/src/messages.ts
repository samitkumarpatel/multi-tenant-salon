import type { Language } from "./languages";

// English source messages are stable keys and the fallback for missing translations.
// Columns: English | Danish | Swedish | Norwegian Bokmål | French | German.
const rows = `
Email preview is unavailable for this activity.|E-mailforhåndsvisning er ikke tilgængelig for denne aktivitet.|Förhandsvisning av e-post är inte tillgänglig för denna aktivitet.|Forhåndsvisning av e-post er ikke tilgjengelig for denne aktiviteten.|L’aperçu de l’e-mail n’est pas disponible pour cette activité.|Für diese Aktivität ist keine E-Mail-Vorschau verfügbar.
All appointments|Alle aftaler|Alla bokningar|Alle avtaler|Tous les rendez-vous|Alle Termine
Filter by|Filtrer efter|Filtrera efter|Filtrer etter|Filtrer par|Filtern nach
Week number|Ugenummer|Veckonummer|Ukenummer|Numéro de semaine|Kalenderwoche
No appointments in this period.|Ingen aftaler i denne periode.|Inga bokningar under den här perioden.|Ingen avtaler i denne perioden.|Aucun rendez-vous pour cette période.|Keine Termine in diesem Zeitraum.
Could not load communication history. Order details are still available.|Kommunikationshistorikken kunne ikke indlæses. Ordredetaljerne er stadig tilgængelige.|Kommunikationshistoriken kunde inte läsas in. Orderinformationen är fortfarande tillgänglig.|Kommunikasjonshistorikken kunne ikke lastes. Ordredetaljene er fortsatt tilgjengelige.|Impossible de charger l’historique des communications. Les détails de la commande restent disponibles.|Der Kommunikationsverlauf konnte nicht geladen werden. Die Bestelldetails sind weiterhin verfügbar.
Loading payment history…|Indlæser betalingshistorik…|Läser in betalningshistorik…|Laster betalingshistorikk…|Chargement de l’historique des paiements…|Zahlungsverlauf wird geladen…
Payment history is currently unavailable.|Betalingshistorikken er ikke tilgængelig i øjeblikket.|Betalningshistoriken är inte tillgänglig just nu.|Betalingshistorikken er ikke tilgjengelig for øyeblikket.|L’historique des paiements est actuellement indisponible.|Der Zahlungsverlauf ist derzeit nicht verfügbar.
Decrease quantity|Reducer antal|Minska antal|Reduser antall|Réduire la quantité|Menge verringern
Increase quantity|Øg antal|Öka antal|Øk antall|Augmenter la quantité|Menge erhöhen
Remove from cart|Fjern fra kurv|Ta bort från varukorgen|Fjern fra handlekurven|Retirer du panier|Aus dem Warenkorb entfernen
Your place for|Dit sted for|Din plats för|Ditt sted for|Votre adresse pour|Ihr Ort für
SMS not configured|SMS er ikke konfigureret|SMS är inte konfigurerat|SMS er ikke konfigurert|SMS non configurés|SMS nicht konfiguriert
Email not configured|E-mail er ikke konfigureret|E-post är inte konfigurerad|E-post er ikke konfigurert|E-mail non configuré|E-Mail nicht konfiguriert
Communication details|Kommunikationsdetaljer|Kommunikationsdetaljer|Kommunikasjonsdetaljer|Détails de la communication|Kommunikationsdetails
Customer communication|Kundekommunikation|Kundkommunikation|Kundekommunikasjon|Communication client|Kundenkommunikation
Notification requested|Besked anmodet|Meddelande begärt|Varsel forespurt|Notification demandée|Benachrichtigung angefordert
Sending attempts|Afsendelsesforsøg|Sändningsförsök|Sendeforsøk|Tentatives d’envoi|Sendeversuche
Retry email|Send e-mail igen|Skicka e-post igen|Send e-post på nytt|Réessayer l’envoi de l’e-mail|E-Mail erneut senden
Confirm email retry|Bekræft genafsendelse|Bekräfta omsändning|Bekreft ny sending|Confirmer le nouvel envoi|Erneutes Senden bestätigen
Retry this saved email to {recipient}?|Send denne gemte e-mail igen til {recipient}?|Skicka detta sparade e-postmeddelande igen till {recipient}?|Sende denne lagrede e-posten på nytt til {recipient}?|Renvoyer cet e-mail enregistré à {recipient} ?|Diese gespeicherte E-Mail erneut an {recipient} senden?
Email retry queued|Genafsendelse af e-mail er sat i kø|Omsändning av e-post har köats|Ny sending av e-post er lagt i kø|Nouvel envoi de l’e-mail en attente|Erneutes Senden der E-Mail eingereiht
Email preview|Forhåndsvisning af e-mail|Förhandsvisning av e-post|Forhåndsvisning av e-post|Aperçu de l’e-mail|E-Mail-Vorschau
Queued|I kø|Köad|I kø|En attente|In der Warteschlange
Sending|Sender|Skickar|Sender|Envoi en cours|Wird gesendet
Accepted by email provider|Accepteret af e-mailudbyder|Accepterat av e-postleverantör|Akseptert av e-postleverandør|Accepté par le fournisseur d’e-mail|Vom E-Mail-Anbieter angenommen
Automatic retry pending|Automatisk genforsøg afventer|Automatiskt nytt försök väntar|Automatisk nytt forsøk venter|Nouvelle tentative automatique en attente|Automatischer Wiederholungsversuch ausstehend
Failed|Mislykkedes|Misslyckades|Mislyktes|Échec|Fehlgeschlagen
Skipped|Sprunget over|Överhoppat|Hoppet over|Ignoré|Übersprungen
Channel|Kanal|Kanal|Kanal|Canal|Kanal
Recipient|Modtager|Mottagare|Mottaker|Destinataire|Empfänger
Updated|Opdateret|Uppdaterad|Oppdatert|Mis à jour|Aktualisiert
Not recorded|Ikke registreret|Inte registrerat|Ikke registrert|Non enregistré|Nicht aufgezeichnet
The message content was not saved for this activity.|Beskedens indhold blev ikke gemt for denne aktivitet.|Meddelandets innehåll sparades inte för denna aktivitet.|Meldingsinnholdet ble ikke lagret for denne aktiviteten.|Le contenu du message n’a pas été enregistré pour cette activité.|Der Nachrichteninhalt wurde für diese Aktivität nicht gespeichert.
Could not refresh communication status.|Kunne ikke opdatere kommunikationsstatus.|Kunde inte uppdatera kommunikationsstatus.|Kunne ikke oppdatere kommunikasjonsstatus.|Impossible d’actualiser le statut de la communication.|Der Kommunikationsstatus konnte nicht aktualisiert werden.
View my orders|Se mine ordrer|Visa mina beställningar|Se mine bestillinger|Voir mes commandes|Meine Bestellungen ansehen
Already ordered? View your orders and updates.|Har du allerede bestilt? Se dine ordrer og opdateringer.|Har du redan beställt? Se dina beställningar och uppdateringar.|Har du allerede bestilt? Se bestillingene dine og oppdateringer.|Vous avez déjà commandé ? Consultez vos commandes et leurs mises à jour.|Bereits bestellt? Sehen Sie Ihre Bestellungen und aktuelle Informationen an.
Manage my membership|Administrer mit medlemskab|Hantera mitt medlemskap|Administrer medlemskapet mitt|Gérer mon abonnement|Meine Mitgliedschaft verwalten
See my points|Se mine point|Se mina poäng|Se poengene mine|Voir mes points|Meine Punkte ansehen
Breadcrumb|Brødkrummesti|Brödsmulor|Brødsmulesti|Fil d’Ariane|Brotkrümelnavigation
View webshop|Se webshop|Visa webbutik|Se nettbutikk|Voir la boutique|Webshop ansehen
Product navigation|Produktnavigation|Produktnavigering|Produktnavigasjon|Navigation des produits|Produktnavigation
Order navigation|Ordrenavigation|Ordernavigering|Ordrenavigasjon|Navigation des commandes|Bestellnavigation
Product handle|Produktets URL-navn|Produktens URL-namn|Produktets URL-navn|Identifiant URL du produit|URL-Kennung des Produkts
Generated from product name|Genereres fra produktnavnet|Genereras från produktnamnet|Genereres fra produktnavnet|Généré à partir du nom du produit|Wird aus dem Produktnamen erstellt
Use lowercase letters, numbers and hyphens. Renaming the product keeps its URL; changing this handle redirects previous links.|Brug små bogstaver, tal og bindestreger. Ændring af produktnavnet bevarer URL'en; ændring af dette URL-navn omdirigerer tidligere links.|Använd små bokstäver, siffror och bindestreck. Produktens URL behålls när namnet ändras; ändring av detta URL-namn omdirigerar tidigare länkar.|Bruk små bokstaver, tall og bindestreker. Produktets URL beholdes når navnet endres; endring av dette URL-navnet videresender tidligere lenker.|Utilisez des minuscules, des chiffres et des tirets. Renommer le produit conserve son URL ; modifier cet identifiant redirige les anciens liens.|Verwenden Sie Kleinbuchstaben, Zahlen und Bindestriche. Eine Namensänderung behält die URL bei; eine Änderung dieser Kennung leitet alte Links weiter.
Product not found|Produktet blev ikke fundet|Produkten hittades inte|Produktet ble ikke funnet|Produit introuvable|Produkt nicht gefunden
This product is no longer available.|Dette produkt er ikke længere tilgængeligt.|Den här produkten är inte längre tillgänglig.|Dette produktet er ikke lenger tilgjengelig.|Ce produit n’est plus disponible.|Dieses Produkt ist nicht mehr verfügbar.
Points|Point|Poäng|Poeng|Points|Punkte
View reviews|Se anmeldelser|Visa recensioner|Se anmeldelser|Voir les avis|Rezensionen ansehen
Allow my written review to appear publicly|Tillad, at min skriftlige anmeldelse vises offentligt|Tillåt att min skriftliga recension visas offentligt|Tillat at min skriftlige anmeldelse vises offentlig|Autoriser la publication de mon avis écrit|Meine schriftliche Rezension darf öffentlich angezeigt werden
Optional. Your comments about the salon and stylist will appear without your name. Leave unchecked to keep them private. Salon replies stay private.|Valgfrit. Dine kommentarer om salonen og frisøren vises uden dit navn. Lad feltet være umarkeret for at holde dem private. Salonens svar forbliver private.|Valfritt. Dina kommentarer om salongen och frisören visas utan ditt namn. Lämna rutan omarkerad för att hålla dem privata. Salongens svar förblir privata.|Valgfritt. Kommentarene dine om salongen og frisøren vises uten navnet ditt. La boksen stå umerket for å holde dem private. Salongens svar forblir private.|Facultatif. Vos commentaires sur le salon et le coiffeur apparaîtront sans votre nom. Ne cochez pas pour les garder privés. Les réponses du salon restent privées.|Optional. Ihre Kommentare zum Salon und zum Stylisten werden ohne Ihren Namen angezeigt. Lassen Sie das Feld deaktiviert, um sie privat zu halten. Antworten des Salons bleiben privat.
Rate the salon, your stylist, or both. Stars and written feedback can be sent separately. Written feedback is private unless you choose to share it publicly. Replies stay private; star ratings contribute to public averages.|Bedøm salonen, din frisør eller begge. Stjerner og skriftlig feedback kan sendes hver for sig. Skriftlig feedback er privat, medmindre du vælger at dele den offentligt. Svar forbliver private; stjerner indgår i offentlige gennemsnit.|Betygsätt salongen, din frisör eller båda. Stjärnor och skriftlig feedback kan skickas separat. Skriftlig feedback är privat om du inte väljer att dela den offentligt. Svar förblir privata; stjärnbetyg ingår i offentliga genomsnitt.|Vurder salongen, frisøren din eller begge. Stjerner og skriftlige tilbakemeldinger kan sendes separat. Skriftlige tilbakemeldinger er private med mindre du velger å dele dem offentlig. Svar forblir private; stjerner inngår i offentlige gjennomsnitt.|Évaluez le salon, votre coiffeur ou les deux. Les étoiles et les commentaires peuvent être envoyés séparément. Les commentaires restent privés sauf si vous choisissez de les publier. Les réponses restent privées ; les étoiles contribuent aux moyennes publiques.|Bewerten Sie den Salon, Ihren Stylisten oder beide. Sterne und schriftliches Feedback können getrennt gesendet werden. Schriftliches Feedback bleibt privat, sofern Sie es nicht veröffentlichen möchten. Antworten bleiben privat; Sterne fließen in öffentliche Durchschnittswerte ein.
Rate the salon, your stylist, or both. You can send just stars or written feedback. Written feedback is private unless you choose to share it publicly. Replies stay private.|Bedøm salonen, din frisør eller begge. Du kan sende kun stjerner eller skriftlig feedback. Skriftlig feedback er privat, medmindre du vælger at dele den offentligt. Svar forbliver private.|Betygsätt salongen, din frisör eller båda. Du kan skicka enbart stjärnor eller skriftlig feedback. Skriftlig feedback är privat om du inte väljer att dela den offentligt. Svar förblir privata.|Vurder salongen, frisøren din eller begge. Du kan sende bare stjerner eller skriftlige tilbakemeldinger. Skriftlige tilbakemeldinger er private med mindre du velger å dele dem offentlig. Svar forblir private.|Évaluez le salon, votre coiffeur ou les deux. Vous pouvez envoyer des étoiles seules ou un commentaire écrit. Les commentaires restent privés sauf si vous choisissez de les publier. Les réponses restent privées.|Bewerten Sie den Salon, Ihren Stylisten oder beide. Sie können nur Sterne oder schriftliches Feedback senden. Schriftliches Feedback bleibt privat, sofern Sie es nicht veröffentlichen möchten. Antworten bleiben privat.
Explore ratings and reviews for the salon and its stylists. Written reviews appear only with customer permission.|Se bedømmelser og anmeldelser af salonen og dens frisører. Skriftlige anmeldelser vises kun med kundens tilladelse.|Se betyg och recensioner för salongen och dess frisörer. Skriftliga recensioner visas endast med kundens tillåtelse.|Se vurderinger og anmeldelser av salongen og frisørene. Skriftlige anmeldelser vises kun med kundens tillatelse.|Découvrez les notes et avis sur le salon et ses coiffeurs. Les avis écrits sont publiés uniquement avec l’accord du client.|Entdecken Sie Bewertungen und Rezensionen zum Salon und seinen Stylisten. Schriftliche Rezensionen erscheinen nur mit Zustimmung der Kunden.
Newest reviews first|Nyeste anmeldelser først|Senaste recensionerna först|Nyeste anmeldelser først|Avis les plus récents en premier|Neueste Rezensionen zuerst
Review pages|Anmeldelsessider|Recensionssidor|Anmeldelsessider|Pages d’avis|Rezensionsseiten
Private feedback — customer has not agreed to publish it.|Privat feedback — kunden har ikke givet tilladelse til offentliggørelse.|Privat feedback — kunden har inte godkänt publicering.|Privat tilbakemelding — kunden har ikke samtykket til publisering.|Commentaire privé — le client n’a pas autorisé sa publication.|Privates Feedback — der Kunde hat der Veröffentlichung nicht zugestimmt.
Written review hidden from the public website.|Skriftlig anmeldelse skjult på den offentlige hjemmeside.|Skriftlig recension dold på den offentliga webbplatsen.|Skriftlig anmeldelse skjult på det offentlige nettstedet.|Avis écrit masqué sur le site public.|Schriftliche Rezension auf der öffentlichen Website ausgeblendet.
Customer agreed to share this written review publicly.|Kunden har givet tilladelse til at dele denne skriftlige anmeldelse offentligt.|Kunden har godkänt att denna skriftliga recension delas offentligt.|Kunden har samtykket til å dele denne skriftlige anmeldelsen offentlig.|Le client a autorisé la publication de cet avis écrit.|Der Kunde hat der Veröffentlichung dieser schriftlichen Rezension zugestimmt.
Hiding a written review keeps its star rating in public totals. Replies stay private.|Når en skriftlig anmeldelse skjules, indgår dens stjerner stadig i offentlige totaler. Svar forbliver private.|När en skriftlig recension döljs räknas dess stjärnbetyg fortfarande i offentliga totalsiffror. Svar förblir privata.|Når en skriftlig anmeldelse skjules, inngår stjernene fortsatt i offentlige totaler. Svar forblir private.|Masquer un avis écrit conserve sa note dans les totaux publics. Les réponses restent privées.|Wenn eine schriftliche Rezension ausgeblendet wird, bleibt ihre Sternebewertung in den öffentlichen Gesamtwerten enthalten. Antworten bleiben privat.
Show written review|Vis skriftlig anmeldelse|Visa skriftlig recension|Vis skriftlig anmeldelse|Afficher l’avis écrit|Schriftliche Rezension anzeigen
Hide written review|Skjul skriftlig anmeldelse|Dölj skriftlig recension|Skjul skriftlig anmeldelse|Masquer l’avis écrit|Schriftliche Rezension ausblenden
Review visibility saved.|Anmeldelsens synlighed er gemt.|Recensionens synlighet har sparats.|Anmeldelsens synlighet er lagret.|Visibilité de l’avis enregistrée.|Sichtbarkeit der Rezension gespeichert.
Let any customer leave stars or written feedback from the website hero, footer and stylist profiles. Completed-visit email invitations and account reviews remain available when this is off.|Lad alle kunder give stjerner eller skriftlig feedback fra hjemmesidens top, sidefod og frisørprofiler. E-mailinvitationer efter besøg og kontoanmeldelser er stadig tilgængelige, når dette er slået fra.|Låt alla kunder lämna stjärnor eller skriftlig feedback från webbplatsens topp, sidfot och frisörprofiler. E-postinbjudningar efter besök och kontorecensioner är fortfarande tillgängliga när detta är avstängt.|La alle kunder gi stjerner eller skriftlige tilbakemeldinger fra nettstedets topp, bunntekst og frisørprofiler. E-postinvitasjoner etter besøk og kontoanmeldelser er fortsatt tilgjengelige når dette er slått av.|Permettez à tout client de laisser des étoiles ou un commentaire depuis l’accueil, le pied de page et les profils des coiffeurs. Les invitations après visite et les avis du compte restent disponibles lorsque cette option est désactivée.|Alle Kunden können über den Kopfbereich, die Fußzeile und die Stylistenprofile Sterne oder schriftliches Feedback abgeben. E-Mail-Einladungen nach Besuchen und Kontorezensionen bleiben verfügbar, wenn diese Option deaktiviert ist.
Read-only account details. Salon owners manage their own customers and staff in Salon Admin.|Skrivebeskyttede kontooplysninger. Salonejere administrerer deres egne kunder og medarbejdere i Salon Admin.|Skrivskyddade kontouppgifter. Salongsägare hanterar sina egna kunder och sin personal i Salon Admin.|Skrivebeskyttede kontoopplysninger. Salongeiere administrerer sine egne kunder og ansatte i Salon Admin.|Détails du compte en lecture seule. Les propriétaires gèrent leurs clients et leur personnel dans Salon Admin.|Kontodetails mit Lesezugriff. Saloninhaber verwalten ihre Kunden und Mitarbeiter in Salon Admin.
Read-only staff details. The salon owner manages team changes in Salon Admin.|Skrivebeskyttede medarbejderoplysninger. Salonejeren administrerer teamændringer i Salon Admin.|Skrivskyddade personaluppgifter. Salongsägaren hanterar teamändringar i Salon Admin.|Skrivebeskyttede ansattopplysninger. Salongeieren administrerer teamendringer i Salon Admin.|Détails du personnel en lecture seule. Le propriétaire gère les changements d’équipe dans Salon Admin.|Mitarbeiterdetails mit Lesezugriff. Der Saloninhaber verwaltet Teamänderungen in Salon Admin.
View user details|Vis brugeroplysninger|Visa användaruppgifter|Vis brukeropplysninger|Voir les détails utilisateur|Benutzerdetails anzeigen

No reviews yet|Ingen anmeldelser endnu|Inga recensioner än|Ingen anmeldelser ennå|Pas encore d’avis|Noch keine Bewertungen
Users and access|Brugere og adgang|Användare och åtkomst|Brukere og tilgang|Utilisateurs et accès|Benutzer und Zugriff
Customer relationships|Kunderelationer|Kundrelationer|Kunderelasjoner|Relations clients|Kundenbeziehungen
All users|Alle brugere|Alla användare|Alle brukere|Tous les utilisateurs|Alle Benutzer
Roles and salon access|Roller og salonadgang|Roller och salongsåtkomst|Roller og salongtilgang|Rôles et accès aux salons|Rollen und Salonzugriff
Effective role|Effektiv rolle|Effektiv roll|Effektiv rolle|Rôle effectif|Wirksame Rolle
Source status|Oprindelig status|Ursprunglig status|Opprinnelig status|Statut d’origine|Quellstatus
Source record|Oprindelig post|Ursprunglig post|Opprinnelig oppføring|Enregistrement source|Quelldatensatz
Platform-wide|Hele platformen|Hela plattformen|Hele plattformen|Toute la plateforme|Plattformweit
Active access|Aktiv adgang|Aktiv åtkomst|Aktiv tilgang|Accès actif|Aktiver Zugriff
Restricted access|Begrænset adgang|Begränsad åtkomst|Begrenset tilgang|Accès restreint|Eingeschränkter Zugriff
No active access|Ingen aktiv adgang|Ingen aktiv åtkomst|Ingen aktiv tilgang|Aucun accès actif|Kein aktiver Zugriff
Access blocked|Adgang blokeret|Åtkomst blockerad|Tilgang blokkert|Accès bloqué|Zugriff gesperrt
Access revoked|Adgang tilbagekaldt|Åtkomst återkallad|Tilgang tilbakekalt|Accès révoqué|Zugriff entzogen
Manage user access|Administrer brugeradgang|Hantera användaråtkomst|Administrer brukertilgang|Gérer l’accès utilisateur|Benutzerzugriff verwalten
Revoke access|Tilbagekald adgang|Återkalla åtkomst|Tilbakekall tilgang|Révoquer l’accès|Zugriff entziehen
Preview impact|Se konsekvenser|Förhandsgranska konsekvenser|Forhåndsvis konsekvenser|Prévisualiser les conséquences|Auswirkungen prüfen
Removal impact|Konsekvenser af fjernelse|Konsekvenser av borttagning|Konsekvenser av fjerning|Conséquences de la suppression|Auswirkungen der Entfernung
All salons and platform access|Alle saloner og platformadgang|Alla salonger och plattformsåtkomst|Alle salonger og plattformtilgang|Tous les salons et l’accès plateforme|Alle Salons und Plattformzugriff
Scope|Omfang|Omfattning|Omfang|Périmètre|Umfang
Confirm access revocation|Bekræft tilbagekaldelse af adgang|Bekräfta återkallad åtkomst|Bekreft tilbakekalling av tilgang|Confirmer la révocation de l’accès|Zugriffsentzug bestätigen
Confirm deletion and access block|Bekræft sletning og adgangsblokering|Bekräfta radering och åtkomstblockering|Bekreft sletting og tilgangsblokkering|Confirmer la suppression et le blocage|Löschung und Zugriffssperre bestätigen
Delete local user data and block access|Slet lokale brugerdata og bloker adgang|Radera lokala användardata och blockera åtkomst|Slett lokale brukerdata og blokker tilgang|Supprimer les données locales et bloquer l’accès|Lokale Benutzerdaten löschen und Zugriff sperren
Local user data deleted|Lokale brugerdata slettet|Lokala användardata raderade|Lokale brukerdata slettet|Données utilisateur locales supprimées|Lokale Benutzerdaten gelöscht
Removal history|Historik over fjernelser|Borttagningshistorik|Fjerningshistorikk|Historique des suppressions|Entfernungsverlauf
Retained data and cleanup boundaries|Bevarede data og oprydningens omfang|Bevarade data och rensningens omfattning|Bevarte data og oppryddingens omfang|Données conservées et limites du nettoyage|Aufbewahrte Daten und Bereinigungsumfang
Active sessions|Aktive sessioner|Aktiva sessioner|Aktive økter|Sessions actives|Aktive Sitzungen
Sign-in codes|Login-koder|Inloggningskoder|Innloggingskoder|Codes de connexion|Anmeldecodes
Staff appointments|Medarbejderaftaler|Personalbokningar|Ansattavtaler|Rendez-vous du personnel|Mitarbeitertermine
Search users|Søg efter brugere|Sök användare|Søk etter brukere|Rechercher des utilisateurs|Benutzer suchen
All roles|Alle roller|Alla roller|Alle roller|Tous les rôles|Alle Rollen
All statuses|Alle statusser|Alla statusar|Alle statuser|Tous les statuts|Alle Status
Access status|Adgangsstatus|Åtkomststatus|Tilgangsstatus|Statut d’accès|Zugriffsstatus
Load customer history|Indlæs kundehistorik|Ladda kundhistorik|Last inn kundehistorikk|Charger l’historique client|Kundenhistorie laden
Salon notes|Salonnoter|Salongsanteckningar|Salongnotater|Notes du salon|Salonnotizen
Last seen|Sidst set|Senast sedd|Sist sett|Dernière activité|Zuletzt gesehen

Delivered to your address|Leveres til din adresse|Levereras till din adress|Leveres til adressen din|Livré à votre adresse|An Ihre Adresse geliefert
My account|Min konto|Mitt konto|Min konto|Mon compte|Mein Konto
Sign in to your account|Log ind på din konto|Logga in på ditt konto|Logg inn på kontoen din|Connectez-vous à votre compte|Melden Sie sich bei Ihrem Konto an
See your appointments, orders and membership at {salon}. Use the email you booked, shopped or joined with — we'll send you a 6-digit code. No password needed.|Se dine aftaler, ordrer og dit medlemskab hos {salon}. Brug den e-mail, du bookede, handlede eller meldte dig ind med — vi sender dig en 6-cifret kode. Ingen adgangskode nødvendig.|Se dina bokningar, beställningar och ditt medlemskap hos {salon}. Använd e-postadressen du bokade, handlade eller gick med med — vi skickar en 6-siffrig kod. Inget lösenord behövs.|Se avtalene, bestillingene og medlemskapet ditt hos {salon}. Bruk e-postadressen du bestilte, handlet eller meldte deg inn med — vi sender deg en 6-sifret kode. Ingen passord nødvendig.|Consultez vos rendez-vous, commandes et votre abonnement chez {salon}. Utilisez l'e-mail avec lequel vous avez réservé, acheté ou adhéré — nous vous enverrons un code à 6 chiffres. Aucun mot de passe requis.|Sehen Sie Ihre Termine, Bestellungen und Mitgliedschaft bei {salon}. Verwenden Sie die E-Mail, mit der Sie gebucht, eingekauft oder sich angemeldet haben — wir senden Ihnen einen 6-stelligen Code. Kein Passwort nötig.
Email me a code|Send mig en kode|Skicka en kod till mig|Send meg en kode|Envoyez-moi un code|Code per E-Mail senden
Check your email|Tjek din e-mail|Kolla din e-post|Sjekk e-posten din|Consultez vos e-mails|Prüfen Sie Ihre E-Mails
If {email} has appointments, orders or a membership with {salon}, we've sent it a 6-digit code. It expires in 10 minutes.|Hvis {email} har aftaler, ordrer eller et medlemskab hos {salon}, har vi sendt en 6-cifret kode. Den udløber om 10 minutter.|Om {email} har bokningar, beställningar eller ett medlemskap hos {salon} har vi skickat en 6-siffrig kod. Den går ut om 10 minuter.|Hvis {email} har avtaler, bestillinger eller et medlemskap hos {salon}, har vi sendt en 6-sifret kode. Den utløper om 10 minutter.|Si {email} a des rendez-vous, des commandes ou un abonnement chez {salon}, nous lui avons envoyé un code à 6 chiffres. Il expire dans 10 minutes.|Wenn {email} Termine, Bestellungen oder eine Mitgliedschaft bei {salon} hat, haben wir einen 6-stelligen Code gesendet. Er läuft in 10 Minuten ab.
6-digit code|6-cifret kode|6-siffrig kod|6-sifret kode|Code à 6 chiffres|6-stelliger Code
Send a new code|Send en ny kode|Skicka en ny kod|Send en ny kode|Envoyer un nouveau code|Neuen Code senden
Send a new code in {seconds}s|Send en ny kode om {seconds} s|Skicka en ny kod om {seconds} s|Send en ny kode om {seconds} s|Nouveau code dans {seconds} s|Neuer Code in {seconds} s
No email? Check your spam folder, and make sure it's the address you used with this salon.|Ingen e-mail? Tjek din spam-mappe, og sørg for, at det er den adresse, du brugte hos denne salon.|Inget mejl? Kolla skräpposten och se till att det är adressen du använde hos salongen.|Ingen e-post? Sjekk søppelposten, og sørg for at det er adressen du brukte hos denne salongen.|Pas d'e-mail ? Vérifiez vos spams et assurez-vous qu'il s'agit de l'adresse utilisée avec ce salon.|Keine E-Mail? Prüfen Sie Ihren Spam-Ordner und ob es die Adresse ist, die Sie bei diesem Salon verwendet haben.
That code is wrong or has expired.|Koden er forkert eller udløbet.|Koden är fel eller har gått ut.|Koden er feil eller har utløpt.|Ce code est incorrect ou a expiré.|Dieser Code ist falsch oder abgelaufen.
Your session has ended. Sign in again to continue.|Din session er udløbet. Log ind igen for at fortsætte.|Din session har avslutats. Logga in igen för att fortsätta.|Økten din er avsluttet. Logg inn igjen for å fortsette.|Votre session a expiré. Reconnectez-vous pour continuer.|Ihre Sitzung ist abgelaufen. Melden Sie sich erneut an.
Hi, {name}|Hej, {name}|Hej, {name}|Hei, {name}|Bonjour, {name}|Hallo, {name}
Nothing coming up.|Intet planlagt.|Inget inplanerat.|Ingenting planlagt.|Rien de prévu.|Nichts geplant.
Book again|Book igen|Boka igen|Bestill igjen|Réserver à nouveau|Erneut buchen
No appointments yet|Ingen aftaler endnu|Inga bokningar än|Ingen avtaler ennå|Aucun rendez-vous pour l'instant|Noch keine Termine
When you book at {salon}, your appointments show up here.|Når du booker hos {salon}, vises dine aftaler her.|När du bokar hos {salon} visas dina bokningar här.|Når du bestiller hos {salon}, vises avtalene dine her.|Vos rendez-vous chez {salon} apparaîtront ici.|Wenn Sie bei {salon} buchen, erscheinen Ihre Termine hier.
Need to change or cancel? Contact {salon} directly.|Skal du ændre eller aflyse? Kontakt {salon} direkte.|Behöver du ändra eller avboka? Kontakta {salon} direkt.|Må du endre eller avlyse? Kontakt {salon} direkte.|Besoin de modifier ou d'annuler ? Contactez directement {salon}.|Ändern oder absagen? Kontaktieren Sie {salon} direkt.
with {name}|med {name}|med {name}|med {name}|avec {name}|mit {name}
Awaiting confirmation|Afventer bekræftelse|Inväntar bekräftelse|Venter på bekreftelse|En attente de confirmation|Wartet auf Bestätigung
Missed|Udeblevet|Uteblev|Uteblitt|Manqué|Verpasst
No orders yet|Ingen ordrer endnu|Inga beställningar än|Ingen bestillinger ennå|Aucune commande pour l'instant|Noch keine Bestellungen
Orders you place in the shop show up here, with their delivery status.|Ordrer fra shoppen vises her med deres leveringsstatus.|Beställningar från butiken visas här med leveransstatus.|Bestillinger fra butikken vises her med leveringsstatus.|Vos commandes de la boutique apparaissent ici, avec leur statut de livraison.|Ihre Shop-Bestellungen erscheinen hier mit ihrem Lieferstatus.
Visit the shop|Besøg shoppen|Besök butiken|Besøk butikken|Visiter la boutique|Zum Shop
Order {number}|Ordre {number}|Beställning {number}|Bestilling {number}|Commande {number}|Bestellung {number}
Being prepared|Klargøres|Förbereds|Klargjøres|En préparation|In Vorbereitung
History|Historik|Historik|Historikk|Historique|Verlauf
No membership yet|Intet medlemskab endnu|Inget medlemskap än|Ingen medlemskap ennå|Pas encore d'abonnement|Noch keine Mitgliedschaft
See membership plans|Se medlemskaber|Se medlemskap|Se medlemskap|Voir les abonnements|Mitgliedschaften ansehen
Show this at the desk when you visit|Vis denne i receptionen, når du kommer|Visa den i receptionen när du kommer|Vis denne i resepsjonen når du kommer|Présentez-le à l'accueil lors de votre visite|Zeigen Sie dies beim Besuch am Empfang
Renew early|Forny tidligt|Förnya i förväg|Forny tidlig|Renouveler en avance|Vorzeitig verlängern
Back to booking|Tilbage til booking|Tillbaka till bokning|Tilbake til bestilling|Retour à la réservation|Zurück zur Buchung
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
Help Center|Hjælpecenter|Hjälpcenter|Hjelpesenter|Centre d'aide|Hilfe-Center
Owner guides|Guides til ejere|Guider för ägare|Veiledninger for eiere|Guides pour les propriétaires|Anleitungen für Inhaber
Read the guide|Læs guiden|Läs guiden|Les veiledningen|Lire le guide|Anleitung lesen
Browse the Help Center guides|Se guiderne i Hjælpecenteret|Bläddra bland guiderna i Hjälpcentret|Se veiledningene i Hjelpesenteret|Parcourir les guides du Centre d'aide|Anleitungen im Hilfe-Center ansehen
Step-by-step guides for setting up your salon, services, staff and payments.|Trin-for-trin-guides til opsætning af din salon, behandlinger, medarbejdere og betalinger.|Steg-för-steg-guider för att konfigurera din salong, tjänster, personal och betalningar.|Trinnvise veiledninger for å sette opp salongen, tjenester, ansatte og betalinger.|Des guides pas à pas pour configurer votre salon, vos prestations, votre équipe et vos paiements.|Schritt-für-Schritt-Anleitungen zur Einrichtung von Salon, Leistungen, Team und Zahlungen.
Step-by-step guides for setting up your salon, bookings, shop, memberships, payments and the front desk.|Trin-for-trin-guides til opsætning af din salon, bookinger, webshop, medlemskaber, betalinger og receptionen.|Steg-för-steg-guider för att konfigurera din salong, bokningar, butik, medlemskap, betalningar och receptionen.|Trinnvise veiledninger for å sette opp salongen, bestillinger, nettbutikk, medlemskap, betalinger og resepsjonen.|Des guides pas à pas pour configurer votre salon, les réservations, la boutique, les abonnements, les paiements et l'accueil.|Schritt-für-Schritt-Anleitungen zur Einrichtung von Salon, Buchungen, Shop, Mitgliedschaften, Zahlungen und Empfang.
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
{count}× {service} included {period}|{count}× {service} inkluderet {period}|{count}× {service} ingår {period}|{count}× {service} inkludert {period}|{count}× {service} inclus {period}|{count}× {service} inklusive {period}
a month|om måneden|per månad|i måneden|par mois|pro Monat
a year|om året|per år|i året|par an|pro Jahr
every 3 months|hver 3. måned|var tredje månad|hver 3. måned|tous les 3 mois|alle 3 Monate
/ month|/ måned|/ månad|/ måned|/ mois|/ Monat
/ 3 months|/ 3 måneder|/ 3 månader|/ 3 måneder|/ 3 mois|/ 3 Monate
/ year|/ år|/ år|/ år|/ an|/ Jahr
{percent}% off all services|{percent}% rabat på alle behandlinger|{percent}% rabatt på alla behandlingar|{percent}% rabatt på alle behandlinger|{percent}% de réduction sur tous les soins|{percent}% Rabatt auf alle Behandlungen
{percent}% off products|{percent}% rabat på produkter|{percent}% rabatt på produkter|{percent}% rabatt på produkter|{percent}% de réduction sur les produits|{percent}% Rabatt auf Produkte
Welcome aboard!|Velkommen som medlem!|Välkommen som medlem!|Velkommen som medlem!|Bienvenue parmi nos membres !|Willkommen als Mitglied!
Thank you for joining {salon}. Your payment is being confirmed.|Tak, fordi du blev medlem hos {salon}. Din betaling bliver bekræftet.|Tack för att du blev medlem hos {salon}. Din betalning bekräftas.|Takk for at du ble medlem hos {salon}. Betalingen din blir bekreftet.|Merci d'avoir rejoint {salon}. Votre paiement est en cours de confirmation.|Danke, dass Sie Mitglied bei {salon} geworden sind. Ihre Zahlung wird bestätigt.
Your membership QR code is on its way to your email — show it at your next visit.|Din medlems-QR-kode er på vej til din e-mail — vis den ved dit næste besøg.|Din medlems-QR-kod är på väg till din e-post — visa den vid ditt nästa besök.|Medlems-QR-koden din er på vei til e-posten din — vis den ved neste besøk.|Votre QR code de membre arrive par e-mail — présentez-le lors de votre prochaine visite.|Ihr Mitglieds-QR-Code ist per E-Mail unterwegs — zeigen Sie ihn bei Ihrem nächsten Besuch vor.
Back to {salon}|Tilbage til {salon}|Tillbaka till {salon}|Tilbake til {salon}|Retour à {salon}|Zurück zu {salon}
Your look, on subscription|Dit look som abonnement|Din look som prenumeration|Looken din som abonnement|Votre style en abonnement|Ihr Look im Abo
Checkout cancelled — you haven't been charged.|Betalingen blev afbrudt — du er ikke blevet opkrævet.|Betalningen avbröts — du har inte debiterats.|Betalingen ble avbrutt — du er ikke belastet.|Paiement annulé — vous n'avez pas été débité.|Bezahlung abgebrochen — Ihnen wurde nichts berechnet.
There are no membership plans available right now — check back soon.|Der er ingen medlemskaber tilgængelige lige nu — kig forbi igen snart.|Det finns inga medlemskap tillgängliga just nu — titta in igen snart.|Det er ingen medlemskap tilgjengelig akkurat nå — sjekk igjen snart.|Aucune formule d'adhésion n'est disponible pour le moment — revenez bientôt.|Derzeit sind keine Mitgliedschaften verfügbar — schauen Sie bald wieder vorbei.
To join, contact us:|Kontakt os for at blive medlem:|Kontakta oss för att bli medlem:|Kontakt oss for å bli medlem:|Pour adhérer, contactez-nous :|Für eine Mitgliedschaft kontaktieren Sie uns:
How membership works|Sådan fungerer medlemskab|Så fungerar medlemskapet|Slik fungerer medlemskapet|Comment fonctionne l'adhésion|So funktioniert die Mitgliedschaft
Join online|Bliv medlem online|Bli medlem online|Bli medlem på nett|Adhérez en ligne|Online beitreten
Show your QR code|Vis din QR-kode|Visa din QR-kod|Vis QR-koden din|Présentez votre QR code|Zeigen Sie Ihren QR-Code
We email you a membership QR code. Show it at the desk to use your benefits.|Vi sender dig en medlems-QR-kode på e-mail. Vis den i receptionen for at bruge dine fordele.|Vi mejlar dig en medlems-QR-kod. Visa den i receptionen för att använda dina förmåner.|Vi sender deg en medlems-QR-kode på e-post. Vis den i resepsjonen for å bruke fordelene dine.|Nous vous envoyons un QR code de membre par e-mail. Présentez-le à l'accueil pour profiter de vos avantages.|Wir senden Ihnen einen Mitglieds-QR-Code per E-Mail. Zeigen Sie ihn am Empfang, um Ihre Vorteile zu nutzen.
Most popular|Mest populær|Mest populär|Mest populær|Le plus populaire|Am beliebtesten
+ {fee} one-time sign-up fee|+ {fee} i engangsgebyr ved tilmelding|+ {fee} i engångsavgift vid start|+ {fee} i engangsgebyr ved innmelding|+ {fee} de frais d'inscription uniques|+ {fee} einmalige Anmeldegebühr
Includes {value} of treatments|Inkluderer behandlinger for {value}|Inkluderar behandlingar för {value}|Inkluderer behandlinger for {value}|Comprend {value} de soins|Enthält Behandlungen im Wert von {value}
Only {count} spots left|Kun {count} pladser tilbage|Endast {count} platser kvar|Bare {count} plasser igjen|Plus que {count} places|Nur noch {count} Plätze frei
Join {plan}|Vælg {plan}|Välj {plan}|Velg {plan}|Choisir {plan}|{plan} wählen
Join|Bliv medlem|Bli medlem|Bli medlem|Adhérer|Beitreten
Jane Smith|Jane Smith|Jane Smith|Jane Smith|Jane Smith|Jane Smith
We'll send your membership QR code here.|Vi sender din medlems-QR-kode hertil.|Vi skickar din medlems-QR-kod hit.|Vi sender medlems-QR-koden din hit.|Nous enverrons votre QR code de membre à cette adresse.|Wir senden Ihren Mitglieds-QR-Code an diese Adresse.
Due today|Betales i dag|Att betala i dag|Betales i dag|À payer aujourd'hui|Heute fällig
Includes the {fee} sign-up fee.|Inkluderer tilmeldingsgebyret på {fee}.|Inkluderar startavgiften på {fee}.|Inkluderer innmeldingsgebyret på {fee}.|Comprend les frais d'inscription de {fee}.|Enthält die Anmeldegebühr von {fee}.
Opening secure checkout…|Åbner sikker betaling…|Öppnar säker betalning…|Åpner sikker betaling…|Ouverture du paiement sécurisé…|Sichere Bezahlung wird geöffnet…
Continue to payment|Fortsæt til betaling|Fortsätt till betalning|Fortsett til betaling|Continuer vers le paiement|Weiter zur Zahlung
Payments are processed securely by Stripe.|Betalinger behandles sikkert af Stripe.|Betalningar hanteras säkert av Stripe.|Betalinger behandles trygt av Stripe.|Les paiements sont traités en toute sécurité par Stripe.|Zahlungen werden sicher über Stripe abgewickelt.
one month|én måned|en månad|én måned|un mois|einen Monat
3 months|3 måneder|3 månader|3 måneder|3 mois|3 Monate
one year|ét år|ett år|ett år|un an|ein Jahr
Regular treatments, member prices and perks at {salon}.|Faste behandlinger, medlemspriser og fordele hos {salon}.|Regelbundna behandlingar, medlemspriser och förmåner hos {salon}.|Faste behandlinger, medlemspriser og fordeler hos {salon}.|Des soins réguliers, des prix membres et des avantages chez {salon}.|Regelmäßige Behandlungen, Mitgliederpreise und Vorteile bei {salon}.
Pick a plan and pay securely by card for your first period.|Vælg et medlemskab og betal sikkert med kort for din første periode.|Välj ett medlemskap och betala säkert med kort för din första period.|Velg et medlemskap og betal trygt med kort for din første periode.|Choisissez une formule et payez votre première période par carte en toute sécurité.|Wählen Sie eine Mitgliedschaft und zahlen Sie Ihren ersten Zeitraum sicher per Karte.
Renew when you're ready|Forny, når du er klar|Förnya när du vill|Forny når du er klar|Renouvelez quand vous voulez|Verlängern, wann Sie möchten
Before your membership ends we email you a renewal link. Don't renew and it simply ends — nothing is charged automatically.|Inden dit medlemskab udløber, sender vi dig et link til fornyelse. Fornyer du ikke, udløber det blot — intet trækkes automatisk.|Innan ditt medlemskap går ut mejlar vi dig en länk för att förnya. Förnyar du inte, upphör det bara — inget dras automatiskt.|Før medlemskapet ditt utløper, sender vi deg en lenke for fornyelse. Fornyer du ikke, utløper det bare — ingenting trekkes automatisk.|Avant la fin de votre adhésion, nous vous envoyons un lien de renouvellement. Sans renouvellement, elle prend simplement fin — aucun prélèvement automatique.|Bevor Ihre Mitgliedschaft endet, senden wir Ihnen einen Verlängerungslink. Ohne Verlängerung endet sie einfach — es wird nichts automatisch abgebucht.
Covers {period}. Before it ends we'll email you a link to renew — nothing is charged automatically.|Dækker {period}. Inden det udløber, sender vi dig et link til fornyelse — intet trækkes automatisk.|Gäller {period}. Innan det går ut mejlar vi dig en länk för att förnya — inget dras automatiskt.|Gjelder {period}. Før det utløper, sender vi deg en lenke for fornyelse — ingenting trekkes automatisk.|Couvre {period}. Avant la fin, nous vous enverrons un lien de renouvellement — aucun prélèvement automatique.|Gilt für {period}. Vor dem Ende senden wir Ihnen einen Verlängerungslink — es wird nichts automatisch abgebucht.
Thanks for renewing!|Tak, fordi du fornyede!|Tack för att du förnyade!|Takk for at du fornyet!|Merci pour votre renouvellement !|Danke für Ihre Verlängerung!
Your payment is being confirmed — your membership continues without a gap.|Din betaling bliver bekræftet — dit medlemskab fortsætter uden afbrydelse.|Din betalning bekräftas — ditt medlemskap fortsätter utan uppehåll.|Betalingen din blir bekreftet — medlemskapet ditt fortsetter uten opphold.|Votre paiement est en cours de confirmation — votre adhésion continue sans interruption.|Ihre Zahlung wird bestätigt — Ihre Mitgliedschaft läuft ohne Unterbrechung weiter.
Renew membership|Forny medlemskab|Förnya medlemskap|Forny medlemskap|Renouveler l'adhésion|Mitgliedschaft verlängern
Hi {name},|Hej {name},|Hej {name},|Hei {name},|Bonjour {name},|Hallo {name},
Your membership ended on {date}.|Dit medlemskab udløb den {date}.|Ditt medlemskap gick ut den {date}.|Medlemskapet ditt utløp {date}.|Votre adhésion a pris fin le {date}.|Ihre Mitgliedschaft ist am {date} abgelaufen.
Your membership runs until {date}.|Dit medlemskab gælder til den {date}.|Ditt medlemskap gäller till den {date}.|Medlemskapet ditt varer til {date}.|Votre adhésion est valable jusqu'au {date}.|Ihre Mitgliedschaft läuft bis zum {date}.
This membership has been cancelled. Contact the salon if you'd like to join again.|Dette medlemskab er opsagt. Kontakt salonen, hvis du vil være medlem igen.|Det här medlemskapet har avslutats. Kontakta salongen om du vill bli medlem igen.|Dette medlemskapet er sagt opp. Kontakt salongen hvis du vil bli medlem igjen.|Cette adhésion a été résiliée. Contactez le salon si vous souhaitez adhérer à nouveau.|Diese Mitgliedschaft wurde gekündigt. Kontaktieren Sie den Salon, wenn Sie wieder Mitglied werden möchten.
The new period starts when the current one ends.|Den nye periode starter, når den nuværende slutter.|Den nya perioden börjar när den nuvarande slutar.|Den nye perioden starter når den nåværende slutter.|La nouvelle période commence à la fin de l'actuelle.|Der neue Zeitraum beginnt, wenn der aktuelle endet.
The new period starts today.|Den nye periode starter i dag.|Den nya perioden börjar i dag.|Den nye perioden starter i dag.|La nouvelle période commence aujourd'hui.|Der neue Zeitraum beginnt heute.
Your membership is set to end. Renewing keeps it going.|Dit medlemskab er sat til at ophøre. Fornyer du, fortsætter det.|Ditt medlemskap är inställt på att upphöra. Förnyar du fortsätter det.|Medlemskapet ditt er satt til å opphøre. Fornyer du, fortsetter det.|Votre adhésion doit prendre fin. La renouveler la prolonge.|Ihre Mitgliedschaft ist zum Ende vorgemerkt. Eine Verlängerung setzt sie fort.
You're paid up for now — renewal opens a month before your membership ends.|Du har betalt for nu — fornyelse åbner en måned før dit medlemskab udløber.|Du har betalt för nu — förnyelse öppnar en månad innan ditt medlemskap går ut.|Du har betalt for nå — fornyelse åpner en måned før medlemskapet ditt utløper.|Vous êtes à jour — le renouvellement ouvre un mois avant la fin de votre adhésion.|Sie sind vorerst bezahlt — die Verlängerung ist ab einem Monat vor Ablauf möglich.
Online renewal isn't available right now — please contact the salon.|Online fornyelse er ikke tilgængelig lige nu — kontakt venligst salonen.|Förnyelse online är inte tillgänglig just nu — kontakta salongen.|Fornyelse på nett er ikke tilgjengelig akkurat nå — kontakt salongen.|Le renouvellement en ligne n'est pas disponible pour le moment — veuillez contacter le salon.|Die Online-Verlängerung ist derzeit nicht verfügbar — bitte kontaktieren Sie den Salon.
Renew for {price}|Forny for {price}|Förnya för {price}|Forny for {price}|Renouveler pour {price}|Für {price} verlängern
See all membership plans|Se alle medlemskaber|Se alla medlemskap|Se alle medlemskap|Voir toutes les formules|Alle Mitgliedschaften ansehen
Full name is required.|Fulde navn er påkrævet.|Fullständigt namn krävs.|Fullt navn er påkrevd.|Le nom complet est obligatoire.|Der vollständige Name ist erforderlich.
Email is required.|E-mail er påkrævet.|E-post krävs.|E-post er påkrevd.|L'adresse e-mail est obligatoire.|Die E-Mail-Adresse ist erforderlich.
Please enter a valid email address.|Indtast en gyldig e-mailadresse.|Ange en giltig e-postadress.|Skriv inn en gyldig e-postadresse.|Veuillez saisir une adresse e-mail valide.|Bitte geben Sie eine gültige E-Mail-Adresse ein.
Address line 1 is required.|Adresselinje 1 er påkrævet.|Adressrad 1 krävs.|Adresselinje 1 er påkrevd.|La ligne d'adresse 1 est obligatoire.|Adresszeile 1 ist erforderlich.
City is required.|By er påkrævet.|Ort krävs.|By er påkrevd.|La ville est obligatoire.|Die Stadt ist erforderlich.
Place order · {amount}|Afgiv ordre · {amount}|Lägg order · {amount}|Legg inn bestilling · {amount}|Passer la commande · {amount}|Bestellung aufgeben · {amount}
Pay {amount}|Betal {amount}|Betala {amount}|Betal {amount}|Payer {amount}|{amount} bezahlen
Placing order…|Afgiver ordre…|Lägger order…|Legger inn bestilling…|Commande en cours…|Bestellung wird aufgegeben…
You'll be taken to Stripe to pay securely.|Du sendes videre til Stripe for at betale sikkert.|Du skickas vidare till Stripe för att betala säkert.|Du sendes videre til Stripe for å betale trygt.|Vous serez redirigé vers Stripe pour payer en toute sécurité.|Sie werden zu Stripe weitergeleitet, um sicher zu bezahlen.
No card is charged online — your order is placed right away.|Der trækkes ikke noget kort online — din ordre afgives med det samme.|Inget kort debiteras online — din order läggs direkt.|Ingen kort belastes på nett — bestillingen din legges inn med en gang.|Aucune carte n'est débitée en ligne — votre commande est passée immédiatement.|Es wird online keine Karte belastet — Ihre Bestellung wird sofort aufgegeben.
We'll send your order confirmation here.|Vi sender din ordrebekræftelse hertil.|Vi skickar din orderbekräftelse hit.|Vi sender ordrebekreftelsen din hit.|Nous vous enverrons la confirmation de commande ici.|Wir senden Ihre Bestellbestätigung an diese Adresse.
Delivery|Levering|Leverans|Levering|Livraison|Lieferung
Ship to me|Send til mig|Skicka till mig|Send til meg|Livrer chez moi|An mich senden
Delivered to the address below|Leveres til adressen nedenfor|Levereras till adressen nedan|Leveres til adressen nedenfor|Livré à l'adresse ci-dessous|Lieferung an die Adresse unten
Collect in salon|Afhent i salonen|Hämta i salongen|Hent i salongen|Retrait au salon|Abholung im Salon
Pick up at {address}|Afhent på {address}|Hämta på {address}|Hent på {address}|Retrait à {address}|Abholung bei {address}
Pick up your order at the salon|Afhent din ordre i salonen|Hämta din order i salongen|Hent bestillingen din i salongen|Retirez votre commande au salon|Holen Sie Ihre Bestellung im Salon ab
Edit cart|Rediger kurv|Redigera varukorg|Rediger handlekurv|Modifier le panier|Warenkorb bearbeiten
Please fix the highlighted fields.|Ret venligst de markerede felter.|Rätta de markerade fälten.|Rett de markerte feltene.|Veuillez corriger les champs signalés.|Bitte korrigieren Sie die markierten Felder.
By placing your order you agree to the salon's policies.|Ved at afgive din ordre accepterer du salonens politikker.|Genom att lägga din order godkänner du salongens villkor.|Ved å legge inn bestillingen godtar du salongens retningslinjer.|En passant commande, vous acceptez les conditions du salon.|Mit Ihrer Bestellung akzeptieren Sie die Richtlinien des Salons.
Thanks, {name}! Your order number is|Tak, {name}! Dit ordrenummer er|Tack, {name}! Ditt ordernummer är|Takk, {name}! Bestillingsnummeret ditt er|Merci, {name} ! Votre numéro de commande est|Danke, {name}! Ihre Bestellnummer lautet
You'll collect this order at the salon.|Du afhenter denne ordre i salonen.|Du hämtar den här ordern i salongen.|Du henter denne bestillingen i salongen.|Vous retirerez cette commande au salon.|Sie holen diese Bestellung im Salon ab.
Processing…|Behandler…|Behandlar…|Behandler…|Traitement…|Wird verarbeitet…
Pay for your order|Betal for din ordre|Betala din beställning|Betal for bestillingen|Payer votre commande|Bestellung bezahlen
The payment form couldn't be loaded. Check your connection and try again.|Betalingsformularen kunne ikke indlæses. Tjek din forbindelse, og prøv igen.|Betalningsformuläret kunde inte laddas. Kontrollera anslutningen och försök igen.|Betalingsskjemaet kunne ikke lastes. Sjekk tilkoblingen og prøv igjen.|Le formulaire de paiement n'a pas pu être chargé. Vérifiez votre connexion et réessayez.|Das Zahlungsformular konnte nicht geladen werden. Prüfen Sie Ihre Verbindung und versuchen Sie es erneut.
Card payment|Kortbetaling|Kortbetalning|Kortbetaling|Paiement par carte|Kartenzahlung
Card reader|Kortlæser|Kortläsare|Kortleser|Terminal de paiement|Kartenlesegerät
Card readers|Kortlæsere|Kortläsare|Kortlesere|Terminaux de paiement|Kartenlesegeräte
Card form on this screen|Kortformular på denne skærm|Kortformulär på den här skärmen|Kortskjema på denne skjermen|Formulaire de carte sur cet écran|Kartenformular auf diesem Bildschirm
Take the card payment on|Tag kortbetalingen på|Ta kortbetalningen på|Ta kortbetalingen på|Encaisser la carte sur|Kartenzahlung annehmen auf
Ask the customer to tap, insert or swipe their card on {reader}|Bed kunden om at holde, indsætte eller swipe kortet på {reader}|Be kunden att blippa, sätta in eller dra kortet på {reader}|Be kunden om å holde, sette inn eller dra kortet på {reader}|Demandez au client de présenter, insérer ou glisser sa carte sur {reader}|Bitten Sie den Kunden, die Karte an {reader} vorzuhalten, einzustecken oder durchzuziehen
the reader|kortlæseren|kortläsaren|kortleseren|le terminal|dem Lesegerät
Payment canceled|Betaling annulleret|Betalningen avbröts|Betaling avbrutt|Paiement annulé|Zahlung abgebrochen
Test mode: tap a test card|Testtilstand: hold et testkort|Testläge: blippa ett testkort|Testmodus: hold et testkort|Mode test : présenter une carte de test|Testmodus: Testkarte vorhalten
Check status|Tjek status|Kontrollera status|Sjekk status|Vérifier le statut|Status prüfen
Cancel payment|Annuller betaling|Avbryt betalning|Avbryt betaling|Annuler le paiement|Zahlung abbrechen
offline|offline|offline|frakoblet|hors ligne|offline
Card payment received.|Kortbetaling modtaget.|Kortbetalning mottagen.|Kortbetaling mottatt.|Paiement par carte reçu.|Kartenzahlung erhalten.
Card payment was not completed.|Kortbetalingen blev ikke gennemført.|Kortbetalningen slutfördes inte.|Kortbetalingen ble ikke fullført.|Le paiement par carte n'a pas abouti.|Die Kartenzahlung wurde nicht abgeschlossen.
Payouts|Udbetalinger|Utbetalningar|Utbetalinger|Virements|Auszahlungen
Payments & disputes|Betalinger og indsigelser|Betalningar och tvister|Betalinger og tvister|Paiements et litiges|Zahlungen und Streitfälle
Transactions|Transaktioner|Transaktioner|Transaksjoner|Transactions|Transaktionen
Refund to card|Refunder til kort|Återbetala till kort|Refunder til kort|Rembourser sur la carte|Auf Karte erstatten
Refund sent to the customer’s card.|Refusion sendt til kundens kort.|Återbetalning skickad till kundens kort.|Refusjon sendt til kundens kort.|Remboursement envoyé sur la carte du client.|Erstattung an die Karte des Kunden gesendet.
Stripe checkout page|Stripes betalingsside|Stripes kassasida|Stripes betalingsside|Page de paiement Stripe|Stripe-Bezahlseite
Stripe form on your page|Stripe-formular på din side|Stripe-formulär på din sida|Stripe-skjema på siden din|Formulaire Stripe sur votre page|Stripe-Formular auf Ihrer Seite
Your branded payment form|Din egen betalingsformular|Ditt eget betalningsformulär|Ditt eget betalingsskjema|Votre formulaire de paiement personnalisé|Ihr eigenes Zahlungsformular
How customers pay|Sådan betaler kunderne|Så betalar kunderna|Slik betaler kundene|Mode de paiement des clients|So zahlen Kunden
Set up payments|Opsæt betalinger|Konfigurera betalningar|Konfigurer betalinger|Configurer les paiements|Zahlungen einrichten
Add reader|Tilføj kortlæser|Lägg till kortläsare|Legg til kortleser|Ajouter un terminal|Lesegerät hinzufügen
Remove reader|Fjern kortlæser|Ta bort kortläsare|Fjern kortleser|Retirer le terminal|Lesegerät entfernen
Registration code|Registreringskode|Registreringskod|Registreringskode|Code d'enregistrement|Registrierungscode
Shipping method|Forsendelsesmetode|Fraktsätt|Fraktmetode|Mode de livraison|Versandart
Home delivery|Levering til døren|Hemleverans|Levering hjem|Livraison à domicile|Lieferung nach Hause
Pickup point|Pakkeshop|Utlämningsställe|Hentested|Point relais|Abholstation
Business address|Erhvervsadresse|Företagsadress|Bedriftsadresse|Adresse professionnelle|Geschäftsadresse
Enter your address|Indtast din adresse|Ange din adress|Skriv inn adressen din|Saisissez votre adresse|Adresse eingeben
Enter your address to see the shipping options|Indtast din adresse for at se forsendelsesmulighederne|Ange din adress för att se fraktalternativen|Skriv inn adressen din for å se fraktalternativene|Saisissez votre adresse pour voir les options de livraison|Geben Sie Ihre Adresse ein, um die Versandoptionen zu sehen
Choose a shipping method.|Vælg en forsendelsesmetode.|Välj ett fraktsätt.|Velg en fraktmetode.|Choisissez un mode de livraison.|Wählen Sie eine Versandart.
Shipping options are still loading.|Forsendelsesmulighederne indlæses stadig.|Fraktalternativen laddas fortfarande.|Fraktalternativene lastes fortsatt.|Les options de livraison sont en cours de chargement.|Die Versandoptionen werden noch geladen.
Finding shipping options…|Finder forsendelsesmuligheder…|Söker fraktalternativ…|Finner fraktalternativer…|Recherche des options de livraison…|Versandoptionen werden gesucht…
We don't ship to {country} yet. Choose Collect in salon instead.|Vi sender endnu ikke til {country}. Vælg Afhent i salonen i stedet.|Vi skickar inte till {country} ännu. Välj Hämta i salongen i stället.|Vi sender ikke til {country} ennå. Velg Hent i salongen i stedet.|Nous ne livrons pas encore en {country}. Choisissez plutôt le retrait au salon.|Wir liefern noch nicht nach {country}. Wählen Sie stattdessen Abholung im Salon.
We couldn't load the shipping options. Shipping is added when you pay.|Vi kunne ikke indlæse forsendelsesmulighederne. Forsendelse lægges til, når du betaler.|Vi kunde inte ladda fraktalternativen. Frakt läggs till när du betalar.|Vi kunne ikke laste fraktalternativene. Frakt legges til når du betaler.|Impossible de charger les options de livraison. La livraison est ajoutée au paiement.|Die Versandoptionen konnten nicht geladen werden. Der Versand wird beim Bezahlen hinzugefügt.
Shipping is free on this order.|Forsendelse er gratis på denne ordre.|Frakten är gratis för den här beställningen.|Frakt er gratis på denne bestillingen.|La livraison est gratuite pour cette commande.|Der Versand ist für diese Bestellung kostenlos.
{min}–{max} business days|{min}–{max} hverdage|{min}–{max} arbetsdagar|{min}–{max} virkedager|{min} à {max} jours ouvrés|{min}–{max} Werktage
{days} business days|{days} hverdage|{days} arbetsdagar|{days} virkedager|{days} jours ouvrés|{days} Werktage
By placing your order you agree to the salon's refund and sales policies.|Ved at afgive din ordre accepterer du salonens refusions- og salgspolitik.|Genom att lägga din beställning godkänner du salongens återbetalnings- och försäljningspolicy.|Ved å legge inn bestillingen godtar du salongens refusjons- og salgsvilkår.|En passant commande, vous acceptez les politiques de remboursement et de vente du salon.|Mit Ihrer Bestellung akzeptieren Sie die Rückerstattungs- und Verkaufsrichtlinien des Salons.
By placing your order you agree to the salon's {policies}.|Ved at afgive din ordre accepterer du salonens {policies}.|Genom att lägga din beställning godkänner du salongens {policies}.|Ved å legge inn bestillingen godtar du salongens {policies}.|En passant commande, vous acceptez les {policies} du salon.|Mit Ihrer Bestellung akzeptieren Sie die {policies} des Salons.
and|og|och|og|et|und
Shipping methods|Forsendelsesmetoder|Fraktsätt|Fraktmetoder|Modes de livraison|Versandarten
Request payment|Anmod om betaling|Begär betalning|Be om betaling|Demander un paiement|Zahlung anfordern
Send {name} a secure link to pay for this appointment.|Send {name} et sikkert link til at betale for denne aftale.|Skicka {name} en säker länk för att betala för den här bokningen.|Send {name} en sikker lenke for å betale for denne avtalen.|Envoyez à {name} un lien sécurisé pour payer ce rendez-vous.|Senden Sie {name} einen sicheren Link zur Bezahlung dieses Termins.
Email the link to {email}|Send linket til {email}|Skicka länken till {email}|Send lenken til {email}|Envoyer le lien à {email}|Link an {email} senden
No email on this booking — copy the link and send it yourself.|Ingen e-mail på denne booking — kopiér linket og send det selv.|Ingen e-post på den här bokningen — kopiera länken och skicka den själv.|Ingen e-post på denne bestillingen — kopier lenken og send den selv.|Aucun e-mail sur cette réservation — copiez le lien et envoyez-le vous-même.|Keine E-Mail bei dieser Buchung — kopieren Sie den Link und senden Sie ihn selbst.
Create payment link|Opret betalingslink|Skapa betalningslänk|Opprett betalingslenke|Créer un lien de paiement|Zahlungslink erstellen
Creating…|Opretter…|Skapar…|Oppretter…|Création…|Wird erstellt…
Payment link created.|Betalingslink oprettet.|Betalningslänk skapad.|Betalingslenke opprettet.|Lien de paiement créé.|Zahlungslink erstellt.
Payment link emailed to {email}.|Betalingslink sendt til {email}.|Betalningslänk skickad till {email}.|Betalingslenke sendt til {email}.|Lien de paiement envoyé à {email}.|Zahlungslink an {email} gesendet.
The link stays open for 24 hours. Create a new one any time.|Linket er åbent i 24 timer. Opret et nyt når som helst.|Länken är öppen i 24 timmar. Skapa en ny när som helst.|Lenken er åpen i 24 timer. Opprett en ny når som helst.|Le lien reste ouvert 24 heures. Vous pouvez en créer un nouveau à tout moment.|Der Link ist 24 Stunden gültig. Sie können jederzeit einen neuen erstellen.
Enter an amount greater than zero.|Angiv et beløb større end nul.|Ange ett belopp större än noll.|Angi et beløp større enn null.|Saisissez un montant supérieur à zéro.|Geben Sie einen Betrag größer als null ein.
Could not create the payment link.|Betalingslinket kunne ikke oprettes.|Det gick inte att skapa betalningslänken.|Kunne ikke opprette betalingslenken.|Impossible de créer le lien de paiement.|Der Zahlungslink konnte nicht erstellt werden.
Could not copy — select the link and copy it by hand.|Kunne ikke kopiere — markér linket og kopiér det manuelt.|Det gick inte att kopiera — markera länken och kopiera den manuellt.|Kunne ikke kopiere — marker lenken og kopier den manuelt.|Copie impossible — sélectionnez le lien et copiez-le manuellement.|Kopieren nicht möglich — markieren Sie den Link und kopieren Sie ihn manuell.
Request payment (no-show)|Anmod om betaling (udeblevet)|Begär betalning (utebliven)|Be om betaling (ikke møtt)|Demander un paiement (absent)|Zahlung anfordern (nicht erschienen)
Refund payment|Refunder betaling|Återbetala betalning|Refunder betaling|Rembourser le paiement|Zahlung erstatten
Send the card payment from {name}'s appointment back to them. Leave the amount empty to refund everything.|Send kortbetalingen fra {name}s aftale tilbage. Lad beløbet stå tomt for at refundere det hele.|Skicka tillbaka kortbetalningen från {name}s bokning. Lämna beloppet tomt för att återbetala allt.|Send kortbetalingen fra {name}s avtale tilbake. La beløpet stå tomt for å refundere alt.|Renvoyez le paiement par carte du rendez-vous de {name}. Laissez le montant vide pour tout rembourser.|Erstatten Sie die Kartenzahlung für den Termin von {name}. Lassen Sie den Betrag leer, um alles zu erstatten.
Not now|Ikke nu|Inte nu|Ikke nå|Pas maintenant|Nicht jetzt
Refunding…|Refunderer…|Återbetalar…|Refunderer…|Remboursement…|Wird erstattet…
Could not refund this payment.|Betalingen kunne ikke refunderes.|Det gick inte att återbetala betalningen.|Betalingen kunne ikke refunderes.|Impossible de rembourser ce paiement.|Die Zahlung konnte nicht erstattet werden.
No-show fee|Gebyr ved udeblivelse|Avgift vid uteblivande|Gebyr ved uteblivelse|Frais d'absence|Gebühr bei Nichterscheinen
What to charge a customer who does not show up. After you mark a no-show you can send them a payment link for this amount. Appointments already paid online keep their payment.|Hvad en kunde, der ikke møder op, skal betale. Når du har markeret en udeblivelse, kan du sende et betalingslink på beløbet. Aftaler, der allerede er betalt online, beholder betalingen.|Vad en kund som inte dyker upp ska betala. När du markerat ett uteblivande kan du skicka en betalningslänk på beloppet. Bokningar som redan betalats online behåller betalningen.|Hva en kunde som ikke møter opp skal betale. Når du har markert en uteblivelse, kan du sende en betalingslenke på beløpet. Avtaler som allerede er betalt på nett beholder betalingen.|Ce que paie un client qui ne se présente pas. Après avoir marqué une absence, vous pouvez lui envoyer un lien de paiement pour ce montant. Les rendez-vous déjà payés en ligne conservent leur paiement.|Was ein nicht erschienener Kunde zahlt. Nach dem Markieren können Sie einen Zahlungslink über diesen Betrag senden. Online bereits bezahlte Termine behalten ihre Zahlung.
No fee|Intet gebyr|Ingen avgift|Ingen gebyr|Aucuns frais|Keine Gebühr
Percentage of the service price|Procent af servicens pris|Procent av tjänstens pris|Prosent av tjenestens pris|Pourcentage du prix du service|Prozent des Leistungspreises
Fixed amount|Fast beløb|Fast belopp|Fast beløp|Montant fixe|Fester Betrag
per no-show|pr. udeblivelse|per uteblivande|per uteblivelse|par absence|pro Nichterscheinen
Your no-show fee for this service.|Dit gebyr ved udeblivelse for denne service.|Din avgift vid uteblivande för den här tjänsten.|Ditt gebyr ved uteblivelse for denne tjenesten.|Vos frais d'absence pour ce service.|Ihre Gebühr bei Nichterscheinen für diese Leistung.
If you miss this appointment without cancelling, the salon may charge a no-show fee of {fee}.|Hvis du ikke møder op til denne aftale uden at aflyse, kan salonen opkræve et gebyr på {fee}.|Om du inte dyker upp till den här bokningen utan att avboka kan salongen ta ut en avgift på {fee}.|Hvis du ikke møter opp til denne avtalen uten å avbestille, kan salongen kreve et gebyr på {fee}.|Si vous manquez ce rendez-vous sans l'annuler, le salon peut facturer des frais d'absence de {fee}.|Wenn Sie diesen Termin ohne Absage versäumen, kann der Salon eine Gebühr von {fee} berechnen.
All stylists|Alle stylister|Alla stylister|Alle stylister|Tous les stylistes|Alle Stylisten
Calendar view|Kalendervisning|Kalendervy|Kalendervisning|Vue du calendrier|Kalenderansicht
Change colour|Skift farve|Byt färg|Bytt farge|Changer la couleur|Farbe ändern
Pick a colour|Vælg en farve|Välj en färg|Velg en farge|Choisir une couleur|Farbe wählen
Show {name}|Vis {name}|Visa {name}|Vis {name}|Afficher {name}|{name} anzeigen
Hide {name}|Skjul {name}|Dölj {name}|Skjul {name}|Masquer {name}|{name} ausblenden
Show cancelled|Vis aflyste|Visa avbokade|Vis avlyste|Afficher les annulés|Stornierte anzeigen
Not working|Arbejder ikke|Arbetar inte|Jobber ikke|Ne travaille pas|Arbeitet nicht
Drag to move|Træk for at flytte|Dra för att flytta|Dra for å flytte|Glisser pour déplacer|Zum Verschieben ziehen
Move {name} to {where}?|Flyt {name} til {where}?|Flytta {name} till {where}?|Flytt {name} til {where}?|Déplacer {name} vers {where} ?|{name} nach {where} verschieben?
Could not move the appointment.|Aftalen kunne ikke flyttes.|Det gick inte att flytta bokningen.|Avtalen kunne ikke flyttes.|Impossible de déplacer le rendez-vous.|Der Termin konnte nicht verschoben werden.
+{n} more|+{n} flere|+{n} till|+{n} til|+{n} de plus|+{n} weitere
Appointment moved.|Aftalen er flyttet.|Bokningen har flyttats.|Avtalen er flyttet.|Rendez-vous déplacé.|Termin verschoben.
`.trim().split("\n").filter((row) => row.trim()).map((row) => row.split("|"));

export const messages: Record<string, Record<Exclude<Language, "en">, string>> = Object.fromEntries(
  rows.map(([en, da, sv, nb, fr, de]) => [en, { da, sv, nb, fr, de }]),
);

export const normalizedMessages = Object.fromEntries(Object.entries(messages).map(([key, value]) => [key.toLowerCase(), value]));
