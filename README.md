# KruDee Timestamp

Electron RFID timestamp kiosk for KruDee schools. Students tap keyboard-wedge RFID cards; the kiosk displays the matched student, speaks a Thai greeting, stores events locally in SQLite, and syncs with the KruDee server every 5 minutes.

## Development

```bash
npm install
npm run dev
npm run typecheck
npm run build
```

Default server base URL is `http://localhost:3000`.

## Packaging

```bash
npm run build:linux
npm run build:win
npm run build:mac
```

## Notes

- Keyboard-wedge RFID capture runs in the renderer via keydown buffering.
- Serial/HID readers can later implement `src/main/rfid/reader.ts`.
- TTS uses Linux `espeak`, macOS `say`, and Windows PowerShell SpeechSynthesizer.
- `src/main/tts/cache.ts` is a stub for future cached speech assets.
