"use client";

import * as React from "react";

/** Distance from the viewport edge to the overlay track. */
export const OVERLAY_SCROLLBAR_INSET = 4;
/** Pointer target cross-axis size. The painted thumb is centered inside this. */
export const OVERLAY_SCROLLBAR_HIT = 12;
export const OVERLAY_SCROLLBAR_MIN_THUMB = 24;
export const OVERLAY_SCROLLBAR_OVERFLOW_EPSILON = 1;

export type OverlayThumbLayout = {
  clientSize: number;
  overflow: number;
  scrollSize: number;
  thumbOffset: number;
  thumbSize: number;
  trackSize: number;
  visible: boolean;
};

const HIDDEN_THUMB: OverlayThumbLayout = {
  clientSize: 0,
  overflow: 0,
  scrollSize: 0,
  thumbOffset: 0,
  thumbSize: 0,
  trackSize: 0,
  visible: false,
};

export function overlayThumbLayout(options: {
  clientSize: number;
  endInset: number;
  minThumb?: number;
  scrollOffset: number;
  scrollSize: number;
}): OverlayThumbLayout {
  const minThumb = options.minThumb ?? OVERLAY_SCROLLBAR_MIN_THUMB;
  const overflow = options.scrollSize - options.clientSize;
  const trackSize = Math.max(
    0,
    options.clientSize - OVERLAY_SCROLLBAR_INSET * 2 - options.endInset,
  );

  if (overflow <= OVERLAY_SCROLLBAR_OVERFLOW_EPSILON || trackSize <= 0) {
    return {
      ...HIDDEN_THUMB,
      clientSize: options.clientSize,
      overflow: Math.max(0, overflow),
      scrollSize: options.scrollSize,
      trackSize,
    };
  }

  const thumbSize = Math.min(
    trackSize,
    Math.max(minThumb, (options.clientSize / options.scrollSize) * trackSize),
  );
  const maxThumbOffset = trackSize - thumbSize;
  const thumbOffset =
    maxThumbOffset <= 0 ? 0 : (Math.max(0, options.scrollOffset) / overflow) * maxThumbOffset;

  return {
    clientSize: options.clientSize,
    overflow,
    scrollSize: options.scrollSize,
    thumbOffset,
    thumbSize,
    trackSize,
    visible: true,
  };
}

export function overlayScrollFromThumbDelta(options: {
  maxThumbOffset: number;
  overflow: number;
  pointerDelta: number;
}): number {
  if (options.maxThumbOffset <= 0) return 0;
  return (options.pointerDelta / options.maxThumbOffset) * options.overflow;
}

type OverlayAxis = "horizontal" | "vertical";

type OverlayLayout = {
  horizontal: OverlayThumbLayout;
  vertical: OverlayThumbLayout;
};

function measureOverlayLayout(viewport: HTMLElement): OverlayLayout {
  const verticalOverflow =
    viewport.scrollHeight - viewport.clientHeight > OVERLAY_SCROLLBAR_OVERFLOW_EPSILON;
  const horizontalOverflow =
    viewport.scrollWidth - viewport.clientWidth > OVERLAY_SCROLLBAR_OVERFLOW_EPSILON;
  return {
    horizontal: overlayThumbLayout({
      clientSize: viewport.clientWidth,
      endInset: verticalOverflow ? OVERLAY_SCROLLBAR_HIT : 0,
      scrollOffset: viewport.scrollLeft,
      scrollSize: viewport.scrollWidth,
    }),
    vertical: overlayThumbLayout({
      clientSize: viewport.clientHeight,
      endInset: horizontalOverflow ? OVERLAY_SCROLLBAR_HIT : 0,
      scrollOffset: viewport.scrollTop,
      scrollSize: viewport.scrollHeight,
    }),
  };
}

function applyThumbStyle(
  thumb: HTMLElement | null,
  layout: OverlayThumbLayout,
  axis: OverlayAxis,
): void {
  if (!thumb || !layout.visible) return;
  if (axis === "vertical") {
    thumb.style.height = `${layout.thumbSize}px`;
    thumb.style.transform = `translate3d(0, ${layout.thumbOffset}px, 0)`;
    return;
  }
  thumb.style.width = `${layout.thumbSize}px`;
  thumb.style.transform = `translate3d(${layout.thumbOffset}px, 0, 0)`;
}

