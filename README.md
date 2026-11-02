# ShambaSmart — Farmer Companion

A digital assistant for small-scale farmers in Kenya, in English and Kiswahili, on Android, iPhone and the web.

- **Crop calendar and farm activities**: add a plot (crop, size, planting day) and the season's work is laid out for
  you: land preparation, planting, weeding, top-dressing, pest checks, harvest. Tick tasks off, move them, add your own.
- **Weather alerts and planting reminders**: a 7-day forecast for your county or GPS position (Open-Meteo, free, no key),
  with plain-language alerts for heavy rain, spraying or fertilizer planned on a wet day (and a better day for it), dry
  weeks, heat, cold nights, strong wind, blight weather for tomatoes and potatoes, and the start of the long and short
  rains. On phones, a reminder at 7 a.m. on the day each task is due.
- **Crop disease check from a photo**: Meta's Llama 4 Scout (free on Cloudflare Workers AI) looks at the photo and
  says what it may be (disease, pest, nutrient or water problem), what to do now with low-cost steps first, how to
  prevent it next season, and when to call an extension officer. Photos are not stored. Google Gemini or Groq also
  work; see `backend/.env.example`.
- **Market prices**: price per kg (and per bag) at 10 main markets. Farmers report prices they saw; reports from the
  last 2 weeks replace the starting sample guide, with an 8-week trend.
- **Expense and harvest records**: spending by category, income from sales, and profit per plot and per period.

## Layout

| Folder     | What it is                                                                                    |
| ---------- | --------------------------------------------------------------------------------------------- |
| `backend/` | Node 24 + Express 5 + SQLite (`node:sqlite`). The API at `/api`, and the built web app at `/`. |
| `app/`     | Expo 57 (React Native, Expo Router). One codebase for Android, iOS and the web.               |

Crop calendars live in `backend/src/catalog/crops.js` (9 crops, English and Kiswahili). Weather alert rules are in
`backend/src/services/alerts.js`; the photo check is `backend/src/services/diagnose.js`.

## Run it on your computer

```sh
# 1. The backend (http://localhost:4000)
cd backend
cp .env.example .env        # add the free Cloudflare details for photo checks
yarn install
yarn dev

# 2. The app
cd ../app
cp .env.example .env        # EXPO_PUBLIC_API_URL=http://localhost:4000
yarn install
yarn web                    # in the browser
yarn start                  # then scan the QR code with Expo Go on your phone
```

On a phone, `EXPO_PUBLIC_API_URL` must be the laptop's address on the Wi-Fi (e.g. `http://192.168.1.20:4000`), not
`localhost`.

Checks: `cd backend && yarn test` (23 tests: calendars, alert rules, the AI client and the whole API, offline),
`cd app && yarn typecheck && yarn lint`.

## Put it online

- **Server and website**: `render.yaml` sets up one Render service that builds the web app and runs the backend.
  Set `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` in Render's settings. It uses a persistent disk for the SQLite database, which needs a paid
  instance; on Render's free plan the data would be wiped on each deploy.
- **Phone app**: set your server's address in `app/eas.json`, then `npx eas-cli@latest build --profile preview
  --platform android` for an installable APK.

## Good to know

- The market's starting prices are a rough sample guide, clearly marked in the app, until farmers report real ones.
  Linking to the Ministry of Agriculture's KAMIS price data would be a good next step.
- Cloudflare's free plan allows 10,000 "neurons" a day, roughly 60-90 photo checks for everyone together;
  `DIAGNOSES_PER_DAY` (default 10) shares it out per farmer. Beyond that, Cloudflare's paid plan costs about
  $0.01 per 1,000 neurons (well under a shilling per check).
- Crop calendars are general guidance for Kenyan conditions; the local extension officer knows each area best.
