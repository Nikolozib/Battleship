/* ============================================
   BATTLESHIP — GAME LOGIC
   ============================================ */

'use strict';

// ── CONSTANTS ──────────────────────────────────────────────────────────────
const GRID_SIZE = 10;
const COLS = ['A','B','C','D','E','F','G','H','I','J'];

const SHIPS = [
  { id: 'carrier',    name: 'CARRIER',    size: 5 },
  { id: 'battleship', name: 'BATTLESHIP', size: 4 },
  { id: 'cruiser',    name: 'CRUISER',    size: 3 },
  { id: 'submarine',  name: 'SUBMARINE',  size: 3 },
  { id: 'destroyer',  name: 'DESTROYER',  size: 2 },
];

// ── STATE ──────────────────────────────────────────────────────────────────
let state = {
  playerGrid: [],
  enemyGrid: [],
  playerShips: [],
  enemyShips: [],
  placedShips: [],
  selectedShip: null,
  orientation: 'H',      // H | V
  playerTurn: true,
  shots: 0,
  hits: 0,
  gameOver: false,
};

// ── GRID HELPERS ───────────────────────────────────────────────────────────
function makeGrid() {
  return Array.from({ length: GRID_SIZE }, () =>
    Array.from({ length: GRID_SIZE }, () => ({
      ship: null,
      hit: false,
      miss: false,
    }))
  );
}

function coordLabel(r, c) {
  return `${COLS[c]}${r + 1}`;
}

function inBounds(r, c) {
  return r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE;
}

function canPlace(grid, r, c, size, dir) {
  for (let i = 0; i < size; i++) {
    const nr = dir === 'V' ? r + i : r;
    const nc = dir === 'H' ? c + i : c;
    if (!inBounds(nr, nc)) return false;
    if (grid[nr][nc].ship) return false;
  }
  return true;
}

function placeShip(grid, r, c, size, dir, shipId) {
  const cells = [];
  for (let i = 0; i < size; i++) {
    const nr = dir === 'V' ? r + i : r;
    const nc = dir === 'H' ? c + i : c;
    grid[nr][nc].ship = shipId;
    cells.push([nr, nc]);
  }
  return cells;
}

function randomPlacement(grid, ships) {
  const placed = [];
  for (const ship of ships) {
    let ok = false;
    while (!ok) {
      const dir = Math.random() < 0.5 ? 'H' : 'V';
      const r = Math.floor(Math.random() * GRID_SIZE);
      const c = Math.floor(Math.random() * GRID_SIZE);
      if (canPlace(grid, r, c, ship.size, dir)) {
        const cells = placeShip(grid, r, c, ship.size, dir, ship.id);
        placed.push({ ...ship, cells, hits: 0 });
        ok = true;
      }
    }
  }
  return placed;
}

// ── SETUP SCREEN ───────────────────────────────────────────────────────────
function initSetup() {
  state.playerGrid = makeGrid();
  state.placedShips = [];
  state.selectedShip = null;
  state.orientation = 'H';

  renderShipList();
  renderSetupBoard();
  updateOrientationLabel();
  updateStartBtn();
}

function renderShipList() {
  const container = document.getElementById('ship-list');
  container.innerHTML = '';
  SHIPS.forEach(ship => {
    const placed = state.placedShips.some(p => p.id === ship.id);
    const selected = state.selectedShip && state.selectedShip.id === ship.id;
    const div = document.createElement('div');
    div.className = `ship-item${placed ? ' placed' : ''}${selected ? ' selected' : ''}`;
    div.dataset.id = ship.id;

    const icon = document.createElement('div');
    icon.className = 'ship-icon';
    for (let i = 0; i < ship.size; i++) {
      const b = document.createElement('div');
      b.className = 'ship-block';
      icon.appendChild(b);
    }

    const label = document.createElement('span');
    label.textContent = `${ship.name} (${ship.size})`;

    div.appendChild(icon);
    div.appendChild(label);

    if (!placed) {
      div.addEventListener('click', () => selectShip(ship));
    }
    container.appendChild(div);
  });
}