function applyTrackStyle(
  track: HTMLElement | null,
  layer: HTMLElement,
  viewport: HTMLElement,
  layout: OverlayThumbLayout,
  axis: OverlayAxis,
): void {
  if (!track || !layout.visible) return;
  const layerRect = layer.getBoundingClientRect();
  const viewRect = viewport.getBoundingClientRect();
  if (axis === "vertical") {
    track.style.top = `${viewRect.top - layerRect.top + OVERLAY_SCROLLBAR_INSET}px`;
    track.style.right = `${layerRect.right - viewRect.right + OVERLAY_SCROLLBAR_INSET}px`;
    track.style.height = `${layout.trackSize}px`;
    return;
  }
  track.style.left = `${viewRect.left - layerRect.left + OVERLAY_SCROLLBAR_INSET}px`;
  track.style.bottom = `${layerRect.bottom - viewRect.bottom + OVERLAY_SCROLLBAR_INSET}px`;
  track.style.width = `${layout.trackSize}px`;
}

/**
 * Paints inset overlay thumbs over a native scroller. The viewport keeps
 * overflowing with `overflow: auto` so wheel, touch, and keyboard scrolling
 * stay native; Windows (and macOS "always show") gutters are hidden in CSS.
 */
export function OverlayScrollbars({
  viewportRef,
}: {
  viewportRef: React.RefObject<HTMLElement | null>;
}) {
  const layerRef = React.useRef<HTMLDivElement>(null);
  const verticalTrackRef = React.useRef<HTMLDivElement>(null);
  const horizontalTrackRef = React.useRef<HTMLDivElement>(null);
  const verticalThumbRef = React.useRef<HTMLDivElement>(null);
  const horizontalThumbRef = React.useRef<HTMLDivElement>(null);
  const layoutRef = React.useRef<OverlayLayout>({
    horizontal: HIDDEN_THUMB,
    vertical: HIDDEN_THUMB,
  });
  const dragRef = React.useRef<{
    axis: OverlayAxis;
    maxThumbOffset: number;
    overflow: number;
    pointerId: number;
    startPointer: number;
    startScroll: number;
  } | null>(null);

  const paint = React.useCallback(
    (layout: OverlayLayout) => {
      const viewport = viewportRef.current;
      const layer = layerRef.current;
      const verticalTrack = verticalTrackRef.current;
      const horizontalTrack = horizontalTrackRef.current;
      if (!viewport || !layer) return;
      if (verticalTrack) verticalTrack.hidden = !layout.vertical.visible;
      if (horizontalTrack) horizontalTrack.hidden = !layout.horizontal.visible;
      applyTrackStyle(verticalTrack, layer, viewport, layout.vertical, "vertical");
      applyTrackStyle(horizontalTrack, layer, viewport, layout.horizontal, "horizontal");
      applyThumbStyle(verticalThumbRef.current, layout.vertical, "vertical");
      applyThumbStyle(horizontalThumbRef.current, layout.horizontal, "horizontal");
    },
    [viewportRef],
  );

  const remeasure = React.useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const layout = measureOverlayLayout(viewport);
    layoutRef.current = layout;
    paint(layout);
  }, [paint, viewportRef]);

  React.useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    remeasure();

    const syncFromScroll = () => {
      if (
        viewport.clientHeight !== layoutRef.current.vertical.clientSize ||
        viewport.clientWidth !== layoutRef.current.horizontal.clientSize ||
        viewport.scrollHeight !== layoutRef.current.vertical.scrollSize ||
        viewport.scrollWidth !== layoutRef.current.horizontal.scrollSize
      ) {
        remeasure();
        return;
      }
      const layout = {
        horizontal: overlayThumbLayout({
          clientSize: layoutRef.current.horizontal.clientSize,
          endInset: layoutRef.current.vertical.visible ? OVERLAY_SCROLLBAR_HIT : 0,
          scrollOffset: viewport.scrollLeft,
          scrollSize: layoutRef.current.horizontal.scrollSize,
        }),
        vertical: overlayThumbLayout({
          clientSize: layoutRef.current.vertical.clientSize,
          endInset: layoutRef.current.horizontal.visible ? OVERLAY_SCROLLBAR_HIT : 0,
          scrollOffset: viewport.scrollTop,
          scrollSize: layoutRef.current.vertical.scrollSize,
        }),
      };
      layoutRef.current = layout;
      applyThumbStyle(verticalThumbRef.current, layout.vertical, "vertical");
      applyThumbStyle(horizontalThumbRef.current, layout.horizontal, "horizontal");
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      viewport.scrollTop += event.deltaY;
      viewport.scrollLeft += event.deltaX;
    };

    viewport.addEventListener("scroll", syncFromScroll, { passive: true });
    const thumbs = [verticalThumbRef.current, horizontalThumbRef.current];
    for (const thumb of thumbs) {
      thumb?.addEventListener("wheel", onWheel, { passive: false });
    }
    const observer =
      typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(remeasure);
    observer?.observe(viewport);
    const canvas = viewport.firstElementChild;
    if (observer && canvas instanceof HTMLElement) observer.observe(canvas);
    return () => {
      viewport.removeEventListener("scroll", syncFromScroll);
      for (const thumb of thumbs) {
        thumb?.removeEventListener("wheel", onWheel);
      }
      observer?.disconnect();
    };
  }, [remeasure, viewportRef]);

  const stopDrag = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    event.currentTarget.removeAttribute("data-dragging");
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  const onThumbPointerDown = React.useCallback(
    (axis: OverlayAxis) => (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      const viewport = viewportRef.current;
      const layout = layoutRef.current[axis];
      if (!viewport || !layout.visible) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      event.currentTarget.setAttribute("data-dragging", "true");
      dragRef.current = {
        axis,
        maxThumbOffset: layout.trackSize - layout.thumbSize,
        overflow: layout.overflow,
        pointerId: event.pointerId,
        startPointer: axis === "vertical" ? event.clientY : event.clientX,
        startScroll: axis === "vertical" ? viewport.scrollTop : viewport.scrollLeft,
      };
    },
    [viewportRef],
  );

  const onThumbPointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      const viewport = viewportRef.current;
      if (!drag || !viewport || event.pointerId !== drag.pointerId) return;
      const pointer = drag.axis === "vertical" ? event.clientY : event.clientX;
      const delta = overlayScrollFromThumbDelta({
        maxThumbOffset: drag.maxThumbOffset,
        overflow: drag.overflow,
        pointerDelta: pointer - drag.startPointer,
      });
      if (drag.axis === "vertical") viewport.scrollTop = drag.startScroll + delta;
      else viewport.scrollLeft = drag.startScroll + delta;
    },
    [viewportRef],
  );

  return (
    <div
      aria-hidden="true"
      className="jt-grid__overlay-scrollbars"
      data-slot="overlay-scrollbars"
      ref={layerRef}
    >
      <div
        className="jt-grid__overlay-scrollbar jt-grid__overlay-scrollbar--vertical"
        data-slot="overlay-scrollbar-vertical"
        hidden
        ref={verticalTrackRef}
      >
        <div
          className="jt-grid__overlay-scrollbar-thumb"
          onPointerCancel={stopDrag}
          onPointerDown={onThumbPointerDown("vertical")}
          onPointerMove={onThumbPointerMove}
          onPointerUp={stopDrag}
          ref={verticalThumbRef}
        />
      </div>
      <div
        className="jt-grid__overlay-scrollbar jt-grid__overlay-scrollbar--horizontal"
        data-slot="overlay-scrollbar-horizontal"
        hidden
        ref={horizontalTrackRef}
      >
        <div
          className="jt-grid__overlay-scrollbar-thumb"
          onPointerCancel={stopDrag}
          onPointerDown={onThumbPointerDown("horizontal")}
          onPointerMove={onThumbPointerMove}
          onPointerUp={stopDrag}
          ref={horizontalThumbRef}
        />
      </div>
    </div>
  );
}
