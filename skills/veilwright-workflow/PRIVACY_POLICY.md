# Datenschutzerklärung erzeugen — Referenz für `PRIVACY_POLICY.md`

Für Anfragen wie „baue eine Datenschutzerklärung", „aktualisiere die Datenschutzerklärung", oder als Folgeschritt, wenn ein neues Formular/Plugin/eine neue Einbettung hinzugefügt wurde, die die bestehende Erklärung nicht mehr abdeckt.

**Grundprinzip, nicht verhandelbar: keine Vorlage ausrollen.** Eine kopierte Standard-Datenschutzerklärung erzeugt in der Praxis zwei teure Fehlerklassen — Abschnitte zu Diensten, die die Seite gar nicht einsetzt (dokumentiert Falsches, untergräbt die Glaubwürdigkeit der ganzen Erklärung), und fehlende Abschnitte zu Dingen, die tatsächlich laufen. Jede Abschnittsauswahl muss aus dem echten technischen Befund der jeweiligen Seite abgeleitet werden — Grundlage dieser Datei: Praxiseinsatz Metall-Service-Dreher (08/2026), Abgleich von sechs produktiven Datenschutzerklärungen aus dem Agentur-Bestand desselben Projekts.

## Ablauf

```
1. Inventar erheben      → was tut die Seite technisch wirklich?
2. Stammdaten sammeln    → wer ist verantwortlich?
3. Module auswählen      → Trigger-Matrix auf Inventar anwenden
4. Lücken markieren      → was kann niemand automatisch wissen?
5. Seite bauen           → Elementor, Widget für Widget
6. Prüfbericht ausgeben  → was wurde erkannt, was fehlt noch
```

Schritt 1 ist der eigentliche Wert — ohne ihn ist das nur ein Textbaustein-Dumper.

## 1. Inventar erheben

**Es gibt noch kein `site_inventory`-Tool** — das ist Handarbeit mit Browser-Tools/`WebFetch` gegen die echten ausgelieferten Seiten, nicht das Backend fragen. Nur was im Frontend tatsächlich ausgeliefert wird, ist datenschutzrelevant. Mindestens abrufen: Startseite, Kontaktseite, eine Inhaltsseite, die Anfahrts-/Standortseite, jede Seite mit einem Formular.

### 1.1 Externe Hosts — der wichtigste Einzelbefund

Alle `src=`/`href=` einsammeln, Eigen-Domain abziehen, Rest gruppieren. **Scharf trennen zwischen Ressource und Link** — hier liegen Standardvorlagen am häufigsten falsch:

| Fundstelle | Bedeutung | Folge |
|---|---|---|
| `src=` auf fremde Domain, `<iframe>`, `<script src>`, `<link rel=stylesheet>` | **Einbettung** — Daten fließen beim bloßen Seitenaufruf | Voller Dienst-Abschnitt |
| `href=` auf fremde Domain | **Verlinkung** — Daten fließen erst beim Klick | Kurzer Abschnitt „reine Verlinkung, keine Übertragung beim Seitenaufruf" |
| gar kein Treffer | Dienst nicht vorhanden | **Kein Abschnitt** — nicht „vorsichtshalber" aufnehmen |

Realer Fall, der eine Standardvorlage falsch gemacht hätte: Instagram und Google Maps waren auf der Referenzseite nur **verlinkt**, nicht eingebettet — eine Vorlage hätte dort „Beim Aufruf unserer Seite wird eine Verbindung zu Instagram-Servern hergestellt" behauptet, schlicht falsch, zu Lasten des Kunden. Ebenso ist der Negativbefund aktiv verwertbar: null externe Font-Hosts bedeutet lokale Schriftarten (siehe §3a in `SKILL.md` — hier ohnehin verpflichtend) und ist im Text als Vorteil formulierbar („keine Übermittlung an Google Fonts").

### 1.2 Plugin-Fingerabdrücke

