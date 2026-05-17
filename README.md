# Fetcherr

Fetcherr gives Infuse and VidHub a streaming experience backed by your stream provider. It acts as a Jellyfin-compatible server, syncing your Trakt and MDBList watchlists, resolving cached torrent streams through Real-Debrid or TorBox, resolving EasyNews streams returned by AIOStreams, and serving library items to your client without a local media collection or mount.

## Responsible Use

Fetcherr should only be used with media you own, have lawfully obtained, or are otherwise authorized to access.

## Requirements

- Docker
- TMDB API key
- Real-Debrid or TorBox API key, or AIOStreams configured with EasyNews
- Stremio add-on with playable streams (e.g. AIOStreams, Comet, Debridio)
- Optional: TVDB API key, Trakt client ID/secret, MDBList API key

## Quick Start

```yaml
services:
  fetcherr:
    image: ghcr.io/goneturbo/fetcherr:latest
    container_name: fetcherr
    restart: unless-stopped
    ports:
      - "9990:9990"
    environment:
      SERVER_URL: "http://YOUR_SERVER:9990"
    volumes:
      - ./data:/app/data
```

```bash
docker compose up -d
```

Open `http://YOUR_SERVER:9990/ui/setup-admin`, create an admin account, then enter your API keys and provider URLs in Settings.

## Setup

1. Deploy and start the container (see Quick Start above)
2. Open `http://YOUR_SERVER:9990/ui/setup-admin` — create admin account
3. Go to **Settings** and enter:
   - TMDB API key
   - Real-Debrid or TorBox API key, if using a debrid provider
   - One or more Stremio add-on manifest URLs (AIOStreams, Comet, Debridio, etc.)
4. Optionally add Trakt or MDBList credentials to sync watchlists
5. Connect your client (see below)

### AIOStreams

Configure AIOStreams with your provider, then paste the manifest URL into Fetcherr Settings under **Add-on Provider URLs**. Recommended settings:

- **Only Cached:** On — Fetcherr streams cached content only; uncached will fail
- **Season/Episode Matching:** Off — breaks daily/late-night shows otherwise
- **Language filter:** Set to your preferred language for pre-filtered results
- In Fetcherr Settings, set **Stream Ranking** to **Provider Order** to preserve AIOStreams sort

Fetcherr also supports EasyNews streams when they are returned by AIOStreams as direct playable URLs. When AIOStreams returns mixed EasyNews, TorBox, and Real-Debrid candidates, Fetcherr tries EasyNews first, then falls back to TorBox or Real-Debrid.

Fetcherr does not expose Stremio catalog search results as Jellyfin library items. Infuse and VidHub should only display media that exists in the Fetcherr library.

## Diagnostics

The in-app Logs page shows recent application logs and add-on provider health. Provider health tracks recent add-on response times, returned stream counts, and failure rates so slow or unreliable add-ons are easier to identify.

## Connecting Infuse

Add Fetcherr as a Jellyfin server in Infuse with your server URL and a Fetcherr account. Enable **Library Mode**, **Auto Scan**, and **Install InfuseSync Plugin**.

## Connecting VidHub

Add Fetcherr as a Jellyfin server in VidHub. If prompted for an Emby endpoint, use `http://YOUR_SERVER:9990/emby`.

## Kubernetes

```bash
kubectl apply -f deploy/kubernetes/fetcherr.yaml
```

Set `SERVER_URL` in the manifest before applying.

## Environment

| Variable | Description |
|---|---|
| `SERVER_URL` | External base URL used for playback redirects (required) |
| `PLAYBACK_SIGNING_SECRET` | Optional secret used to sign short-lived playback URLs. If omitted, Fetcherr generates and stores a persistent random secret in SQLite. |
| `MDBLIST_MAX_ITEMS` | Max items per MDBList list (default: 1000) |

All other configuration is managed through the Settings UI and stored in the database.
