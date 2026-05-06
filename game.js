'use strict';

const GRID  = 10;
const COLS  = ['A','B','C','D','E','F','G','H','I','J'];
const DIRS  = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
const BOT_SHOT_DELAY = 520;

const SHIP_DEFS = [
  { id:'carrier',    name:'CARRIER',    size:5 },
  { id:'battleship', name:'BATTLESHIP', size:4 },
  { id:'cruiser',    name:'CRUISER',    size:3 },
  { id:'submarine',  name:'SUBMARINE',  size:3 },
  { id:'destroyer',  name:'DESTROYER',  size:2 },
];


let S = freshState();

function freshState() {
  return {
    playerGrid:  makeGrid(),
    enemyGrid:   makeGrid(),
    playerShips: [],
    enemyShips:  [],
    placed:      [],
    selected:    null,
    orientation: 'H',
    playerTurn:  true,
    shots: 0, hits: 0,
    over: false,
  };
}


function makeGrid() {
  return Array.from({length:GRID}, () =>
    Array.from({length:GRID}, () => ({
      ship: null,
      hit:  false,
      miss: false,
      safe: false,
    }))
  );
}

function inBounds(r,c) { return r>=0 && r<GRID && c>=0 && c<GRID; }
function label(r,c) { return `${COLS[c]}${r+1}`; }


function shipCells(r,c,size,dir) {
  const cells=[];
  for(let i=0;i<size;i++) {
    const nr = dir==='V' ? r+i : r;
    const nc = dir==='H' ? c+i : c;
    cells.push([nr,nc]);
  }
  return cells;
}


function canPlace(grid, r, c, size, dir) {
  const cells = shipCells(r,c,size,dir);
  const cellSet = new Set(cells.map(([r,c])=>`${r},${c}`));
  for(const [sr,sc] of cells) {
    if(!inBounds(sr,sc)) return false;
    if(grid[sr][sc].ship) return false;

    for(const [dr,dc] of DIRS) {
      const nr=sr+dr, nc=sc+dc;
      if(!inBounds(nr,nc)) continue;
      if(cellSet.has(`${nr},${nc}`)) continue;
      if(grid[nr][nc].ship) return false;
    }
  }
  return true;
}


function placeShip(grid, r, c, size, dir, id) {
  const cells = shipCells(r,c,size,dir);
  for(const [nr,nc] of cells) grid[nr][nc].ship = id;
  return cells;
}


function randomPlacement(grid, defs) {
  const ships=[];
  for(const def of defs) {
    let ok=false;
    while(!ok) {
      const dir = Math.random()<.5 ? 'H' : 'V';
      const r   = Math.floor(Math.random()*GRID);
      const c   = Math.floor(Math.random()*GRID);
      if(canPlace(grid,r,c,def.size,dir)) {
        const cells = placeShip(grid,r,c,def.size,dir,def.id);
        ships.push({...def, cells, hits:0, hitCells:new Set(), sunk:false});
        ok=true;
      }
    }
  }
  return ships;
}


function revealSafeZone(grid, ship) {
  const revealed=[];
  for(const [sr,sc] of ship.cells) {
    for(const [dr,dc] of DIRS) {
      const nr=sr+dr, nc=sc+dc;
      if(!inBounds(nr,nc)) continue;
      const cell=grid[nr][nc];
      if(!cell.hit && !cell.miss && !cell.safe && !cell.ship) {
        cell.safe=true;
        revealed.push([nr,nc]);
      }
    }
  }
  return revealed;
}


function initSetup() {
  S.playerGrid=makeGrid();
  S.placed=[];
  S.selected=null;
  S.orientation='H';
  renderShipList();
  renderSetupBoard();
  updateStartBtn();
  updateOrientLabel();
}

function renderShipList() {
  const el=document.getElementById('ship-list');
  el.innerHTML='';
  SHIP_DEFS.forEach(def=>{
    const placed   = S.placed.some(p=>p.id===def.id);
    const selected = S.selected && S.selected.id===def.id;
    const div=document.createElement('div');
    div.className='ship-item'+(placed?' placed':'')+(selected?' selected':'');

    const icon=document.createElement('div');
    icon.className='ship-icon';
    for(let i=0;i<def.size;i++){
      const b=document.createElement('div');
      b.className='ship-block';
      icon.appendChild(b);
    }
    const lbl=document.createElement('span');
    lbl.textContent=`${def.name} (${def.size})`;
    div.appendChild(icon);
    div.appendChild(lbl);

    if(!placed) div.addEventListener('click',()=>{ S.selected=def; renderShipList(); });
    el.appendChild(div);
  });
}

