# Segment Comparator – Technische Spezifikation

## Übersicht

Web-App zum Vergleich von selbst definierten Streckensegmenten über mehrere
Aktivitäten hinweg. Datenbasis ist die intervals.icu API. Segmente werden via
GPS-Koordinaten definiert und als JSON gespeichert/geladen.

---

## Tech Stack

- **Framework:** React 18 + Vite
- **Styling:** Tailwind CSS
- **Karten:** Leaflet + React-Leaflet
- **Charts:** Recharts
- **Datenhaltung:** JSON-Export/Import (kein Backend)
- **API:** intervals.icu REST API v1

---

## Projektstruktur

```
segment-comparator/
├── src/
│   ├── api/
│   │   └── intervals.js        # API-Client
│   ├── components/
│   │   ├── Auth.jsx             # Login-Screen
│   │   ├── ActivityList.jsx     # Aktivitäten durchsuchen
│   │   ├── RouteFilter.jsx      # Route-Dropdown Filter
│   │   ├── MapPicker.jsx        # GPS-Segment definieren
│   │   ├── SegmentList.jsx      # Gespeicherte Segmente
│   │   ├── CompareView.jsx      # Vergleichstabelle + Charts
│   │   └── charts/
│   │       ├── TimelineChart.jsx
│   │       ├── RadarChart.jsx
│   │       └── MetricBar.jsx
│   ├── hooks/
│   │   ├── useIntervals.js      # API-Calls + Caching
│   │   ├── useRoutes.js         # Route-Liste + Dropdown-Daten
│   │   └── useSegments.js       # Segment-Verwaltung
│   ├── utils/
│   │   ├── gps.js               # GPS-Matching Logik
│   │   ├── metrics.js           # Einheiten + Formatierung
│   │   └── storage.js           # JSON Import/Export
│   ├── App.jsx
│   └── main.jsx
├── public/
├── package.json
└── README.md
```

---

## intervals.icu API

### Authentifizierung
```
Basic Auth: API_KEY:{dein-api-key}
Base URL:   https://intervals.icu/api/v1
```

### Verwendete Endpunkte

| Endpunkt | Beschreibung |
|---|---|
| `GET /athlete/{id}/activities` | Aktivitätenliste (enthält `route_id` + `route_name`) |
| `GET /athlete/{id}/activity/{id}` | Aktivitätsdetails |
| `GET /athlete/{id}/activity/{id}/streams` | GPS + Metriken als Zeitreihe |

### Route-ID Filter
Aktivitäten können serverseitig nach Route gefiltert werden:
```
GET /athlete/{id}/activities?route_id=12345
```
Die `route_id` und `route_name` sind in jedem Aktivitätsobjekt enthalten und
werden beim ersten Laden der Aktivitätsliste für das Dropdown gecacht.

### Streams-Parameter
Für den Vergleich relevante Streams:
```
time, latlng, distance, altitude, velocity_smooth,
heartrate, cadence, watts, grade_smooth
```

Aufruf:
```
GET /athlete/{id}/activity/{id}/streams?streams=time,latlng,distance,altitude,velocity_smooth,heartrate,cadence,watts,grade_smooth
```

---

## Kernfunktionen

### 1. Authentifizierung

- Eingabefelder für `Athlete-ID` und `API-Key`
- Credentials werden in `sessionStorage` gespeichert (nicht persistent)
- Verbindungstest beim Login via `/athlete/{id}` Endpunkt
- Keine Credentials in JSON-Exporten

### 2. Segment definieren

**Ablauf:**
1. Benutzer wählt eine Aktivität aus der Liste
2. Die Route wird auf einer Leaflet-Karte dargestellt
3. Benutzer klickt Start-Punkt auf der Route
4. Benutzer klickt End-Punkt auf der Route
5. Segment wird benannt und gespeichert

**GPS-Matching Logik** (`src/utils/gps.js`):
- Für jeden Datenpunkt der Route: Distanz zum gewählten Punkt berechnen
- Nächster Punkt innerhalb Toleranz (default: 25 Meter) = Match
- Funktion: `findClosestPoint(latlng, stream, toleranceMeters = 25)`
- Haversine-Formel für Distanzberechnung

