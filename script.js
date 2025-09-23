let selectedHandLocation = 'your-hand'; // Default to Your Hand

function createCardElement(cardData) {
    const cardDiv = document.createElement('div');
    cardDiv.className = 'card';
    cardDiv.dataset.war = cardData.war || 'early';

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'card-actions';

    const discardIcon = document.createElement('div');
    discardIcon.className = 'card-icon discard-icon';
    discardIcon.title = 'Move to Discard';
    discardIcon.textContent = '↓';

    const removeIcon = document.createElement('div');
    removeIcon.className = 'card-icon remove-icon';
    removeIcon.title = 'Move to Removed';
    removeIcon.textContent = '⊘';
    if (!cardData.canBeRemoved) {
        removeIcon.classList.add('hidden');
    }

    const cardText = document.createElement('span');
    cardText.className = 'card-text';
    if (cardData.eventType) {
        cardText.classList.add(cardData.eventType);
    }
    cardText.textContent = `${cardData.ops} - ${cardData.name}`;

    actionsDiv.appendChild(discardIcon);
    actionsDiv.appendChild(removeIcon);
    cardDiv.appendChild(actionsDiv);
    cardDiv.appendChild(cardText);

    return cardDiv;
}

function createUnknownCardElement() {
    const cardDiv = document.createElement('div');
    cardDiv.className = 'card unknown-card';

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'card-actions';

    const minusIcon = document.createElement('div');
    minusIcon.className = 'card-icon unknown-minus-icon';
    minusIcon.title = 'Remove unknown card';
    minusIcon.textContent = '−';

    const cardText = document.createElement('span');
    cardText.className = 'card-text unknown-card-text';
    const deckAvg = calculateDeckAverage();
    cardText.textContent = `${deckAvg.toFixed(1)} - Unknown Card`;

    actionsDiv.appendChild(minusIcon);
    cardDiv.appendChild(actionsDiv);
    cardDiv.appendChild(cardText);

    return cardDiv;
}