Aus Asset-Pfaden lesen (`wp-content/plugins/<slug>`) — verlässlicher als eine Backend-Pluginliste, weil es nur zeigt, was im Frontend tatsächlich lädt.

| Slug-Muster | Auslöser |
|---|---|
| `fluentform`, `contact-form-7`, `wpforms`, `ninja-forms`, `gravityforms` | Kontaktformular; Datei-Upload gesondert prüfen |
| `cookie-law-info`, `cookiez`, `complianz`, `borlabs-cookie`, `real-cookie-banner` | Einwilligungsverwaltung |
| `woocommerce` | Bestellabwicklung, Zahlungsdienstleister, Kundenkonto |
| `mailchimp*`, `newsletter`, `mailpoet` | Newsletter, Double-Opt-In |
| `google-analytics*`, `matomo`, `ga-google-analytics` | Reichweitenmessung, Einwilligung zwingend |
| `wp-members`, `ultimate-member`, `buddypress` | Registrierung/Mitgliederbereich |
| `google-captcha`, `recaptcha`, `hcaptcha` | Bot-Schutz, Drittlandübermittlung prüfen |
| `wp-google-maps`, `leaflet-map`, `osm*` | Karteneinbettung (≠ Kartenlink, siehe §1.1) |

### 1.3 Weitere Signale

- **`<iframe>` zählen.** Null Iframes ist ein starker Negativbefund: keine Karte, kein YouTube/Vimeo, kein externes Buchungssystem.
- **Formularfelder auslesen.** Ein `input[type=file]` bedeutet Datei-Upload, eigener Absatz — bei einem Bewerbungsformular andere Rechtsgrundlage (§ 26 BDSG) als bei einer Angebotsanfrage (Art. 6 Abs. 1 lit. b DSGVO).
- **Kommentarfunktion** nur aufnehmen, wenn im Frontend tatsächlich ein Kommentarformular ausgegeben wird.
- **Login-/Registrierungsformulare** im Frontend.
- **Custom Post Types mit Stellenanzeigen** → Bewerbungsabschnitt wahrscheinlich nötig (siehe `customPostType_list`/`customPostType_get`, Abschnitt 5j der Haupt-`SKILL.md`).

**An die eigene Site angewendet, konkret:** `page_list`/`page_get` und Browser-Tools (`navigate` + `get_page_text`/`read_page`) für die oben genannten Mindest-Seiten, dazu `elementorTemplate_list`/`elementorTemplate_get` falls Header/Footer eigene Einbettungen tragen (Karten-Widget im Footer ist ein sehr häufiger Fall). Ergebnis vor Schritt 3 kurz zusammenfassen, nicht erst am Ende.

## 2. Stammdaten

Reihenfolge, jeweils gegenprüfen statt raten:

1. **Impressumsseite der Zielsite** — Firmierung, Anschrift, Vertretungsberechtigte, Registergericht und -nummer, USt-IdNr.
2. **Bestehende Datenschutzseite**, falls vorhanden — für bereits gepflegte Angaben.
3. **Site Memory** (`siteMemory_get`) — projektspezifische Festlegungen.
4. **Rückfrage beim Nutzer** für alles Übrige.

**Bei Widersprüchen zwischen Quellen: melden, nicht stillschweigend eine Variante wählen.** Realer Fall: Faxnummer und Instagram-Handle wichen zwischen einer Projektdatei und der Live-Seite voneinander ab — beide Werte nennen und den Nutzer entscheiden lassen, nicht raten welcher aktuell ist.

### 2.1 Zuständige Aufsichtsbehörde — Name stabil, Adresse **nicht** hardcoden

Die zuständige Behörde ergibt sich aus dem Sitz des Verantwortlichen (Bundesland). Die **Namen** der 16 Landesbehörden plus BfDI sind stabil genug für eine Zuordnungstabelle:

