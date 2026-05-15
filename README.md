# Fetcherr

Fetcherr gives Infuse and VidHub a streaming experience backed by your debrid provider. It acts as a Jellyfin-compatible server, syncing your Trakt and MDBList watchlists, resolving cached torrent streams through Real-Debrid or TorBox, and serving them to your client without a local media collection or mount.

## Responsible Use

Fetcherr should only be used with media you own, have lawfully obtained, or are otherwise authorized to access.

## Requirements

- Docker
- TMDB API key
- Real-Debrid or TorBox API key
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
| `MDBLIST_MAX_ITEMS` | Max items per MDBList list (default: 1000) |

All other configuration is managed through the Settings UI and stored in the database.
