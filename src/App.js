import React, { useState, useEffect, useRef, useCallback } from "react";

// === CONFIGURATION ===
const GRID_SIZE = 25;
const BASE_SPEED = 150; 
const MAX_SPEED = 80;
const FEVER_DURATION = 5000;
const MALUS_DURATION = 5000;
const COMBO_TIMEOUT = 2500;
const OBSTACLE_THRESHOLD = 20;

const SNAKE_CLASSES = {
  classic: { name: "Classique", color: "green", desc: "Équilibré, pour débuter." },
  viper:   { name: "Viper", color: "cyan", desc: "Vitesse +20%, Score x2." },
  tank:    { name: "Tank", color: "orange", desc: "Space pour casser les murs." },
  mage:    { name: "Mage", color: "purple", desc: "Attire la nourriture (Aimant)." },
};

const App = () => {
  // --- ÉTATS ---
  const [snake, setSnake] = useState([{ x: 10, y: 10 }]);
  const [food, setFood] = useState({ x: 5, y: 5, type: "normal" });
  const [direction, setDirection] = useState({ x: 1, y: 0 });
  const [status, setStatus] = useState("menu"); 
  
  const [showRules, setShowRules] = useState(false);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(parseInt(localStorage.getItem("bestScore")) || 0);
  const [speed, setSpeed] = useState(BASE_SPEED);
  
  const [selectedClass, setSelectedClass] = useState("classic");
  const [obstacles, setObstacles] = useState([]);
  
  const [isImmortal, setIsImmortal] = useState(false);
  const [malusActive, setMalusActive] = useState(false);
  const [feverMode, setFeverMode] = useState(false);
  const [combo, setCombo] = useState(0);
  const [abilityReady, setAbilityReady] = useState(true);

  const [pointsAnimation, setPointsAnimation] = useState(null);
  const [shake, setShake] = useState(false);
  const [flash, setFlash] = useState(false);

  const [realTileSize, setRealTileSize] = useState(20);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const containerRef = useRef(null);
  
  const directionQueue = useRef([]);
  const lastProcessedDirection = useRef({ x: 1, y: 0 });
  const lastEatTime = useRef(0);
  
  const playSound = useCallback((type) => {
    // Audio placeholder
  }, []);

  // --- INIT ---
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
      if (containerRef.current) {
        const size = Math.min(
          containerRef.current.offsetWidth,
          containerRef.current.offsetHeight
        ) / GRID_SIZE;
        setRealTileSize(Math.floor(size));
      }
    };
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // --- MOUVEMENT ---
  const moveSnake = useCallback(() => {
    if (status !== "playing") return;

    let nextDir = direction;
    if (directionQueue.current.length > 0) {
      nextDir = directionQueue.current.shift();
      setDirection(nextDir);
    }
    lastProcessedDirection.current = nextDir;

    const newSnake = [...snake];
    const head = { x: newSnake[0].x + nextDir.x, y: newSnake[0].y + nextDir.y };

    // Collisions
    let hitObstacleIndex = obstacles.findIndex(o => o.x === head.x && o.y === head.y);
    let collision = false;

    if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
        if (isImmortal || feverMode) {
            if (head.x < 0) head.x = GRID_SIZE - 1;
            if (head.x >= GRID_SIZE) head.x = 0;
            if (head.y < 0) head.y = GRID_SIZE - 1;
            if (head.y >= GRID_SIZE) head.y = 0;
        } else {
            collision = true;
        }
    }
    else if (newSnake.some(p => p.x === head.x && p.y === head.y)) {
        if (!isImmortal && !feverMode) collision = true;
    }
    else if (hitObstacleIndex !== -1) {
        if (isImmortal || feverMode) {
            const newObs = [...obstacles];
            newObs.splice(hitObstacleIndex, 1);
            setObstacles(newObs);
            setScore(s => s + 5);
            setShake(true); setTimeout(() => setShake(false), 200);
        } else {
            collision = true;
        }
    }

    if (collision) {
        triggerGameOver();
        return;
    }

    newSnake.unshift(head);

    // Manger
    const canEat = (head.x === food.x && head.y === food.y) || 
                   (selectedClass === "mage" && Math.abs(head.x - food.x) <= 1 && Math.abs(head.y - food.y) <= 1);

    if (canEat) {
        handleEat(newSnake);
    } else {
        newSnake.pop();
    }

    setSnake(newSnake);
  }, [snake, direction, status, food, obstacles, isImmortal, feverMode, selectedClass]);


  const handleEat = (currentSnake) => {
    const now = Date.now();
    if (now - lastEatTime.current < COMBO_TIMEOUT) {
        const newCombo = combo + 1;
        setCombo(newCombo);
        if (newCombo >= 3 && !feverMode) activateFever();
    } else {
        setCombo(1);
    }
    lastEatTime.current = now;

    // --- CALCUL DES POINTS ---
    let points = 1;
    let isBonus = false;

    if (selectedClass === "viper") points = 2;

    if (malusActive && food.type !== "poison") {
        points = 5; 
        isBonus = true;
    }

    if (feverMode) points *= 2;
    if (food.type === "magic") points += 5;

    // --- GESTION EFFETS ---
    if (food.type === "poison") {
        setMalusActive(true);
        playSound("malus");
        setFlash(true); setTimeout(() => setFlash(false), 300);
        setTimeout(() => setMalusActive(false), MALUS_DURATION);
        points = 0; 
    } 
    else if (food.type === "immortal") {
        setIsImmortal(true);
        setTimeout(() => setIsImmortal(false), 5000);
        playSound("eat");
    }
    else {
        playSound("eat");
    }

    if (points > 0) {
        setScore(s => s + points);
        setPointsAnimation({ x: currentSnake[0].x, y: currentSnake[0].y, val: points, bonus: isBonus });
        setTimeout(() => setPointsAnimation(null), 600);
    }

    if (!feverMode && food.type !== "poison") {
         if ((score + points) % 10 === 0) setSpeed(prev => Math.max(MAX_SPEED, prev - 10));
    }
    
    const targetObstaclesCount = Math.floor(score / OBSTACLE_THRESHOLD);
    if (obstacles.length < targetObstaclesCount) spawnObstacle(currentSnake);

    generateFood(currentSnake);
  };

  const activateFever = () => {
    setFeverMode(true);
    playSound("fever");
    setSpeed(60); 
    setTimeout(() => {
        setFeverMode(false);
        setCombo(0);
        setSpeed(Math.max(MAX_SPEED, BASE_SPEED - (Math.floor(score/10)*10))); 
    }, FEVER_DURATION);
  };

  const spawnObstacle = (currentSnake) => {
      let x, y;
      for(let i=0; i<50; i++) {
          x = Math.floor(Math.random() * GRID_SIZE);
          y = Math.floor(Math.random() * GRID_SIZE);
          const onSnake = currentSnake.some(p => p.x === x && p.y === y);
          const onFood = (x === food.x && y === food.y);
          const onOtherObstacle = obstacles.some(o => o.x === x && o.y === y);
          const tooCloseToHead = Math.abs(x - currentSnake[0].x) + Math.abs(y - currentSnake[0].y) < 4;
          if (!onSnake && !onFood && !onOtherObstacle && !tooCloseToHead) {
              setObstacles(prev => [...prev, { x, y }]);
              return;
          }
      }
  };

  const generateFood = (currentSnake) => {
    let x, y;
    let safe = false;
    while(!safe) {
      x = Math.floor(Math.random() * GRID_SIZE);
      y = Math.floor(Math.random() * GRID_SIZE);
      const onSnake = currentSnake.some(p => p.x === x && p.y === y);
      const onObstacle = obstacles.some(o => o.x === x && o.y === y);
      if(!onSnake && !onObstacle) safe = true;
    }

    const rand = Math.random();
    let type = "normal";
    if (rand > 0.95) type = "immortal";
    else if (rand > 0.75) type = "poison";
    else if (rand > 0.65) type = "magic";
    setFood({ x, y, type });
  };

  const triggerGameOver = () => {
      setStatus("gameover");
      playSound("hit");
      setShake(true);
      if (score > bestScore) {
          localStorage.setItem("bestScore", score);
          setBestScore(score);
      }
  };

  useEffect(() => {
    if (status === "playing") {
        const interval = setInterval(moveSnake, speed);
        return () => clearInterval(interval);
    }
  }, [moveSnake, speed, status]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (status !== "playing") return;

      if (e.code === "Space" && selectedClass === "tank" && abilityReady) {
          setIsImmortal(true); setAbilityReady(false);
          setFlash(true); setTimeout(() => setFlash(false), 200);
          setTimeout(() => setIsImmortal(false), 2000); 
          setTimeout(() => setAbilityReady(true), 10000);
          return;
      }

      const keys = { ArrowUp: {x:0, y:-1}, ArrowDown: {x:0, y:1}, ArrowLeft: {x:-1, y:0}, ArrowRight: {x:1, y:0} };
      if (!keys[e.key]) return;
      e.preventDefault();

      let requestedDir = keys[e.key];
      if (malusActive) requestedDir = { x: -requestedDir.x, y: -requestedDir.y };

      const lastDir = directionQueue.current.length > 0 ? directionQueue.current[directionQueue.current.length - 1] : lastProcessedDirection.current;
      
      if (requestedDir.x !== -lastDir.x || requestedDir.y !== -lastDir.y) {
          if (directionQueue.current.length < 2) directionQueue.current.push(requestedDir);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [status, malusActive, selectedClass, abilityReady]);

  const startGame = () => {
    setSnake([{ x: 10, y: 10 }, { x: 10, y: 11 }, { x: 10, y: 12 }]);
    setDirection({ x: 0, y: -1 });
    directionQueue.current = [];
    lastProcessedDirection.current = { x: 0, y: -1 };
    setScore(0);
    setObstacles([]);
    setCombo(0);
    setFeverMode(false);
    setMalusActive(false);
    setAbilityReady(true);
    const startSpeed = selectedClass === "viper" ? BASE_SPEED * 0.8 : BASE_SPEED;
    setSpeed(startSpeed);
    setStatus("playing");
  };

  const getFoodStyle = (type) => {
      switch(type) {
          case "magic": return "bg-blue-400 shadow-[0_0_10px_blue]";
          case "immortal": return "bg-yellow-400 shadow-[0_0_10px_gold] animate-pulse";
          case "poison": return "bg-purple-600 shadow-[0_0_10px_purple] animate-bounce";
          default: return "bg-red-500 shadow-[0_0_10px_red]";
      }
  };

  // Fonction pour déterminer la classe de style du corps (le "squarcle")
  const getBodyShape = (index, length) => {
      if (index === 0) return "rounded-full"; // Tête ronde
      // Corps intermédiaire : arrondi custom (environ 35%) pour un aspect fusionné
      return "rounded-[35%]"; 
  };

  return (
    <div className={`flex flex-col items-center justify-center min-h-screen text-white overflow-hidden touch-none transition-colors duration-1000
        ${feverMode ? "bg-red-900" : malusActive ? "bg-purple-900" : "bg-slate-900"}
    `}>
      
      {/* HUD */}
      <div className="w-full max-w-lg px-4 flex justify-between items-end mb-2 z-10">
         <div>
            <h1 className="text-3xl font-black italic tracking-tighter">SNAKE <span className="text-blue-400">RPG</span></h1>
            <div className="text-sm opacity-70">Class: {SNAKE_CLASSES[selectedClass].name}</div>
         </div>
         <div className="text-right">
             <div className="text-4xl font-bold">{score}</div>
             <div className="text-xs text-yellow-400">BEST: {bestScore}</div>
         </div>
      </div>

      <div className="w-full max-w-lg h-2 bg-gray-700 rounded-full mb-4 overflow-hidden relative">
          <div className={`h-full transition-all duration-300 ${feverMode ? "bg-yellow-300 w-full animate-pulse" : "bg-blue-500"}`}
            style={{ width: feverMode ? '100%' : `${(combo / 3) * 100}%` }} />
      </div>

      {/* GAME BOARD */}
      <div 
        ref={containerRef}
        className={`relative bg-black/40 rounded-[2rem] border-2 backdrop-blur-sm transition-all duration-100 overflow-hidden
            ${shake ? "translate-x-1 translate-y-1" : ""}
            ${malusActive ? "border-purple-500 shadow-[0_0_30px_purple]" : ""}
            ${feverMode ? "border-yellow-500 shadow-[0_0_50px_orange]" : "border-gray-600"}
        `}
        style={{ width: Math.min(window.innerWidth - 30, 500), height: Math.min(window.innerWidth - 30, 500) }}
      >
        {flash && <div className="absolute inset-0 bg-white/30 z-40 pointer-events-none" />}
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: `radial-gradient(circle, #fff 1px, transparent 1px)`, backgroundSize: `${realTileSize}px ${realTileSize}px` }} />

        {/* Snake - CORPS LIQUIDE ICI */}
        {snake.map((part, i) => (
             <div key={i} 
             // Utilisation de la nouvelle fonction pour la forme + z-index pour que la tête soit au-dessus
             className={`absolute transition-all duration-100 ${getBodyShape(i, snake.length)} ${i===0 ? "z-20 scale-110" : "z-10 scale-105"} 
                ${isImmortal || feverMode ? "bg-yellow-300" : SNAKE_CLASSES[selectedClass].color === 'cyan' ? 'bg-cyan-400' : SNAKE_CLASSES[selectedClass].color === 'purple' ? 'bg-purple-500' : SNAKE_CLASSES[selectedClass].color === 'orange' ? 'bg-orange-500' : 'bg-green-500'}`}
             style={{ 
                 // ASTUCE DE FUSION : On rend chaque segment un peu plus grand (+4px) et on le décale (-2px) pour qu'ils se chevauchent
                 width: realTileSize + 4, 
                 height: realTileSize + 4, 
                 left: part.x * realTileSize - 2, 
                 top: part.y * realTileSize - 2, 
                 opacity: (selectedClass === "tank" && !abilityReady && i===0) ? 0.5 : 1, 
                 boxShadow: i===0 ? (feverMode ? "0 0 20px yellow" : "0 0 10px rgba(0,0,0,0.3)") : "none"
             }} />
        ))}

        <div className={`absolute rounded-full transition-all duration-300 ${getFoodStyle(food.type)}`} style={{ width: realTileSize * 0.8, height: realTileSize * 0.8, left: food.x * realTileSize + realTileSize*0.1, top: food.y * realTileSize + realTileSize*0.1 }} />

        {obstacles.map((obs, i) => (
            <div key={i} className="absolute bg-gray-600 border border-gray-500 rounded-xl shadow-sm" style={{ width: realTileSize, height: realTileSize, left: obs.x*realTileSize, top: obs.y*realTileSize }} />
        ))}

        {pointsAnimation && (
            <div className={`absolute font-bold z-30 animate-bounce ${pointsAnimation.bonus ? "text-yellow-300 text-2xl" : "text-white text-xl"}`} 
                 style={{ left: pointsAnimation.x*realTileSize, top: pointsAnimation.y*realTileSize - 20, textShadow: "0 2px 0 black" }}>
                 +{pointsAnimation.val}
                 {pointsAnimation.bonus && <span className="text-xs block">DRUNK BONUS!</span>}
            </div>
        )}

        {malusActive && <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-purple-400 font-black text-4xl animate-pulse z-30 pointer-events-none text-center">DRUNK MODE<br/><span className="text-sm text-white">X5 POINTS ACTIVATED!</span></div>}
        {feverMode && <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-yellow-400 font-black text-5xl animate-ping z-30 pointer-events-none">FEVER!</div>}

        {status === "menu" && (
            <div className="absolute inset-0 bg-slate-900/95 flex flex-col items-center justify-center p-4 z-50">
                {!showRules ? (
                    <>
                        <h2 className="text-2xl font-bold mb-4">CHOISIR TA CLASSE</h2>
                        <div className="grid grid-cols-2 gap-3 w-full max-w-sm mb-6">
                            {Object.entries(SNAKE_CLASSES).map(([key, cls]) => (
                                <button key={key} onClick={() => setSelectedClass(key)} className={`p-3 rounded-2xl border-2 text-left transition-all ${selectedClass === key ? `border-${cls.color}-400 bg-white/10 scale-105` : "border-gray-700 hover:bg-white/5"}`}>
                                    <div className={`font-bold text-${cls.color}-400`}>{cls.name}</div>
                                    <div className="text-xs text-gray-300 leading-tight mt-1">{cls.desc}</div>
                                </button>
                            ))}
                        </div>
                        <div className="flex gap-4">
                            <button onClick={() => setShowRules(true)} className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-full text-lg shadow-lg">📜 Règles</button>
                            <button onClick={startGame} className="px-8 py-3 bg-green-500 hover:bg-green-600 text-white font-bold rounded-full text-xl shadow-lg transition-transform hover:scale-110">JOUER</button>
                        </div>
                    </>
                ) : (
                    <div className="w-full max-w-sm h-full max-h-[90%] bg-gray-800 rounded-[2rem] border border-gray-600 shadow-2xl flex flex-col overflow-hidden">
                        <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-900">
                            <h2 className="text-xl font-bold text-blue-400">📜 Règles du Jeu</h2>
                            <button onClick={() => setShowRules(false)} className="text-gray-400 hover:text-white font-bold text-xl">✕</button>
                        </div>
                        <div className="p-4 overflow-y-auto text-sm space-y-4 text-gray-200">
                            <p className="bg-purple-900/50 p-3 rounded-xl border border-purple-500">
                                🍷 <strong>DRUNK MODE:</strong> Mange la pomme violette pour inverser les contrôles. <br/>
                                💰 <strong>BONUS:</strong> Si tu survis et manges des pommes en étant "bourré", elles valent <strong>5 POINTS</strong> !
                            </p>
                            <ul className="list-disc pl-4 space-y-2 text-gray-400">
                                <li className="flex items-center gap-2"><div className="w-3 h-3 bg-red-500 rounded-full"/> Pomme Rouge: +1 Pt</li>
                                <li className="flex items-center gap-2"><div className="w-3 h-3 bg-blue-400 rounded-full shadow-sm shadow-blue-400"/> Magique: +5 Pts</li>
                                <li className="flex items-center gap-2"><div className="w-3 h-3 bg-gray-500 rounded-md"/> Murs: Apparaissent tous les 20 pts.</li>
                            </ul>
                        </div>
                        <div className="p-4 border-t border-gray-700 bg-gray-900">
                            <button onClick={() => setShowRules(false)} className="w-full py-3 bg-blue-600 rounded-full font-bold hover:bg-blue-500 text-lg">C'est parti !</button>
                        </div>
                    </div>
                )}
            </div>
        )}

        {status === "gameover" && (
            <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-50">
                <h2 className="text-5xl font-black text-red-500 mb-2">GAME OVER</h2>
                <p className="text-xl text-white mb-6">Score Final: {score}</p>
                <button onClick={() => setStatus("menu")} className="px-8 py-3 bg-white text-black font-bold rounded-full hover:scale-105 text-xl">MENU</button>
            </div>
        )}
      </div>

      {isMobile && status === "playing" && (
          <div className="mt-8 grid grid-cols-3 gap-3">
              <div/>
              <button className="w-16 h-16 bg-gray-800 rounded-full text-2xl shadow-lg active:bg-gray-700" onTouchStart={(e)=>{e.preventDefault(); if(direction.y!==1) directionQueue.current.push({x:0,y:-1})}}>⬆️</button>
              <div/>
              <button className="w-16 h-16 bg-gray-800 rounded-full text-2xl shadow-lg active:bg-gray-700" onTouchStart={(e)=>{e.preventDefault(); if(direction.x!==1) directionQueue.current.push({x:-1,y:0})}}>⬅️</button>
              <button className="w-16 h-16 bg-orange-600 rounded-full text-sm font-bold shadow-lg active:scale-95 flex items-center justify-center border-2 border-orange-400" 
                onTouchStart={(e)=>{ e.preventDefault(); if(selectedClass === 'tank' && abilityReady) { setIsImmortal(true); setAbilityReady(false); setTimeout(()=>setIsImmortal(false),2000); setTimeout(()=>setAbilityReady(true),10000); } }}>
                {selectedClass==='tank' ? '🛡️' : '🐍'}
              </button>
              <button className="w-16 h-16 bg-gray-800 rounded-full text-2xl shadow-lg active:bg-gray-700" onTouchStart={(e)=>{e.preventDefault(); if(direction.x!==-1) directionQueue.current.push({x:1,y:0})}}>➡️</button>
              <div/>
              <button className="w-16 h-16 bg-gray-800 rounded-full text-2xl shadow-lg active:bg-gray-700" onTouchStart={(e)=>{e.preventDefault(); if(direction.y!==-1) directionQueue.current.push({x:0,y:1})}}>⬇️</button>
              <div/>
          </div>
      )}
    </div>
  );
};

export default App;