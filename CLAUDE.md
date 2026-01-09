# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a vanilla JavaScript web application for tracking cards during Twilight Struggle board game sessions. It's a single-page application that runs entirely in the browser with no build step or backend.

## Technology Stack

- Pure HTML/CSS/JavaScript (no framework)
- LocalStorage for game state persistence
- Single `index.html`, `script.js`, `style.css` structure
- `cards.json` contains the Twilight Struggle card database

## Running the Application

Since this is a static web application with no build process:

1. **Development**: Open `index.html` directly in a browser, or use a local server:
   ```bash
   python -m http.server 8000
   # or
   npx serve .
   ```

2. **No build, test, or lint commands** - this is vanilla JavaScript with no tooling.

## Core Architecture

### State Management

The application uses a hybrid state management approach:

1. **LocalStorage Schema**:
   - `cardCounter_games`: Array of game metadata `[{id, name}]`
   - `cardCounter_currentGame`: Currently selected game ID
   - `cardCounter_game_{gameId}`: Individual game data including:
     - `title`: Game title
     - `notes`: User notes
     - `cardPositions`: Object mapping location IDs to arrays of card data
     - `lastModified`: ISO timestamp

2. **In-Memory State**:
   - `selectedHandLocation`: Which hand is currently selected ('your-hand' or 'opponent-hand')
   - `useShortNames`: Boolean for card name display mode
   - `selectedType`: Currently selected card type filter (default: '-')
   - `selectedRegion`: Currently selected region filter (default: '-')
   - `fullCardData`: Card database lookup object (name -> card data)
   - `actionHistory`: Array of undo actions (not persisted)
   - `currentGameId`: Currently loaded game ID
   - `isLoading`: Flag to prevent auto-save during load operations

### Card Locations

Cards exist in specific DOM containers with these IDs:
- `your-hand`: Player's hand
- `opponent-hand`: Opponent's hand (supports unknown cards)
- `deck-us`: US cards in deck
- `deck-neutral`: Neutral cards in deck
- `deck-ussr`: USSR cards in deck
- `discard`: Discard pile
- `removed`: Removed from game pile
- `box`: Hidden container for mid/late war cards not yet in play

### Card Data Model

Each card has:
- `cardId`: Unique numeric ID
- `name`: Full card name
- `short`: Abbreviated name (e.g., "nato" for "NATO")
- `eventType`: "us", "ussr", or "neutral"
- `ops`: Operation points (0-4)
- `canBeRemoved`: Boolean indicating if card can be removed from game
- `war`: "early", "mid", or "late" (determines when card enters deck)
- `types`: Array of card type tags (e.g., ["china", "defcon-modify", "hand-modify", "key", "suicide", "vps", "wars"])
- `regions`: Array of region tags (e.g., ["africa", "asia", "central-america", "europe", "middle-east", "south-america", "southeast-asia"])

Card elements store types and regions in `dataset.types` and `dataset.regions` as JSON strings for filtering.

### Undo System

The undo system (`actionHistory`) records actions with before/after snapshots:
- Maximum 20 actions stored
- Rate limited to 100ms between undos
- Action types: MOVE_CARD, ADD_UNKNOWN, REMOVE_UNKNOWN, ADD_DISCARDS, ADD_MID_WAR, ADD_LATE_WAR, REORDER_HAND
- Undo history is NOT persisted with game saves
- Keyboard shortcut: Ctrl/Cmd+Z (when not focused on input/textarea)

### Card Sorting

- **Automatic sorting**: Deck subsections sort by ops (ascending) then name
- **Discard/Removed sorting**: Sort by event type first (US, Neutral, USSR), then ops (ascending), then name
- **Manual sorting**: Hand locations (`your-hand`, `opponent-hand`) support drag-and-drop reordering
- Function: `sortCardsInContainer(container)` - skips sorting for hand locations via `shouldAutoSort()`

### Key Interactions

1. **Moving cards**:
   - Click card text: Toggle between deck and selected hand
   - Click discard icon (↓): Move to discard
   - Click remove icon (⊘): Move to removed (only if `canBeRemoved`)
   - Drag and drop: Reorder within hand locations

2. **Bulk operations**:
   - "Re-add Discards": Moves deck to opponent's hand, discard to deck
   - "Add Mid"/"Add Late": Moves mid/late war cards from box to deck
   - All bulk operations are undoable

3. **Unknown cards**:
   - Created with "+" button in opponent's hand header
   - Display current deck average instead of specific ops
   - Can be removed with "−" button
   - Automatically update when deck average changes

4. **Card highlighting**:
   - Filter cards by type (China, DEFCON Modify, Hand Modify, Key, Suicide, VPs, Wars)
   - Filter cards by region (Africa, Asia, Central America, Europe, Middle East, South America, Southeast Asia)
   - Both filters can be active simultaneously (OR logic - card matches if it has the type OR the region)
   - "Clear" button resets both filters
   - Matching cards get `.highlighted` class applied
   - Function: `updateCardHighlighting()` - checks `selectedType` and `selectedRegion` globals

## Important Implementation Details

### Game Creation

The application uses a modal dialog for creating new games:
- Function: `showNewGameModal()` / `hideNewGameModal()`
- Collects: opponent name, your side (US/USSR), game ID
- Modal element: `#new-game-modal`
- Form element: `#new-game-form`
- Clicking outside modal closes it

### Card Counts

Discard and Removed piles display card counts in their headers:
- Elements: `#discard-count`, `#removed-count`
- Format: "X card(s)" or empty string if zero
- Updated automatically when cards move

### Auto-Save Behavior

The `autoSaveIfNeeded()` function saves the current game whenever:
- Cards are moved or reordered
- Title or notes change (but NOT during `isLoading`)
- Bulk operations complete

The `isLoading` flag prevents saves during game load/restore operations.

### Card Display Names

Cards store both full and short names in `dataset.cardName` and `dataset.cardShort`. The `useShortNames` global toggles which is displayed. When toggling, `refreshCardDisplays()` updates all card text elements without recreating cards.

### Button Visibility

Card action buttons (discard/remove icons) have complex visibility rules:
- Remove icon hidden if card is in "removed" location OR `canBeRemoved === false`
- Discard icon hidden if card is in "discard" location
- `updateCardButtonVisibility()` manages this logic

### Drag and Drop

Only cards in hand locations are draggable. The drag system:
- Uses HTML5 drag and drop API
- Shows visual feedback with `.dragging` class
- Calculates drop position with `getDragAfterElement()`
- Records reorder actions for undo

### Card Data Enrichment

When loading saved games, `enrichCardData()` merges saved card data with full card data from `fullCardData` lookup. This ensures cards retain properties like `canBeRemoved` even if not explicitly saved.

## Common Pitfalls

1. **Don't save during load**: Always check `isLoading` before calling `saveCurrentGame()` in event handlers
2. **Skip undo during restore**: Pass `{skipUndo: true}` or `{isUndoOperation: true}` to prevent recording undo actions during game load/undo
3. **Update button visibility**: Call `updateCardButtonVisibility()` after moving cards to update icon states
4. **Sort after bulk moves**: Call `sortCardsInContainer()` after moving multiple cards
5. **Finalize undo actions**: Always call `finalizeAction(action)` after operations complete to capture "after" state
6. **Event type subsections**: Cards in deck go to subsections based on `eventType`, not directly to "deck"
7. **Card metadata**: When adding new cards or modifying card data, ensure `types` and `regions` arrays are properly populated in `cards.json`
8. **Highlighting updates**: Call `updateCardHighlighting()` after adding/removing cards or changing filters to ensure highlight state is correct
