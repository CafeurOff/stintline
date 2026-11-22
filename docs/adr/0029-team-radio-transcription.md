# 0029. Team radio transcribed on our machine with Whisper

- Status: Accepted (the maintainer chose listening plus transcription, local Whisper, public on 2026-11-21)
- Date: 2026-11-21
- Amends: [0002](0002-data-sources-and-live-strategy.md) (the research note listed team radio transcription as out of scope)

## Context
OpenF1 `team_radio` and the live `TeamRadio` topic give one URL per clip on
`livetiming.formula1.com/static/`. Since ADR 0004 we have stored those references, but the
site only played the last eight clips in live mode. Fans want to hear what drivers and
engineers said in every session, and to read it: a clip lasts 3 to 20 s, a race has 100 to
300 of them, and most are only meaningful next to the lap they were sent on.

## Decision drivers
- Show every session's radio, races and practice and qualifying alike, on the lap it was sent.
- Text for every clip: readable, searchable by eye, and a text alternative for the audio.
- The audio stays FOM content: played from its source, never stored or re-hosted.
- No paid service and no audio sent to a third party.
- Fits the production worker (one process, `--concurrency=1`, 900 MB memory cap).

## Options considered
### Whisper on our machine, `faster-whisper` on the CPU (chosen)
- Pros: free, no third party, deterministic; `base.en` in int8 is about 150 MB and runs
  faster than real time on one core (1 to 2 s per clip, checked on Bahrain 2025).
- Cons: a heavy dependency (CTranslate2, PyAV, onnxruntime); the checkpoint is downloaded on
  first use; accuracy on radio noise is fair, not perfect.

### A cloud speech-to-text API
- Pros: more accurate, no CPU cost.
- Cons: paid, and every clip is sent to a third party.

### Listening only
- Cons: no text alternative, nothing to skim.

## Decision
- `racedata.radio` fetches clips (`RadioClipSource`, HTTPS on `livetiming.formula1.com`,
  paths under `/static/`, MP3 only; the fetcher is not an open proxy) and transcribes them
  (`WhisperTranscriber`). Named defaults: `base.en`, int8, English forced, Whisper's
  reference beam size, a racing vocabulary prompt, voice-activity filter, Whisper's own
  silence thresholds, and a short list of phrases it invents on noise ("thank you",
  "beep"). `faster-whisper` is the `transcription` extra, imported on first use; PyAV stays
  below 16 (16+ dropped an argument `faster-whisper` 1.2 passes).
- `TeamRadio` gains `transcript`, `transcript_language`, `transcript_confidence` (mean token
  probability), `transcript_model` and `transcribed_at`. A clip gone upstream or
  undecodable is marked done with an empty text and `transcript_model = "unreadable"`.
  A clip the CDN refuses (HTTP 403) stays pending and stops the batch: the CDN blocks some
  datacenter addresses, which says nothing about the clip.
  A timing re-import never touches these columns.
- The `transcribe_radio` Celery task does 25 clips, then queues itself for the rest, so
  imports queued meanwhile wait at most about a minute on the single worker. It is queued
  after each import, and `refresh_recent` starts two sessions of the backlog per run,
  most recent first. `manage.py transcribe_radio` runs or queues it by hand (`--redo` after
  a model change). Settings: `RADIO_TRANSCRIPTION_ENABLED`, `RADIO_WHISPER_MODEL`,
  `RADIO_WHISPER_DIR`, `RADIO_WHISPER_THREADS`, and `RADIO_RELAY_URL` / `RADIO_RELAY_TOKEN`
  for a server the CDN refuses: clips are then fetched from a relay that serves the same
  `/static/…/TeamRadio/*.mp3` paths and nothing else, behind a bearer token.
- `GET /api/v1/sessions/{id}/radio` adds the car's `lap` (from lap start times),
  `transcript` (`null` until transcribed, empty when nothing intelligible was said) and
  `transcript_confidence`. Its ETag follows the latest transcription.
- The local live process (`manage.py live`) transcribes new clips in a thread every 2 s and
  publishes the text with the next snapshot (`--no-transcribe` to skip).
- Web: a Team radio panel on the race page and on practice and qualifying replays (the
  selected driver or everyone, `?radio=all`), each clip with its player, its text, a
  "box call" tag and a button that moves the replay to that lap. Below 0.5 confidence the
  text is marked uncertain. The live page shows the text under each clip.
- Transcripts are public, with a note that they are automatic and that the clip is the
  reference.

## Consequences
- The worker needs outbound HTTPS to `livetiming.formula1.com` (or to the relay) and, once, to Hugging Face
  for the checkpoint (kept in `RADIO_WHISPER_DIR`, outside the read-only release).
- Pages play the clips from the CDN in the visitor's browser: the page policy allows
  `media-src https://livetiming.formula1.com`.
- The model is loaded once per task and released after it: about 500 MB on top of Django
  while a batch runs (about 800 MB in all, measured in production on 195 clips, whatever
  the number of clips), about 2 s per clip on two threads.
- Fixtures mode has no clip source: tests use a scripted transport and a fake transcriber,
  and the demo shows clips as "transcription on its way".
- Words can be wrong (names, radio noise). `small.en` is more accurate for about three times
  the CPU and memory; switch with `RADIO_WHISPER_MODEL`, then `transcribe_radio --redo`.