**Segment-Objekt:**
```json
{
  "id": "uuid-v4",
  "name": "Risch Auffahrt",
  "description": "Von Kreuzung bis Bergkuppe",
  "start": { "lat": 47.1234, "lng": 8.5678 },
  "end":   { "lat": 47.1290, "lng": 8.5710 },
  "toleranceMeters": 25,
  "createdAt": "2026-04-16T10:00:00Z",
  "createdFrom": "activity-id-123"
}
```

### 3. Segment-Matching in Aktivitäten

Beim Laden einer Aktivität:
1. GPS-Stream laden
2. Für jedes gespeicherte Segment: Start- und End-Punkt suchen
3. Wenn beide gefunden: Effort extrahieren
4. Metriken für diesen Zeitabschnitt berechnen

**Effort-Objekt:**
```json
{
  "segmentId": "uuid",
  "activityId": "intervals-activity-id",
  "activityName": "Pendeln Rückfahrt",
  "date": "2026-04-08",
  "elapsedTime": 187,
  "distance": 2340,
  "avgWatts": 220,
  "maxWatts": 380,
  "avgHeartrate": 162,
  "maxHeartrate": 178,
  "avgCadence": 84,
  "avgSpeed": 28.5,
  "avgGrade": 2.1,
  "elevationGain": 48,
  "normalizedPower": 235,
  "startIndex": 412,
  "endIndex": 598
}
```

### 4. Aktivitäten durchsuchen

**Filter-Leiste:**
```
[Route: Alle ▼] [Typ: Ride ▼] [Von: Datum] [Bis: Datum] [🔍 Name suchen]
```

**Route-Dropdown:**
- Wird beim ersten Laden dynamisch aus allen Aktivitäten befüllt
- Einträge: Route-Name aus intervals.icu (z.B. "Pendeln Hinfahrt", "Pendeln Rückfahrt")
- Option "Alle Routen" zeigt ungefilterte Liste
- Auswahl einer Route filtert die Aktivitätsliste via `route_id` Parameter
- **Wichtig:** Route-Filter ist unabhängig vom Segment-Matching – ein Segment
  kann in Aktivitäten verschiedener Routen gefunden werden

**Verhalten:**
- Pagination oder Lazy Loading (intervals.icu gibt max. 50 zurück)
- Für jede Aktivität: Welche Segmente wurden gefunden? (Badge-Anzeige)
- Bulk-Analyse: Mehrere Aktivitäten auf einmal nach Segmenten durchsuchen
- Route-Name wird in der Aktivitätsliste als Chip/Tag angezeigt

**Beispiel Use-Case:**
1. Route-Filter "Pendeln Hinfahrt" → nur Hinfahrten laden
2. Segment "Dorfauffahrt" suchen → in Hinfahrten gefunden
3. Route-Filter auf "Pendeln Rückfahrt" wechseln → gleiches Segment,
   andere Route → beide Efforts vergleichbar

### 5. Vergleichsansicht

**Tabelle:**
- Zeilen: Efforts (eine pro Aktivität)
- Spalten: Alle Metriken
- Sortierbar nach jeder Spalte
- Beste Werte farblich hervorheben (grün)
- Schlechteste Werte hervorheben (rot)
- Delta zur besten Zeit anzeigen (+0:12, -0:08)

**Charts:**

*Timeline-Chart:*
- X-Achse: Datum
- Y-Achse: Zeit (primär) + wählbare zweite Metrik
- Ziel-Linie einblendbar (z.B. 45 min für Pendelstrecke)
- Trend-Linie (gleitender Durchschnitt)

*Radar-Chart:*
- Normalisierte Darstellung aller Metriken (0–100)
- Bis zu 6 Efforts gleichzeitig
- Gut für direkten Vergleich zweier Fahrten

*Metric-Detail-Chart:*
- Wählbare Metrik über Zeit
- Klick auf Datenpunkt öffnet Aktivitätsdetail

### 6. JSON Export/Import

**Export (`segments.json`):**
```json
{
  "version": "1.0",
  "exportedAt": "2026-04-16T10:00:00Z",
  "segments": [ ...Segment-Objekte... ],
  "efforts": [ ...Effort-Objekte... ]
}
```

