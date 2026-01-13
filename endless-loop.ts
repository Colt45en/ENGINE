// endless-loop.ts
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

let running = true;

process.on("SIGINT", () => {
  console.log("\n🛑 SIGINT received. Shutting down...");
  running = false;
});

async function main() {
  let i = 0;

  while (running) {
    i++;

    // ✅ your repeating work goes here
    console.log("tick", i);

    // ✅ prevents CPU from pegging at 100%
    await sleep(250);
  }

  console.log("✅ loop ended cleanly");
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});

export {};
