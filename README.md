# Embrace

A chess game where nothing is ever captured. Pieces **pair up**, pairs set off **chain reactions**, and you win by **hugging the enemy king**.

It's an installable web app (PWA): it works offline and can be added to a phone's home screen.

## Play

- **vs Computer**: *Relaxed* or *Tricky*, and you can play Light, Dark or a random side
- **Two players, one phone**: pass and play
- Undo, flip the board, and your current game is saved automatically

## Rules

1. Same board, pieces and moves as chess, but nothing is captured.
2. **Hug**: move onto a lone enemy piece and the two become a *pair* on that square.
3. **Pairs are shared**: either player can move a pair by moving their own piece in it. The partner comes along. Pairs only move to empty squares.
4. **Chain reactions**: move a lone piece onto a pair and it takes your piece's place there. The bumped piece must move right away: to an empty square, onto a lone enemy (hug), or into another pair (the chain continues).
5. Kings only move to empty squares. Castling works; there is no check.
6. Pawns move forward to empty squares and diagonally to hug or bump. They become queens on the far rank.
7. **Win by hugging the enemy king.** A draw happens if the same position comes up three times, or if the side to move has no moves.

## Install on a phone

The app has to be served over HTTPS. The simplest way is GitHub Pages:

1. In the repo go to **Settings → Pages**.
2. Set *Source* to **Deploy from a branch**, then pick the branch and the `/ (root)` folder.
3. Open the Pages URL on your phone:
   - **Android (Chrome)**: tap **Install app** on the menu screen, or use ⋮ → *Install app*.
   - **iPhone (Safari)**: tap **Share** → **Add to Home Screen**.

## Run locally

It's a static site with no build step:

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

## Files

| File | Purpose |
| --- | --- |
| `rules.js` | Rules engine (moves, pairs, chain reactions, win/draw) |
| `ai.js` | Computer opponent |
| `pieces.js` | Piece artwork (inline SVG) |
| `app.js` | UI, saving, install prompt |
| `sw.js` | Service worker for offline play (bump `CACHE` when you change files) |
| `manifest.webmanifest`, `icons/` | PWA metadata and icons |