- Kein API-Key, keine Credentials im Export
- Efforts optional exportierbar (für Backup)

**Import:**
- JSON-Datei hochladen
- Versionsprüfung
- Merge-Strategie: bestehende Segmente behalten, neue hinzufügen
- Duplikate via ID erkennen

---

## Caching-Strategie

Da kein Backend vorhanden:

```javascript
// src/hooks/useIntervals.js
const cache = new Map(); // In-Memory während Session

async function getActivityStreams(athleteId, activityId) {
  const key = `streams_${activityId}`;
  
  // 1. Memory Cache prüfen
  if (cache.has(key)) return cache.get(key);
  
  // 2. SessionStorage prüfen
  const stored = sessionStorage.getItem(key);
  if (stored) {
    const parsed = JSON.parse(stored);
    cache.set(key, parsed);
    return parsed;
  }
  
  // 3. API-Call
  const data = await fetchStreams(athleteId, activityId);
  cache.set(key, data);
  
  // SessionStorage nur wenn klein genug (< 1MB)
  try {
    sessionStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    // QuotaExceeded: ignorieren, Memory-Cache reicht
  }
  
  return data;
}
```

---

## UI/UX Konzept

### Layout
```
┌─────────────────────────────────────────────────────┐
│  SEGMENT COMPARATOR              [Athlete: C]  ⚙️    │
├──────────────┬──────────────────────────────────────┤
│              │  [Route: Alle ▼] [Typ ▼] [Von] [Bis] │
│  SEGMENTE    │  [🔍 Name suchen...................]  │
│  ──────────  │  ────────────────────────────────── │
│  🗺 Risch    │  📍 Pendeln Hinfahrt   ✓ Segment A  │
│  ⛰ Auffahrt │  📍 Pendeln Rückfahrt  ✓ Segment A  │
│  🔄 Pendeln  │  📍 Obfelden Runde     –            │
│              │                                      │
│  [+ Neu]     │   [Vergleichen →]                   │
│  [Import]    │                                      │
│  [Export]    │                                      │
└──────────────┴──────────────────────────────────────┘
```

### Farbschema
- Hintergrund: `#0a0a0f` (dunkel)
- Akzent: `#00c87a` (grün, passend zu intervals.icu)
- Schrift: `#e8e8f0`
- Vergleichsfarben: 6 distinkte Farben für bis zu 6 Efforts

---

## Bekannte Einschränkungen

- intervals.icu API: Rate Limiting beachten (nicht dokumentiert, ~60 req/min)
- GPS-Matching: Bei schlechtem GPS-Signal kann Toleranz erhöht werden müssen
- Streams-Daten: Nicht alle Aktivitäten haben alle Streams (z.B. kein Watt ohne PM)
- SessionStorage: Wird beim Browser-Schliessen geleert → Efforts in JSON exportieren

---

## Empfohlene npm-Pakete

```json
{
  "dependencies": {
    "react": "^18",
    "react-dom": "^18",
    "react-leaflet": "^4",
    "leaflet": "^1.9",
    "recharts": "^2",
    "uuid": "^9",
    "date-fns": "^3"
  },
  "devDependencies": {
    "vite": "^5",
    "@vitejs/plugin-react": "^4",
    "tailwindcss": "^3",
    "autoprefixer": "^10"
  }
}
```

---

## Entwicklungsschritte (empfohlene Reihenfolge)

1. **Auth + API-Client** – Login, Verbindungstest, Aktivitätenliste laden
2. **Route-Filter Dropdown** – `route_id`/`route_name` aus Aktivitätsliste extrahieren, Dropdown befüllen, Filter-Parameter an API übergeben
3. **Karte + GPS-Matching** – Leaflet, Route anzeigen, Punkte wählen
4. **Segment CRUD** – Erstellen, benennen, löschen, JSON Export/Import
5. **Effort-Extraktion** – Streams laden, Matching, Metriken berechnen
6. **Vergleichstabelle** – Sortierung, Delta, Highlighting, Route-Name als Spalte
7. **Charts** – Timeline, Radar, Metric-Detail
8. **Bulk-Analyse** – Mehrere Aktivitäten auf einmal verarbeiten
9. **Polish** – Loading States, Fehlerbehandlung, mobile Ansicht