async function loadCards() {
    try {
        console.log('Attempting to load cards from cards.json');
        const response = await fetch('cards.json');
        console.log('Response status:', response.status, response.statusText);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const cards = await response.json();
        console.log('Cards loaded successfully:', cards);

        cards.forEach(cardData => {
            const cardElement = createCardElement(cardData);

            // Put mid/late war cards in the hidden box, early war cards in deck
            if (cardData.war === 'early') {
                const targetDeck = getDeckSubsection(cardData.eventType);
                targetDeck.appendChild(cardElement);
            } else {
                const box = document.getElementById('box');
                box.appendChild(cardElement);
            }
        });

        // Sort cards in each deck subsection
        sortCardsInContainer(document.getElementById('deck-us'));
        sortCardsInContainer(document.getElementById('deck-neutral'));
        sortCardsInContainer(document.getElementById('deck-ussr'));

        // Update averages
        updateLocationAverages();

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

function getCardData(cardElement) {
    const cardText = cardElement.querySelector('.card-text').textContent;
    const opsMatch = cardText.match(/^(\d+(?:\.\d+)?) - (.+)$/);
    if (opsMatch) {
        return {
            ops: parseFloat(opsMatch[1]),
            name: opsMatch[2]
        };
    }
    return { ops: 0, name: cardText };
}

function sortCardsInContainer(container) {
    const cards = Array.from(container.children);
    cards.sort((a, b) => {
        const dataA = getCardData(a);
        const dataB = getCardData(b);

        // Sort by ops first (ascending)
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
    if (cards.length === 0) return 0;

    const totalOps = cards.reduce((sum, card) => {
        const data = getCardData(card);
        return sum + data.ops;
    }, 0);

    return totalOps / cards.length;
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

    if (allDeckCards.length === 0) return 0;

    const totalOps = allDeckCards.reduce((sum, card) => {
        const data = getCardData(card);
        return sum + data.ops;
    }, 0);

    return totalOps / allDeckCards.length;
}

function updateLocationAverages() {
    // First update all unknown cards with current deck average
    const deckAvg = calculateDeckAverage();
    const unknownCards = document.querySelectorAll('.unknown-card-text');
    unknownCards.forEach(cardText => {
        cardText.textContent = `${deckAvg.toFixed(1)} - Unknown Card`;
    });

    // Update Your Hand average
    const yourHandContainer = document.getElementById('your-hand');
    const yourHandAvg = calculateAverageOps(yourHandContainer);
    document.getElementById('your-hand-avg').textContent =
        yourHandContainer.children.length > 0 ? `(avg: ${yourHandAvg.toFixed(1)})` : '';

    // Update Opponent's Hand average
    const opponentHandContainer = document.getElementById('opponent-hand');
    const opponentHandAvg = calculateAverageOps(opponentHandContainer);
    document.getElementById('opponent-hand-avg').textContent =
        opponentHandContainer.children.length > 0 ? `(avg: ${opponentHandAvg.toFixed(1)})` : '';

    // Update Deck average (combine all subsections)
    const deckUS = document.getElementById('deck-us');
    const deckNeutral = document.getElementById('deck-neutral');
    const deckUSSR = document.getElementById('deck-ussr');
    const allDeckCards = [
        ...Array.from(deckUS.children),
        ...Array.from(deckNeutral.children),
        ...Array.from(deckUSSR.children)
    ];

    if (allDeckCards.length > 0) {
        const totalOps = allDeckCards.reduce((sum, card) => {
            const data = getCardData(card);
            return sum + data.ops;
        }, 0);
        const deckAvgForDisplay = totalOps / allDeckCards.length;
        document.getElementById('deck-avg').textContent = `(avg: ${deckAvgForDisplay.toFixed(1)})`;
    } else {
        document.getElementById('deck-avg').textContent = '';
    }
}

function moveCard(cardElement, targetLocationId) {
    cardElement.remove();

    if (targetLocationId === 'deck') {
        // Get the card's event type from its text element
        const cardTextElement = cardElement.querySelector('.card-text');
        let eventType = 'neutral';
        if (cardTextElement.classList.contains('us')) {
            eventType = 'us';
        } else if (cardTextElement.classList.contains('ussr')) {
            eventType = 'ussr';
        }
        const targetLocation = getDeckSubsection(eventType);
        targetLocation.appendChild(cardElement);
        sortCardsInContainer(targetLocation);
    } else {
        const targetLocation = document.getElementById(targetLocationId);
        targetLocation.appendChild(cardElement);
        sortCardsInContainer(targetLocation);
    }

    // Update averages after moving card
    updateLocationAverages();

    // Auto-save current game state
    if (getCurrentGameId()) {
        saveCurrentGame();
    }
}

function selectHandLocation(locationId) {
    // Remove selected class from all locations
    document.querySelectorAll('.location').forEach(loc => {
        loc.classList.remove('selected');
    });

    // Set the selected hand location
    selectedHandLocation = locationId;

    // Add selected class to opponent's hand if it's selected
    if (locationId === 'opponent-hand') {
        const opponentHandLocation = document.querySelector('#opponent-hand').closest('.location');
        opponentHandLocation.classList.add('selected');
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
        card.remove();
        updateLocationAverages();
        // Auto-save current game state
        if (getCurrentGameId()) {
            saveCurrentGame();
        }
    } else if (e.target.classList.contains('card-text')) {
        e.stopPropagation();
        const card = e.target.closest('.card');
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
                const cardText = card.querySelector('.card-text');
                const isUnknown = card.classList.contains('unknown-card');
                return {
                    name: isUnknown ? 'Unknown Card' : data.name,
                    ops: data.ops,
                    eventType: cardText.classList.contains('us') ? 'us' :
                              cardText.classList.contains('ussr') ? 'ussr' : 'neutral',
                    canBeRemoved: !card.querySelector('.remove-icon') || !card.querySelector('.remove-icon').classList.contains('hidden'),
                    war: card.dataset.war || 'early',
                    isUnknown: isUnknown
                };
            });
        }
    });

    return positions;
}

function saveCurrentGame() {
    const gameId = getCurrentGameId();
    if (!gameId) return;

    const gameData = {
        id: gameId,
        title: document.getElementById('game-title').value,
        notes: document.getElementById('game-notes').value,
        cardPositions: getCardPositions(),
        lastModified: new Date().toISOString()
    };

    console.log('Saving game data:', gameData);
    localStorage.setItem(`cardCounter_game_${gameId}`, JSON.stringify(gameData));
}

