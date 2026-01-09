let selectedHandLocation = 'your-hand'; // Default to Your Hand
let useShortNames = false; // Global variable to track short name display
let fullCardData = {}; // Store full card data by name for lookup
let selectedType = '-'; // Selected type filter
let selectedRegion = '-'; // Selected region filter
let midWarAdded = false; // Track if mid war cards have been added
let lateWarAdded = false; // Track if late war cards have been added

// Undo system
let actionHistory = [];
const MAX_HISTORY_SIZE = 20;
let lastUndoTime = 0;
const UNDO_RATE_LIMIT_MS = 100; // Prevent accidental rapid undos

// Action types for undo system
const ACTION_TYPES = {
    MOVE_CARD: 'move_card',
    ADD_UNKNOWN: 'add_unknown',
    REMOVE_UNKNOWN: 'remove_unknown',
    ADD_DISCARDS: 'add_discards',
    ADD_MID_WAR: 'add_mid_war',
    ADD_LATE_WAR: 'add_late_war',
    REORDER_HAND: 'reorder_hand'
};

function createCardElement(cardData, currentLocation = null) {
    const cardDiv = document.createElement('div');
    cardDiv.className = 'card';
    cardDiv.dataset.war = cardData.war || 'early';
    cardDiv.dataset.canBeRemoved = cardData.canBeRemoved ? 'true' : 'false';

    // Store full card data for name switching
    cardDiv.dataset.cardName = cardData.name || '';
    cardDiv.dataset.cardShort = cardData.short || '';

    // Store types and regions for filtering
    cardDiv.dataset.types = JSON.stringify(cardData.types || []);
    cardDiv.dataset.regions = JSON.stringify(cardData.regions || []);

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'card-actions';

    const removeIcon = document.createElement('div');
    removeIcon.className = 'card-icon remove-icon';
    removeIcon.title = 'Move to Removed';
    removeIcon.textContent = '⊘';
    if (!cardData.canBeRemoved || currentLocation === 'removed') {
        removeIcon.classList.add('hidden');
    }

    const discardIcon = document.createElement('div');
    discardIcon.className = 'card-icon discard-icon';
    discardIcon.title = 'Move to Discard';
    discardIcon.textContent = '↓';
    if (currentLocation === 'discard') {
        discardIcon.classList.add('hidden');
    }

    const cardText = document.createElement('span');
    cardText.className = 'card-text';
    if (cardData.eventType) {
        cardText.classList.add(cardData.eventType);
    }
    const displayName = useShortNames ? (cardData.short || cardData.name) : cardData.name;
    cardText.textContent = `${cardData.ops}  ${displayName}`;

    actionsDiv.appendChild(removeIcon);
    actionsDiv.appendChild(discardIcon);
    cardDiv.appendChild(actionsDiv);
    cardDiv.appendChild(cardText);

    // Add drag functionality for cards in hand locations
    if (currentLocation && currentLocation.includes('hand')) {
        setupCardDragging(cardDiv);
    }

    return cardDiv;
}

function setupCardDragging(cardElement) {
    cardElement.draggable = true;

    cardElement.addEventListener('dragstart', function(e) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', cardElement.outerHTML);
        e.dataTransfer.setData('text/plain', cardElement.dataset.cardName);
        cardElement.classList.add('dragging');

        // Store reference to dragged element
        cardElement._draggedElement = cardElement;
    });

    cardElement.addEventListener('dragend', function(e) {
        cardElement.classList.remove('dragging');
        delete cardElement._draggedElement;

        // Clean up any drag indicators
        document.querySelectorAll('.drag-over').forEach(el => {
            el.classList.remove('drag-over');
        });
    });
}