function selectShip(ship) {
  state.selectedShip = ship;
  renderShipList();
}

function renderSetupBoard() {
  const board = document.getElementById('setup-board');
  board.innerHTML = '';
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      if (state.playerGrid[r][c].ship) cell.classList.add('ship');

      cell.addEventListener('click', () => handleSetupClick(r, c));
      cell.addEventListener('mouseenter', () => handleSetupHover(r, c, true));
      cell.addEventListener('mouseleave', () => handleSetupHover(r, c, false));

      board.appendChild(cell);
    }
  }
}

function handleSetupClick(r, c) {
  if (!state.selectedShip) return;
  const ship = state.selectedShip;
  if (!canPlace(state.playerGrid, r, c, ship.size, state.orientation)) return;
  const cells = placeShip(state.playerGrid, r, c, ship.size, state.orientation, ship.id);
  state.placedShips.push({ ...ship, cells, hits: 0 });
  state.selectedShip = null;
  renderShipList();
  renderSetupBoard();
  updateStartBtn();
}

function handleSetupHover(r, c, entering) {
  if (!state.selectedShip) return;
  const ship = state.selectedShip;
  const valid = canPlace(state.playerGrid, r, c, ship.size, state.orientation);
  const cells = document.querySelectorAll('#setup-board .cell');

  // Clear previews
  cells.forEach(cell => {
    cell.classList.remove('ship-preview', 'invalid');
  });

  if (!entering) return;

  for (let i = 0; i < ship.size; i++) {
    const nr = state.orientation === 'V' ? r + i : r;
    const nc = state.orientation === 'H' ? c + i : c;
    if (!inBounds(nr, nc)) continue;
    const idx = nr * GRID_SIZE + nc;
    cells[idx].classList.add('ship-preview');
    if (!valid) cells[idx].classList.add('invalid');
  }
}

function updateOrientationLabel() {
  document.getElementById('orientation-label').textContent =
    state.orientation === 'H' ? 'HORIZONTAL' : 'VERTICAL';
}

function updateStartBtn() {
  document.getElementById('start-btn').disabled =
    state.placedShips.length < SHIPS.length;
}

// ── GAME SCREEN ────────────────────────────────────────────────────────────
function startGame() {
  state.enemyGrid = makeGrid();
  state.enemyShips = randomPlacement(state.enemyGrid, SHIPS);
  state.playerShips = JSON.parse(JSON.stringify(state.placedShips));
  state.playerTurn = true;
  state.shots = 0;
  state.hits = 0;
  state.gameOver = false;

  renderPlayerBoard();
  renderEnemyBoard();
  renderFleets();
  updateStats();
  setPhase('YOUR TURN', true);
  document.getElementById('log-entries').innerHTML = '';

  showScreen('game-screen');
}

function renderPlayerBoard() {
  const board = document.getElementById('player-board');
  board.innerHTML = '';
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      const g = state.playerGrid[r][c];
      if (g.ship) cell.classList.add('ship');
      if (g.hit) cell.classList.add('hit');
      if (g.miss) cell.classList.add('miss');
      board.appendChild(cell);
    }
  }
}

function renderEnemyBoard() {
  const board = document.getElementById('enemy-board');
  board.innerHTML = '';
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      const g = state.enemyGrid[r][c];
      // Only show hits/misses, not ship positions
      if (g.hit) {
        const ship = state.enemyShips.find(s => s.id === g.ship);
        cell.classList.add(ship && ship.sunk ? 'sunk' : 'hit');
      }
      if (g.miss) cell.classList.add('miss');
      if (!g.hit && !g.miss) {
        cell.addEventListener('click', () => playerFire(r, c));
      }
      board.appendChild(cell);
    }
  }
}

