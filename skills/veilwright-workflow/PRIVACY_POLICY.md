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

**`site_inventory({ urls, siteId })` kapselt diesen Schritt jetzt** (veilwright-ai v0.38.0) — liefert `externalHosts` (Ressource/Link getrennt), `frontendPlugins`, `iframes`, `forms` (inkl. `hasFileUpload`), `localFonts`, `commentsEnabled` in einem Aufruf. Analysiert die echte ausgelieferte Seite (`wp_remote_get`), nicht `post_content` — auf einer Elementor-Seite ist `post_content` oft leer/ein Platzhalter, während echte Einbettungen (Maps-Iframe, YouTube, Script) nur im gerenderten HTML sichtbar sind. `urls` selbst auswählen (über `page_list` oder eigene Kenntnis der Seite) — das Tool rät nicht aus Slugs wie "kontakt"/"anfahrt", das wäre auf einem echten Teil der Seiten falsch. Mindestens abrufen: Startseite, Kontaktseite, eine Inhaltsseite, die Anfahrts-/Standortseite, jede Seite mit einem Formular. Nur was im Frontend tatsächlich ausgeliefert wird, ist datenschutzrelevant.

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
- **Fließtext über Kit-Global-Referenzen (`__globals__`), Überschriften auf einer solchen Seite bewusst NICHT zwingend** — siehe §5.2, echter Grund dort.
- **Keine zusätzliche Breitenbegrenzung im inneren Container.** Ist der äußere Container `content_width: "boxed"`, begrenzt bereits das Kit die Inhaltsbreite — ein zusätzlicher innerer Container mit fester Pixelbreite erzeugt eine zweite, konkurrierende Begrenzung, die im Editor schwer nachvollziehbar ist und beim Ändern der Kit-Breite nicht mitwandert. Innere Container auf `100%`.
- Seite auf `noindex, follow` setzen (SEO-Plugin, siehe `SKILL.md` Abschnitt 5c).

### 5.1 Eine bestehende Erklärung ersetzen, nicht verdoppeln

Eine Datenschutzerklärung ist fast immer eine **Ersetzung** einer bestehenden Seite, kein Neuanlegen. **`page_replaceElementorData({ id, elements })` existiert jetzt** (veilwright-ai v0.38.0) — ersetzt den kompletten Elementor-Baum einer Seite atomar in einem Aufruf, das ist der Standardweg. `page_deleteElementorElement({ id, elementId })` bleibt daneben sinnvoll, wenn wirklich nur einzelne Elemente entfernt werden sollen statt der ganzen Seite — `elementId` kann seit v0.39.0 auch ein Array sein, um mehrere Elemente in einem Aufruf/einem Write zu entfernen (z. B. eine überholte Überschrift plus ihr Textblock) — inkl. automatischem Backup vor dem Löschen und optionalem `dryRun`. **Vor dem Ersetzen/Löschen immer `page_backup` aufrufen** — beide sind echte, sofortige Schreiboperationen ohne eingebautes Undo. Die `backupId` aus der `page_backup`-Antwort dem Nutzer mitteilen (`page_listBackups` wurde live getestet und funktioniert inzwischen korrekt, ein früher gemeldetes Problem damit reproduziert nicht mehr — trotzdem die `backupId` direkt notieren, nicht erst später nachschlagen).

Für `page_update` gilt weiterhin: schreibt nur `post_content`, kein Zugriff auf Elementor-Daten — nicht für diesen Zweck verwenden.

### 5.2 Zurückhaltende Überschriften, Navigator-Titel, echtes Inhaltsverzeichnis-Widget — real verifiziert (Metall-Service-Dreher, 2026-08-17)

Der Seitenbetreiber hat die von diesem Skill erzeugte Datenschutzerklärung anschließend selbst optisch überarbeitet, mit der Begründung: „für so eine rechtlich relevante Seite müssen die Überschriften nicht so plakativ groß sein wie auf den Marketing-Seiten". Live gegen die reale `_elementor_data` geprüft (nicht nur den Screenshot geglaubt) — drei konkrete, wiederverwendbare Techniken:

