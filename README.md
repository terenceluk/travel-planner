# 🗺️ Travel Planner

A web app that calculates exactly when you need to leave home (or each stop) to arrive at every destination on time — accounting for real-time traffic, transit schedules, and parking time.

Enter your starting location, a date, and a list of stops with their required arrival times. The app chains each leg together and returns departure times for both **driving** and **transit** for every stop, with traffic severity badges and a connected schedule view.

Live demo: https://terence-travel-planner.azurewebsites.net/

Blog post: https://blog.terenceluk.com/2026/04/vibe-coding-a-smart-travel-planner-with-github-copilot.html

---

## Screenshots

The blog post currently exposes three unique image assets. The light/dark mode image contains two screenshots side by side.

### Light And Dark Mode

![Travel Planner light and dark mode](https://blog.terenceluk.com/wp-content/uploads/2026/04/Light-and-Dark-Mode-1024x609.png)

### Paris Trip Planning

<img src="https://blog.terenceluk.com/wp-content/uploads/2026/04/Paris-Planning-653x1024.png" alt="Travel Planner itinerary form for a Paris trip" width="420" />

### Paris Trip Results

<img src="https://blog.terenceluk.com/wp-content/uploads/2026/04/Paris-Planning-Result-653x1024.png" alt="Travel Planner calculated results for a Paris trip" width="420" />

---

## Features

- **Chained routing** — each stop departs from the previous stop's address, not always from home
- **Traffic-aware driving** — uses Google's `duration_in_traffic` and departure-time prediction
- **Traffic badges** — 🟢 Light / 🟡 Moderate / 🔴 Heavy with exact delay minutes
- **Transit directions** — step-by-step transit route with departure time
- **Parking buffer** — configurable head-start (0–20 min) subtracted from arrival time so you have time to park and walk in
- **Impossible timing detection** — flags when a stop's departure time conflicts with the previous stop's arrival, with a suggested earlier departure
- **Address autocomplete** — Google Places suggestions as you type
- **Resolved addresses** — shows the full postal address Google matched for each origin/destination
- **Static map thumbnails** — inline map image for each stop (gracefully hidden if Maps Static API isn't enabled)
- **Open in Maps links** — deep links to Google Maps app/web for each leg
- **Time-at-stop connectors** — shows how long you have at each stop between arrival and the next departure
- **Date-scoped scheduling** — single date picker applies to all stops
- **localStorage persistence** — form state survives page refreshes
- **Reset button** — clears all state and localStorage to start fresh
- **Bring-your-own API key** — if no server-side key is configured, users paste their own Google Maps API key; the key is validated against Google before being accepted and never stored server-side

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript, Vite 5 |
| Backend | Node.js + Express + TypeScript (ts-node-dev) |
| Google APIs | Directions API, Places API, Maps Static API |
| Styling | Plain CSS (no framework) |

---

## Getting Started

### Prerequisites

- **Node.js** v18 or later
- A **Google Maps API key** with the following APIs enabled:
  - [Directions API](https://developers.google.com/maps/documentation/directions)
  - [Places API](https://developers.google.com/maps/documentation/places/web-service)
  - [Maps Static API](https://developers.google.com/maps/documentation/maps-static) *(optional — used for map thumbnails)*

> **Don't have a key yet?** [Get started here →](https://developers.google.com/maps/get-started)

---

### Installation

```bash
# 1. Clone the repo
git clone https://github.com/your-username/travel-planner.git
cd travel-planner

# 2. Install all dependencies (root + server + client)
npm run install:all
```

---

### Configuration

Copy the example env file and add your key:

```bash
cp server/.env.example server/.env
```

Then edit `server/.env`:

```dotenv
# Option A — server-side key (recommended for local/private use)
GOOGLE_MAPS_API_KEY=AIzaSy...your_key_here

PORT=3001
```

> **Leaving the key blank?** See [Bring-Your-Own-Key mode](#bring-your-own-key-mode) below.

---

### Running in Development

```bash
npm run dev
```

This starts both servers concurrently:

| Server | URL |
|--------|-----|
| React (Vite) | http://localhost:3000 |
| Express API | http://localhost:3001 |

Vite proxies all `/api/*` requests to the Express server automatically — no CORS configuration needed.

---

### Building for Production

```bash
npm run build
```

This compiles the React app into `client/dist/` and the Express server into `server/dist/`. The Express server is configured to serve the React build as static files when `NODE_ENV=production`.

To run in production mode:

```bash
cd server
NODE_ENV=production npm start
```

The app will be available on `http://localhost:3001` (or the port set in your `.env`).

---

## Usage

1. **Enter your starting location** in the *Starting Location* field (with autocomplete)
2. **Pick a date** for your trip
3. **Set a parking buffer** — extra minutes added before your arrival time so you have time to park and walk in (default: 5 min)
4. **Add stops** — each stop needs:
   - An optional label (e.g. "Breakfast")
   - An address (with autocomplete)
   - The time you need to *arrive by*
5. Click **🚗 Calculate Departure Times**
6. Review your schedule — each stop card shows:
   - When to leave (for driving and transit)
   - Travel duration and traffic conditions
   - A "Open in Maps" link to navigate directly
   - How long you have at each stop before you need to leave for the next one

---

## Bring-Your-Own-Key Mode

This mode is designed for **public deployments** (e.g. a demo app for a blog post) where you don't want your own API key billed by other users.

**How to enable it:** Simply leave `GOOGLE_MAPS_API_KEY` unset (or commented out) in `server/.env`.

**What users see:**

1. A key entry panel appears at the top of the app
2. All form fields are greyed out until a key is entered
3. When the user clicks **Activate**, the server makes a live test call to Google to validate the key
4. If invalid → a red error message explains the problem and the key is not saved
5. If valid → the key is saved to their browser's `localStorage` and the form unlocks
6. The key is sent with every API call as a request header (`X-Google-Api-Key`) — it is **never logged or stored server-side**
7. Users can click **Change key** at any time to replace it

**What API key owners need to enable in Google Cloud Console:**

- Directions API
- Places API
- Maps Static API *(optional, for map thumbnails)*

---

## Project Structure

```
travel-planner/
├── package.json              # Root scripts (dev, build, install:all)
│
├── client/                   # React frontend (Vite)
│   ├── src/
│   │   ├── App.tsx           # Main app component, state, calculate logic
│   │   ├── App.css           # All styles
│   │   ├── components/
│   │   │   ├── AddressAutocomplete.tsx   # Debounced Places autocomplete
│   │   │   ├── DestinationList.tsx       # Stop cards with add/remove
│   │   │   └── ResultsPanel.tsx          # Results cards, traffic badges, maps
│   │   ├── types/
│   │   │   └── index.ts      # Shared TypeScript interfaces
│   │   └── utils/
│   │       └── apiFetch.ts   # Fetch wrapper that injects X-Google-Api-Key header
│   └── vite.config.ts        # Dev proxy: /api → localhost:3001
│
└── server/                   # Express backend
    ├── .env.example          # Copy to .env and fill in your key
    └── src/
        ├── index.ts          # App entry point, route registration
        └── routes/
            ├── config.ts         # GET /api/config — tells client if key is required
            ├── validate-key.ts   # GET /api/validate-key — tests a key against Google
            ├── directions.ts     # POST /api/directions — driving + transit legs
            ├── autocomplete.ts   # GET /api/autocomplete — Places autocomplete
            └── place-image.ts    # GET /api/place-image — proxied Static Maps image
```

---

## API Reference

All routes are prefixed `/api/`. In development, Vite proxies them; in production, Express serves them directly.

### `GET /api/config`

Returns whether the app requires a user-supplied API key.

```json
{ "requiresApiKey": true }
```

### `GET /api/validate-key`

Validates the key passed in the `X-Google-Api-Key` header by making a live probe to Google.

```json
{ "valid": true }
// or
{ "valid": false, "error": "Key is invalid, not enabled for Places API, or restricted." }
```

### `POST /api/directions`

Returns driving and transit directions for a single leg.

**Request body:**
```json
{
  "origin": "123 Main St, Toronto, ON",
  "destination": "555 University Ave, Toronto, ON",
  "arrivalTime": 1712345678
}
```

**Response:**
```json
{
  "driving": {
    "durationSeconds": 900,
    "durationText": "15 mins",
    "departureTime": 1712344778,
    "departureTimeText": "9:45 AM",
    "durationWithoutTrafficSeconds": 780,
    "trafficDelaySeconds": 120
  },
  "transit": { "...": "..." },
  "resolvedOriginAddress": "123 Main Street, Toronto, ON M5V 1A1, Canada",
  "resolvedDestinationAddress": "555 University Ave, Toronto, ON M5G 1X8, Canada"
}
```

### `GET /api/autocomplete?input=&sessiontoken=`

Returns up to 5 place predictions from the Google Places Autocomplete API.

```json
{
  "predictions": [
    { "description": "Toronto, ON, Canada", "place_id": "ChIJ..." }
  ]
}
```

### `GET /api/place-image?address=`

Returns a proxied 700×140 static map image (PNG) centred on the address. Returns HTTP 422 if the Maps Static API is not enabled.

---

## Deploying to Azure App Service

1. Build the app: `npm run build`
2. Set `GOOGLE_MAPS_API_KEY` and `PORT` in the App Service **Application Settings** (Environment Variables)
3. Set `NODE_ENV=production`
4. Deploy the entire repository (or just the `server/` folder with `client/dist/` copied into it) — the Express server serves the React build as static files

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_MAPS_API_KEY` | Optional | Server-side Google Maps API key. If omitted, users must supply their own via the UI. |
| `PORT` | Optional | Port for the Express server. Defaults to `3001`. |

---

## License

MIT
