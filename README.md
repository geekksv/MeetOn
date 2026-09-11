# MeetOn

Browser-based video calls. No download, no account, no time limit.

**Live:** https://meeton-i4dr.onrender.com

---

## What it does

Calls run peer-to-peer over WebRTC. Audio and video go straight between
browsers; the server only handles signalling, so it never sees the call itself.

- Video up to 8K / 60fps, screen sharing, local recording
- Chat with file transfer, emoji, markdown
- Whiteboard, YouTube and media embeds
- Push-to-talk, speech recognition, speaking detection
- Optional host protection and JWT auth
- REST API with Swagger docs at `/api/v1/docs`

Rooms are unlimited and have no duration cap.

---

## Running it

Needs [Node.js](https://nodejs.org/en/download).

```bash
cp .env.template .env
cp app/src/config.template.js app/src/config.js
npm install
npm start
```

Then open http://localhost:3000.

Tests: `npm test`. Dev with reload: `npm run start-dev`.

---

## Configuration

Two files, both gitignored:

- **`.env`** — server, STUN/TURN, auth, API keys
- **`app/src/config.js`** — branding, UI, buttons

### TURN

WebRTC needs a TURN relay to connect through symmetric NATs and strict
corporate firewalls. Without one, calls quietly fail for some users and work
fine for others, which is a miserable thing to debug.

`.env.template` points at a free Metered relay. Fine for testing. Get your own
before anyone depends on it.

### Host protection

| Variable | Effect |
|---|---|
| `HOST_PROTECTED` | Credentials required to create or join a room |
| `HOST_USER_AUTH` | Credentials required for every participant |
| `HOST_USERS` | JSON array of `{"username", "password"}` |

### Direct join

Skip the lobby by passing parameters:

```
/join?room=test&name=user&audio=1&video=1&screen=0&chat=1
```

---

## Deployment note

The live instance runs on Render's free tier, which spins down after about 15
minutes of inactivity. First request after that takes 30–60 seconds to wake.
Nothing is broken — it's just cold.

---

## Licence

[AGPL-3.0](LICENSE). Built on [MiroTalk P2P](https://github.com/miroslavpejic85/mirotalk),
© Miroslav Pejić, from whom commercial and closed-source licensing is available.

AGPL is network copyleft, which is worth understanding rather than skimming:
running it as a public service counts as distribution, so anyone using this
instance is entitled to the source. That is why this repository is public, and
the same obligation passes to you if you fork it.
