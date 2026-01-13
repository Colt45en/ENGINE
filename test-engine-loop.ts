// test-engine-loop.ts
// Test file to verify engine-loop can be imported and used

import { runLoop } from './engine-loop';

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

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