| Bundesland | Zuständige Behörde |
|---|---|
| Baden-Württemberg | Der Landesbeauftragte für den Datenschutz und die Informationsfreiheit |
| Bayern | **Bayerisches Landesamt für Datenschutzaufsicht (BayLDA)** für den privaten Bereich (übliche Wahl bei einer normalen Firma/GmbH) — nicht der Bayerische Landesbeauftragte für den Datenschutz, der nur den öffentlichen Bereich abdeckt |
| Berlin | Berliner Beauftragte für Datenschutz und Informationsfreiheit |
| Brandenburg | Die Landesbeauftragte für den Datenschutz und für das Recht auf Akteneinsicht |
| Bremen | Die Landesbeauftragte für Datenschutz und Informationsfreiheit |
| Hamburg | Der Hamburgische Beauftragte für Datenschutz und Informationsfreiheit |
| Hessen | Der Hessische Beauftragte für Datenschutz und Informationsfreiheit |
| Mecklenburg-Vorpommern | Der Landesbeauftragte für Datenschutz und Informationsfreiheit |
| Niedersachsen | Die Landesbeauftragte für den Datenschutz Niedersachsen |
| Nordrhein-Westfalen | Die Landesbeauftragte für Datenschutz und Informationsfreiheit NRW |
| Rheinland-Pfalz | Der Landesbeauftragte für den Datenschutz und die Informationsfreiheit |
| Saarland | Unabhängiges Datenschutzzentrum Saarland |
| Sachsen | Die Sächsische Datenschutzbeauftragte |
| Sachsen-Anhalt | Landesbeauftragter für den Datenschutz Sachsen-Anhalt |
| Schleswig-Holstein | Unabhängiges Landeszentrum für Datenschutz Schleswig-Holstein |
| Thüringen | Thüringer Landesbeauftragter für den Datenschutz und die Informationsfreiheit |
| (Bund, nur falls einschlägig) | Bundesbeauftragte für den Datenschutz und die Informationsfreiheit (BfDI) |

**Postanschrift, Telefon und E-Mail dieser Behörden gehören NICHT in eine statische Tabelle in dieser Datei — bei jedem Einsatz live nachschlagen** (`WebSearch`/`WebFetch` gegen die Übersicht `https://www.bfdi.bund.de/DE/Service/Anschriften/Laender/Laender-node.html` oder die Behörde selbst) und im generierten Text zitieren. Begründung ist kein Vorsichtsprinzip, sondern ein konkret nachgewiesener Fall: **die Adresse „Lautenschlagerstraße 20, 70173 Stuttgart" für den LfDI Baden-Württemberg — genau der Wert, der als Beispiel im ursprünglichen Projekt-Briefing für diese Datei stand — war zum Zeitpunkt der Erstellung dieser Datei bereits veraltet.** Die Behörde ist umgezogen (aktuell, Stand Prüfung 2026-08-13: Heilbronner Straße 35, 70191 Stuttgart) — eine 2021 offiziell verkündete Adresse war schon wieder überholt. Wer diese Tabelle liest: **niemals** eine hier oder anderswo notierte Adresse ungeprüft in eine Datenschutzerklärung schreiben, sondern jedes Mal frisch nachschlagen.

## 3. Modulbibliothek und Trigger-Matrix

Jedes Modul: Auslöser, Überschrift, Textbaustein, Rechtsgrundlage, Pflicht-Platzhalter.

### 3.1 Grundgerüst

Immer gleich, unabhängig vom Befund. Die bedingten Module aus §3.2 werden **als Block zwischen Position 6 und 7** eingefügt — dort stehen alle dienstbezogenen Abschnitte beieinander, davor das Allgemeine, danach die Rechte.

