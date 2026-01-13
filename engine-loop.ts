// engine-loop.ts
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

type LoopFns = {
  update: (dt: number) => void | Promise<void>;
  render?: () => void | Promise<void>;
  targetFps?: number;
};

type LoopControl = {
  stop: () => void;
};

export async function runLoop({ update, render, targetFps = 60 }: LoopFns): Promise<LoopControl> {
  const frameMs = 1000 / targetFps;
  let running = true;

  const control: LoopControl = {
    stop: () => { running = false; }
  };

  // Start the loop in the background
  (async () => {
    let last = performance.now?.() ?? Date.now();

    while (running) {
      const now = performance.now?.() ?? Date.now();
      const dt = (now - last) / 1000; // seconds
      last = now;

      await update(dt);
      if (render) await render();

      // throttle to target FPS
      const elapsedMs = (performance.now?.() ?? Date.now()) - now;
      const wait = Math.max(0, frameMs - elapsedMs);
      if (wait > 0) await sleep(wait);
    }
  })();

  return control;
}

// Example usage when run directly
if (require.main === module) {
  let running = true;
  
  process.on("SIGINT", () => {
    console.log("\n🛑 SIGINT received. Shutting down...");
    running = false;
  });

  runLoop({
    update: (dt) => {
      if (!running) {
        console.log("✅ loop ended cleanly");
        process.exit(0);
      }
      console.log("update dt:", dt.toFixed(4));
    },
    render: () => {},
    targetFps: 10,
  });
}