function renderFleets() {
  // Player fleet
  const pf = document.getElementById('player-fleet');
  pf.innerHTML = '';
  state.playerShips.forEach(ship => {
    pf.appendChild(makeFleetShipEl(ship));
  });

  // Enemy fleet
  const ef = document.getElementById('enemy-fleet');
  ef.innerHTML = '';
  state.enemyShips.forEach(ship => {
    ef.appendChild(makeFleetShipEl(ship, true));
  });
}

function makeFleetShipEl(ship, hideUntilSunk = false) {
  const div = document.createElement('div');
  div.className = 'fleet-ship';
  div.id = `fleet-${ship.id}`;

  const name = document.createElement('div');
  name.className = 'fleet-ship-name';
  name.textContent = ship.name;

  const bar = document.createElement('div');
  bar.className = 'fleet-ship-bar';
  for (let i = 0; i < ship.size; i++) {
    const seg = document.createElement('div');
    seg.className = 'fleet-ship-seg';
    if (ship.sunk) seg.classList.add('sunk');
    bar.appendChild(seg);
  }

  div.appendChild(name);
  div.appendChild(bar);
  return div;
}

function updateFleet(shipList, prefix) {
  shipList.forEach(ship => {
    const el = document.getElementById(`fleet-${ship.id}`);
    if (!el) return;
    const segs = el.querySelectorAll('.fleet-ship-seg');
    segs.forEach((seg, i) => {
      seg.className = 'fleet-ship-seg';
      if (ship.sunk) {
        seg.classList.add('sunk');
      } else if (ship.hitCells && ship.hitCells.has(i)) {
        seg.classList.add('hit');
      }
    });
  });
}

// ── FIRING ────────────────────────────────────────────────────────────────
function playerFire(r, c) {
  if (!state.playerTurn || state.gameOver) return;
  const g = state.enemyGrid[r][c];
  if (g.hit || g.miss) return;

  state.shots++;
  setPhase('ENEMY TURN', false);

  const boardEl = document.getElementById('enemy-board');
  boardEl.classList.add('locked');

  if (g.ship) {
    g.hit = true;
    state.hits++;
    const ship = state.enemyShips.find(s => s.id === g.ship);
    if (!ship.hitCells) ship.hitCells = new Set();
    const segIdx = ship.cells.findIndex(([sr, sc]) => sr === r && sc === c);
    ship.hitCells.add(segIdx);
    ship.hits = (ship.hits || 0) + 1;

    let sunkMsg = null;
    if (ship.hits >= ship.size) {
      ship.sunk = true;
      // Mark all cells as sunk
      ship.cells.forEach(([sr, sc]) => state.enemyGrid[sr][sc].sunk = true);
      sunkMsg = ship;
    }

    renderEnemyBoard();
    updateFleet(state.enemyShips, 'enemy');
    flashScreen(r, c, true);

    if (sunkMsg) {
      addLog(`☠ YOU SANK THEIR ${sunkMsg.name}!`, 'sunk');
    } else {
      addLog(`▶ YOU HIT ${coordLabel(r, c)}!`, 'player-hit');
    }

    updateStats();

    if (checkWin(state.enemyShips)) {
      setTimeout(() => endGame(true), 600);
      return;
    }
  } else {
    g.miss = true;
    renderEnemyBoard();
    flashScreen(r, c, false);
    addLog(`○ MISS AT ${coordLabel(r, c)}`, 'player-miss');
  }

  updateStats();

  // AI turn after delay
  setTimeout(() => {
    if (!state.gameOver) enemyTurn();
  }, 900);
}

