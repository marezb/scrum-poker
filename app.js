import { generateId, ADMIN_PASSWORD, POKER_CARDS } from './config.js?v=2';
import { elements, screens, showScreen, renderDeck, updateDeckSelection, renderPlayers } from './ui.js?v=2';
import { calculateAverage, getClosestFibonacci, checkAutoRevealCondition } from './game-logic.js?v=2';
import * as db from './firebase-service.js?v=2';

// State variables
let currentPlayerId = localStorage.getItem('sp_playerId');
if (!currentPlayerId) {
    currentPlayerId = generateId();
    localStorage.setItem('sp_playerId', currentPlayerId);
}

let currentName = localStorage.getItem('sp_playerName') || '';
let currentRole = localStorage.getItem('sp_playerRole') || 'player';
let currentRoomId = null;
let isRevealed = false;
let isOfflineMode = localStorage.getItem('sp_offlineMode') === 'true';
let playersData = {};

// === Initialization ===
function init() {
    const savedConfig = localStorage.getItem('sp_firebaseConfig');
    if (!savedConfig && !isOfflineMode) {
        showScreen('setup');
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('room')) {
            elements.roomIdInput.value = urlParams.get('room');
        }
        return;
    }

    if (isOfflineMode) {
        setupOfflineMode();
        return;
    }

    try {
        const config = JSON.parse(savedConfig);
        if (!db.initFirebase(config)) throw new Error("Init failed");

        elements.playerNameInput.value = currentName;
        elements.spectatorModeInput.checked = (currentRole === 'spectator');

        const urlParams = new URLSearchParams(window.location.search);
        const urlRoom = urlParams.get('room');

        if (urlRoom) {
            elements.roomIdInput.value = urlRoom;
            elements.passwordGroup.classList.add('hidden');
            elements.spectatorGroup.classList.remove('hidden');
            elements.roomIdGroup.classList.remove('hidden');
            elements.joinBtn.innerText = "Join Game";

            if (currentName) {
                setTimeout(() => elements.joinForm.dispatchEvent(new Event('submit')), 100);
            } else {
                showScreen('login');
            }
        } else {
            showScreen('login');
            elements.adminDashboard.classList.remove('hidden');
            db.fetchActiveRooms(renderActiveRooms);
        }
    } catch (e) {
        alert("Firebase configuration error. Ensure the pasted JSON is valid.");
        showScreen('setup');
    }
}

function setupOfflineMode() {
    elements.playerNameInput.value = currentName;
    elements.spectatorModeInput.checked = (currentRole === 'spectator');
    const urlParams = new URLSearchParams(window.location.search);
    const urlRoom = urlParams.get('room');
    if (urlRoom && currentName) {
        const savedPassword = localStorage.getItem('sp_roomPassword');
        if (savedPassword === ADMIN_PASSWORD) {
            joinRoomOffline(urlRoom);
            return;
        }
    }
    showScreen('login');
}

// === Setup Handlers ===
elements.saveConfigBtn.addEventListener('click', () => {
    const val = elements.firebaseConfigInput.value.trim();
    if (!val) { alert("Please provide configuration JSON."); return; }
    try {
        JSON.parse(val);
        localStorage.setItem('sp_firebaseConfig', val);
        localStorage.setItem('sp_offlineMode', 'false');
        window.location.reload();
    } catch(e) { alert("Invalid JSON format"); }
});

elements.demoModeBtn.addEventListener('click', () => {
    localStorage.setItem('sp_offlineMode', 'true');
    window.location.reload();
});

elements.clearConfigBtn.addEventListener('click', () => {
    localStorage.removeItem('sp_firebaseConfig');
    localStorage.removeItem('sp_offlineMode');
    elements.firebaseConfigInput.value = '';
    alert("Configuration cleared.");
});

// === Login Handlers ===
elements.joinForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const urlParams = new URLSearchParams(window.location.search);
    let room = urlParams.get('room');

    if (!room) {
        const password = elements.passwordInput.value.trim();
        if (password !== ADMIN_PASSWORD) {
            alert("Access Denied: Incorrect password. Please Ask Marek for approval.");
            return;
        }
        room = generateId(8).toUpperCase();
        
        if (!isOfflineMode) {
            await db.createRoom(room);
            localStorage.setItem(`sp_admin_${room}`, "true");
        }
    }

    currentName = elements.playerNameInput.value.trim();
    currentRole = elements.spectatorModeInput.checked ? 'spectator' : 'player';

    localStorage.setItem('sp_playerName', currentName);
    localStorage.setItem('sp_playerRole', currentRole);

    if (isOfflineMode) {
        joinRoomOffline(room);
    } else {
        joinRoomOnline(room);
    }
});