1. **Visuelle Größe und semantische Ebene sind getrennte Entscheidungen — die Überschrift bleibt ein echtes `<h2>`, nur ihre Typografie wird eigens für diese Seite überschrieben.** Jeder Abschnitts-Heading-Widget lässt `header_size` unverändert (Elementor-Default `h2`, semantisch korrekt für SEO/Screenreader/Inhaltsverzeichnis) — aber `__globals__.typography_typography` wird explizit auf `""` gesetzt (vom Kit-Global gelöst) und stattdessen `typography_typography: "custom"` mit eigenen Werten gesetzt: kleinere Schrift (`24px` Desktop, tatsächlich **größer** bei `27px` auf `typography_font_size_mobile` — nicht überall kleiner, sondern dort größer wo eine kondensierte Groß­buchstaben-Schrift auf kleinem Screen sonst zu klein wirkt), `font_weight: "500"`, `text_transform: "uppercase"`, `word_spacing: 3px`, `line_height: 1.16em`, gedeckte Textfarbe (`#141817`, Anthrazit) statt der sonst auf der Seite verwendeten Akzentfarbe. Ergebnis: liest sich eher wie ein kleines, seriöses Eyebrow-Label als wie eine große Marketing-Überschrift — **ohne** die Überschriftenhierarchie zu verletzen (kein Downgrade auf `div`/`h3`/Fließtext, was Inhaltsverzeichnis und Screenreader-Navigation kaputt gemacht hätte). Fließtext (`text-editor`-Widgets) blieb dabei unverändert auf dem gemeinsamen Kit-Global — nur die Überschriften wurden angefasst, nicht die ganze Seite neu gestylt.
2. **Jeder Abschnitts-Container bekommt `_title` gleich dem Abschnittsnamen** (z. B. `"_title": "Begriffsbestimmungen"`, `"_title": "Verantwortlicher"`) — rein kosmetisch für Elementors eigenes Navigator-Panel im Editor, hat keine Frontend-Wirkung, macht aber eine lange Seite mit vielen gleich aussehenden Containern im Editor tatsächlich navigierbar, ohne jeden einzelnen aufklappen zu müssen. Bei jeder Seite mit vielen strukturell ähnlichen Abschnitten (nicht nur Datenschutzerklärungen) sinnvoll.
3. **Reales Inhaltsverzeichnis-Widget bestätigt die schon bestehende Empfehlung aus §3.1 oben** (`headings_by_tags: ["h2", "h3"]`) — platziert direkt im Hero, rechts neben Titel/Intro-Text (55%/40%-Spaltenaufteilung, `content_width: "full"` auf beiden, kollabiert auf Tablet zu je `100%` — Standardmuster, siehe `SKILL.md`s Multi-column-row-Abschnitt), nicht irgendwo unten auf der Seite versteckt. Weitere real bestätigte Einstellungen über das bereits in `ELEMENTOR_WIDGETS.md` dokumentierte Minimalbeispiel hinaus: `collapse_subitems: "yes"` (Unterpunkte einklappbar), `word_wrap: "ellipsis"`, alle Farben (`border_color`, `header_text_color`, `toggle_button_color`, `item_text_color_normal`, `marker_color`) als Kit-Global-Referenzen statt Einzelwerte, eigene `list_typography_*`. `ELEMENTOR_WIDGETS.md` entsprechend ergänzt.

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
8. Die Seite enthält jeden Abschnitt **genau einmal** — bei einer bestehenden Seite ist die Vorfassung über `page_replaceElementorData` echt ersetzt (§5.1), nicht stillschweigend darunter stehen geblieben.

Kriterium 1 und 7 sind die eigentlichen: ein Generator, der alles aufnimmt, ist wertlos, weil niemand mehr prüfen kann, was stimmt. Kriterium 8 ist der Praxistest, an dem ein früherer Durchlauf im Referenzprojekt tatsächlich gescheitert ist.

## Frühere Empfehlungen an die Plugin-Entwicklung — alle erledigt (veilwright-ai v0.38.0, 2026-08-17)

Alle vier ursprünglich hier offenen Punkte sind geschlossen:

1. ~~`site_inventory(siteId)`~~ — **erledigt**, siehe §1 oben.
2. ~~`page_replaceElementorData(siteId, id, elements)`~~ — **erledigt**, siehe §5.1 oben.
3. ~~`page_deleteElementorElement(siteId, id, elementId)`~~ — **erledigt** (v0.37.0).
4. ~~`page_listBackups` reparieren~~ — **live getestet, reproduziert nicht mehr** (`page_backup` gefolgt von `page_listBackups` auf derselben Seite liefert das gerade erstellte Backup korrekt zurück). Kein Code geändert, da kein reproduzierbarer Fehler mehr vorlag — nicht auf Verdacht "repariert".
