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
    scale: 0.35
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

  const [valentineStatus, setValentineStatus] = useState<
    "waiting" | "yes" | "no"
  >("waiting");
  const [valentineMessage, setValentineMessage] = useState<string>(
    "PLEASE PLEASE SAY YES 🤞"
  );

  const valentineRef = useRef<"waiting" | "yes" | "no">("waiting");
  type Petal = {
    x: number;
    y: number;
    vx: number;
    vy: number;
    rotation: number;
    vr: number;
    size: number;
    life: number;
  };
  const petalsRef = useRef<Petal[]>([]);
  const cardVisibleRef = useRef(false);

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

      // Extract finger cursors and pinch pointers (mirrored to match the video).
      const pinchThresholdPx = Math.max(22, Math.min(w, h) * 0.04);
      const cursors: Array<{ x: number; y: number }> = [];
      const pinches: Array<{ x: number; y: number }> = [];

      for (const hand of landmarks) {
        const thumb = hand[4];
        const indexTip = hand[8];
        if (!thumb || !indexTip) continue;

        // Mirror horizontally so hands/cursor align with mirrored video.
        const ix = w - indexTip.x * w;
        const iy = indexTip.y * h;
        const tx = w - thumb.x * w;
        const ty = thumb.y * h;

        const d = dist(ix, iy, tx, ty);
        if (d < pinchThresholdPx) {
          pinches.push({ x: ix, y: iy });
        }

        // Always show the index fingertip cursor, even when not pinching.
        cursors.push({ x: ix, y: iy });
      }

      const overlayImg = overlayImgRef.current;
      const overlay = overlayRef.current;
      const currentVal = valentineRef.current;
      const cardVisible = cardVisibleRef.current;

      // If the big Valentine card is visible, draw it full-screen (decoration only).
      if (cardVisible) {
        // Define a big card covering the whole canvas.
        const cardX = 0;
        const cardY = 0;
        const cardW = w;
        const cardH = h;

        // Draw full-screen off-white card over the camera view.
        const line1 = "Will you be my";
        const line2 = "Valentine?";

        const centerX = w / 2;
        const centerY = h * 0.4;

        // Background.
        const radius = 28;
        const borderWidth = 3;

        ctx.save();
        ctx.fillStyle = "#fdf7f2";
        ctx.strokeStyle = "#a855f7";
        ctx.lineWidth = borderWidth;

        ctx.beginPath();
        ctx.moveTo(cardX + radius, cardY);
        ctx.lineTo(cardX + cardW - radius, cardY);
        ctx.quadraticCurveTo(cardX + cardW, cardY, cardX + cardW, cardY + radius);
        ctx.lineTo(cardX + cardW, cardY + cardH - radius);
        ctx.quadraticCurveTo(
          cardX + cardW,
          cardY + cardH,
          cardX + cardW - radius,
          cardY + cardH
        );
        ctx.lineTo(cardX + radius, cardY + cardH);
        ctx.quadraticCurveTo(
          cardX,
          cardY + cardH,
          cardX,
          cardY + cardH - radius
        );
        ctx.lineTo(cardX, cardY + radius);
        ctx.quadraticCurveTo(cardX, cardY, cardX + radius, cardY);
        ctx.closePath();

        ctx.fill();
        ctx.stroke();

        // Cute Valentine text.
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#a855f7";

        const line1Size = Math.round(h * 0.08);
        const line2Size = Math.round(h * 0.11);

        ctx.font = `${line1Size}px "Comic Sans MS", "Brush Script MT", cursive`;
        ctx.fillText(line1, centerX, centerY - h * 0.04);

        ctx.font = `${line2Size}px "Comic Sans MS", "Brush Script MT", cursive`;
        ctx.fillText(line2, centerX, centerY + h * 0.04);

        ctx.restore();
      }

      // Define Valentine choice boxes near the bottom of the canvas.
      const boxWidth = w * 0.22;
      const boxHeight = h * 0.1;
      const boxY = h - boxHeight - Math.max(24, h * 0.04);
      const gap = w * 0.06;
      const yesBox = {
        x: w / 2 - boxWidth - gap / 2,
        y: boxY,
        w: boxWidth,
        h: boxHeight
      };
      const noBox = {
        x: w / 2 + gap / 2,
        y: boxY,
        w: boxWidth,
        h: boxHeight
      };

      // Detect pinches inside Yes / No boxes.
      let pinchInYes = false;
      let pinchInNo = false;
      for (const p of pinches) {
        if (
          p.x >= yesBox.x &&
          p.x <= yesBox.x + yesBox.w &&
          p.y >= yesBox.y &&
          p.y <= yesBox.y + yesBox.h
        ) {
          pinchInYes = true;
        } else if (
          p.x >= noBox.x &&
          p.x <= noBox.x + noBox.w &&
          p.y >= noBox.y &&
          p.y <= noBox.y + noBox.h
        ) {
          pinchInNo = true;
        }
      }

      if (pinchInYes) {
        cardVisibleRef.current = false;
        valentineRef.current = "yes";
        setValentineStatus("yes");
        setValentineMessage(
          "Yay! A perfect answer. Here is your rose overlay you can move around."
        );

        // Set the rose starting position near the opposite (top-left) corner.
        if (overlayImg) {
          const baseScale = overlayRef.current.scale;
          const ow = overlayImg.width * baseScale;
          const oh = overlayImg.height * baseScale;
          const margin = Math.max(16, h * 0.03);

          overlayRef.current.cx = margin + ow / 2;
          overlayRef.current.cy = margin + oh / 2;
        }

        // Spawn rose petals shower.
        const petals: Petal[] = [];
        const count = 70;
        for (let i = 0; i < count; i++) {
          petals.push({
            x: Math.random() * w,
            y: -Math.random() * h * 0.5,
            vx: (Math.random() - 0.5) * (w * 0.0015),
            vy: h * (0.003 + Math.random() * 0.004),
            rotation: Math.random() * Math.PI * 2,
            vr: (Math.random() - 0.5) * 0.15,
            size: Math.max(10, Math.random() * (h * 0.03)),
            life: 1
          });
        }
        petalsRef.current = petals;
      } else if (pinchInNo) {
        cardVisibleRef.current = false;
        valentineRef.current = "no";
        setValentineStatus("no");
        setValentineMessage(
          "Error: that answer is not allowed. Please pinch Yes to try again."
        );
      }

      // Two-hand pinch: zoom + center at midpoint (only after "Yes").
      if (pinches.length >= 2 && overlayImg && currentVal === "yes") {
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

        // One-hand pinch: drag if pinch starts inside overlay bounds (only after "Yes").
        if (pinches.length === 1 && overlayImg && currentVal === "yes") {
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

      // Clamp overlay center so the image stays on-screen (only after "Yes"),
      // and keep it above the Yes/No buttons at the bottom.
      if (overlayImg && currentVal === "yes") {
        const ow = overlayImg.width * overlay.scale;
        const oh = overlayImg.height * overlay.scale;

        const minCx = ow / 2;
        const maxCx = w - ow / 2;

        const margin = Math.max(16, h * 0.02);
        const maxCyForImage = boxY - margin - oh / 2;
        const minCy = oh / 2;
        const maxCy = Math.max(minCy, maxCyForImage);

        overlay.cx = clamp(overlay.cx, minCx, maxCx);
        overlay.cy = clamp(overlay.cy, minCy, maxCy);
      }

      // Draw overlay (not mirrored; coordinates already computed in mirrored space).
      if (overlayImg && currentVal === "yes") {
        const ow = overlayImg.width * overlay.scale;
        const oh = overlayImg.height * overlay.scale;
        const x = overlay.cx - ow / 2;
        const y = overlay.cy - oh / 2;
        ctx.drawImage(overlayImg, x, y, ow, oh);
      }

      // Rose petal shower when Yes has been chosen.
      if (valentineRef.current === "yes") {
        const petals = petalsRef.current;

        // Continuously spawn new petals in small batches so the shower feels endless.
        const maxPetals = 100;
        const spawnRate = 3;
        if (petals.length < maxPetals) {
          const toAdd = Math.min(spawnRate, maxPetals - petals.length);
          for (let i = 0; i < toAdd; i++) {
            petals.push({
              x: Math.random() * w,
              y: -Math.random() * h * 0.5,
              vx: (Math.random() - 0.5) * (w * 0.0015),
              vy: h * (0.003 + Math.random() * 0.004),
              rotation: Math.random() * Math.PI * 2,
              vr: (Math.random() - 0.5) * 0.15,
              size: Math.max(10, Math.random() * (h * 0.03)),
              life: 1
            });
          }
        }

        ctx.save();
        ctx.fillStyle = "#e9d5ff";
        ctx.strokeStyle = "#c4b5fd";
        ctx.lineWidth = 1;

        for (const petal of petals) {
          // Update simple physics.
          petal.x += petal.vx;
          petal.y += petal.vy;
          petal.rotation += petal.vr;
          petal.life -= 0.0045;

          // Draw a small rotated oval as a petal.
          ctx.save();
          ctx.translate(petal.x, petal.y);
          ctx.rotate(petal.rotation);
          const wPetal = petal.size * 0.6;
          const hPetal = petal.size;
          ctx.beginPath();
          ctx.ellipse(0, 0, wPetal, hPetal, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }

        ctx.restore();

        // Remove dead/off-screen petals; new ones will keep being spawned.
        petalsRef.current = petals.filter(
          (p) => p.life > 0 && p.y <= h + 40
        );
      }

      // "Yayy!!" message once Yes is selected, with a soft white banner behind it.
      if (valentineRef.current === "yes") {
        ctx.save();
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        const yaySize = Math.round(h * 0.09);
        const bannerPaddingX = yaySize * 1.6;
        const bannerPaddingY = yaySize * 0.4;
        const text = "Yayy!!";
        const centerX = w / 2;
        const topY = h * 0.07;

        ctx.font = `${yaySize}px "Comic Sans MS", "Brush Script MT", cursive`;
        const textWidth = ctx.measureText(text).width;
        const bannerWidth = textWidth + bannerPaddingX * 2;
        const bannerHeight = yaySize + bannerPaddingY * 2;
        const bx = centerX - bannerWidth / 2;
        const by = topY;
        const radius = bannerHeight * 0.4;

        // Banner background.
        ctx.fillStyle = "rgba(249, 250, 251, 0.94)";
        ctx.strokeStyle = "rgba(167, 139, 250, 0.9)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(bx + radius, by);
        ctx.lineTo(bx + bannerWidth - radius, by);
        ctx.quadraticCurveTo(
          bx + bannerWidth,
          by,
          bx + bannerWidth,
          by + radius
        );
        ctx.lineTo(bx + bannerWidth, by + bannerHeight - radius);
        ctx.quadraticCurveTo(
          bx + bannerWidth,
          by + bannerHeight,
          bx + bannerWidth - radius,
          by + bannerHeight
        );
        ctx.lineTo(bx + radius, by + bannerHeight);
        ctx.quadraticCurveTo(
          bx,
          by + bannerHeight,
          bx,
          by + bannerHeight - radius
        );
        ctx.lineTo(bx, by + radius);
        ctx.quadraticCurveTo(bx, by, bx + radius, by);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Text on top.
        ctx.fillStyle = "#a855f7";
        ctx.fillText(text, centerX, by + bannerPaddingY);

        ctx.restore();
      }

      // Draw fingertip cursor(s) above the overlay so the finger position is visible.
      if (cursors.length > 0) {
        ctx.save();
        ctx.fillStyle = "rgba(0, 0, 0, 0.9)";
        ctx.strokeStyle = "rgba(248, 250, 252, 0.9)";
        ctx.lineWidth = 2;
        for (const p of cursors) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
        ctx.restore();
      }

      // Draw Valentine Yes / No boxes on top.
      function drawChoiceBox(
        ctxLocal: CanvasRenderingContext2D,
        box: { x: number; y: number; w: number; h: number },
        label: string,
        isYes: boolean,
        active: boolean
      ) {
        const isSelectedYes = currentVal === "yes" && isYes;
        const isSelectedNo = currentVal === "no" && !isYes;

        const baseColor = isYes ? "#a855f7" : "#4b5563";
        const borderColor =
          active || isSelectedYes || isSelectedNo
            ? "#f9a8d4"
            : "rgba(255,255,255,0.45)";
        const fillAlpha = isSelectedYes || isSelectedNo ? 0.6 : 0.3;

        ctxLocal.save();
        ctxLocal.fillStyle = `rgba(15, 23, 42, ${fillAlpha})`;
        ctxLocal.strokeStyle = borderColor;
        ctxLocal.lineWidth = active ? 3 : 2;
        const radius = 12;

        // Rounded rect.
        ctxLocal.beginPath();
        ctxLocal.moveTo(box.x + radius, box.y);
        ctxLocal.lineTo(box.x + box.w - radius, box.y);
        ctxLocal.quadraticCurveTo(
          box.x + box.w,
          box.y,
          box.x + box.w,
          box.y + radius
        );
        ctxLocal.lineTo(box.x + box.w, box.y + box.h - radius);
        ctxLocal.quadraticCurveTo(
          box.x + box.w,
          box.y + box.h,
          box.x + box.w - radius,
          box.y + box.h
        );
        ctxLocal.lineTo(box.x + radius, box.y + box.h);
        ctxLocal.quadraticCurveTo(
          box.x,
          box.y + box.h,
          box.x,
          box.y + box.h - radius
        );
        ctxLocal.lineTo(box.x, box.y + radius);
        ctxLocal.quadraticCurveTo(box.x, box.y, box.x + radius, box.y);
        ctxLocal.closePath();

        ctxLocal.fill();
        ctxLocal.stroke();

        // "Checkbox" indicator.
        const cbSize = Math.min(box.h * 0.45, 26);
        const cbX = box.x + box.w * 0.12;
        const cbY = box.y + (box.h - cbSize) / 2;
        ctxLocal.strokeStyle = borderColor;
        ctxLocal.lineWidth = 2;
        ctxLocal.strokeRect(cbX, cbY, cbSize, cbSize);

        if (isSelectedYes || isSelectedNo) {
          ctxLocal.fillStyle = baseColor;
          ctxLocal.fillRect(cbX + 4, cbY + 4, cbSize - 8, cbSize - 8);
        }

        // Label text.
        ctxLocal.fillStyle = "#e5e7eb";
        ctxLocal.font = `600 ${Math.round(
          box.h * 0.32
        )}px system-ui, -apple-system, sans-serif`;
        ctxLocal.textBaseline = "middle";
        ctxLocal.fillText(label, cbX + cbSize + 10, box.y + box.h / 2);

        ctxLocal.restore();
      }

      drawChoiceBox(ctx, yesBox, "Yes", true, pinchInYes);
      drawChoiceBox(ctx, noBox, "No", false, pinchInNo);

      // Big error banner if "No" is chosen or currently active.
      if (pinchInNo || currentVal === "no") {
        ctx.save();
        const bannerWidth = w * 0.78;
        const bannerHeight = h * 0.18;
        const bx = (w - bannerWidth) / 2;
        const by = h * 0.16;
        const radius = 16;

        ctx.fillStyle = "rgba(127, 29, 29, 0.9)";
        ctx.strokeStyle = "rgba(248, 113, 113, 0.95)";
        ctx.lineWidth = 3;

        ctx.beginPath();
        ctx.moveTo(bx + radius, by);
        ctx.lineTo(bx + bannerWidth - radius, by);
        ctx.quadraticCurveTo(
          bx + bannerWidth,
          by,
          bx + bannerWidth,
          by + radius
        );
        ctx.lineTo(bx + bannerWidth, by + bannerHeight - radius);
        ctx.quadraticCurveTo(
          bx + bannerWidth,
          by + bannerHeight,
          bx + bannerWidth - radius,
          by + bannerHeight
        );
        ctx.lineTo(bx + radius, by + bannerHeight);
        ctx.quadraticCurveTo(
          bx,
          by + bannerHeight,
          bx,
          by + bannerHeight - radius
        );
        ctx.lineTo(bx, by + radius);
        ctx.quadraticCurveTo(bx, by, bx + radius, by);
        ctx.closePath();

        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#fee2e2";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        const text = "ERROR: That answer is invalid. Please pinch YES ❤️";
        const maxTextWidth = bannerWidth * 0.9;
        let fontSize = Math.round(bannerHeight * 0.3);
        const fontFamily = 'system-ui, -apple-system, sans-serif';

        ctx.font = `700 ${fontSize}px ${fontFamily}`;
        while (ctx.measureText(text).width > maxTextWidth && fontSize > 10) {
          fontSize -= 1;
          ctx.font = `700 ${fontSize}px ${fontFamily}`;
        }

        ctx.fillText(text, w / 2, by + bannerHeight / 2);

        ctx.restore();
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
      setMessage("Pinch the Yes button on the Valentine card to be my valentine this year and every year ;)");

      // Show the big Valentine card as soon as the camera starts.
      cardVisibleRef.current = true;
      valentineRef.current = "waiting";
      setValentineStatus("waiting");
      setValentineMessage(
        "Pinch the Yes button on the card to accept the Valentine (pretty please)."
      );
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

    valentineRef.current = "waiting";
    setValentineStatus("waiting");
    setValentineMessage(
      "Pinch the Yes box on the video to accept, DO NOT PRESS NO (PLS)."
    );
  }

  return (
    <main className="container stack">
      <div className="stack">
        <h1 style={{ margin: 0, fontSize: 28 }}>To my dearest poojiee ❤️</h1>
        <div className="muted">
          I have a special question for my special lady...
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
        {valentineMessage}
        <br />
        <br />
        <span>
          You get bonus kissy for pinching yes ... just saying!
        </span>
      </div>
    </main>
  );
}


