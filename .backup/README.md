# Video Call P2P

Free WebRTC peer-to-peer video conferencing. Simple, secure, and fast real-time video calls with support for up to 8K resolution and 60fps. Compatible with all major browsers and platforms.

Based on [MiroTalk P2P](https://github.com/miroslavpejic85/mirotalk) (AGPLv3).

---

## Features

- No downloads, plugins, or logins required — completely browser-based
- Unlimited conference rooms with no time limitations
- Webcam streaming with front and rear camera support for mobile
- Crystal-clear audio with speaking detection and volume indicators
- Screen sharing for presentations
- File sharing with drag-and-drop support
- Video quality up to 8K and 60 FPS
- Record your screen, audio, and video
- Chat with Emoji Picker, Markdown support, and conversation saving
- Speech recognition for spoken messages
- Push-to-talk (walkie-talkie mode)
- Collaborative whiteboard
- Real-time YouTube embeds, video files (MP4, WebM, OGG), and audio files (MP3)
- Meeting duration control (HH:MM:SS)
- Full-screen mode with video element zoom and pin/unpin
- Customizable UI themes
- Direct peer-to-peer connections via WebRTC
- REST API with Swagger documentation
- Host protection & JWT token authentication

---

## Quick Start

**Requirements:** [Node.js](https://nodejs.org/en/download) installed.

```bash
# Copy environment config (edit as needed)
cp .env.template .env

# Copy brand config (edit as needed)
cp app/src/config.template.js app/src/config.js

# Install dependencies
npm install

# Start the server
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Configuration

- **`.env`** — Server settings, STUN/TURN, auth, API keys
- **`app/src/config.js`** — Branding, UI customization, button config

### Host Protection

| Param | Description |
|-------|-------------|
| `HOST_PROTECTED` | Requires valid credentials to create/join rooms |
| `HOST_USER_AUTH` | Requires valid credentials for all users |
| `HOST_USERS` | JSON array of `{"username", "password"}` objects |

### Direct Join URL

```
https://your-domain.com/join?room=test&name=user&audio=1&video=1&screen=0&chat=1&notify=0&hide=0
```

---

## API

API documentation available at `/api/v1/docs` (Swagger UI).

```bash
# Create a meeting
curl -X POST "http://localhost:3000/api/v1/meeting" \
  -H "authorization: YOUR_API_SECRET" \
  -H "Content-Type: application/json"

# Get active meetings
curl -X GET "http://localhost:3000/api/v1/meetings" \
  -H "authorization: YOUR_API_SECRET" \
  -H "Content-Type: application/json"
```

---

## License

[AGPLv3](LICENSE) — Free and open-source. Modifications must also be free and publicly available.