// ── AI ────────────────────────────────────────────────────────────────────
const ai = {
  mode: 'hunt',    // hunt | target
  hits: [],        // recent hit queue for targeting
  queue: [],       // cells to try next
  tried: new Set(),

  reset() {
    this.mode = 'hunt';
    this.hits = [];
    this.queue = [];
    this.tried = new Set();
  },

  nextTarget() {
    // Target mode: try queued adjacent cells first
    while (this.mode === 'target' && this.queue.length > 0) {
      const [r, c] = this.queue.shift();
      if (!this.tried.has(`${r},${c}`) && inBounds(r, c)) {
        return [r, c];
      }
    }
    // Fall back to hunt mode
    this.mode = 'hunt';
    this.hits = [];
    this.queue = [];
    return this.huntTarget();
  },

  huntTarget() {
    // Checkerboard pattern for efficiency
    const candidates = [];
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if ((r + c) % 2 === 0 && !this.tried.has(`${r},${c}`)) {
          const g = state.playerGrid[r][c];
          if (!g.hit && !g.miss) candidates.push([r, c]);
        }
      }
    }
    if (candidates.length === 0) {
      // Fallback: any untried
      for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
          if (!this.tried.has(`${r},${c}`)) {
            const g = state.playerGrid[r][c];
            if (!g.hit && !g.miss) candidates.push([r, c]);
          }
        }
      }
    }
    return candidates[Math.floor(Math.random() * candidates.length)];
  },

  recordHit(r, c, sunk) {
    this.tried.add(`${r},${c}`);
    if (sunk) {
      this.mode = 'hunt';
      this.hits = [];
      this.queue = [];
      return;
    }
    this.mode = 'target';
    this.hits.push([r, c]);

    // Build queue of adjacent cells
    const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
    if (this.hits.length >= 2) {
      // Direction is known — fire along that axis
      const [r1,c1] = this.hits[0];
      const [r2,c2] = this.hits[this.hits.length-1];
      const dr = Math.sign(r2-r1);
      const dc = Math.sign(c2-c1);
      const ahead = [r2+dr, c2+dc];
      const behind = [r1-dr, c1-dc];
      this.queue = [ahead, behind, ...dirs.map(([dr,dc]) => [r+dr, c+dc])];
    } else {
      this.queue = dirs.map(([dr,dc]) => [r+dr, c+dc]);
    }
  },

  recordMiss(r, c) {
    this.tried.add(`${r},${c}`);
  },
};

function enemyTurn() {
  const [r, c] = ai.nextTarget();
  const g = state.playerGrid[r][c];
  ai.tried.add(`${r},${c}`);

  if (g.ship) {
    g.hit = true;
    const ship = state.playerShips.find(s => s.id === g.ship);
    if (!ship.hitCells) ship.hitCells = new Set();
    const segIdx = ship.cells.findIndex(([sr, sc]) => sr === r && sc === c);
    ship.hitCells.add(segIdx);
    ship.hits = (ship.hits || 0) + 1;

    let sunk = false;
    if (ship.hits >= ship.size) {
      ship.sunk = true;
      sunk = true;
      addLog(`☠ ENEMY SANK YOUR ${ship.name}!`, 'sunk');
    } else {
      addLog(`⚠ ENEMY HIT YOUR ${ship.name} AT ${coordLabel(r, c)}!`, 'enemy-hit');
    }

    ai.recordHit(r, c, sunk);
    renderPlayerBoard();
    updateFleet(state.playerShips, 'player');

    if (checkWin(state.playerShips)) {
      setTimeout(() => endGame(false), 600);
      return;
    }
  } else {
    g.miss = true;
    addLog(`○ ENEMY MISSED AT ${coordLabel(r, c)}`, 'enemy-miss');
    ai.recordMiss(r, c);
    renderPlayerBoard();
  }

  updateStats();
  state.playerTurn = true;
  setPhase('YOUR TURN', true);
  document.getElementById('enemy-board').classList.remove('locked');
}

// ── UTILITIES ─────────────────────────────────────────────────────────────
function checkWin(ships) {
  return ships.every(s => s.sunk);
}

function updateStats() {
  document.getElementById('shot-counter').textContent = state.shots;
  document.getElementById('hit-counter').textContent = state.hits;
  document.getElementById('enemy-ships-left').textContent =
    state.enemyShips.filter(s => !s.sunk).length;
  document.getElementById('player-ships-left').textContent =
    state.playerShips.filter(s => !s.sunk).length;
  updateFleet(state.playerShips, 'player');
  updateFleet(state.enemyShips, 'enemy');
}