| # | Abschnitt |
|---|---|
| 1 | Einleitung |
| 2 | Begriffsbestimmungen |
| 3 | Name und Anschrift des Verantwortlichen |
| 4 | Hosting und Server-Logfiles |
| 5 | SSL-/TLS-Verschlüsselung |
| 6 | Cookies |
| — | *hier alle bedingten Module aus §3.2* |
| 7 | Empfänger und Auftragsverarbeiter |
| 8 | Routinemäßige Löschung und Sperrung |
| 9 | Rechte der betroffenen Person (a–i) |
| 10 | Beschwerderecht bei einer Aufsichtsbehörde |
| 11 | Rechtsgrundlagen der Verarbeitung |
| 12 | Berechtigte Interessen |
| 13 | Speicherdauer |
| 14 | Gesetzliche oder vertragliche Vorschriften zur Bereitstellung |
| 15 | Automatisierte Entscheidungsfindung |
| 16 | Stand und Aktualität |

Das ist der Agentur-Standard (fünf von sechs untersuchten Referenzseiten nutzen diese Gliederung) — als Default beibehalten, damit der Bestand einheitlich wirkt, sofern der Nutzer nichts anderes vorgibt.

**Keine Nummerierung in den Überschriften-Widgets.** Nummern im Überschriftentext werden beim Einfügen/Umsortieren/Weglassen eines bedingten Moduls sofort falsch und müssen von Hand nachgezogen werden — die Modulauswahl fällt je Seite unterschiedlich aus, eine feste Nummerierung ist hier strukturell fehleranfällig. Eine Gliederungsansicht, falls gewünscht, über ein Inhaltsverzeichnis-Widget, nicht über den Überschriftentext.

### 3.2 Bedingte Module

| Modul | Auslöser aus dem Inventar |
|---|---|
| Datenschutzbeauftragter | immer als Rückfrage an den Nutzer; Abschnitt nur bei Benennung |
| Einwilligungsverwaltung | Consent-Plugin im Frontend |
| Kontaktformular | Formular-Plugin mit Kontaktformular |
| Datei-Uploads (Anfragen) | Formular mit `input[type=file]`, kein Bewerbungsbezug |
| Bewerbungen | Bewerbungsformular oder Stellen-CPT |
| Lokale Schriftarten | keine externen Font-Ressourcen (der erwartete Normalfall, siehe `SKILL.md` §3a) |
| Google Fonts | Font-Ressource von `fonts.googleapis.com` gefunden (sollte laut §3a ohnehin nicht vorkommen — falls doch, das dem Nutzer separat als Befund melden, nicht nur den Datenschutz-Abschnitt schreiben) |
| Karten-Einbettung | Iframe/Script eines Kartendienstes |
| Karten-Verlinkung | nur `href` auf Kartendienst |
| Social-Media-Einbettung | Script/Iframe der Plattform |
| Social-Media-Verlinkung | nur `href` auf Profil |
| Reichweitenmessung | Analytics-Plugin oder -Script |
| Newsletter | Newsletter-Plugin |
| Kundenkonto/Registrierung | Shop- oder Mitglieder-Plugin |
| Bestellabwicklung/Zahlung | WooCommerce oder Zahlungs-Plugin |
| Kommentare | Kommentarformular im Frontend |
| Bot-Schutz (Captcha) | Captcha-Script |
| Drittlandübermittlung | externe Ressource außerhalb EU/EWR |

### 3.3 Textqualität

- **Kein Wortlaut aus fremden Erklärungen übernehmen** — urheberrechtlich geschützt, schleppt fremde Fehler ein. Eigenständig entlang der Gliederung aus §3.1 formulieren.
- Anrede durchgängig „Sie", keine Mischung mit „der Nutzer".
- Jede Verarbeitung bekommt Zweck **und** Rechtsgrundlage — ein Abschnitt ohne Rechtsgrundlage ist unfertig.
- Aktuelle Normbezeichnung: **TDDDG**, nicht mehr TTDSG.
- Bei Verlinkungen ausdrücklich formulieren, dass beim bloßen Seitenaufruf keine Daten fließen — das ist der inhaltliche Unterschied zur Einbettung (§1.1).

## 4. Lücken markieren

Nicht ermittelbar, darf nicht erfunden und nicht verschwiegen werden — sichtbar als Platzhalter setzen:

