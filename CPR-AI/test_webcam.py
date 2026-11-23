"""
CPR AI Vision System - Cross-Platform Camera Benchmark & Diagnostics
Auto-discovers and benchmarks built-in and external USB cameras across macOS, Windows, and Linux.
"""
import sys
import time
import cv2
from vision.camera import discover_available_cameras, get_platform_backends

def benchmark_cameras(target_frames=90, req_width=640, req_height=480):
    print("=" * 65)
    print("  CPR AI CAMERA DIAGNOSTICS & HARDWARE BENCHMARK")
    print(f"  Operating System: {sys.platform.upper()}")
    print("=" * 65)

    print("\n[1/3] Scanning for connected cameras (USB & Built-in)...")
    cameras = discover_available_cameras(max_probe=4)

    if not cameras:
        print("\n[!] No working physical cameras were found.")
        if sys.platform == "darwin":
            print("    macOS Note: Ensure camera permissions are granted in:")
            print("    System Settings -> Privacy & Security -> Camera -> (Allow Terminal)")
        elif sys.platform.startswith("win"):
            print("    Windows Note: Ensure camera access is allowed in Settings -> Privacy & Security -> Camera")
        print("    If using an external USB webcam, ensure the cable is firmly connected.")
        return

    print(f"\n[2/3] Detected {len(cameras)} active camera device(s):")
    for i, c in enumerate(cameras):
        cam_type = "External USB Camera" if c["index"] > 0 else "Primary / Built-in Camera"
        print(f"  [{i+1}] {cam_type}")
        print(f"      - Index:        {c['index']}")
        print(f"      - Driver:       {c['backend_name']} (code {c['backend_code']})")
        print(f"      - Native Res:   {c['width']}x{c['height']}")

    # Benchmark first available or external camera
    target = cameras[-1] if len(cameras) > 1 else cameras[0]
    target_idx = target["index"]
    target_backend = target["backend_code"]
    target_name = "External USB Camera" if target_idx > 0 else "Primary Built-in Camera"

    print(f"\n[3/3] Benchmarking {target_name} (Index {target_idx}) for {target_frames} frames...")
    cap = cv2.VideoCapture(target_idx, target_backend)
    if not cap.isOpened():
        print(f"[ERROR] Could not open camera at index {target_idx}.")
        return

    cap.set(cv2.CAP_PROP_FRAME_WIDTH, req_width)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, req_height)
    cap.set(cv2.CAP_PROP_FPS, 30)

    actual_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)) or req_width
    actual_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)) or req_height

    timestamps = []
    start_total = time.perf_counter()

    for i in range(target_frames):
        t0 = time.perf_counter()
        ret, frame = cap.read()
        t1 = time.perf_counter()

        if not ret:
            print(f"[WARN] Frame acquisition dropped at frame {i+1}.")
            break

        timestamps.append(t1 - t0)

    total_time = time.perf_counter() - start_total
    cap.release()

    if len(timestamps) > 5:
        actual_fps = len(timestamps) / total_time
        avg_latency = (sum(timestamps) / len(timestamps)) * 1000

        print("\n" + "-" * 65)
        print("  BENCHMARK RESULTS:")
        print(f"  - Target Device:      {target_name} (Index {target_idx})")
        print(f"  - Stream Resolution:  {actual_w}x{actual_h}")
        print(f"  - Total Captured:     {len(timestamps)} frames in {total_time:.2f}s")
        print(f"  - Real Measured FPS:  {actual_fps:.2f} FPS")
        print(f"  - Avg Grab Latency:   {avg_latency:.2f} ms")
        print("-" * 65)
        if actual_fps >= 25.0:
            print("[STATUS] Optimal performance for real-time crowd tracking.")
        else:
            print("[STATUS] Frame rate acceptable. Recommended running at 640x480 resolution.")

if __name__ == "__main__":
    benchmark_cameras()
