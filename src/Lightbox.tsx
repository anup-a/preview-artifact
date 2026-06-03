// Full-screen zoom lightbox for images and mermaid diagrams in the read view.
//
// Scroll wheel zooms around the cursor, drag pans, double-click resets, and
// Esc / a clean click on the backdrop closes. Transform is written imperatively
// to the stage element so panning stays smooth (no React re-render per frame).

import { useEffect, useRef } from "react";

export type ZoomContent =
  | { type: "img"; src: string; alt?: string }
  | { type: "svg"; markup: string };

const MIN_SCALE = 0.2;
const MAX_SCALE = 8;
// Lower = gentler zoom. Proportional to scroll distance so trackpads (many tiny
// deltas) and mouse wheels (few large ticks) feel consistent.
const ZOOM_SENSITIVITY = 0.004;
const CLICK_SLOP = 5; // px of movement under which a pointer up counts as a click

export function Lightbox({
  content,
  onClose,
}: {
  content: ZoomContent;
  onClose: () => void;
}) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const view = useRef({ scale: 1, tx: 0, ty: 0 });

  const apply = () => {
    const el = stageRef.current;
    if (!el) return;
    const { scale, tx, ty } = view.current;
    el.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
  };

  // Reset the transform whenever a new image/diagram is opened.
  useEffect(() => {
    view.current = { scale: 1, tx: 0, ty: 0 };
    apply();
  }, [content]);

  // Esc closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Native listeners: wheel must be non-passive to call preventDefault, and
  // pointer panning is simplest tracked imperatively.
  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = surface.getBoundingClientRect();
      const cx = e.clientX - rect.left - rect.width / 2;
      const cy = e.clientY - rect.top - rect.height / 2;
      const s = view.current.scale;
      // Scale proportionally to scroll distance so trackpads (many tiny events)
      // and mouse wheels (few large ticks) feel the same. deltaMode 1 = lines.
      const px = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      const factor = Math.exp(-px * ZOOM_SENSITIVITY);
      const ns = Math.min(MAX_SCALE, Math.max(MIN_SCALE, s * factor));
      const ratio = ns / s;
      // Keep the point under the cursor fixed while scaling about the center.
      view.current.tx = cx - ratio * (cx - view.current.tx);
      view.current.ty = cy - ratio * (cy - view.current.ty);
      view.current.scale = ns;
      apply();
    };

    let drag: { x: number; y: number; onBackdrop: boolean; moved: number } | null =
      null;

    const onDown = (e: PointerEvent) => {
      drag = {
        x: e.clientX - view.current.tx,
        y: e.clientY - view.current.ty,
        onBackdrop: e.target === surface,
        moved: 0,
      };
      surface.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!drag) return;
      const nx = e.clientX - drag.x;
      const ny = e.clientY - drag.y;
      drag.moved += Math.abs(nx - view.current.tx) + Math.abs(ny - view.current.ty);
      view.current.tx = nx;
      view.current.ty = ny;
      apply();
    };
    const onUp = () => {
      // A clean click on the empty backdrop closes; a drag does not.
      if (drag && drag.onBackdrop && drag.moved < CLICK_SLOP) onClose();
      drag = null;
    };
    const onDouble = () => {
      view.current = { scale: 1, tx: 0, ty: 0 };
      apply();
    };

    surface.addEventListener("wheel", onWheel, { passive: false });
    surface.addEventListener("pointerdown", onDown);
    surface.addEventListener("pointermove", onMove);
    surface.addEventListener("pointerup", onUp);
    surface.addEventListener("dblclick", onDouble);
    return () => {
      surface.removeEventListener("wheel", onWheel);
      surface.removeEventListener("pointerdown", onDown);
      surface.removeEventListener("pointermove", onMove);
      surface.removeEventListener("pointerup", onUp);
      surface.removeEventListener("dblclick", onDouble);
    };
  }, [onClose]);

  return (
    <div className="lightbox" ref={surfaceRef} role="dialog" aria-modal="true">
      <button
        className="lightbox-close"
        onClick={onClose}
        title="Close (Esc)"
        aria-label="Close"
      >
        ×
      </button>
      <div className="lightbox-stage" ref={stageRef}>
        {content.type === "img" ? (
          <img src={content.src} alt={content.alt ?? ""} draggable={false} />
        ) : (
          <div
            className="lightbox-svg"
            dangerouslySetInnerHTML={{ __html: content.markup }}
          />
        )}
      </div>
      <div className="lightbox-hint">
        Scroll to zoom · drag to pan · double-click to reset · Esc to close
      </div>
    </div>
  );
}
