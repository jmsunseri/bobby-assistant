# Tiny Assistant

Tiny Assistant is an LLM-based assistant that runs on your Pebble smartwatch,
if you still have a smartwatch that ceased production in 2016 lying around.

![A screenshot from a Pebble smartwatch running the Tiny Assistant. The user asked for the time, the assistant responded that it was 3:59 PM.](./docs/screenshot.png)

## Usage

### Server

To use Tiny Assistant, you will need to run the server in `service/` somewhere
your phone can reach.

You will also need to set a few environment variables:

- `GEMINI_KEY` - a key for Google's Gemini - you can get one at the
  [Google AI Studio](https://aistudio.google.com)
- `REDIS_URL` - a URL for a functioning Redis server. No data is persisted
  long-term, so a purely in-memory server is fine.
- `USER_IDENTIFICATION_URL` - a URL pointing to an instance of
  [user-identifier](https://github.com/pebble-dev/user-identifier).
- `MAPBOX_KEY` - an API key for [Mapbox](https://www.mapbox.com), which is
  used for geocoding. If no key is provided, geocoding will be unavailable.

### Client

Update the URL in `app/src/pkjs/urls.js` to point at your instance of the
server.

Then you can simply build it using the Pebble SDK and install on your watch.

## Local agent (cloudflare branch)

This branch moves the agent loop out of the `service/` Go server and into the
phone's PebbleKit JS. Prompts go directly from the phone to Cloudflare Workers
AI; the Go service is left in the tree but is not used by the app.

- **Routing:** Clef-flash picks a tool, or falls back to chat/multi-step.
- **Extraction:** Clairic pulls typed arguments out of the request.
- **Tools:** time, alarms, timers, reminders, weather (Open-Meteo), currency
  (ExchangeRate-API), and web search (Brave). Tools whose key is missing are
  hidden from the router.
- **Replies:** deterministic tool results use templates, so no model is asked
  to confirm that a timer was set. Open-ended chat, multi-step requests, and
  results that need interpretation use a Workers AI language model.
- **State:** one conversation thread is persisted in the phone's
  `localStorage`; the watch no longer needs a server thread.

Set it up in the app's Clay settings:

1. Cloudflare account ID and an API token with Workers AI access.
2. Whether the account has the Workers Paid plan (filters the model list).
3. A language model: DeepSeek V4.1 Flash, Inkling 2 Small, GLM-5.3, Qwen 3.8,
   or Gemma 4. Kimi K2.6, GLM-5.3-flash, and Nemotron were retired by
   Cloudflare on 20 November 2026 and are not offered.
4. Optionally, Brave Search, ExchangeRate-API, and Mapbox keys.

API keys stay in the phone's local storage. The app uses manifest version 2
permissions to declare `Location`, `Timeline`, and the exact `Internet` hosts
it contacts; see `app/package.json`.

Tests for the routing, extraction, history, template, and tool helpers use
Vitest:

```sh
npm install
npm test
```

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for details.

## License

Apache 2.0; see [`LICENSE`](LICENSE) for details.

## Disclaimer

This project is not an official Google project. It is not supported by
Google and Google specifically disclaims all warranties as to its quality,
merchantability, or fitness for a particular purpose.
  
