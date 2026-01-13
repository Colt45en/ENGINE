# ENGINE
world engine

## Endless Loop Patterns

Production-safe endless loop implementations for various environments. These patterns allow you to create loops that run indefinitely but can be safely stopped without burning CPU or locking the UI.

### Available Implementations

#### 1. JavaScript/TypeScript (Node.js) - `endless-loop.ts`
An endless loop with clean SIGINT (Ctrl+C) shutdown handling.

**Run:**
```bash
npm install
npm run dev:endless
```

**Features:**
- Clean shutdown with Ctrl+C (SIGINT handling)
- CPU-friendly with sleep intervals
- Error handling for fatal errors

#### 2. Browser/UI - `browser-loop.html`
Browser-safe endless loops that won't freeze the page.

**Run:**
Open `browser-loop.html` in your browser.

**Patterns included:**
- **requestAnimationFrame**: Best for frame-based work (animations, rendering)
- **setInterval**: Best for fixed time intervals

#### 3. Python - `endless_loop.py`
Python endless loop with signal handling.

**Run:**
```bash
python endless_loop.py
```

**Features:**
- SIGINT (Ctrl+C) handling
- CPU-friendly with sleep intervals
- Clean shutdown

#### 4. Engine Loop Pattern - `engine-loop.ts`
Game/simulation loop with fixed timestep logic.

**Run:**
```bash
npm run dev:engine
```

**Features:**
- Delta time (dt) calculation
- Update/Render separation
- Target FPS throttling
- Reusable `runLoop` function

**Usage:**
```typescript
import { runLoop } from './engine-loop';

runLoop({
  update: (dt) => {
    // Update game state with delta time
    console.log(`Updating with dt: ${dt.toFixed(4)}`);
  },
  render: () => {
    // Render current state
  },
  targetFps: 60
});
```

### Key Principles

All implementations follow these safety principles:

✅ **Stoppable**: Can be cleanly stopped via signals or flags  
✅ **CPU-friendly**: Include sleep/wait to prevent CPU pegging  
✅ **Non-blocking**: Browser loops won't freeze the UI  
✅ **Error handling**: Fatal errors are caught and logged  

### Use Cases

- **Node/TypeScript backend**: Workers, automation, telemetry ingestion
- **Browser/React**: UI loops, animations, editor ticks
- **Python**: Training loops, backend daemons
- **Game/Sim loop**: Fixed timestep physics, variable render