function renderSetupBoard() {
  const board=document.getElementById('setup-board');
  board.innerHTML='';
  for(let r=0;r<GRID;r++) for(let c=0;c<GRID;c++) {
    const cell=document.createElement('div');
    cell.className='cell';
    if(S.playerGrid[r][c].ship) cell.classList.add('ship');
    cell.addEventListener('click',  ()=>onSetupClick(r,c));
    cell.addEventListener('mouseenter',()=>onSetupHover(r,c,true));
    cell.addEventListener('mouseleave',()=>onSetupHover(r,c,false));
    board.appendChild(cell);
  }
}

function onSetupClick(r,c) {
  if(!S.selected) return;
  if(!canPlace(S.playerGrid,r,c,S.selected.size,S.orientation)) return;
  const cells=placeShip(S.playerGrid,r,c,S.selected.size,S.orientation,S.selected.id);
  S.placed.push({...S.selected, cells, hits:0, hitCells:new Set(), sunk:false});
  S.selected=null;
  clearPreviews();
  renderShipList();
  renderSetupBoard();
  updateStartBtn();
}

function onSetupHover(r,c,entering) {
  clearPreviews();
  if(!entering || !S.selected) return;
  const valid=canPlace(S.playerGrid,r,c,S.selected.size,S.orientation);
  const cells=shipCells(r,c,S.selected.size,S.orientation);
  const allCells=document.querySelectorAll('#setup-board .cell');
  for(const [nr,nc] of cells) {
    if(!inBounds(nr,nc)) continue;
    const cl=allCells[nr*GRID+nc];
    cl.classList.add(valid?'preview':'preview-bad');
  }
}

function clearPreviews() {
  document.querySelectorAll('#setup-board .preview,.preview-bad').forEach(c=>{
    c.classList.remove('preview','preview-bad');
  });
}

function updateOrientLabel() {
  document.getElementById('orientation-label').textContent =
    S.orientation==='H' ? 'HORIZONTAL' : 'VERTICAL';
}
function updateStartBtn() {
  document.getElementById('start-btn').disabled = S.placed.length < SHIP_DEFS.length;
}


function startGame() {
  S.enemyGrid  = makeGrid();
  S.enemyShips = randomPlacement(S.enemyGrid, SHIP_DEFS);
  S.playerShips= JSON.parse(JSON.stringify(S.placed));

  S.playerShips.forEach(s=>{ s.hitCells=new Set(); s.sunk=false; s.hits=0; });
  S.playerTurn=true; S.shots=0; S.hits=0; S.over=false;

  ai.reset();
  renderPlayerBoard();
  renderEnemyBoard();
  renderFleets();
  updateStats();
  setPhase('YOUR TURN', true);
  document.getElementById('log-entries').innerHTML='';
  showScreen('game-screen');
}


function renderPlayerBoard() {
  const board=document.getElementById('player-board');
  board.innerHTML='';
  for(let r=0;r<GRID;r++) for(let c=0;c<GRID;c++) {
    const g=S.playerGrid[r][c];
    const cell=document.createElement('div');
    cell.className='cell';
    if(g.ship && !g.hit) cell.classList.add('ship');
    if(g.hit)  cell.classList.add(shipSunk(S.playerShips,g.ship)?'sunk':'hit');
    if(g.miss) cell.classList.add('miss');
    if(g.safe) cell.classList.add('safe-zone');
    board.appendChild(cell);
  }
}

function renderEnemyBoard() {
  const board=document.getElementById('enemy-board');
  board.innerHTML='';
  for(let r=0;r<GRID;r++) for(let c=0;c<GRID;c++) {
    const g=S.enemyGrid[r][c];
    const cell=document.createElement('div');
    cell.className='cell';
    const sunk = g.ship && shipSunk(S.enemyShips,g.ship);
    if(g.hit)  cell.classList.add(sunk?'sunk':'hit');
    if(g.miss) cell.classList.add('miss');
    if(g.safe) cell.classList.add('safe-zone');

    if(!g.hit && !g.miss && !g.safe) {
      cell.addEventListener('click',()=>playerFire(r,c));
    } else {
      cell.classList.add('no-fire');
    }
    board.appendChild(cell);
  }
}

