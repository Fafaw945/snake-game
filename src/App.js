import React, { useState, useEffect, useRef } from "react";

const App = () => {
  const gridSize = 25; // nombre de cases par ligne/colonne
  const defaultTileSize = 20; // taille de base

  const [snake, setSnake] = useState([{ x: 8, y: 8 }]);
  const [food, setFood] = useState({ x: 5, y: 5, type: "normal" });
  const [direction, setDirection] = useState({ x: 1, y: 0 });
  const [gameOver, setGameOver] = useState(false);
  const [speed, setSpeed] = useState(200);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(
    parseInt(localStorage.getItem("bestScore")) || 0
  );
  const [pointsAnimation, setPointsAnimation] = useState(null);
  const [isImmortal, setIsImmortal] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [realTileSize, setRealTileSize] = useState(defaultTileSize);

  const containerRef = useRef(null);

  // === Sons ===
  const playEat = useRef();
  const playMagic = useRef();
  const playGameOver = useRef();

  // === Joystick ===
  const joystickBaseRef = useRef(null);
  const [stickPos, setStickPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    // Pool de sons
    const createSoundPool = (src, size = 5) => {
      const pool = Array.from({ length: size }, () => new Audio(src));
      let index = 0;
      return () => {
        const sound = pool[index];
        sound.currentTime = 0;
        sound.play();
        index = (index + 1) % size;
      };
    };
    playEat.current = createSoundPool("/sounds/eat.mp3");
    playMagic.current = createSoundPool("/sounds/magic.mp3");
    playGameOver.current = createSoundPool("/sounds/gameover.mp3");

    // Détecter mobile
    setIsMobile(window.innerWidth < 768);
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
      updateTileSize();
    };
    window.addEventListener("resize", handleResize);

    // Taille réelle des cases
    const updateTileSize = () => {
      if (containerRef.current) {
        const size = Math.min(
          containerRef.current.offsetWidth,
          containerRef.current.offsetHeight
        ) / gridSize;
        setRealTileSize(size);
      }
    };
    updateTileSize();

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Boucle du jeu
  useEffect(() => {
    if (!isPlaying || gameOver) return;
    const interval = setInterval(moveSnake, speed);
    return () => clearInterval(interval);
  }, [snake, direction, gameOver, speed, isPlaying]);

  // Clavier
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
      }
      switch (e.key) {
        case "ArrowUp":
          if (direction.y !== 1) setDirection({ x: 0, y: -1 });
          break;
        case "ArrowDown":
          if (direction.y !== -1) setDirection({ x: 0, y: 1 });
          break;
        case "ArrowLeft":
          if (direction.x !== 1) setDirection({ x: -1, y: 0 });
          break;
        case "ArrowRight":
          if (direction.x !== -1) setDirection({ x: 1, y: 0 });
          break;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [direction]);

  const moveSnake = () => {
    const newSnake = [...snake];
    const head = { x: newSnake[0].x + direction.x, y: newSnake[0].y + direction.y };

    // Collision murs et corps
    if (
      !isImmortal &&
      (head.x < 0 ||
        head.y < 0 ||
        head.x >= gridSize ||
        head.y >= gridSize ||
        newSnake.some((p) => p.x === head.x && p.y === head.y))
    ) {
      setGameOver(true);
      playGameOver.current();
      if (score > bestScore) {
        localStorage.setItem("bestScore", score);
        setBestScore(score);
      }
      return;
    }

    newSnake.unshift(head);

    // Mange la pomme
    if (head.x === food.x && head.y === food.y) {
      let gainedPoints = 1;
      switch (food.type) {
        case "magic":
          gainedPoints = 5;
          playMagic.current();
          break;
        case "immortal":
          gainedPoints = 1;
          setIsImmortal(true);
          const immortalSound = new Audio("/sounds/immortal.mp3");
          immortalSound.play();
          setTimeout(() => {
            immortalSound.pause();
            setIsImmortal(false);
          }, 10000);
          break;
        default:
          playEat.current();
      }

      setScore(score + gainedPoints);
      setPointsAnimation({ x: head.x, y: head.y, points: gainedPoints });
      setTimeout(() => setPointsAnimation(null), 400);

      // Nouvelle pomme toujours dans la grille
      let randX, randY;
      do {
        randX = Math.floor(Math.random() * gridSize);
        randY = Math.floor(Math.random() * gridSize);
      } while (newSnake.some((p) => p.x === randX && p.y === randY));

      const types = ["normal", "normal", "magic", "normal", "immortal"];
      const type = types[Math.floor(Math.random() * types.length)];
      setFood({ x: randX, y: randY, type });

      if (speed > 80) setSpeed(speed - 5);
    } else {
      newSnake.pop();
    }

    setSnake(newSnake);
  };

  const resetGame = () => {
    setSnake([{ x: 8, y: 8 }]);
    setFood({ x: 5, y: 5, type: "normal" });
    setDirection({ x: 1, y: 0 });
    setGameOver(false);
    setSpeed(200);
    setScore(0);
    setIsImmortal(false);
    setIsPlaying(false);
    setStickPos({ x: 0, y: 0 });
  };

  const getFoodColor = (type) => {
    switch (type) {
      case "magic":
        return "bg-blue-400 shadow-blue-400";
      case "immortal":
        return "bg-yellow-400 shadow-yellow-400";
      default:
        return "bg-red-500 shadow-red-500";
    }
  };

  // === Joystick Handlers ===
  const handleTouchStart = (e) => e.preventDefault();

  const handleTouchMove = (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const base = joystickBaseRef.current.getBoundingClientRect();
    let x = touch.clientX - (base.left + base.width / 2);
    let y = touch.clientY - (base.top + base.height / 2);
    const radius = base.width / 2 - 16; // rayon max pour le stick
    const distance = Math.sqrt(x * x + y * y);
    if (distance > radius) {
      x = (x / distance) * radius;
      y = (y / distance) * radius;
    }
    setStickPos({ x, y });

    // Détermination de la direction
    const threshold = 10;
    if (Math.abs(x) > Math.abs(y)) {
      if (x > threshold && direction.x !== -1) setDirection({ x: 1, y: 0 });
      else if (x < -threshold && direction.x !== 1) setDirection({ x: -1, y: 0 });
    } else {
      if (y > threshold && direction.y !== -1) setDirection({ x: 0, y: 1 });
      else if (y < -threshold && direction.y !== 1) setDirection({ x: 0, y: -1 });
    }
  };

  const handleTouchEnd = () => setStickPos({ x: 0, y: 0 });

  return (
    <div
      className="flex flex-col items-center justify-center"
      style={{
        background: "linear-gradient(135deg, #0f0c29, #302b63, #24243e)",
        minHeight: "100vh",
        overflow: "hidden",
      }}
    >
      <h1 className="text-5xl font-bold mb-4 text-white drop-shadow-lg animate-pulse">
        Snake Power-Ups 🐍
      </h1>
      <p className="text-white mb-1 drop-shadow-md text-xl">Score: {score}</p>
      <p className="text-white mb-4 drop-shadow-md text-xl">Meilleur score: {bestScore}</p>

      {!isPlaying && !gameOver && (
        <button
          onClick={() => setIsPlaying(true)}
          className="px-6 py-3 bg-green-500 text-white rounded-lg shadow-md hover:bg-green-600 transform hover:scale-110 transition-all mb-4"
        >
          Jouer
        </button>
      )}

      <div
        ref={containerRef}
        className={`relative border-4 border-green-500 rounded-lg shadow-xl ${
          isImmortal ? "animate-pulse" : ""
        }`}
        style={{
          width: gridSize * defaultTileSize,
          height: gridSize * defaultTileSize,
          maxWidth: "90vw",
          maxHeight: "90vw",
          backgroundColor: "rgba(0,0,0,0.5)",
        }}
      >
        {snake.map((part, i) => (
          <div
            key={i}
            className={`absolute rounded-full shadow-lg ${
              i === 0 ? "bg-green-300" : "bg-green-600"
            }`}
            style={{
              width: realTileSize,
              height: realTileSize,
              left: part.x * realTileSize,
              top: part.y * realTileSize,
              transition: "left 0.1s, top 0.1s",
              boxShadow: i === 0 ? "0 0 10px #0f0" : "0 0 6px #0f0",
            }}
          />
        ))}

        <div
          className={`absolute rounded-full shadow-lg animate-bounce ${getFoodColor(
            food.type
          )}`}
          style={{
            width: realTileSize,
            height: realTileSize,
            left: food.x * realTileSize,
            top: food.y * realTileSize,
            border: "2px solid darkred",
            transition: "left 0.1s, top 0.1s",
          }}
        />

        {pointsAnimation && (
          <div
            className="absolute text-yellow-400 font-bold animate-bounce"
            style={{
              left: pointsAnimation.x * realTileSize,
              top: pointsAnimation.y * realTileSize - 10,
            }}
          >
            +{pointsAnimation.points}
          </div>
        )}
      </div>

      {/* Joystick mobile */}
      {isMobile && isPlaying && !gameOver && (
        <div className="flex justify-center mt-6">
          <div
            className="relative w-40 h-40 bg-gray-800 rounded-full"
            ref={joystickBaseRef}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div
  className="absolute w-16 h-16 bg-gray-400 rounded-full"
  style={{
    left: '50%',
    top: '50%',
    transform: `translate(calc(-50% + ${stickPos.x}px), calc(-50% + ${stickPos.y}px))`,
  }}
/>

          </div>
        </div>
      )}

      {gameOver && (
        <div className="mt-4 text-center">
          <p className="text-red-500 font-bold text-2xl drop-shadow-md animate-pulse">
            Game Over!
          </p>
          <button
            onClick={resetGame}
            className="mt-2 px-6 py-3 bg-green-500 text-white rounded-lg shadow-md hover:bg-green-600 transform hover:scale-110 transition-all"
          >
            Rejouer
          </button>
        </div>
      )}
    </div>
  );
};

export default App;
