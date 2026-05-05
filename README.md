# UNO No Mercy

A real-time multiplayer UNO card game with the brutal "No Mercy" rule expansion. Play online with friends or battle a ruthless AI - all from your browser.

**Play now:** [uno-no-mercy.pages.dev](https://uno-no-mercy.pages.dev)

## Why this exists

The official UNO No Mercy rules never got a proper digital version. This project brings every chaotic rule - Draw 6, Draw 10, Skip Everyone, Discard All, Color Roulette, hand swaps on 7, hand rotations on 0 - into a fast, playable web game. No downloads, no app stores.

## What it does

- **Real-time multiplayer** - create a room, share a code, play with 2-10 players
- **VS Bot** - single-player mode against an AI opponent
- **Full No Mercy rules** - every card from the physical deck implemented faithfully
- **Mobile responsive** - playable on phones (320px+), tablets, and desktops
- **Supabase backend** - auth, game state, and real-time sync via Supabase Realtime
- **Cloudflare proxy** - optional Cloudflare Worker to bypass regional Supabase blocks

### No Mercy cards included

| Card | Effect |
|------|--------|
| Skip Everyone | Skip all other players |
| Draw 6 / Draw 10 | Force massive draws (stackable) |
| Reverse Draw 4 | Reverse direction AND +4 |
| Color Roulette | Victim draws until they hit the chosen color |
| Discard All | Play every card of the matching color at once |
| 7 - Swap | Swap hands with any player |
| 0 - Rotate | All hands rotate in play direction |

## Tech stack

| Layer | Tech |
|-------|------|
| Frontend | Vue 3 + TypeScript + Vite |
| Styling | CSS (custom industrial/cyberpunk theme) |
| State | Pinia |
| Animations | GSAP |
| Cards | Programmatic SVG generation (no image assets needed) |
| Auth + DB + Realtime | Supabase |
| Proxy (optional) | Cloudflare Workers |

## Project structure

```
.
├── frontend/                # Vue 3 SPA
│   ├── src/
│   │   ├── components/      # Vue components (game/, auth, lobby, landing)
│   │   ├── composables/     # Shared logic (screen size, sounds, animations)
│   │   ├── stores/          # Pinia stores (game, multiplayer, auth)
│   │   ├── utils/           # Game rules, card generator, helpers
│   │   └── types/           # TypeScript types
│   └── index.html
├── supabase-proxy/          # Cloudflare Worker (optional)
├── cards/                   # Reference card images
├── cards-svgs/              # Reference card SVGs
└── cards-images/            # Reference card renders
```

## Getting started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project (free tier works)

### 1. Clone and install

```bash
git clone https://github.com/alii13/Uno-no-mercy.git
cd Uno-no-mercy/frontend
npm install
```

### 2. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Copy your project URL and anon key from **Settings > API**
3. Create your env file:

```bash
cp .env.example .env
```

4. Fill in your credentials:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 3. Run locally

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). That's it.

### 4. Build for production

```bash
npm run build
npm run preview   # test the production build locally
```

### Deploy to Cloudflare Pages

The production site runs on [Cloudflare Pages](https://pages.cloudflare.com).

**Option A: CLI deploy**

```bash
cd frontend
npm run build
npx wrangler pages deploy dist --project-name uno-no-mercy
```

**Option B: GitHub auto-deploy**

1. Go to [Cloudflare Dashboard > Pages](https://dash.cloudflare.com/?to=/:account/pages)
2. Create a project and connect your GitHub repo
3. Set build configuration:
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Root directory:** `frontend`
4. Add environment variables:
   - `VITE_SUPABASE_URL` - your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` - your Supabase anon key
5. Every push to `main` auto-deploys

### Supabase proxy (optional)

If Supabase is blocked in your region, the `supabase-proxy/` directory contains a Cloudflare Worker that proxies all traffic through Cloudflare's network.

```bash
cd supabase-proxy
npm install
# Update wrangler.toml with your Supabase project ref
npx wrangler dev       # local dev
npx wrangler deploy    # deploy to Cloudflare
```

Then add to your frontend `.env`:
```env
VITE_SUPABASE_PROXY_URL=https://uno-supabase-proxy.your-subdomain.workers.dev
```

## Screenshots

### Lobby
Create a game, join with a room code, or play against the AI.

![Lobby](docs/screenshots/lobby.png)

### Waiting room
Share the room code and wait for players to join.

![Waiting room](docs/screenshots/waiting-room.png)

## Contributing

Contributions welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

Some areas that could use help:

- **Spectator mode** - watch games in progress
- **Game history / replays** - review past games
- **More AI strategies** - smarter bot opponents
- **Sound design** - better audio effects
- **Accessibility** - screen reader support, keyboard navigation
- **Localization** - translate to other languages

## License

[MIT](LICENSE)