function shipSunk(ships, id) {
  const s=ships.find(s=>s.id===id);
  return s && s.sunk;
}


function renderFleets() {
  renderFleetMini('player-fleet', S.playerShips);
  renderFleetMini('enemy-fleet',  S.enemyShips);
}

function renderFleetMini(elId, ships) {
  const el=document.getElementById(elId);
  el.innerHTML='';
  ships.forEach(ship=>{
    const row=document.createElement('div');
    row.className='fm-ship';
    row.id=`fm-${elId}-${ship.id}`;
    for(let i=0;i<ship.size;i++){
      const seg=document.createElement('div');
      seg.className='fm-seg'+(ship.sunk?' fm-sunk':ship.hitCells.has(i)?' fm-hit':'');
      row.appendChild(seg);
    }
    el.appendChild(row);
  });
}

function updateFleetMini(elId, ships) {
  ships.forEach(ship=>{
    const row=document.getElementById(`fm-${elId}-${ship.id}`);
    if(!row) return;
    const segs=row.querySelectorAll('.fm-seg');
    segs.forEach((seg,i)=>{
      seg.className='fm-seg'+(ship.sunk?' fm-sunk':ship.hitCells.has(i)?' fm-hit':'');
    });
  });
}


function updateStats() {
  document.getElementById('shot-counter').textContent = S.shots;
  document.getElementById('hit-counter').textContent  = S.hits;
  document.getElementById('enemy-ships-left').textContent =
    S.enemyShips.filter(s=>!s.sunk).length;
  document.getElementById('player-ships-left').textContent =
    S.playerShips.filter(s=>!s.sunk).length;
}

function setPhase(text, isPlayer) {
  const el=document.getElementById('phase-indicator');
  el.textContent=text;
  el.className='status-value'+(isPlayer?' your-turn':'');
}

function addLog(msg, cls, icon='') {
  const c=document.getElementById('log-entries');
  const d=document.createElement('div');
  d.className=`log-entry ${cls}`;
  d.innerHTML = icon ? `<i class="bi ${icon}" aria-hidden="true"></i> ${msg}` : msg;
  c.prepend(d);
}


function playerFire(r,c) {
  if(!S.playerTurn || S.over) return;
  const g=S.enemyGrid[r][c];
  if(g.hit||g.miss||g.safe) return;

  // Lock turn during processing to prevent double-clicks
  S.playerTurn = false;
  S.shots++;

  if(g.ship) {
    g.hit=true;
    S.hits++;
    const ship=S.enemyShips.find(s=>s.id===g.ship);
    const segIdx=ship.cells.findIndex(([sr,sc])=>sr===r&&sc===c);
    ship.hitCells.add(segIdx);
    ship.hits++;

    if(ship.hits>=ship.size) {
      ship.sunk=true;
      ship.cells.forEach(([sr,sc])=>{ S.enemyGrid[sr][sc].hit=true; });
      const safe=revealSafeZone(S.enemyGrid, ship);
      addLog(`YOU SANK THEIR ${ship.name}!`, 'l-sunk', 'bi-exclamation-octagon-fill');
      if(safe.length) addLog(`${safe.length} SAFE ZONE CELLS REVEALED`, 'l-safe', 'bi-shield-check');
    } else {
      addLog(`HIT AT ${label(r,c)}! FIRE AGAIN!`, 'p-hit', 'bi-bullseye');
    }

    flashScreen('enemy-board', r, c, true);
    renderEnemyBoard();
    updateFleetMini('enemy-fleet', S.enemyShips);
    updateStats();

    if(S.enemyShips.every(s=>s.sunk)) { setTimeout(()=>endGame(true),700); return; }

    // HIT → player keeps their turn
    S.playerTurn = true;
    setPhase('YOUR TURN', true);

  } else {
    // MISS → hand off to enemy
    g.miss=true;
    addLog(`MISS AT ${label(r,c)}`, 'p-miss', 'bi-circle');
    flashScreen('enemy-board', r, c, false);
    renderEnemyBoard();
    updateStats();
    setPhase('ENEMY TURN', false);
    document.getElementById('enemy-board').classList.add('locked');
    setTimeout(()=>{ if(!S.over) enemyTurn(); }, BOT_SHOT_DELAY);
  }
}


