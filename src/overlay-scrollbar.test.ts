import { describe, expect, it } from "vitest";
import {
  OVERLAY_SCROLLBAR_HIT,
  OVERLAY_SCROLLBAR_INSET,
  overlayScrollFromThumbDelta,
  overlayThumbLayout,
} from "./overlay-scrollbar";

describe("overlayThumbLayout", () => {
  it("hides the thumb when content fits", () => {
    expect(
      overlayThumbLayout({
        clientSize: 200,
        endInset: 0,
        scrollOffset: 0,
        scrollSize: 200,
      }).visible,
    ).toBe(false);
  });

  it("sizes the thumb to the visible fraction of the inset track", () => {
    const layout = overlayThumbLayout({
      clientSize: 200,
      endInset: 0,
      scrollOffset: 0,
      scrollSize: 800,
    });
    const trackSize = 200 - OVERLAY_SCROLLBAR_INSET * 2;

    expect(layout.visible).toBe(true);
    expect(layout.trackSize).toBe(trackSize);
    expect(layout.thumbSize).toBe((200 / 800) * trackSize);
    expect(layout.thumbOffset).toBe(0);
  });

  it("leaves room for the crossing scrollbar and follows scroll offset", () => {
    const layout = overlayThumbLayout({
      clientSize: 200,
      endInset: OVERLAY_SCROLLBAR_HIT,
      scrollOffset: 300,
      scrollSize: 800,
    });
    const trackSize = 200 - OVERLAY_SCROLLBAR_INSET * 2 - OVERLAY_SCROLLBAR_HIT;
    const thumbSize = (200 / 800) * trackSize;
    const overflow = 600;

    expect(layout.trackSize).toBe(trackSize);
    expect(layout.thumbSize).toBe(thumbSize);
    expect(layout.thumbOffset).toBe((300 / overflow) * (trackSize - thumbSize));
  });

  it("floors the thumb at the minimum grab size", () => {
    const layout = overlayThumbLayout({
      clientSize: 200,
      endInset: 0,
      minThumb: 24,
      scrollOffset: 0,
      scrollSize: 20_000,
    });
    expect(layout.thumbSize).toBe(24);
  });
});

describe("overlayScrollFromThumbDelta", () => {
  it("maps pointer movement across the free track to content scroll", () => {
    expect(
      overlayScrollFromThumbDelta({
        maxThumbOffset: 144,
        overflow: 600,
        pointerDelta: 72,
      }),
    ).toBe(300);
  });

  it("does not divide by a collapsed track", () => {
    expect(
      overlayScrollFromThumbDelta({
        maxThumbOffset: 0,
        overflow: 600,
        pointerDelta: 10,
      }),
    ).toBe(0);
  });
});
