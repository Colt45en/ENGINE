# endless_loop.py
import time
import signal

running = True

def handle_sigint(sig, frame):
    global running
    print("\n🛑 SIGINT received. Shutting down...")
    running = False

signal.signal(signal.SIGINT, handle_sigint)

i = 0
while running:
    i += 1
    print("tick", i)
    time.sleep(0.25)

print("✅ loop ended cleanly")
