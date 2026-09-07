# Atlas — trip planner

One trip, several levels of resolution. A planning workstation on the desktop, a
travel companion on a phone, from a single codebase.

The demo trip (Japan, 14 days) loads on first launch, so the product explains
itself immediately.

---

## Running it

```bash
npm install
npm run dev          # web app at http://localhost:5173
```

Other targets:

```bash
npm run build        # production build into dist/
npm run electron:dev # desktop app against the dev server (hot reload)
npm run electron:start # desktop app against the production build
npm run cap:sync     # copy the build into the native iOS/Android projects
```

### Android and iOS

Capacitor wraps the same `dist/` build. The native projects are not committed;
create them once:

```bash
npm run build
npx cap add android      # needs Android Studio + SDK
npx cap add ios          # needs Xcode (macOS only)
npm run cap:android      # sync + open in Android Studio
npm run cap:ios          # sync + open in Xcode
```

The Capacitor CLI needs Node 20+; the app itself has no such constraint.

### Checks

```bash
npm run lint             # eslint, zero warnings allowed
npm test                 # vitest — domain rules and store workflows (36 tests)
npm run smoke            # drives the real app in Chrome (25 checks)
npm run offline:check    # builds, then proves the app works with the network off
npm run electron:check   # boots the desktop shell and tears off a panel window
npm run verify           # lint + build + test + smoke
```

`npm run smoke:shots` also writes screenshots to `screenshots/`.

---

## Architecture

| Layer | Choice | Why |
| --- | --- | --- |
| UI | React 19 + TypeScript, Vite | One codebase for every target |
| State | Zustand, normalised store with undo | Small, synchronous, easy to snapshot |
| Storage | IndexedDB (localStorage fallback) | Local-first; no server, no network |
| Map | Leaflet + OpenStreetMap | No API key to start, swappable provider |
| Desktop | Electron | Real windows, multi-monitor, persistent window state |
| Mobile | Capacitor | Same build inside a native shell |

```
src/
  domain/      types, time maths, selectors, the warning rule engine
  data/        IndexedDB persistence, cross-window sync, the demo trip
  store/       trip store (data + undo) and UI store (selection, panels)
  features/    one folder per view: overview, plan, timeline, day, activity,
               ideas, map, bookings, travel, settings, trips, warnings
  ui/          icon set and shared primitives
  platform/    map config, native shell, detachable windows
electron/      desktop main process
scripts/       smoke, offline and electron verification
```

### The data model

Entities are normalised and each collection is its own IndexedDB object store —
a trip is never one big document, and editing an activity writes one record.

```
Trip ──< Day ──< Activity >── Location
                    │
                    ├── Transport      (journey detail: carrier, seat, platform)
                    ├── Booking        (reference, provider, URL, status)
                    └── Accommodation  (link to the stay)

Accommodation ──> Trip   (covers a date range; days resolve their own stay)
Booking       ──> Trip   (referenced by activities and stays)
```

Two decisions carry most of the weight:

**An idea is an activity with `dayId === null`.** Scheduling something is a
*move*, not a conversion, so nothing is duplicated and nothing is lost when you
send it back to the inbox.

**Transport and accommodation never repeat placement.** A journey's day, time and
order live on its activity; the `Transport` record holds only what is specific to
travelling (carrier, seat, platform, terminal). The same is true of stays. This
is why the weekly view, the day view, the map, travel mode and the dashboard can
all be projections of the same records rather than copies of them.

**Timing is deliberately loose.** `timePrecision` is one of `exact`,
`approximate`, `dayPart`, `relative` ("After lunch"), `flexible` or
`unscheduled`. Untimed activities sort to the bottom of a day under an "Any
time" divider rather than being forced onto the clock, and gaps between timed
activities are rendered as explicit free time.

---

## What's implemented

**Trips** — create, edit, delete, switch; multiple trips side by side. Changing
the dates grows or shrinks the day list; activities on a removed day return to
Ideas rather than being deleted.

**Weekly view** — every day as a scannable card: date, city, headline, the two
or three activities that define it, where you sleep, and a warning count.
Deliberately not the whole itinerary.

**Day planner** — the timeline with explicit free-time blocks, inline time
editing, quick-add that parses `09:30 Coffee at Blue Bottle`, and per-row
complete / skip / duplicate.

**Activity inspector** — every field in the model, editing straight through to
the store (no save button, no draft copy), so the timeline, map and warnings
update as you type.

**Drag and drop** — reorder within a day, move between days, drop onto a
free-time gap to schedule at that time, drag from Ideas onto a day, or drag an
activity back to Ideas to unschedule it. Dropping an already-timed activity
keeps its time and duration; dropping an untimed one adopts a time from where it
landed.

**Map** — Leaflet, pins grouped by place, filtered by day and category, with the
day's route drawn when a single day is selected. Selecting an activity anywhere
highlights its pin and pans to it; clicking a pin selects the activity.

**Transport and accommodation** — first-class records with carrier, vehicle,
seat, platform, terminal, references and links. The current stay is visible from
every day it covers.

