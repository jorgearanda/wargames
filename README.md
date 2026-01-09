# Wargames - A Twilight Struggle Card Tracker

This is a card tracker for Twilight Struggle board game sessions, inspired by [David McHealy's](https://david.mcwebsite.net/ts/).

## Features

- **Card Management**: Move cards between your hand, opponent's hand, deck, discard pile, and removed pile
  - Add cards to your opponent's hand by first clicking the title of their card region
  - Sort the cards in your hand and your opponents by dragging and dropping
  - Keep track of unknown cards in your opponent's hand and provide an estimate of their operations points
- **Card Highlighting**: Filter and highlight cards by type or region they can influence
- **Undo Support**: Undo your last 20 actions with Ctrl/Cmd+Z
- **Notes** Keep notes for your game in the text area provided
- **Multiple Games**: Save and switch between different game sessions
- **Persistent Storage**: All data saved locally in your browser, not shared anywhere else

## Run Locally

Clone this repo, then run a local server:

```bash
python3 -m http.server 8000
```

...and visit `http://localhost:8000`