const ai = {
  mode:  'hunt',
  queue: [],
  tried: new Set(),
  lastHits: [],

  reset() { this.mode='hunt'; this.queue=[]; this.tried=new Set(); this.lastHits=[]; },

  pick() {

    while(this.mode==='target' && this.queue.length>0) {
      const [r,c]=this.queue.shift();
      const key=`${r},${c}`;
      const g=S.playerGrid[r][c];
      if(!this.tried.has(key) && inBounds(r,c) && !g.hit && !g.miss && !g.safe) return [r,c];
    }

    this.mode='hunt'; this.lastHits=[];
    return this.hunt();
  },

  hunt() {

    const cands=[];
    for(let r=0;r<GRID;r++) for(let c=0;c<GRID;c++) {
      if((r+c)%2===0) {
        const g=S.playerGrid[r][c];
        if(!g.hit&&!g.miss&&!g.safe&&!this.tried.has(`${r},${c}`)) cands.push([r,c]);
      }
    }
    if(cands.length>0) return cands[Math.floor(Math.random()*cands.length)];

    const all=[];
    for(let r=0;r<GRID;r++) for(let c=0;c<GRID;c++) {
      const g=S.playerGrid[r][c];
      if(!g.hit&&!g.miss&&!g.safe&&!this.tried.has(`${r},${c}`)) all.push([r,c]);
    }
    if(all.length===0) return null;
    return all[Math.floor(Math.random()*all.length)];
  },

  onHit(r,c,sunk) {
    this.tried.add(`${r},${c}`);
    if(sunk) { this.mode='hunt'; this.lastHits=[]; this.queue=[]; return; }
    this.mode='target';
    this.lastHits.push([r,c]);
    const adj=[[-1,0],[1,0],[0,-1],[0,1]];
    if(this.lastHits.length>=2) {
      const [r1,c1]=this.lastHits[0];
      const [r2,c2]=this.lastHits[this.lastHits.length-1];
      const dr=Math.sign(r2-r1), dc=Math.sign(c2-c1);
      this.queue=[[r2+dr,c2+dc],[r1-dr,c1-dc],...adj.map(([dr,dc])=>[r+dr,c+dc])];
    } else {
      this.queue=adj.map(([dr,dc])=>[r+dr,c+dc]);
    }
  },

  onMiss(r,c) { this.tried.add(`${r},${c}`); },
};

function enemyTurn() {
  const target = ai.pick();
  if(!target) {
    S.playerTurn=true;
    setPhase('YOUR TURN', true);
    document.getElementById('enemy-board').classList.remove('locked');
    return;
  }
  const [r,c]=target;
  ai.tried.add(`${r},${c}`);
  const g=S.playerGrid[r][c];
  let enemyKeepsTurn = false;

  if(g.ship) {
    g.hit=true;
    enemyKeepsTurn = true;
    const ship=S.playerShips.find(s=>s.id===g.ship);
    const segIdx=ship.cells.findIndex(([sr,sc])=>sr===r&&sc===c);
    ship.hitCells.add(segIdx);
    ship.hits++;

    if(ship.hits>=ship.size) {
      ship.sunk=true;
      ship.cells.forEach(([sr,sc])=>{ S.playerGrid[sr][sc].hit=true; });
      const safe=revealSafeZone(S.playerGrid, ship);

      safe.forEach(([nr,nc])=>ai.tried.add(`${nr},${nc}`));
      addLog(`ENEMY SANK YOUR ${ship.name}!`, 'l-sunk', 'bi-exclamation-octagon-fill');
      ai.onHit(r,c,true);
    } else {
      addLog(`ENEMY HIT ${ship.name} AT ${label(r,c)}!`, 'e-hit', 'bi-crosshair2');
      ai.onHit(r,c,false);
    }

    flashScreen('player-board', r, c, true);
    renderPlayerBoard();
    updateFleetMini('player-fleet', S.playerShips);
    updateStats();

    if(S.playerShips.every(s=>s.sunk)) { setTimeout(()=>endGame(false),700); return; }
  } else {
    g.miss=true;
    addLog(`ENEMY MISSED AT ${label(r,c)}`, 'e-miss', 'bi-circle');
    ai.onMiss(r,c);
    flashScreen('player-board', r, c, false);
    renderPlayerBoard();
  }

  updateStats();
  if(enemyKeepsTurn) {
    S.playerTurn=false;
    setPhase('ENEMY TURN', false);
    document.getElementById('enemy-board').classList.add('locked');
    setTimeout(()=>{ if(!S.over) enemyTurn(); }, BOT_SHOT_DELAY);
  } else {
    S.playerTurn=true;
    setPhase('YOUR TURN', true);
    document.getElementById('enemy-board').classList.remove('locked');
  }
}