**Warnings** — seven rules: overlaps, tight connections, insufficient travel
time between located activities, activities far apart, opening hours, an
over-full day, and missing accommodation. They are advisory: they never change
the itinerary, and each one is clickable through to what it refers to. The demo
trip deliberately raises seven warnings across five of those rules.

**Desktop workspace** — Days / Itinerary / dock (map, ideas, checks) with
independently resizable panes whose sizes persist, plus the inspector as a
fourth pane. Any panel can be torn off into its own window; under Electron those
are real OS windows with remembered position and size, and all windows stay in
sync through a BroadcastChannel.

**Travel mode** — Now / Next / Later for one day, with Navigate, Booking, Call,
Done, Skip, Note and add-something-spontaneous, plus tonight's hotel and its
reference. Large targets, no planning UI.

**Offline** — the itinerary lives in IndexedDB and needs no network. The web
build additionally registers a service worker so the app itself loads offline;
map tiles you have already looked at are cached too.

**Keyboard** — `Ctrl/⌘+Z` undo, `+Shift` redo, `J`/`K` day navigation, `N`
quick-add, `M`/`I` panels, `1`–`6` views, `Esc` closes the inspector.

---

## Deployment and the shared plan

The site is published to GitHub Pages from `main`:

**<https://nic4wtf.github.io/atlas-trip-planner/>**

It works on a desktop browser and on a phone, and can be installed to the home
screen on both (it ships a web app manifest and a service worker, so it opens
full-screen and runs offline once loaded).

### One plan, proposed changes, one gate

The itinerary is a file in the repository — `public/trips/sydney-2026.json` —
and the deployed site serves it. That makes the plan versioned, and it makes
"who is allowed to change it" a question GitHub already answers.

```
your device                   repository                    everyone
───────────                   ──────────                    ────────
edit freely, locally
  │
  │ Settings → Propose changes
  ▼
sydney-2026.json ──upload──►  pull request
                                  │  checks run automatically
                                  │  owner reviews the diff
                                  ▼
                              merged to main ──deploy──►  new published plan
                                                              │
                                                          "update available"
```

- **Local-first is unchanged.** Edits go to IndexedDB and need no network. The
  published file is only read: on first run to seed the trip, and afterwards to
  answer "has this moved on?".
- **Proposals need no account setup** beyond a GitHub login — no token, no OAuth
  app, no backend. GitHub forks the repo for a contributor automatically.
- **`main` is protected**, so a proposal is only published once it is merged.
- **Every proposal is checked first.** `npm test` guards the trip file itself —
  malformed JSON, dangling references, days outside the trip's range — so a
  broken plan fails before it reaches review.

The full walkthrough is in [CONTRIBUTING.md](CONTRIBUTING.md).

### Verifying a deploy locally

GitHub Pages serves a project site from a subpath (`/atlas-trip-planner/`),
which is where relative-path bugs surface. This serves the real build that way
and drives it in a browser, desktop and phone-sized:

```bash
npm run pages:check
```

### Why Pages

`base: './'` already made the build path-relative for Electron and Capacitor, so
subpath hosting needed no change, and `HashRouter` means there is no SPA 404
problem to solve. Version control and the approval gate are the product's own
requirements met by the host, rather than a service to run. The trade-off is
that Pages on a free account serves from a **public** repository — the itinerary
is world-readable. Hosting the same build on Cloudflare Pages or Netlify from a
private repo is the swap if that matters; nothing above depends on the host.

---

## Configuration

No secrets are committed. Maps default to OpenStreetMap, which needs no key. To
use a commercial tile provider, copy `.env.example` to `.env.local`:

```
VITE_MAP_TILE_URL=https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key={key}
VITE_MAP_API_KEY=your_key_here
VITE_MAP_ATTRIBUTION=© MapTiler © OpenStreetMap contributors
```

`{key}` is substituted at runtime from the environment.

---

## Limitations and next steps

- **Search for places is manual.** Coordinates are typed into the inspector;
  there is no geocoder. Adding one is a single call site (`upsertLocation`).
- **Routes are straight lines** between consecutive stops, and travel estimates
  are distance-based heuristics rather than real routing. Both are deliberate:
  no network dependency, and a wrong-but-honest estimate is better than a
  confident one that needs a live API.
- **Offline maps are partial.** Tiles are cached opportunistically as you pan;
  there is no "download this region" yet. The service worker is where that
  would go.
- **Attachments are modelled but not uploadable.** The `Attachment` type exists
  and links work; file storage does not.
- **Collaboration is asynchronous, not live.** Changes are proposed as pull
  requests and land when they are merged; there is no realtime sync and no
  merging of two people's concurrent edits. Adopting the published plan replaces
  the local copy wholesale rather than reconciling it. The normalised store with
  per-entity records and timestamps is the shape a real sync layer would want.
- **Native projects are not committed.** `npx cap add android|ios` needs the
  platform SDKs, so they are generated locally rather than checked in.
- **The tests that touch the DOM run through a real browser** (`npm run smoke`)
  rather than jsdom, which does not install on Node 20.10.
