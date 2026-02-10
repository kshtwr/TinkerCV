"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Hands } from "@mediapipe/hands";
import { Camera } from "@mediapipe/camera_utils";

type HandLandmark = { x: number; y: number; z?: number };

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function dist(ax: number, ay: number, bx: number, by: number) {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

export default function Page() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const overlayImgRef = useRef<HTMLImageElement | null>(null);

  const overlayRef = useRef({
    cx: 640,
    cy: 360,
    scale: 0.8
  });

  const dragRef = useRef<{
    active: boolean;
    offsetX: number;
    offsetY: number;
  }>({ active: false, offsetX: 0, offsetY: 0 });

  const zoomRef = useRef<{
    active: boolean;
    startDist: number;
    startScale: number;
  }>({ active: false, startDist: 0, startScale: 1 });

  const [status, setStatus] = useState<
    "idle" | "starting" | "running" | "blocked" | "error"
  >("idle");
  const [message, setMessage] = useState<string>(
    "Click “Start camera” and allow webcam access."
  );

  const overlaySrc = useMemo(() => "/overlays/1.png", []);

  useEffect(() => {
    const img = new Image();
    img.src = overlaySrc;
    img.onload = () => {
      overlayImgRef.current = img;
    };
    img.onerror = () => {
      setMessage("Failed to load overlay image: " + overlaySrc);
    };
  }, [overlaySrc]);

  async function start() {
    if (status === "starting" || status === "running") return;
    setStatus("starting");
    setMessage("Starting camera + hand tracking…");

    const videoEl = videoRef.current;
    const canvasEl = canvasRef.current;
    if (!videoEl || !canvasEl) {
      setStatus("error");
      setMessage("Missing video/canvas elements.");
      return;
    }
    // Help TypeScript understand these are non-null for nested closures.
    const video = videoEl;
    const canvas = canvasEl;

    // Ensure we have a reasonable initial canvas size.
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setStatus("error");
      setMessage("Could not create canvas context.");
      return;
    }

    const hands = new Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });

    hands.setOptions({
      selfieMode: true,
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.7
    });

    function ensureCanvasSizeFromVideo() {
      const vw = video.videoWidth || 1280;
      const vh = video.videoHeight || 720;
      if (canvas.width !== vw || canvas.height !== vh) {
        canvas.width = vw;
        canvas.height = vh;
        // Reset overlay to center on first real size.
        overlayRef.current.cx = vw / 2;
        overlayRef.current.cy = vh / 2;
      }
    }

    hands.onResults((results) => {
      ensureCanvasSizeFromVideo();
      const w = canvas.width;
      const h = canvas.height;

      // Draw mirrored video frame.
      ctx.save();
      ctx.clearRect(0, 0, w, h);
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(results.image as unknown as CanvasImageSource, 0, 0, w, h);
      ctx.restore();

      const landmarks = ((results as any).multiHandLandmarks ??
        []) as HandLandmark[][];

      // Extract pinch pointers (mirrored x to match what user sees).
      const pinchThresholdPx = Math.max(22, Math.min(w, h) * 0.04);
      const pinches: Array<{ x: number; y: number }> = [];

      for (const hand of landmarks) {
        const thumb = hand[4];
        const indexTip = hand[8];
        if (!thumb || !indexTip) continue;

        const ix = w - indexTip.x * w;
        const iy = indexTip.y * h;
        const tx = w - thumb.x * w;
        const ty = thumb.y * h;

        const d = dist(ix, iy, tx, ty);
        if (d < pinchThresholdPx) {
          pinches.push({ x: ix, y: iy });
        }

        // Optional: draw landmarks for feedback.
        ctx.fillStyle = "rgba(0,0,0,0.85)";
        ctx.beginPath();
        ctx.arc(ix, iy, 6, 0, Math.PI * 2);
        ctx.fill();
      }

      const overlayImg = overlayImgRef.current;
      const overlay = overlayRef.current;

      // Two-hand pinch: zoom + center at midpoint.
      if (pinches.length >= 2) {
        const p1 = pinches[0];
        const p2 = pinches[1];
        const d = dist(p1.x, p1.y, p2.x, p2.y);
        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;

        if (!zoomRef.current.active) {
          zoomRef.current.active = true;
          zoomRef.current.startDist = d;
          zoomRef.current.startScale = overlay.scale;
        }

        const ratio = d / Math.max(1, zoomRef.current.startDist);
        overlay.scale = clamp(zoomRef.current.startScale * ratio, 0.2, 6);
        overlay.cx = midX;
        overlay.cy = midY;

        // While zooming, disable drag state.
        dragRef.current.active = false;
      } else {
        zoomRef.current.active = false;

        // One-hand pinch: drag if pinch starts inside overlay bounds.
        if (pinches.length === 1 && overlayImg) {
          const p = pinches[0];
          const ow = overlayImg.width * overlay.scale;
          const oh = overlayImg.height * overlay.scale;
          const left = overlay.cx - ow / 2;
          const top = overlay.cy - oh / 2;
          const inside =
            p.x >= left && p.x <= left + ow && p.y >= top && p.y <= top + oh;

          if (!dragRef.current.active) {
            if (inside) {
              dragRef.current.active = true;
              dragRef.current.offsetX = overlay.cx - p.x;
              dragRef.current.offsetY = overlay.cy - p.y;
            }
          }

          if (dragRef.current.active) {
            overlay.cx = p.x + dragRef.current.offsetX;
            overlay.cy = p.y + dragRef.current.offsetY;
          }
        } else {
          dragRef.current.active = false;
        }
      }

      // Clamp overlay center so the image stays on-screen.
      if (overlayImg) {
        const ow = overlayImg.width * overlay.scale;
        const oh = overlayImg.height * overlay.scale;
        overlay.cx = clamp(overlay.cx, ow / 2, w - ow / 2);
        overlay.cy = clamp(overlay.cy, oh / 2, h - oh / 2);
      }

      // Draw overlay (not mirrored; coordinates already computed in mirrored space).
      if (overlayImg) {
        const ow = overlayImg.width * overlay.scale;
        const oh = overlayImg.height * overlay.scale;
        const x = overlay.cx - ow / 2;
        const y = overlay.cy - oh / 2;
        ctx.drawImage(overlayImg, x, y, ow, oh);
      }
    });

    const camera = new Camera(videoEl, {
      onFrame: async () => {
        await hands.send({ image: video });
      },
      width: 1280,
      height: 720
    });

    try {
      await camera.start();
      setStatus("running");
      setMessage("Pinch to drag. Two-hand pinch to zoom. Press Reset if needed.");
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : "Could not start camera (permission?)";
      setStatus(msg.toLowerCase().includes("permission") ? "blocked" : "error");
      setMessage(msg);
      try {
        hands.close();
      } catch {
        // ignore
      }
    }
  }

  function resetOverlay() {
    const canvasEl = canvasRef.current;
    const overlay = overlayRef.current;
    if (!canvasEl) return;
    overlay.cx = canvasEl.width / 2 || 640;
    overlay.cy = canvasEl.height / 2 || 360;
    overlay.scale = 0.8;
  }

  return (
    <main className="container stack">
      <div className="stack">
        <h1 style={{ margin: 0, fontSize: 28 }}>TinkerCV Web</h1>
        <div className="muted">
          Runs fully in the browser (your webcam never leaves your device). Works
          on Vercel because there’s no backend.
        </div>
      </div>

      <div className="card stack">
        <div className="row">
          <button
            className="button"
            onClick={start}
            disabled={status === "starting" || status === "running"}
          >
            Start camera
          </button>
          <button className="button" onClick={resetOverlay}>
            Reset overlay
          </button>
          <span className="badge">
            <span style={{ opacity: 0.7 }}>Status:</span> {status}
          </span>
        </div>
        <div className="muted">{message}</div>
      </div>

      {/* Hidden video element: MediaPipe Camera writes into this */}
      <video
        ref={videoRef}
        playsInline
        muted
        style={{ display: "none" }}
      />

      <div className="stage">
        <canvas ref={canvasRef} />
      </div>

      <div className="muted">
        Tips: make sure you’re on HTTPS (Vercel preview/prod is) or localhost.
        Safari sometimes requires the page to be interacted with before camera
        starts.
      </div>
    </main>
  );
}