function setPhase(text, isPlayer) {
  const el = document.getElementById('phase-indicator');
  el.textContent = text;
  el.className = `status-value${isPlayer ? ' your-turn' : ' enemy-turn'}`;
}

function addLog(msg, type) {
  const container = document.getElementById('log-entries');
  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  entry.textContent = msg;
  container.prepend(entry);
}

function flashScreen(r, c, isHit) {
  const overlay = document.getElementById('explosion-overlay');
  const board = document.getElementById('enemy-board');
  const rect = board.getBoundingClientRect();
  const cellSize = rect.width / GRID_SIZE;
  const x = ((c * cellSize + cellSize / 2 + rect.left) / window.innerWidth) * 100;
  const y = ((r * cellSize + cellSize / 2 + rect.top) / window.innerHeight) * 100;
  overlay.style.setProperty('--ex', `${x}%`);
  overlay.style.setProperty('--ey', `${y}%`);
  overlay.className = `explosion-overlay ${isHit ? 'hit-flash' : 'miss-flash'}`;
  setTimeout(() => { overlay.className = 'explosion-overlay'; }, 500);
}

// ── SCREEN NAV ────────────────────────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ── END GAME ──────────────────────────────────────────────────────────────
function endGame(playerWon) {
  state.gameOver = true;
  const accuracy = state.shots > 0
    ? Math.round((state.hits / state.shots) * 100)
    : 0;

  document.getElementById('final-shots').textContent = state.shots;
  document.getElementById('final-hits').textContent = state.hits;
  document.getElementById('final-accuracy').textContent = accuracy + '%';

  if (playerWon) {
    document.getElementById('result-icon').textContent = '🏆';
    document.getElementById('result-label').textContent = 'VICTORY';
    document.getElementById('result-title').textContent = 'MISSION COMPLETE';
    document.getElementById('result-title').classList.remove('defeat');
    document.getElementById('result-sub').textContent = 'All enemy vessels have been destroyed!';
  } else {
    document.getElementById('result-icon').textContent = '💀';
    document.getElementById('result-label').textContent = 'DEFEAT';
    document.getElementById('result-title').textContent = 'FLEET DESTROYED';
    document.getElementById('result-title').classList.add('defeat');
    document.getElementById('result-sub').textContent = 'Your fleet has been annihilated by the enemy!';
  }

  setTimeout(() => showScreen('result-screen'), 800);
}

// ── EVENTS ────────────────────────────────────────────────────────────────
document.getElementById('rotate-btn').addEventListener('click', () => {
  state.orientation = state.orientation === 'H' ? 'V' : 'H';
  updateOrientationLabel();
});

document.getElementById('random-btn').addEventListener('click', () => {
  state.playerGrid = makeGrid();
  state.placedShips = [];
  state.selectedShip = null;
  const placed = randomPlacement(state.playerGrid, SHIPS);
  state.placedShips = placed;
  renderShipList();
  renderSetupBoard();
  updateStartBtn();
});

document.getElementById('clear-btn').addEventListener('click', () => {
  state.playerGrid = makeGrid();
  state.placedShips = [];
  state.selectedShip = null;
  renderShipList();
  renderSetupBoard();
  updateStartBtn();
});

document.getElementById('start-btn').addEventListener('click', () => {
  ai.reset();
  startGame();
});

document.getElementById('play-again-btn').addEventListener('click', () => {
  state = {
    playerGrid: [],
    enemyGrid: [],
    playerShips: [],
    enemyShips: [],
    placedShips: [],
    selectedShip: null,
    orientation: 'H',
    playerTurn: true,
    shots: 0,
    hits: 0,
    gameOver: false,
  };
  ai.reset();
  initSetup();
  showScreen('setup-screen');
});

// ── BOOT ──────────────────────────────────────────────────────────────────
initSetup();
showScreen('setup-screen');