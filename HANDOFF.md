# Chronos Voyager — Handoff per nuova chat

Data: 2026-04-20. Progetto: `/Users/niccolo/Progetti/chronos-voyager`.

## Stato del gioco

Three.js + TypeScript. 10 ere storiche, ognuna con un flow corridor (tubo cilindrico nello spazio) che il giocatore percorre raccogliendo oggetti sacri. 18 puzzle in-flow (9 ere × 2) + Egitto con i suoi puzzle.

## Cosa è stato fatto in questa sessione (già committato)

### Puzzle port iOS → web (completo)
Tutti i 18 puzzle Math Vs Time iOS portati. File in `src/puzzles/`. Integrati in `src/Game.ts` via `buildPuzzleForEra`.

### Sfondo corridoio arricchito
- **`src/render/CorridorAura.ts` (FRAG shader)**: aggiunti glifi floor, strisce, halo basso, tinta pavimento più calda, haze soffitto. Il pavimento non è più piatto.
- **`src/render/FloorGlyphs.ts` (NUOVO)**: 28 tessere emissive procedurali (archi, croce, rombi) che scorrono sul pavimento, tintate con `era.palette.accent`. Recycle-chain come `Decorations`.
- **`src/gameplay/Flow.ts`**: integrato `floorGlyphs` in costruttore, `init()`, `update()`, `recenter()`.

### Fix divinità celesti in flow tiltati
- **`src/render/CelestialGods.ts`**: `update()` ora accetta `flowQuat?: Quaternion`; l'offset orbita è calcolato in frame locale del flow e poi ruotato nel mondo. In Egitto (quaternion identità) comportamento invariato.
- **`src/Game.ts`**: passa `activeFlow.quaternion` a `celestial.update`.
- Verifica programmatica (Revolution, asse [0.91,-0.38,-0.19]): tutte le 8 divinità hanno `flowLocalY` positivo (18-42) nonostante `worldOffY` vari da -44 a +76 → sempre "in cielo" relativamente al corridoio.

## ⚠️ Problemi aperti segnalati dall'utente (DA SISTEMARE NELLA NUOVA CHAT)

Feedback ricevuto su screenshot fornito dall'utente in free space:

### 1. "Spaccatura nello sfondo esterno"
Dall'esterno si vedono i tubi degli altri flussi come bande diagonali luminose, e al loro interno si intravedono Track/Decorations/Collectibles/FloorGlyphs come specks. Sembra che il tubo abbia una "crepa" che mostra il suo contenuto.

**Causa**: in `src/gameplay/FlowManager.ts:208`, quando il ship è in free space, TUTTI i flussi vengono resi visibili (`isActive || shipInFreeSpace`) e anche i contenuti interni (obstacles, orbs, glifi pavimento) renderizzano da fuori.

**Fix proposto**: aggiungere un metodo `Flow.setExteriorOnly(bool)` che nasconde i sottogruppi interni (`track.group`, `decorations.group`, `collectibles.group`, `floorGlyphs.group`) ma tiene visibile solo `corridorAura.group`. FlowManager lo chiama per i flussi non-active quando `shipInFreeSpace`.

### 2. Aura: modifiche shader non devono essere visibili dall'esterno
Gli arricchimenti aggiunti al FRAG di `CorridorAura.ts` (glyphs grid, stripes, lowerHalo, floorDetail, ceilingHaze, floor tint più calda) contribuiscono al **colore** delle bande anche quando `uOutside = 1`. Da fuori si vede il pattern interno come variazione di colore sul tubo.

**Fix**: moltiplicare tutti i contributi di arricchimento per `(1.0 - uOutside)` nel FRAG. Cercare `floorDetail`, `lowerHalo`, `ceilingHaze`, e la mix `floorTint` — tutti devono decadere a 0 quando `uOutside` è 1. Il `baseline` e la `outerSkin` (alpha) restano come ora.

Righe interessate in `src/render/CorridorAura.ts`:
- riga ~87 `bands += lowerHalo + floorDetail;` → `* (1.0 - uOutside)`
- riga ~94 `bands += ceilingHaze * 0.12;` → stessa cosa
- riga ~112 `floorTint` mix → solo quando inside

### 3. Collectibles "sembrano scomparire andando avanti"
L'utente ha l'impressione che gli oggetti da raccogliere si esauriscano procedendo nel flow.

**Analisi**: `src/gameplay/Collectibles.ts` ha POOL_SIZE=22, `layOutChainAround` piazza simmetricamente (11 dietro + 11 avanti). Logica di recycle sembra corretta (orbs che passano dietro ritornano avanti). Ma:
- Solo 11 orb avanti a ~30 unit spacing = 330 unit di copertura (a 40 u/s = 8s di orb visibili)
- I 11 dietro sono "sprecati" finché non vengono riciclati
- La branch `dz < -RECYCLE_DIST` (orb molto avanti) sposta l'orb **dietro** — errato per il goal di "sempre avanti"

**Fix proposto**:
- Aumentare POOL_SIZE a ~32-40
- In `layOutChainAround`, biasare verso avanti: es. 6 dietro + 28 avanti
- Rimuovere o invertire la branch `dz < -RECYCLE_DIST`

## File chiave da leggere nella nuova chat

- `src/gameplay/FlowManager.ts` — setVisible logic (riga 208)
- `src/gameplay/Flow.ts` — struttura gruppi interni
- `src/render/CorridorAura.ts` — FRAG shader, gating `uOutside`
- `src/gameplay/Collectibles.ts` — chain logic
- `src/render/CelestialGods.ts` — già OK, solo riferimento
- `src/render/FloorGlyphs.ts` — già OK, solo riferimento

## Stato dev server

Preview server attivo su porta 5173 (launch.json: `voyager`). Usare `preview_list` / `preview_start` / `preview_eval` / `preview_screenshot` per verifiche.

## Note

- **Asset binari**: `public/models/` (63MB) e `public/hdri/` (1.3MB) sono nel repo ma non ancora committati. Possibile che il push richieda git-lfs — decidere con l'utente.
- **`.scratch/`**: aggiunto a `.gitignore` (tooling locale).
- **Gioco iOS `ChronosMathematica`**: progetto sorella in Xcode, non toccato in questa sessione. Le puzzle iOS sono state portate in web mantenendo il comportamento.