function flashScreen(boardId, r, c, isHit) {
  const overlay=document.getElementById('explosion-overlay');
  const missile=document.getElementById('missile-overlay');
  const board=document.getElementById(boardId);
  if(!overlay || !missile || !board) return;
  const rect=board.getBoundingClientRect();
  const cs=rect.width/GRID;
  const x=((c*cs+cs/2+rect.left)/window.innerWidth)*100;
  const y=((r*cs+cs/2+rect.top)/window.innerHeight)*100;
  const sx = x - 12;
  const sy = y - 22;
  const targetCell = board.children[r*GRID+c];

  missile.className='missile-overlay';
  overlay.className='explosion-overlay';
  void missile.offsetWidth;

  missile.style.setProperty('--msx',`${sx}%`);
  missile.style.setProperty('--msy',`${sy}%`);
  missile.style.setProperty('--mtx',`${x}%`);
  missile.style.setProperty('--mty',`${y}%`);
  missile.className='missile-overlay missile-flight';
  setTimeout(()=>{ missile.className='missile-overlay'; },420);

  overlay.style.setProperty('--ex',`${x}%`);
  overlay.style.setProperty('--ey',`${y}%`);
  overlay.className=`explosion-overlay ${isHit?'hit-flash':'miss-flash'}`;
  setTimeout(()=>{ overlay.className='explosion-overlay'; },500);

  if(targetCell) {
    targetCell.classList.remove('impact-cell','impact-hit','impact-miss');
    void targetCell.offsetWidth;
    targetCell.classList.add('impact-cell', isHit ? 'impact-hit' : 'impact-miss');
    setTimeout(()=>{
      targetCell.classList.remove('impact-cell','impact-hit','impact-miss');
    }, 360);
  }
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}


function endGame(won) {
  S.over=true;
  const acc = S.shots>0 ? Math.round((S.hits/S.shots)*100) : 0;
  document.getElementById('final-shots').textContent   = S.shots;
  document.getElementById('final-hits').textContent    = S.hits;
  document.getElementById('final-accuracy').textContent= acc+'%';
  if(won) {
    document.getElementById('result-icon').innerHTML ='<i class="bi bi-trophy-fill"></i>';
    document.getElementById('result-label').textContent='VICTORY';
    document.getElementById('result-title').textContent='MISSION COMPLETE';
    document.getElementById('result-title').classList.remove('defeat');
    document.getElementById('result-sub').textContent  ='All enemy vessels destroyed!';
  } else {
    document.getElementById('result-icon').innerHTML ='<i class="bi bi-x-octagon-fill"></i>';
    document.getElementById('result-label').textContent='DEFEAT';
    document.getElementById('result-title').textContent='FLEET DESTROYED';
    document.getElementById('result-title').classList.add('defeat');
    document.getElementById('result-sub').textContent  ='Your fleet has been annihilated!';
  }
  setTimeout(()=>showScreen('result-screen'),900);
}


document.getElementById('rotate-btn').addEventListener('click',()=>{
  S.orientation = S.orientation==='H' ? 'V' : 'H';
  updateOrientLabel();
});

document.getElementById('random-btn').addEventListener('click',()=>{
  S.playerGrid=makeGrid();
  S.placed=[];
  S.selected=null;
  S.placed=randomPlacement(S.playerGrid, SHIP_DEFS);
  renderShipList();
  renderSetupBoard();
  updateStartBtn();
});

document.getElementById('clear-btn').addEventListener('click',()=>{
  S.playerGrid=makeGrid();
  S.placed=[];
  S.selected=null;
  renderShipList();
  renderSetupBoard();
  updateStartBtn();
});

document.getElementById('start-btn').addEventListener('click',()=>{
  startGame();
});

document.getElementById('play-again-btn').addEventListener('click',()=>{
  S=freshState();
  ai.reset();
  initSetup();
  showScreen('setup-screen');
});


initSetup();
showScreen('setup-screen');