function setupHandDropZone(handContainer) {
    handContainer.addEventListener('dragover', function(e) {
        if (!e.dataTransfer.types.includes('text/html')) return;

        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        const draggingCard = document.querySelector('.dragging');
        if (!draggingCard) return;

        // Find the card we're hovering over
        const afterElement = getDragAfterElement(handContainer, e.clientY);

        if (afterElement == null) {
            handContainer.appendChild(draggingCard);
        } else {
            handContainer.insertBefore(draggingCard, afterElement);
        }
    });

    handContainer.addEventListener('drop', function(e) {
        e.preventDefault();

        const draggingCard = document.querySelector('.dragging');
        if (!draggingCard || !handContainer.contains(draggingCard)) return;

        // Record action for undo
        const action = recordAction(ACTION_TYPES.REORDER_HAND, {
            location: handContainer.id,
            cardName: draggingCard.dataset.cardName
        });

        updateLocationAverages();
        updateCardHighlighting();

        // Finalize action for undo
        if (action) {
            finalizeAction(action);
        }

        // Auto-save current game state
        autoSaveIfNeeded();
    });
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.card:not(.dragging)')];

    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;

        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function updateCardButtonVisibility(cardElement, newLocationId) {
    const removeIcon = cardElement.querySelector('.remove-icon');
    const discardIcon = cardElement.querySelector('.discard-icon');

    if (removeIcon) {
        const canBeRemoved = cardElement.dataset.canBeRemoved === 'true';

        // Hide if card is in removed location OR if card is not removable
        if (newLocationId === 'removed' || !canBeRemoved) {
            removeIcon.classList.add('hidden');
            removeIcon.style.visibility = 'hidden';
        } else {
            removeIcon.classList.remove('hidden');
            removeIcon.style.visibility = 'visible';
        }
    }

    if (discardIcon) {
        if (newLocationId === 'discard') {
            discardIcon.classList.add('hidden');
            discardIcon.style.visibility = 'hidden';
        } else {
            discardIcon.classList.remove('hidden');
            discardIcon.style.visibility = 'visible';
        }
    }
}

function createUnknownCardElement() {
    const cardDiv = document.createElement('div');
    cardDiv.className = 'card unknown-card';

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'card-actions';

    // Empty space where remove button would be (for alignment)
    const emptySpace = document.createElement('div');
    emptySpace.className = 'card-icon';
    emptySpace.style.visibility = 'hidden';

    const minusIcon = document.createElement('div');
    minusIcon.className = 'card-icon unknown-minus-icon';
    minusIcon.title = 'Remove unknown card';
    minusIcon.textContent = '−';

    const cardText = document.createElement('span');
    cardText.className = 'card-text unknown-card-text';
    const deckStats = calculateDeckAverage();
    cardText.textContent = `${deckStats.average.toFixed(1)}  ?`;

    actionsDiv.appendChild(emptySpace);
    actionsDiv.appendChild(minusIcon);
    cardDiv.appendChild(actionsDiv);
    cardDiv.appendChild(cardText);

    return cardDiv;
}

async function loadCardDatabase() {
    try {
        console.log('Loading card database from cards.json');
        const response = await fetch('cards.json');

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const cards = await response.json();

        // Store full card data for lookup by name
        cards.forEach(card => {
            fullCardData[card.name] = card;
        });

        console.log('Card database loaded successfully');
        return cards;
    } catch (error) {
        console.error('Error loading card database:', error);
        throw error;
    }
}

async function loadCards() {
    try {
        const cards = await loadCardDatabase();

        cards.forEach(cardData => {
            let targetLocation, targetLocationId;

            // Put mid/late war cards in the hidden box, early war cards in deck
            if (cardData.war === 'early') {
                targetLocation = getDeckSubsection(cardData.eventType);
                targetLocationId = targetLocation.id;
            } else {
                targetLocation = document.getElementById('box');
                targetLocationId = 'box';
            }

            const cardElement = createCardElement(cardData, targetLocationId);
            targetLocation.appendChild(cardElement);
        });

        // Sort cards in each deck subsection
        sortAllDeckSubsections();

        // Update averages
        updateLocationAverages();

        // Update highlighting
        updateCardHighlighting();

        console.log('Cards rendered and sorted in deck');
    } catch (error) {
        console.error('Error loading cards:', error);
        const deckArea = document.getElementById('deck');
        deckArea.innerHTML = `<p>Error loading cards: ${error.message}</p>`;
    }
}

function getDeckSubsection(eventType) {
    switch(eventType) {
        case 'us': return document.getElementById('deck-us');
        case 'ussr': return document.getElementById('deck-ussr');
        case 'neutral': return document.getElementById('deck-neutral');
        default: return document.getElementById('deck-neutral');
    }
}

function getCardEventType(cardElement) {
    const cardTextElement = cardElement.querySelector('.card-text');
    if (!cardTextElement) return 'neutral';

    if (cardTextElement.classList.contains('us')) {
        return 'us';
    } else if (cardTextElement.classList.contains('ussr')) {
        return 'ussr';
    }
    return 'neutral';
}

function getCardData(cardElement) {
    const cardText = cardElement.querySelector('.card-text').textContent;
    const opsMatch = cardText.match(/^(\d+(?:\.\d+)?)  (.+)$/);
    if (opsMatch) {
        return {
            ops: parseFloat(opsMatch[1]),
            name: cardElement.dataset.cardName || opsMatch[2], // Use stored full name if available
            short: cardElement.dataset.cardShort || opsMatch[2] // Include short name too
        };
    }
    return {
        ops: 0,
        name: cardElement.dataset.cardName || cardText,
        short: cardElement.dataset.cardShort || cardText
    };
}

function enrichCardData(savedCardData) {
    // If we have the full card data for this name, merge it
    if (fullCardData[savedCardData.name]) {
        return {
            ...fullCardData[savedCardData.name],
            ops: savedCardData.ops // Keep the ops from saved data in case it was modified
        };
    }
    // Fallback to saved data if not found in full data
    return savedCardData;
}

function shouldAutoSort(containerId) {
    // Don't auto-sort hand locations - allow manual sorting
    return !containerId.includes('hand');
}

function sortCardsInContainer(container) {
    // Skip sorting for hand locations
    if (!shouldAutoSort(container.id)) {
        return;
    }

    const cards = Array.from(container.children);
    const isDiscardOrRemoved = container.id === 'discard' || container.id === 'removed';

    cards.sort((a, b) => {
        const dataA = getCardData(a);
        const dataB = getCardData(b);

        // For discard and removed: sort by event type first (US, Neutral, USSR)
        if (isDiscardOrRemoved) {
            const typeA = getCardEventType(a);
            const typeB = getCardEventType(b);
            const typeOrder = { 'us': 0, 'neutral': 1, 'ussr': 2 };
            if (typeA !== typeB) {
                return typeOrder[typeA] - typeOrder[typeB];
            }
        }

        // Sort by ops (ascending)
        if (dataA.ops !== dataB.ops) {
            return dataA.ops - dataB.ops;
        }

        // Then by name (alphabetical)
        return dataA.name.localeCompare(dataB.name);
    });

    // Remove all cards and re-add them in sorted order
    cards.forEach(card => card.remove());
    cards.forEach(card => container.appendChild(card));
}

function calculateAverageOps(container) {
    const cards = Array.from(container.children);
    if (cards.length === 0) return { count: 0, sum: 0, average: 0 };

    const totalOps = cards.reduce((sum, card) => {
        const data = getCardData(card);
        return sum + data.ops;
    }, 0);

    return {
        count: cards.length,
        sum: totalOps,
        average: totalOps / cards.length
    };
}

function calculateDeckAverage() {
    const deckUS = document.getElementById('deck-us');
    const deckNeutral = document.getElementById('deck-neutral');
    const deckUSSR = document.getElementById('deck-ussr');
    const allDeckCards = [
        ...Array.from(deckUS.children),
        ...Array.from(deckNeutral.children),
        ...Array.from(deckUSSR.children)
    ];

    if (allDeckCards.length === 0) return { count: 0, sum: 0, average: 0 };

    const totalOps = allDeckCards.reduce((sum, card) => {
        const data = getCardData(card);
        return sum + data.ops;
    }, 0);

    return {
        count: allDeckCards.length,
        sum: totalOps,
        average: totalOps / allDeckCards.length
    };
}

// Undo system functions
function getGameSnapshot() {
    return {
        cardPositions: getCardPositions(),
        selectedHandLocation: selectedHandLocation,
        midWarAdded: midWarAdded,
        lateWarAdded: lateWarAdded,
        timestamp: Date.now()
    };
}

function recordAction(actionType, actionData = {}) {
    // Don't record actions during undo operations
    if (actionData.isUndoOperation) {
        return null;
    }

    const beforeState = getGameSnapshot();
    const action = {
        type: actionType,
        timestamp: Date.now(),
        beforeState: beforeState,
        afterState: null, // Will be set after operation completes
        actionData: actionData
    };

    // Store reference to be filled after operation
    actionHistory.push(action);

    // Trim history if too large
    if (actionHistory.length > MAX_HISTORY_SIZE) {
        actionHistory.shift();
    }

    return action;
}

function finalizeAction(action) {
    if (action && !action.afterState) {
        action.afterState = getGameSnapshot();
    }
    updateUndoButtonState();
}

function canUndo() {
    return actionHistory.length > 0;
}

function clearActionHistory() {
    actionHistory = [];
    updateUndoButtonState();
}

function updateUndoButtonState() {
    const undoButton = document.getElementById('undo-btn');
    if (undoButton) {
        undoButton.disabled = !canUndo();
        undoButton.style.opacity = canUndo() ? '1' : '0.5';

        if (canUndo()) {
            const lastAction = actionHistory[actionHistory.length - 1];
            const actionName = getActionDisplayName(lastAction.type);
            const actionTime = new Date(lastAction.timestamp).toLocaleTimeString();
            undoButton.title = `Undo: ${actionName} (${actionTime})\n${actionHistory.length} actions available\nKeyboard: Ctrl+Z`;
        } else {
            undoButton.title = 'No actions to undo\nKeyboard: Ctrl+Z';
        }
    }
}

function getActionDisplayName(actionType) {
    const displayNames = {
        [ACTION_TYPES.MOVE_CARD]: 'Move Card',
        [ACTION_TYPES.ADD_UNKNOWN]: 'Add Unknown Card',
        [ACTION_TYPES.REMOVE_UNKNOWN]: 'Remove Unknown Card',
        [ACTION_TYPES.ADD_DISCARDS]: 'Add Discards',
        [ACTION_TYPES.ADD_MID_WAR]: 'Add Mid War Cards',
        [ACTION_TYPES.ADD_LATE_WAR]: 'Add Late War Cards',
        [ACTION_TYPES.REORDER_HAND]: 'Reorder Hand'
    };
    return displayNames[actionType] || actionType;
}

function performUndo() {
    if (!canUndo()) {
        return false;
    }

    // Rate limiting to prevent accidental rapid undos
    const now = Date.now();
    if (now - lastUndoTime < UNDO_RATE_LIMIT_MS) {
        console.log('Undo rate limited');
        return false;
    }
    lastUndoTime = now;

    const lastAction = actionHistory.pop();

    if (lastAction && lastAction.beforeState && lastAction.beforeState.cardPositions) {
        // Optional confirmation for bulk operations
        const isBulkOperation = [
            ACTION_TYPES.ADD_DISCARDS,
            ACTION_TYPES.ADD_MID_WAR,
            ACTION_TYPES.ADD_LATE_WAR
        ].includes(lastAction.type);

        if (isBulkOperation && !confirmBulkUndo(lastAction)) {
            // User cancelled, put the action back
            actionHistory.push(lastAction);
            updateUndoButtonState();
            return false;
        }

        console.log(`Undoing action: ${lastAction.type} from ${new Date(lastAction.timestamp).toLocaleTimeString()}`);
        console.log('Before undo - Current state:', getGameSnapshot().cardPositions);
        console.log('Restoring to state:', lastAction.beforeState.cardPositions);

        // Restore the previous state
        restoreGameSnapshot(lastAction.beforeState, { isUndoOperation: true });

        // Visual feedback for undo
        showUndoFeedback();

        updateUndoButtonState();
        return true;
    } else {
        console.error('Cannot undo - invalid action or state:', lastAction);
        // Put the action back if it was invalid
        if (lastAction) {
            actionHistory.push(lastAction);
        }
        return false;
    }
}

function confirmBulkUndo(action) {
    // For now, we'll skip confirmation to keep UX simple
    // Could add this later with a setting: return confirm(`Undo ${getActionDisplayName(action.type)}?`);
    return true;
}

function showUndoFeedback() {
    // Flash the main locations area to indicate undo occurred
    const locations = document.querySelector('.locations');
    if (locations) {
        locations.classList.add('undo-flash');
        setTimeout(() => {
            locations.classList.remove('undo-flash');
        }, 300);
    }

    // Also flash the undo button briefly
    const undoButton = document.getElementById('undo-btn');
    if (undoButton) {
        undoButton.style.transform = 'scale(0.95)';
        setTimeout(() => {
            undoButton.style.transform = '';
        }, 150);
    }
}

function restoreGameSnapshot(snapshot, options = {}) {
    // Restore card positions
    if (snapshot.cardPositions) {
        restoreCardPositions(snapshot.cardPositions, options);
    }

    // Restore selected hand location
    if (snapshot.selectedHandLocation) {
        selectedHandLocation = snapshot.selectedHandLocation;
        selectHandLocation(selectedHandLocation);
    }

    // Restore war card flags
    midWarAdded = snapshot.midWarAdded || false;
    lateWarAdded = snapshot.lateWarAdded || false;
    updateWarButtonStates();

    // Update averages
    updateLocationAverages();

    // Update highlighting
    updateCardHighlighting();

    // Auto-save if not during undo operation
    if (!options.isUndoOperation) {
        autoSaveIfNeeded();
    }
}

function updateLocationAverages() {
    // First update all unknown cards with current deck average
    const deckStats = calculateDeckAverage();
    const unknownCards = document.querySelectorAll('.unknown-card-text');
    unknownCards.forEach(cardText => {
        cardText.textContent = `${deckStats.average.toFixed(1)}  ?`;
    });

    // Update Your Hand average
    const yourHandContainer = document.getElementById('your-hand');
    const yourHandStats = calculateAverageOps(yourHandContainer);
    document.getElementById('your-hand-avg').textContent =
        yourHandStats.count > 0 ? `${yourHandStats.count} cards, ${yourHandStats.sum.toFixed(0)} ops, ${yourHandStats.average.toFixed(1)}/card` : '';

    // Update Opponent's Hand average
    const opponentHandContainer = document.getElementById('opponent-hand');
    const opponentHandStats = calculateAverageOps(opponentHandContainer);
    document.getElementById('opponent-hand-avg').textContent =
        opponentHandStats.count > 0 ? `${opponentHandStats.count} cards, ${opponentHandStats.sum.toFixed(1)} ops, ${opponentHandStats.average.toFixed(1)}/card` : '';

    // Update Deck average
    document.getElementById('deck-avg').textContent =
        deckStats.count > 0 ? `${deckStats.count} cards, ${deckStats.sum.toFixed(0)} ops, ${deckStats.average.toFixed(1)}/card` : '';

    // Update Discard count
    const discardContainer = document.getElementById('discard');
    const discardCount = discardContainer.children.length;
    document.getElementById('discard-count').textContent =
        discardCount > 0 ? `${discardCount} card${discardCount !== 1 ? 's' : ''}` : '';

    // Update Removed count
    const removedContainer = document.getElementById('removed');
    const removedCount = removedContainer.children.length;
    document.getElementById('removed-count').textContent =
        removedCount > 0 ? `${removedCount} card${removedCount !== 1 ? 's' : ''}` : '';
}

function moveCard(cardElement, targetLocationId, options = {}) {
    // Record action for undo
    const action = !options.skipUndo ? recordAction(ACTION_TYPES.MOVE_CARD, {
        cardName: getCardData(cardElement).name,
        fromLocation: cardElement.closest('.card-area')?.id,
        toLocation: targetLocationId
    }) : null;

    cardElement.remove();

    let actualLocationId = targetLocationId;

    if (targetLocationId === 'deck') {
        // Get the card's event type from its text element
        const eventType = getCardEventType(cardElement);
        const targetLocation = getDeckSubsection(eventType);
        actualLocationId = targetLocation.id;
        targetLocation.appendChild(cardElement);
        sortCardsInContainer(targetLocation);
    } else {
        const targetLocation = document.getElementById(targetLocationId);
        targetLocation.appendChild(cardElement);
        sortCardsInContainer(targetLocation);
    }

    // Update button visibility based on actual final location
    updateCardButtonVisibility(cardElement, actualLocationId);

    // Enable dragging if moved to a hand location
    if (actualLocationId.includes('hand')) {
        setupCardDragging(cardElement);
    } else {
        // Remove dragging if moved away from hand
        cardElement.draggable = false;
        cardElement.classList.remove('dragging');
    }

    // Update averages after moving card
    updateLocationAverages();

    // Update highlighting for the moved card
    updateCardHighlighting();

    // Finalize action for undo
    if (action) {
        finalizeAction(action);
    }

    // Auto-save current game state
    autoSaveIfNeeded();
}

function selectHandLocation(locationId, options = {}) {
    // Remove selected class from all locations
    document.querySelectorAll('.location').forEach(loc => {
        loc.classList.remove('selected');
    });

    // Set the selected hand location
    selectedHandLocation = locationId;

    // Add selected class to opponent's hand if it's selected
    if (locationId === 'opponent-hand') {
        const opponentHandLocation = document.querySelector('#opponent-hand').closest('.location');
        if (opponentHandLocation) {
            opponentHandLocation.classList.add('selected');
        }
    }
}

document.addEventListener('click', function(e) {
    // Handle location header clicks
    if (e.target.tagName === 'H2') {
        // Find the card area - it might be a sibling of the parent container now
        let cardArea = e.target.nextElementSibling;
        if (!cardArea || !cardArea.classList.contains('card-area')) {
            // Try looking for it as a sibling of the parent
            const parentContainer = e.target.closest('.location-header');
            if (parentContainer) {
                cardArea = parentContainer.nextElementSibling;
            }
        }

        if (cardArea && cardArea.classList.contains('card-area')) {
            const locationId = cardArea.id;
            if (locationId === 'your-hand' || locationId === 'opponent-hand') {
                selectHandLocation(locationId);
            }
        }
        return;
    }

    // Handle card actions
    if (e.target.classList.contains('discard-icon')) {
        e.stopPropagation();
        const card = e.target.closest('.card');
        moveCard(card, 'discard');
    } else if (e.target.classList.contains('remove-icon')) {
        e.stopPropagation();
        const card = e.target.closest('.card');
        moveCard(card, 'removed');
    } else if (e.target.classList.contains('unknown-minus-icon')) {
        e.stopPropagation();
        const card = e.target.closest('.card');

        // Record action for undo
        const action = recordAction(ACTION_TYPES.REMOVE_UNKNOWN);

        card.remove();
        updateLocationAverages();
        updateCardHighlighting();

        // Finalize action for undo
        finalizeAction(action);

        // Auto-save current game state
        autoSaveIfNeeded();
    } else if (e.target.classList.contains('card-text')) {
        e.stopPropagation();
        const card = e.target.closest('.card');

        // Don't allow unknown cards to be moved via text clicks
        if (card.classList.contains('unknown-card')) {
            return;
        }

        const currentLocation = card.closest('.card-area');

        // If card is in Deck, move to selected hand location
        // Otherwise, move to Deck
        if (currentLocation && currentLocation.id.startsWith('deck-')) {
            moveCard(card, selectedHandLocation);
        } else {
            moveCard(card, 'deck');
        }
    }
});

// Game management state
let currentGameId = null;
let isLoading = false;
let playerSide = null; // 'US' or 'USSR'

// Game management functions
function getGamesList() {
    const games = localStorage.getItem('cardCounter_games');
    return games ? JSON.parse(games) : [];
}

function saveGamesList(games) {
    localStorage.setItem('cardCounter_games', JSON.stringify(games));
}

function getCurrentGameId() {
    if (!currentGameId) {
        currentGameId = localStorage.getItem('cardCounter_currentGame');
    }
    return currentGameId;
}

function autoSaveIfNeeded() {
    if (getCurrentGameId()) {
        saveCurrentGame();
    }
}

function setCurrentGameId(gameId) {
    currentGameId = gameId;
    localStorage.setItem('cardCounter_currentGame', gameId);
}

function getCardPositions() {
    const positions = {};
    const locations = ['your-hand', 'opponent-hand', 'deck-us', 'deck-neutral', 'deck-ussr', 'discard', 'removed', 'box'];

    locations.forEach(locationId => {
        const container = document.getElementById(locationId);
        if (container) {
            positions[locationId] = Array.from(container.children).map(card => {
                const data = getCardData(card);
                const isUnknown = card.classList.contains('unknown-card');
                return {
                    name: isUnknown ? '?' : data.name,
                    ops: data.ops,
                    eventType: getCardEventType(card),
                    canBeRemoved: !card.querySelector('.remove-icon') || !card.querySelector('.remove-icon').classList.contains('hidden'),
                    war: card.dataset.war || 'early',
                    isUnknown: isUnknown
                };
            });
        }
    });

    return positions;
}

function getGameTitle() {
    // Title is now only shown in dropdown, retrieve from game data if needed
    const gameId = getCurrentGameId();
    if (!gameId) return '';

    const games = getGamesList();
    const game = games.find(g => g.id === gameId);
    return game ? game.name : '';
}

function getGameNotes() {
    return document.getElementById('game-notes').value;
}

function setGameUIState(title, notes) {
    // Title is now only shown in dropdown, no input field to update
    document.getElementById('game-notes').value = notes || '';
}

function saveCurrentGame() {
    const gameId = getCurrentGameId();
    if (!gameId) return;

    const gameData = {
        id: gameId,
        title: getGameTitle(),
        notes: getGameNotes(),
        cardPositions: getCardPositions(),
        playerSide: playerSide, // Store the player's side
        midWarAdded: midWarAdded,
        lateWarAdded: lateWarAdded,
        lastModified: new Date().toISOString()
        // Note: We don't persist undo history with game saves for now
        // This keeps save files smaller and avoids complexity
    };

    console.log('Saving game data:', gameData);
    localStorage.setItem(`cardCounter_game_${gameId}`, JSON.stringify(gameData));
}

function loadGameData(gameId) {
    const gameData = localStorage.getItem(`cardCounter_game_${gameId}`);
    return gameData ? JSON.parse(gameData) : null;
}

function parsePlayerSideFromTitle(title) {
    // Parse from format: "Opponent Name v YOUR_SIDE (Game ID)"
    const match = title.match(/v\s+(US|USSR)\s+\(/);
    return match ? match[1] : null;
}

function applySideColors() {
    const yourHandLocation = document.querySelector('#your-hand').closest('.location');
    const opponentHandLocation = document.querySelector('#opponent-hand').closest('.location');

    // Remove existing side classes
    yourHandLocation.classList.remove('side-us', 'side-ussr');
    opponentHandLocation.classList.remove('side-us', 'side-ussr');

    if (playerSide === 'US') {
        yourHandLocation.classList.add('side-us');
        opponentHandLocation.classList.add('side-ussr');
    } else if (playerSide === 'USSR') {
        yourHandLocation.classList.add('side-ussr');
        opponentHandLocation.classList.add('side-us');
    }
}

function clearAllCards() {
    const locations = ['your-hand', 'opponent-hand', 'deck-us', 'deck-neutral', 'deck-ussr', 'discard', 'removed', 'box'];
    locations.forEach(locationId => {
        const container = document.getElementById(locationId);
        if (container) {
            container.innerHTML = '';
        }
    });
}

function restoreCardPositions(positions, options = {}) {
    clearAllCards();

    // Temporarily flag that we're in a restoration process
    // This prevents any action recording during card restoration
    const isRestoring = options.isUndoOperation || options.isLoading;

    Object.entries(positions).forEach(([locationId, cards]) => {
        const container = document.getElementById(locationId);
        if (container && cards) {
            cards.forEach(cardData => {
                let cardElement;
                if (cardData.isUnknown || cardData.name === '?') {
                    cardElement = createUnknownCardElement();
                } else {
                    const enrichedCardData = enrichCardData(cardData);
                    cardElement = createCardElement(enrichedCardData, locationId);
                }
                container.appendChild(cardElement);

                // Update button visibility for restored cards
                if (!cardData.isUnknown && cardData.name !== '?') {
                    updateCardButtonVisibility(cardElement, locationId);
                }
            });
        }
    });

    updateLocationAverages();
    updateCardHighlighting();
}

function showNewGameModal() {
    const modal = document.getElementById('new-game-modal');
    modal.style.display = 'flex';

    // Pre-populate Game ID with "Friendly"
    document.getElementById('game-id').value = 'Friendly';

    // Focus the first input
    document.getElementById('opponent-name').focus();
}

function hideNewGameModal() {
    const modal = document.getElementById('new-game-modal');
    modal.style.display = 'none';

    // Reset form
    document.getElementById('new-game-form').reset();
}

function createNewGame() {
    showNewGameModal();
}

function createGameFromForm(opponentName, yourSide, gameId) {
    const internalGameId = 'game_' + Date.now();
    const gameName = `${opponentName} v ${yourSide} (${gameId})`;

    const games = getGamesList();
    games.push({ id: internalGameId, name: gameName });
    saveGamesList(games);

    // Save current game before switching
    autoSaveIfNeeded();

    // Clear undo history when creating new game
    clearActionHistory();

    // Set the player's side
    playerSide = yourSide;

    // Reset war card flags for new game
    midWarAdded = false;
    lateWarAdded = false;
    updateWarButtonStates();

    // Initialize new game with default card setup
    isLoading = true;
    setCurrentGameId(internalGameId);
    setGameUIState(gameName, '');

    // Clear existing cards and load default cards
    clearAllCards();
    loadCards().then(() => {
        setTimeout(() => {
            isLoading = false;
            applySideColors(); // Apply colors based on side
            saveCurrentGame();
            updateGameSelector();
        }, 100); // Small delay to ensure cards are rendered
    });

    hideNewGameModal();
}

function deleteCurrentGame() {
    const gameId = getCurrentGameId();
    if (!gameId) return;

    const games = getGamesList();
    const gameIndex = games.findIndex(g => g.id === gameId);
    if (gameIndex === -1) return;

    if (!confirm(`Are you sure you want to delete "${games[gameIndex].name}"?`)) return;

    // Remove from games list
    games.splice(gameIndex, 1);
    saveGamesList(games);

    // Remove game data
    localStorage.removeItem(`cardCounter_game_${gameId}`);

    // Clear undo history when deleting game
    clearActionHistory();

    // Clear current game
    setCurrentGameId(null);
    setGameUIState('', '');
    clearAllCards();

    updateGameSelector();
}

function loadGame(gameId) {
    console.log('Loading game:', gameId);
    isLoading = true;

    // Only save current game if we're switching between games, not on initial load
    if (getCurrentGameId() && getCurrentGameId() !== gameId) {
        saveCurrentGame(); // Save current game before switching
    }

    // Clear undo history when switching games
    clearActionHistory();

    setCurrentGameId(gameId);
    const gameData = loadGameData(gameId);
    console.log('Loaded game data:', gameData);

    if (gameData) {
        setGameUIState(gameData.title, gameData.notes);

        // Load player side from game data, or parse from title if not stored
        playerSide = gameData.playerSide || parsePlayerSideFromTitle(gameData.title);

        // Load war card flags
        midWarAdded = gameData.midWarAdded || false;
        lateWarAdded = gameData.lateWarAdded || false;
        updateWarButtonStates();

        if (gameData.cardPositions) {
            restoreCardPositions(gameData.cardPositions);
            isLoading = false; // Loading complete
            applySideColors(); // Apply colors based on side
        } else {
            // If no card positions saved, load default cards
            loadCards().then(() => {
                isLoading = false; // Loading complete
                applySideColors(); // Apply colors based on side
                // Only save if this is a new game without positions
                setTimeout(() => saveCurrentGame(), 100);
            });
        }
    } else {
        // Game not found, load defaults
        console.log('Game data not found, loading defaults');
        setGameUIState('', '');
        playerSide = null;
        midWarAdded = false;
        lateWarAdded = false;
        updateWarButtonStates();
        loadCards().then(() => {
            isLoading = false; // Loading complete
            applySideColors(); // Clear any side colors
            // Save the default setup for new games
            setTimeout(() => saveCurrentGame(), 100);
        });
    }

    updateGameSelector();
}

function updateGameSelector() {
    const selector = document.getElementById('game-selector');
    const games = getGamesList();
    const currentId = getCurrentGameId();

    // Clear existing options except the first one
    selector.innerHTML = '<option value="">Select or create a game...</option>';

    // Add game options
    games.forEach(game => {
        const option = document.createElement('option');
        option.value = game.id;
        option.textContent = game.name;
        if (game.id === currentId) {
            option.selected = true;
        }
        selector.appendChild(option);
    });
}

function sortAllDeckSubsections() {
    sortCardsInContainer(document.getElementById('deck-us'));
    sortCardsInContainer(document.getElementById('deck-neutral'));
    sortCardsInContainer(document.getElementById('deck-ussr'));
}

function moveCardsToDeckByEventType(cards) {
    cards.forEach(card => {
        const eventType = getCardEventType(card);
        card.remove();
        const targetDeckSubsection = getDeckSubsection(eventType);
        const targetLocationId = targetDeckSubsection.id;
        targetDeckSubsection.appendChild(card);

        // Update button visibility for new location
        updateCardButtonVisibility(card, targetLocationId);
    });
    sortAllDeckSubsections();
}

function finalizeBulkOperation(action) {
    updateLocationAverages();
    updateCardHighlighting();
    if (action) {
        finalizeAction(action);
    }
    autoSaveIfNeeded();
}

function addDiscards(options = {}) {
    const action = !options.skipUndo ? recordAction(ACTION_TYPES.ADD_DISCARDS) : null;

    // Step 1: Move all cards from Deck subsections to Opponent's Hand
    const opponentHand = document.getElementById('opponent-hand');
    const allDeckCards = [
        ...Array.from(document.getElementById('deck-us').children),
        ...Array.from(document.getElementById('deck-neutral').children),
        ...Array.from(document.getElementById('deck-ussr').children)
    ];

    allDeckCards.forEach(card => {
        card.remove();
        opponentHand.appendChild(card);
    });
    sortCardsInContainer(opponentHand);

    // Step 2: Move all cards from Discard to appropriate Deck subsections
    const discardCards = Array.from(document.getElementById('discard').children);
    moveCardsToDeckByEventType(discardCards);

    finalizeBulkOperation(action);
}

function updateWarButtonStates() {
    const midBtn = document.getElementById('add-mid-btn');
    const lateBtn = document.getElementById('add-late-btn');

    midBtn.disabled = midWarAdded;
    lateBtn.disabled = lateWarAdded;
}

function addMidWar(options = {}) {
    const action = !options.skipUndo ? recordAction(ACTION_TYPES.ADD_MID_WAR) : null;

    const box = document.getElementById('box');
    const midWarCards = Array.from(box.children).filter(card => card.dataset.war === 'mid');

    moveCardsToDeckByEventType(midWarCards);

    midWarAdded = true;
    updateWarButtonStates();

    finalizeBulkOperation(action);
}

function addLateWar(options = {}) {
    const action = !options.skipUndo ? recordAction(ACTION_TYPES.ADD_LATE_WAR) : null;

    const box = document.getElementById('box');
    const lateWarCards = Array.from(box.children).filter(card => card.dataset.war === 'late');

    moveCardsToDeckByEventType(lateWarCards);

    lateWarAdded = true;
    updateWarButtonStates();

    finalizeBulkOperation(action);
}

function addUnknownCard(options = {}) {
    const action = !options.skipUndo ? recordAction(ACTION_TYPES.ADD_UNKNOWN) : null;

    const opponentHand = document.getElementById('opponent-hand');
    const unknownCard = createUnknownCardElement();

    opponentHand.appendChild(unknownCard);
    sortCardsInContainer(opponentHand);

    finalizeBulkOperation(action);
}

// Export/Import functionality
function exportGame() {
    const gameId = getCurrentGameId();
    if (!gameId) {
        alert('No game selected to export.');
        return;
    }

    saveCurrentGame(); // Ensure current state is saved
    const gameData = loadGameData(gameId);
    const games = getGamesList();
    const game = games.find(g => g.id === gameId);

    const exportData = {
        ...gameData,
        name: game ? game.name : 'Unknown Game',
        exportedAt: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${exportData.name || 'game'}_${gameId}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function importGame() {
    document.getElementById('import-game-input').click();
}

function refreshCardDisplays() {
    // Get all cards and update their display names
    const allCards = document.querySelectorAll('.card:not(.unknown-card)');
    allCards.forEach(cardElement => {
        const cardText = cardElement.querySelector('.card-text');
        if (cardText && cardElement.dataset.cardName && cardElement.dataset.cardShort) {
            const displayName = useShortNames ? cardElement.dataset.cardShort : cardElement.dataset.cardName;
            const opsMatch = cardText.textContent.match(/^(\d+(?:\.\d+)?)  /);
            const ops = opsMatch ? opsMatch[1] : '';
            cardText.textContent = `${ops}  ${displayName}`;
        }
    });
}

function updateCardHighlighting() {
    const allCards = document.querySelectorAll('.card:not(.unknown-card)');

    allCards.forEach(cardElement => {
        let shouldHighlight = false;
        const hasActiveFilter = selectedType !== '-' || selectedRegion !== '-';

        // Check type filter
        if (selectedType !== '-') {
            const cardTypes = JSON.parse(cardElement.dataset.types || '[]');
            if (cardTypes.includes(selectedType)) {
                shouldHighlight = true;
            }
        }

        // Check region filter
        if (selectedRegion !== '-') {
            const cardRegions = JSON.parse(cardElement.dataset.regions || '[]');
            if (cardRegions.includes(selectedRegion)) {
                shouldHighlight = true;
            }
        }

        // Apply or remove highlight
        if (shouldHighlight && hasActiveFilter) {
            cardElement.classList.add('highlighted');
        } else {
            cardElement.classList.remove('highlighted');
        }
    });
}

function attachAutoSaveListener(elementId, eventType, logPrefix) {
    document.getElementById(elementId).addEventListener(eventType, function() {
        const value = this.value;
        const displayValue = elementId === 'game-notes' ? value.substring(0, 50) + '...' : value;
        console.log(`${logPrefix}:`, displayValue, 'isLoading:', isLoading);
        if (getCurrentGameId() && !isLoading) {
            saveCurrentGame();
        }
    });
}

// Load cards and initialize game management
document.addEventListener('DOMContentLoaded', async function() {
    console.log('DOM Content Loaded');
    updateGameSelector();
    updateUndoButtonState(); // Initialize undo button state
    updateWarButtonStates(); // Initialize war button states

    // Always load card database first for short name lookup
    try {
        await loadCardDatabase();
    } catch (error) {
        console.error('Failed to load card database:', error);
    }

    // Try to load the last current game, or load default cards
    const currentId = getCurrentGameId();
    console.log('Current game ID on load:', currentId);

    if (currentId) {
        loadGame(currentId);
    } else {
        console.log('No current game, loading default cards');
        clearActionHistory(); // Clear undo history when loading default cards
        loadCards();
    }

    // Game management event listeners
    document.getElementById('game-selector').addEventListener('change', function(e) {
        if (e.target.value) {
            loadGame(e.target.value);
        }
    });

    document.getElementById('new-game-btn').addEventListener('click', createNewGame);
    document.getElementById('delete-game-btn').addEventListener('click', deleteCurrentGame);
    document.getElementById('export-game-btn').addEventListener('click', exportGame);
    document.getElementById('import-game-btn').addEventListener('click', importGame);
    document.getElementById('add-discards-btn').addEventListener('click', addDiscards);
    document.getElementById('add-mid-btn').addEventListener('click', addMidWar);
    document.getElementById('add-late-btn').addEventListener('click', addLateWar);
    document.getElementById('opponent-plus-btn').addEventListener('click', addUnknownCard);
    document.getElementById('undo-btn').addEventListener('click', performUndo);

    // New game modal event listeners
    document.getElementById('new-game-form').addEventListener('submit', function(e) {
        e.preventDefault();
        const opponentName = document.getElementById('opponent-name').value.trim();
        const yourSide = document.getElementById('your-side').value;
        const gameId = document.getElementById('game-id').value.trim();

        if (opponentName && yourSide && gameId) {
            createGameFromForm(opponentName, yourSide, gameId);
        }
    });

    document.getElementById('cancel-new-game').addEventListener('click', hideNewGameModal);

    // Close modal on outside click
    document.getElementById('new-game-modal').addEventListener('click', function(e) {
        if (e.target === this) {
            hideNewGameModal();
        }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        // Ctrl+Z or Cmd+Z for undo
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
            // Don't interfere if user is typing in inputs
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }
            e.preventDefault();
            if (canUndo()) {
                performUndo();
            }
        }
    });

    // Import file handling
    document.getElementById('import-game-input').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(event) {
            try {
                const importedData = JSON.parse(event.target.result);

                // Create new game ID to avoid conflicts
                const newGameId = 'game_' + Date.now();
                const gameName = importedData.name || 'Imported Game';

                // Add to games list
                const games = getGamesList();
                games.push({ id: newGameId, name: gameName });
                saveGamesList(games);

                // Save imported game data with new ID
                const gameData = {
                    ...importedData,
                    id: newGameId,
                    lastModified: new Date().toISOString()
                };
                localStorage.setItem(`cardCounter_game_${newGameId}`, JSON.stringify(gameData));

                // Load the imported game
                loadGame(newGameId);

                alert('Game imported successfully!');
            } catch (error) {
                alert('Error importing game: Invalid file format.');
                console.error('Import error:', error);
            }
        };
        reader.readAsText(file);

        // Reset file input
        e.target.value = '';
    });

    // Auto-save when notes change (but not during loading)
    attachAutoSaveListener('game-notes', 'input', 'Notes changed');
    attachAutoSaveListener('game-notes', 'blur', 'Notes blur');

    // Short names checkbox event listener
    document.getElementById('short-names-checkbox').addEventListener('change', function() {
        useShortNames = this.checked;
        refreshCardDisplays();
    });

    // Type and region filter event listeners
    document.getElementById('highlight-dropdown').addEventListener('change', function() {
        selectedType = this.value;
        updateCardHighlighting();
    });

    document.getElementById('region-dropdown').addEventListener('change', function() {
        selectedRegion = this.value;
        updateCardHighlighting();
    });

    document.getElementById('clear-highlight-btn').addEventListener('click', function() {
        selectedType = '-';
        selectedRegion = '-';
        document.getElementById('highlight-dropdown').value = '-';
        document.getElementById('region-dropdown').value = '-';
        updateCardHighlighting();
    });

    // Initialize drag-and-drop for hand locations
    setupHandDropZone(document.getElementById('your-hand'));
    setupHandDropZone(document.getElementById('opponent-hand'));
});