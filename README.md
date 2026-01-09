# Wargames - A Twilight Struggle Card Tracker

This is a card tracker for Twilight Struggle board game sessions, created by Jorge Aranda and inspired by [David McHealy's](https://david.mcwebsite.net/ts/).

## Features

- **Multiple Games**: Keep track of different games in the same tab, auto-saving and switching between them
- **Card Management**: Move cards between your hand, your opponent's hand, deck, discard pile, and removed pile
  - Add cards to your opponent's hand by first clicking the title of their card region
  - Sort the cards in your hand and your opponents' by dragging and dropping
  - Keep track of unknown cards in your opponent's hand and provide an estimate of their operations points
- **Card Highlighting**: Filter and highlight cards by type or region they can influence
- **Undo**
- **Notes**: Keep notes for your game in the text area provided
- **Persistent Storage**: All data saved locally in your browser, not shared anywhere else

## Try it Out

https://jorgearanda.github.io/wargames/

## Run Locally

If you'd rather run the app locally, clone this repo, then run a local server:

```bash
python -m http.server 8000
```

...and visit `http://localhost:8000`