function renderActiveRooms(activeRooms) {
    elements.activeRoomsList.innerHTML = '';
    if (activeRooms.length === 0) {
        elements.activeRoomsList.innerHTML = '<li style="color: var(--text-muted); justify-content: center;">No active rooms found.</li>';
        return;
    }

    activeRooms.forEach(roomId => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span>Room: ${roomId}</span>
            <div class="room-actions">
                <button class="btn icon-btn copy-btn" data-room="${roomId}" title="Copy Link">Copy Link</button>
                <button class="btn icon-btn close-btn" data-room="${roomId}" title="Close Room" style="color: #ef4444;">Close</button>
            </div>
        `;
        elements.activeRoomsList.appendChild(li);
    });

    document.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const url = new URL(window.location.href);
            url.searchParams.set('room', e.target.dataset.room);
            navigator.clipboard.writeText(url.toString());
            e.target.innerText = "Copied!";
            setTimeout(() => e.target.innerText = "Copy Link", 1500);
        });
    });

    document.querySelectorAll('.close-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const pwd = prompt("Enter Admin Password to close this room:");
            if (pwd === ADMIN_PASSWORD) {
                db.closeRoom(e.target.dataset.room);
            } else if (pwd !== null) {
                alert("Access Denied");
            }
        });
    });
}

// === Game Actions ===
elements.copyLinkBtn.addEventListener('click', () => {
    if (isOfflineMode) {
        alert("Sharing links is disabled in Offline Mode to prevent errors. Please configure Firebase for multiplayer.");
        return;
    }
    const url = new URL(window.location.href);
    url.searchParams.set('room', currentRoomId);
    navigator.clipboard.writeText(url.toString()).then(() => {
        const originalHtml = elements.copyLinkBtn.innerHTML;
        elements.copyLinkBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
        setTimeout(() => elements.copyLinkBtn.innerHTML = originalHtml, 2000);
    });
});

elements.revealBtn.addEventListener('click', () => {
    if (!currentRoomId) return;
    if (isOfflineMode) {
        isRevealed = true;
        updateGameStateOffline(true);
    } else {
        db.updateRevealedState(currentRoomId, true);
    }
});

elements.resetBtn.addEventListener('click', () => {
    if (!currentRoomId) return;
    if (isOfflineMode) {
        isRevealed = false;
        Object.keys(playersData).forEach(pId => { playersData[pId].vote = null; });
        updateGameStateOffline();
    } else {
        db.clearAllVotes(currentRoomId, playersData);
    }
});

elements.closeRoomBtn.addEventListener('click', () => {
    if (!currentRoomId || isOfflineMode) return;
    if (confirm("Are you sure you want to close this room? No one will be able to join.")) {
        db.closeRoom(currentRoomId);
    }
});

// === Join Room Logic ===
function joinRoomOnline(roomId) {
    currentRoomId = roomId;
    elements.displayRoomId.innerText = roomId;

    if (localStorage.getItem(`sp_admin_${roomId}`) === "true") {
        elements.closeRoomBtn.classList.remove('hidden');
    } else {
        elements.closeRoomBtn.classList.add('hidden');
    }

    const url = new URL(window.location.href);
    url.searchParams.set('room', roomId);
    window.history.pushState({}, '', url);

    showScreen('game');
    if (currentRole === 'spectator') {
        elements.deckArea.classList.add('hidden');
    } else {
        elements.deckArea.classList.remove('hidden');
        renderDeck(handleCardSelect);
    }

    const playerData = {
        name: currentName,
        vote: null,
        joinedAt: Date.now(),
        role: currentRole
    };

    db.joinRoom(roomId, currentPlayerId, playerData, {
        onPlayersChange: (data) => {
            playersData = data;
            renderPlayers(playersData, isRevealed);
            updateDeckSelection(playersData[currentPlayerId]?.vote, isRevealed);
            if (!isRevealed && checkAutoRevealCondition(playersData)) {
                db.updateRevealedState(currentRoomId, true);
            }
        },
        onStateChange: (state) => {
            const wasRevealed = isRevealed;
            isRevealed = state.revealed;
            const animate = isRevealed && !wasRevealed;
            updateUIState();
            renderPlayers(playersData, isRevealed, animate);
        },
        onRoomClosed: () => {
            alert("This room has been closed by the admin.");
            window.location.href = window.location.pathname;
        }
    });
}

function joinRoomOffline(roomId) {
    currentRoomId = roomId;
    elements.displayRoomId.innerText = roomId + " (Offline)";
    showScreen('game');
    
    if (currentRole === 'spectator') {
        elements.deckArea.classList.add('hidden');
    } else {
        elements.deckArea.classList.remove('hidden');
        renderDeck(handleCardSelect);
    }

    playersData = {
        [currentPlayerId]: {
            name: currentName || "Me",
            vote: null,
            joinedAt: Date.now(),
            role: currentRole
        }
    };

    const fakePlayers = ["Alice", "Bob", "Charlie"];
    fakePlayers.forEach((name, i) => {
        playersData[`fake_${i}`] = {
            name: name,
            vote: POKER_CARDS[Math.floor(Math.random() * (POKER_CARDS.length - 1))],
            joinedAt: Date.now() + i + 1,
            role: 'player'
        };
    });
    playersData['fake_spec'] = {
        name: "John (Spectator)",
        joinedAt: Date.now() + 10,
        role: 'spectator'
    };

    isRevealed = false;
    updateGameStateOffline();
}

function updateGameStateOffline(animate = false) {
    updateUIState();
    if (!isRevealed) {
        Object.keys(playersData).forEach(pId => {
            if (pId.startsWith('fake_') && playersData[pId].vote === null && playersData[pId].role !== 'spectator') {
                playersData[pId].vote = POKER_CARDS[Math.floor(Math.random() * (POKER_CARDS.length - 1))];
            }
        });
    }
    renderPlayers(playersData, isRevealed, animate);
    updateDeckSelection(playersData[currentPlayerId]?.vote, isRevealed);
}

function updateUIState() {
    if (isRevealed) {
        elements.revealBtn.classList.add('hidden');
        elements.resetBtn.classList.remove('hidden');
        elements.resultsArea.classList.remove('hidden');
        elements.statsPanel.classList.remove('hidden');
        handleCalculateResults();
    } else {
        elements.revealBtn.classList.remove('hidden');
        elements.resetBtn.classList.add('hidden');
        elements.resultsArea.classList.add('hidden');
        elements.statsPanel.classList.add('hidden');
    }
}

function handleCalculateResults() {
    const res = calculateAverage(playersData);
    if (res) {
        const closestFib = getClosestFibonacci(res.average);
        elements.averageScoreDisplay.innerText = closestFib;
        const sumLine = `${res.equationParts.join(' + ')} = ${res.sum}`;
        const divLine = `${res.sum} / ${res.count} = ${res.average.toFixed(1)}`;
        elements.statsEquation.innerHTML = `Calculation:<br>${sumLine}<br>${divLine}`;
        elements.statsClosest.innerHTML = `Closest Fibonacci:<br><strong>${getClosestFibonacci(res.average)}</strong>`;
    } else {
        elements.averageScoreDisplay.innerText = "-";
        elements.statsEquation.innerHTML = "No numeric votes cast.";
        elements.statsClosest.innerHTML = "";
    }
}

function handleCardSelect(value) {
    if (!currentRoomId || isRevealed) return;
    const currentVote = playersData[currentPlayerId]?.vote;
    const newVote = currentVote === value ? null : value;

    if (isOfflineMode) {
        playersData[currentPlayerId].vote = newVote;
        if (!isRevealed && checkAutoRevealCondition(playersData)) {
            isRevealed = true;
            updateGameStateOffline(true);
        } else {
            updateGameStateOffline();
        }
    } else {
        db.updateVote(currentRoomId, currentPlayerId, newVote);
    }
}

// Start app
init();

// Export for tests
window.__TEST_EXPORTS__ = {
    calculateAverage,
    getClosestFibonacci,
    generateId,
    joinRoomOffline,
    handleCardSelect,
    get playersData() { return playersData; },
    setPlayersData: (data) => { playersData = data; },
    setIsRevealed: (rev) => { isRevealed = rev; },
    calculateResults: handleCalculateResults,
    renderPlayers: (animate) => renderPlayers(playersData, isRevealed, animate)
};
