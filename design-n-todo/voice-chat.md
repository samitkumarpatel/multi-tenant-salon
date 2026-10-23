# Voice for the website chat (plan)

> **Status: proposed — not implemented.** Written 2026-10-20 for review. Open decisions are listed
> at the end; nothing here changes the API until Phase 2.

Visitors should be able to talk to the salon assistant on the website and, optionally, hear its
replies — alongside typing, not instead of it. Voice is an input/output layer on top of the
existing chat: a spoken question becomes the same chat `message`, and the streamed text reply is
read aloud. The assistant, its tools, the MCP apps and the booking rules stay exactly as they are.

## What the current setup supports

| Area | Today | What it means for voice |
|---|---|---|
| AI model | Spring AI with Anthropic only (`spring-ai-starter-model-anthropic`) | Claude takes text and images — no audio in, no speech out. Any **server-side** speech needs a separate speech service. |
| Chat API | `POST /api/salon/{salonId}/chat` and `POST …/chat/stream` (SSE `session` / `delta` / `app` / `done` / `suggestions`); request `{sessionId, context, message, uiState}` | Already voice-friendly: a transcript is just `message`, and `delta` events let replies be spoken sentence by sentence while they stream. No change needed. |
| Website composer (`frontend/packages/ui-website/src/GenerativeUIWebsite.tsx`) | Text box only; no mic, `SpeechRecognition`, `speechSynthesis` or `MediaRecorder` code anywhere | Needs a mic button and a read-aloud control. |
| Language | Website i18n (`useI18n()` from `@salon/i18n`) and per-salon languages (`V15__salon_languages.sql`) | Gives the recognition/speech language (e.g. `en-US`, `da-DK`) for free. |
| Browser permissions | No `Permissions-Policy` header; the website is served top-level over HTTPS | The microphone is allowed by default. If the chat is ever embedded in a third-party page's iframe, that page needs `allow="microphone"`. |
| MCP apps in Claude / ChatGPT | Hosted by the AI app | Nothing to build — voice there is the host's own feature (e.g. Claude's voice mode); the app views still render. Don't add a mic to the MCP apps. |

## Phase 1 — browser speech, no backend change (recommended first)

Uses the browser's built-in Web Speech API.

- **Mic button in the composer.** Speech → text with `SpeechRecognition` (`webkitSpeechRecognition`
  on Safari), `lang` from the visitor's website language. Interim words appear in the text box as
  they are recognised; tapping stop or a natural pause sends it through the existing `sendMessage`.
- **Read replies aloud.** A speaker toggle in the chat header. Spoken with `speechSynthesis`, one
  sentence at a time as `delta` text arrives (so the first sentence is heard before the reply ends).
  - Markdown is stripped before speaking (no "asterisk asterisk").
  - App views and cards are never read out; a short spoken line stands in, e.g. "I've opened the
    booking app below."
  - Uses the closest installed voice for the website language; falls back silently if none.
- **Barge-in.** Speech stops when the visitor types, taps the mic, sends another message, or clears
  the chat.
- **Graceful absence.** The mic button is hidden where `SpeechRecognition` doesn't exist (Firefox
  today); read-aloud is hidden where `speechSynthesis` doesn't exist. Nothing else changes.
- **Safety unchanged.** Voice never confirms a booking or an order — those still need the visitor's
  tap inside the app (`create_customer_booking` / `create_shop_order` stay app-only).
- **Accessibility.** The transcript and the reply stay on screen as text (captions for free); the
  mic and speaker buttons get labels and `aria-pressed`; a visible "Listening…" state.

**Where the code goes**

| File | Change |
|---|---|
| `frontend/packages/ui-website/src/useVoice.ts` (new) | Hook wrapping recognition (start/stop, interim + final transcript, errors) and synthesis (queue sentences, stop, voice pick by language), with feature detection |
| `frontend/packages/ui-website/src/GenerativeUIWebsite.tsx` | Mic button in `renderComposer()`, speaker toggle in `chatHeader`, feed streamed `delta` text to the sentence queue, stop on send/type/clear |
| `@salon/i18n` strings | "Listening…", "Tap to speak", "Read replies aloud", permission-denied message |
| Website privacy text / policies | Note that the browser's speech service may process audio (see trade-offs) |

**Trade-offs:** free and no new infrastructure, but quality and available voices vary by browser,
Firefox has no recognition, and Chrome sends the audio to Google's speech service — worth stating
in the privacy text.

## Phase 2 — server speech (optional, consistent quality)

Adds our own speech-to-text and text-to-speech so every browser (including Firefox) gets the same
recognition and one consistent voice per salon.

- **New endpoints** (public, under the existing chat path):
  - `POST /api/salon/{salonId}/chat/transcribe` — `multipart/form-data` audio (WebM/Opus or WAV from
    `MediaRecorder`, max ~60 s) + `language` → `{ "text": "…" }`.
  - `POST /api/salon/{salonId}/chat/speak` — `{ "text", "language" }` → `audio/mpeg`.
- **Provider:** Azure AI Speech — we already run on Azure with Key Vault. Called through Spring's
  HTTP service client (per `CLAUDE.md`), key from Key Vault/env, region configurable. Alternative:
  Azure OpenAI's transcription and TTS models through Spring AI's audio support
  (`TranscriptionModel` / `TextToSpeechModel`).
- **Frontend:** `useVoice` switches to `MediaRecorder` + the endpoints when configured, keeping the
  Phase 1 behaviour (interim text is lost — server STT returns only the final transcript).
- **Guard rails:** per-salon/IP rate limits (the chat API is public), audio size/duration caps, no
  audio stored, a salon-level on/off (possibly a feature flag alongside `BOOKING`/`WEBSHOP`).
- **Costs:** billed per audio minute — needs a budget/alert.
- **Docs:** both endpoints go into `oas/OAS.yaml` and `oas/api.md`; new config under
  `spring.application.chat.voice.*`.

## Not recommended

**Realtime voice-to-voice models** (e.g. OpenAI's Realtime API). They would replace Claude as the
assistant, and with it the tool calls the MCP apps and booking flow rely on — a different product,
not a voice layer.

## Testing

- Phase 1: unit tests for the sentence splitter and markdown stripping; manual checks in Chrome,
  Safari (macOS + iOS), Edge and Firefox (mic hidden); permission denied/revoked; switching language
  mid-session; barge-in while speaking.
- Phase 2: RestTestClient + Testcontainers tests for the endpoints with the speech client stubbed
  (size limits, unsupported format, rate limit, disabled salon).

## Open decisions

1. **Scope:** Phase 1 only for now, or go straight to Phase 2 with Azure Speech?
2. **Read-aloud default:** off by default (visitor turns it on), or on automatically for replies to
   a spoken question?
3. **Availability:** every salon with the chat, or opt-in per salon?