function loadGameData(gameId) {
    const gameData = localStorage.getItem(`cardCounter_game_${gameId}`);
    return gameData ? JSON.parse(gameData) : null;
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

function restoreCardPositions(positions) {
    clearAllCards();

    Object.entries(positions).forEach(([locationId, cards]) => {
        const container = document.getElementById(locationId);
        if (container && cards) {
            cards.forEach(cardData => {
                let cardElement;
                if (cardData.isUnknown || cardData.name === 'Unknown Card') {
                    cardElement = createUnknownCardElement();
                } else {
                    cardElement = createCardElement(cardData);
                }
                container.appendChild(cardElement);
            });
        }
    });

    updateLocationAverages();
}

function createNewGame() {
    const gameId = 'game_' + Date.now();
    const gameName = prompt('Enter a name for the new game:');
    if (!gameName) return;

    const games = getGamesList();
    games.push({ id: gameId, name: gameName });
    saveGamesList(games);

    // Save current game before switching
    if (getCurrentGameId()) {
        saveCurrentGame();
    }

    // Initialize new game with default card setup
    isLoading = true;
    setCurrentGameId(gameId);
    document.getElementById('game-title').value = gameName;
    document.getElementById('game-notes').value = '';

    // Clear existing cards and load default cards
    clearAllCards();
    loadCards().then(() => {
        setTimeout(() => {
            isLoading = false;
            saveCurrentGame();
            updateGameSelector();
        }, 100); // Small delay to ensure cards are rendered
    });
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

    // Clear current game
    setCurrentGameId(null);
    document.getElementById('game-title').value = '';
    document.getElementById('game-notes').value = '';
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

    setCurrentGameId(gameId);
    const gameData = loadGameData(gameId);
    console.log('Loaded game data:', gameData);

    if (gameData) {
        document.getElementById('game-title').value = gameData.title || '';
        document.getElementById('game-notes').value = gameData.notes || '';

        if (gameData.cardPositions) {
            restoreCardPositions(gameData.cardPositions);
            isLoading = false; // Loading complete
        } else {
            // If no card positions saved, load default cards
            loadCards().then(() => {
                isLoading = false; // Loading complete
                // Only save if this is a new game without positions
                setTimeout(() => saveCurrentGame(), 100);
            });
        }
    } else {
        // Game not found, load defaults
        console.log('Game data not found, loading defaults');
        document.getElementById('game-title').value = '';
        document.getElementById('game-notes').value = '';
        loadCards().then(() => {
            isLoading = false; // Loading complete
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

function addDiscards() {
    // Step 1: Move all cards from Deck subsections to Opponent's Hand
    const deckUS = document.getElementById('deck-us');
    const deckNeutral = document.getElementById('deck-neutral');
    const deckUSSR = document.getElementById('deck-ussr');
    const opponentHand = document.getElementById('opponent-hand');

    // Collect all deck cards
    const allDeckCards = [
        ...Array.from(deckUS.children),
        ...Array.from(deckNeutral.children),
        ...Array.from(deckUSSR.children)
    ];

    // Move each deck card to opponent's hand
    allDeckCards.forEach(card => {
        card.remove();
        opponentHand.appendChild(card);
    });

    // Sort opponent's hand
    sortCardsInContainer(opponentHand);

    // Step 2: Move all cards from Discard to appropriate Deck subsections
    const discardPile = document.getElementById('discard');
    const discardCards = Array.from(discardPile.children);

    discardCards.forEach(card => {
        // Get the card's event type from its text element
        const cardTextElement = card.querySelector('.card-text');
        let eventType = 'neutral';
        if (cardTextElement.classList.contains('us')) {
            eventType = 'us';
        } else if (cardTextElement.classList.contains('ussr')) {
            eventType = 'ussr';
        }

        // Move to appropriate deck subsection
        card.remove();
        const targetDeckSubsection = getDeckSubsection(eventType);
        targetDeckSubsection.appendChild(card);
    });

    // Sort all deck subsections
    sortCardsInContainer(deckUS);
    sortCardsInContainer(deckNeutral);
    sortCardsInContainer(deckUSSR);

    // Update averages
    updateLocationAverages();

    // Auto-save current game state
    if (getCurrentGameId()) {
        saveCurrentGame();
    }
}

function addMidWar() {
    const box = document.getElementById('box');
    const midWarCards = Array.from(box.children).filter(card => card.dataset.war === 'mid');

    midWarCards.forEach(card => {
        // Get the card's event type from its text element
        const cardTextElement = card.querySelector('.card-text');
        let eventType = 'neutral';
        if (cardTextElement.classList.contains('us')) {
            eventType = 'us';
        } else if (cardTextElement.classList.contains('ussr')) {
            eventType = 'ussr';
        }

        // Move from box to appropriate deck subsection
        card.remove();
        const targetDeckSubsection = getDeckSubsection(eventType);
        targetDeckSubsection.appendChild(card);
    });

    // Sort all deck subsections
    const deckUS = document.getElementById('deck-us');
    const deckNeutral = document.getElementById('deck-neutral');
    const deckUSSR = document.getElementById('deck-ussr');
    sortCardsInContainer(deckUS);
    sortCardsInContainer(deckNeutral);
    sortCardsInContainer(deckUSSR);

    // Update averages
    updateLocationAverages();

    // Auto-save current game state
    if (getCurrentGameId()) {
        saveCurrentGame();
    }
}

function addLateWar() {
    const box = document.getElementById('box');
    const lateWarCards = Array.from(box.children).filter(card => card.dataset.war === 'late');

    lateWarCards.forEach(card => {
        // Get the card's event type from its text element
        const cardTextElement = card.querySelector('.card-text');
        let eventType = 'neutral';
        if (cardTextElement.classList.contains('us')) {
            eventType = 'us';
        } else if (cardTextElement.classList.contains('ussr')) {
            eventType = 'ussr';
        }

        // Move from box to appropriate deck subsection
        card.remove();
        const targetDeckSubsection = getDeckSubsection(eventType);
        targetDeckSubsection.appendChild(card);
    });

    // Sort all deck subsections
    const deckUS = document.getElementById('deck-us');
    const deckNeutral = document.getElementById('deck-neutral');
    const deckUSSR = document.getElementById('deck-ussr');
    sortCardsInContainer(deckUS);
    sortCardsInContainer(deckNeutral);
    sortCardsInContainer(deckUSSR);

    // Update averages
    updateLocationAverages();

    // Auto-save current game state
    if (getCurrentGameId()) {
        saveCurrentGame();
    }
}

function addUnknownCard() {
    const opponentHand = document.getElementById('opponent-hand');
    const unknownCard = createUnknownCardElement();

    opponentHand.appendChild(unknownCard);
    sortCardsInContainer(opponentHand);

    // Update averages
    updateLocationAverages();

    // Auto-save current game state
    if (getCurrentGameId()) {
        saveCurrentGame();
    }
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

// Load cards and initialize game management
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM Content Loaded');
    updateGameSelector();

    // Try to load the last current game, or load default cards
    const currentId = getCurrentGameId();
    console.log('Current game ID on load:', currentId);

    if (currentId) {
        loadGame(currentId);
    } else {
        console.log('No current game, loading default cards');
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

    // Auto-save when title or notes change (but not during loading)
    document.getElementById('game-title').addEventListener('input', function() {
        console.log('Title changed:', this.value, 'isLoading:', isLoading);
        if (getCurrentGameId() && !isLoading) {
            saveCurrentGame();
        }
    });

    document.getElementById('game-title').addEventListener('blur', function() {
        console.log('Title blur:', this.value, 'isLoading:', isLoading);
        if (getCurrentGameId() && !isLoading) {
            saveCurrentGame();
        }
    });

    document.getElementById('game-notes').addEventListener('input', function() {
        console.log('Notes changed:', this.value.substring(0, 50) + '...', 'isLoading:', isLoading);
        if (getCurrentGameId() && !isLoading) {
            saveCurrentGame();
        }
    });

    document.getElementById('game-notes').addEventListener('blur', function() {
        console.log('Notes blur:', this.value.substring(0, 50) + '...', 'isLoading:', isLoading);
        if (getCurrentGameId() && !isLoading) {
            saveCurrentGame();
        }
    });
});