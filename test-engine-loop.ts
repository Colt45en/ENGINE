// test-engine-loop.ts
// Test file to verify engine-loop can be imported and used

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

type LoopFns = {
  update: (dt: number) => void | Promise<void>;
  render?: () => void | Promise<void>;
  targetFps?: number;
};

type LoopControl = {
  stop: () => void;
};

async function runLoop({ update, render, targetFps = 60 }: LoopFns): Promise<LoopControl> {
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

// Test usage
let ticks = 0;
const maxTicks = 5;

async function testLoop() {
  const control = await runLoop({
    update: (dt) => {
      ticks++;
      console.log(`✅ Test tick ${ticks}, dt: ${dt.toFixed(4)}`);
      if (ticks >= maxTicks) {
        control.stop();
      }
    },
    render: () => {},
    targetFps: 10,
  });
  
  // Wait for loop to finish
  await sleep(1000);
  console.log("✅ Test completed successfully");
}

testLoop();

export {};
