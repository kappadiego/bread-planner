# Bread Planner

Web app responsive per calcolare ingredienti base di pane con starter/lievito madre usando le percentuali del panificatore.

## Sviluppo locale

La versione principale e' una app React, TypeScript, Vite e Tailwind CSS.

```bash
npm install
npm run dev
```

Apri poi l'indirizzo mostrato da Vite, normalmente:

```text
http://127.0.0.1:5173/
```

## Build e preview

```bash
npm run build
npm run preview
```

`npm run build` esegue prima il controllo TypeScript e poi genera la build Vite in `dist/`.

## Fallback standalone

`standalone.html` contiene una versione statica apribile direttamente dal browser senza server locale. Usala solo come fallback rapido o per confronto: il flusso di sviluppo ufficiale passa da `index.html` + Vite.

## Troubleshooting

- Se `npm` non e' disponibile, installa Node.js oppure usa un ambiente dove `npm` sia nel `PATH`.
- Se Vite/Rollup fallisce su una dipendenza nativa come `@rollup/rollup-darwin-arm64`, elimina `node_modules` e reinstalla con `npm install`.
- Se il push verso GitHub fallisce con `Permission denied (publickey)`, autorizza sul tuo account GitHub la chiave SSH del Mac oppure usa HTTPS/GitHub Desktop.
- Prima delle prossime release e' stato previsto un backup Git locale con branch e tag timestampati.
