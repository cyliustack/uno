# UNO (JavaScript)

Browser-based UNO against 1–3 AI opponents. No build step — ES modules served over HTTP.

## Run locally

```bash
cd uno
python3 -m http.server 8080
```

Open [http://localhost:8080](http://localhost:8080).

## Rules implemented

- Match by color, number, or action symbol
- Skip, Reverse, Draw Two, Wild, Wild Draw Four
- Stacked draw penalties (+2 / +4)
- Call **UNO!** with one card left (forget = draw 2)
- First player to empty their hand wins

## Project layout

| File | Role |
|------|------|
| `js/cards.js` | Deck composition and card helpers |
| `js/deck.js` | Shuffle and draw |
| `js/rules.js` | Legal plays and scoring |
| `js/game.js` | Game state and turn logic |
| `js/ai.js` | Simple AI card selection |
| `js/ui.js` | DOM rendering |
| `js/main.js` | App entry and event wiring |

## Play

1. Enter your name and pick how many AI opponents.
2. Click **Deal cards**.
3. On your turn, click a highlighted card or **Draw** / the deck pile.
4. Tap **UNO!** when you have one card left.
5. For wild cards, pick a color from the picker.