- Hosting-Anbieter mit Firmierung und Sitz
- Bestehen und Kontaktdaten eines Datenschutzbeauftragten
- Löschfrist der Server-Logfiles
- Löschfrist für Bewerbungsunterlagen
- konkrete Auftragsverarbeiter und Bestätigung vorliegender AV-Verträge
- Standdatum der Veröffentlichung

Platzhalter im Fließtext kursiv in eckigen Klammern (`*[Hosting-Anbieter: Firma, Anschrift]*`); größere offene Punkte als eigenen, farblich abgesetzten Hinweis-Container am Seitenende. Beides muss beim Korrekturlesen ins Auge fallen, nicht im Fließtext untergehen.

## 5. Seitenaufbau

Wie jede Content-Seite (siehe `SKILL.md` Abschnitt 3, „Plain content"-Fall gilt hier explizit **nicht** — eine Datenschutzerklärung braucht trotz reinem Text echtes Layout-Nachdenken):

- Elementor, **Widget für Widget**: `heading` (h2/h3) und `text-editor` im Wechsel. Kein HTML-Dump, kein `page_createFromHtml` mit einem einzigen großen Textblock — die Seite muss für den Kunden bearbeitbar bleiben, siehe die harte Regel in `SKILL.md` Abschnitt 3.
- Typografie über Kit-Global-Referenzen (`__globals__`), nicht über Einzelwerte je Widget.
- **Keine zusätzliche Breitenbegrenzung im inneren Container.** Ist der äußere Container `content_width: "boxed"`, begrenzt bereits das Kit die Inhaltsbreite — ein zusätzlicher innerer Container mit fester Pixelbreite erzeugt eine zweite, konkurrierende Begrenzung, die im Editor schwer nachvollziehbar ist und beim Ändern der Kit-Breite nicht mitwandert. Innere Container auf `100%`.
- Seite auf `noindex, follow` setzen (SEO-Plugin, siehe `SKILL.md` Abschnitt 5c).

### 5.1 Eine bestehende Erklärung ersetzen, nicht verdoppeln

Eine Datenschutzerklärung ist fast immer eine **Ersetzung** einer bestehenden Seite, kein Neuanlegen. **`page_deleteElementorElement({ id, elementId })` existiert jetzt** (veilwright-ai, echtes Löschen inkl. Kindelementen, siehe `SKILL.md`) — der frühere Ausblend-Workaround unten ist damit nicht mehr der richtige Standardweg für diesen Fall. Vorgehen: `page_getElementorData` lesen, die alten Top-Level-Container/-Widgets identifizieren, jedes einzeln mit `page_deleteElementorElement` entfernen, dann die neue Erklärung mit `page_addElementorWidget` aufbauen. **Vor dem Löschen `page_backup` aufrufen** — Löschen ist eine echte, sofortige Schreiboperation ohne eingebautes Undo; `page_listBackups` liefert die `backupId` teils nicht zuverlässig zurück, deshalb die `backupId` aus der `page_backup`-Antwort selbst notieren/dem Nutzer mitteilen, statt sich auf `page_listBackups` zu verlassen.

Für `page_update` gilt weiterhin: schreibt nur `post_content`, kein Zugriff auf Elementor-Daten — nicht für diesen Zweck verwenden.

**Älterer Workaround, nur noch relevant wenn `page_deleteElementorElement` aus irgendeinem Grund nicht genutzt werden kann** (z. B. sehr alte Plugin-Version ohne dieses Tool): den alten Inhalts-Container über `page_updateElementorWidget` auf **allen** Breakpoints ausblenden (`hide_desktop`, `hide_laptop`, `hide_tablet_extra`, `hide_tablet`, `hide_mobile_extra`, `hide_mobile`) und den Elementtitel (`_title`) auf etwas wie „ALT — zum Löschen markiert" setzen. Ausgeblendete Inhalte bleiben aber per `display:none` im DOM — für Screenreader und Suchmaschinen weiterhin vorhanden, kein Ersatz für echtes Löschen. Nur echte Notlösung, kein Standardweg mehr.

## 6. Prüfbericht

Am Ende ausgeben, damit nachvollziehbar ist, worauf die Auswahl beruht:

1. **Erkannt und aufgenommen** — je Modul mit Fundstelle (Beispiel: „Instagram: `href` auf www.instagram.com in Header und Footer, kein Script → Verlinkungs-Modul").
2. **Geprüft und bewusst weggelassen** — mit Begründung (Beispiel: „kein Analytics-Script gefunden, kein Analytics-Plugin im Frontend").
3. **Offene Platzhalter** — als Liste zum Abarbeiten.
4. **Widersprüche** — abweichende Stammdaten zwischen Quellen (§2).
5. **Rechtlicher Hinweis, wortwörtlich in jede Ausgabe, nicht ins Kleingedruckte:** dieser Entwurf ist ein strukturierter Vorschlag auf Basis des technischen Befundes, keine Rechtsberatung — vor Veröffentlichung ist eine juristische Prüfung erforderlich.

## Abnahmekriterien

1. Auf einer Seite ohne Analytics, Karten-Einbettung und Social-Plugins werden keine entsprechenden Abschnitte erzeugt.
2. Ein reiner Profil-Link zu Instagram löst das Verlinkungs-Modul aus, nicht das Einbettungs-Modul.
3. Fehlen externe Font-Ressourcen, wird der Abschnitt „lokale Schriftarten" erzeugt.
4. Ein Formular mit Datei-Upload erhält einen eigenen Absatz, mit unterschiedlicher Rechtsgrundlage für Bewerbung vs. Angebotsanfrage.
5. Die genannte Aufsichtsbehörde passt zum Bundesland des Verantwortlichen — Name aus §2.1, Adresse frisch nachgeschlagen, nicht aus einer Tabelle kopiert.
6. Jeder nicht ermittelbare Wert erscheint als Platzhalter — keiner erfunden.
7. Der Prüfbericht benennt auch die bewusst weggelassenen Module.
8. Die Seite enthält jeden Abschnitt **genau einmal** — bei einer bestehenden Seite ist die Vorfassung ersetzt oder nachweislich ausgeblendet und als zu löschen markiert (§5.1), nicht stillschweigend darunter stehen geblieben.

Kriterium 1 und 7 sind die eigentlichen: ein Generator, der alles aufnimmt, ist wertlos, weil niemand mehr prüfen kann, was stimmt. Kriterium 8 ist der Praxistest, an dem ein früherer Durchlauf im Referenzprojekt tatsächlich gescheitert ist.

## Empfehlungen an die Plugin-Entwicklung (nicht Teil dieses Skills, separat zu priorisieren)

Diese drei würden den Ablauf oben spürbar verbessern, sind aber eigene Engineering-Aufgaben, keine Skill-Doku:

1. `site_inventory(siteId)` — kapselt Schritt 1 serverseitig (externe Hosts nach Ressource/Link getrennt, Frontend-Plugin-Fingerabdrücke, Iframe-Zahl, Formularfelder inkl. Datei-Upload-Erkennung, lokale-Fonts-Flag). Wäre auch außerhalb dieses Skills nützlich (Performance-Audits, Consent-Prüfung, Migrationen).
2. `page_replaceElementorData(siteId, id, elements)` — ersetzt den Elementor-Baum vollständig in einem Aufruf, statt jedes alte Element einzeln über das jetzt vorhandene `page_deleteElementorElement` zu entfernen.
3. ~~`page_deleteElementorElement(siteId, id, elementId)`~~ — **erledigt**, siehe §5.1.
4. `page_listBackups` reparieren — ein Backup, das man nicht wiederfindet, ist keines, und „vor jeder Änderung sichern" wird dadurch zur leeren Geste.

Nicht selbst umsetzen, ohne mit dem Nutzer abgestimmt zu sein — dem Nutzer als konkrete Folge-Tickets vorschlagen, wenn der Kontext passt.
