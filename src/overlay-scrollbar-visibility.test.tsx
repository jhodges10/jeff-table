import { act, cleanup, fireEvent, render } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OverlayScrollbars } from "./overlay-scrollbar";
import { defined } from "./test/defined";

function mountScrollbars(scrollHeight = 800, scrollWidth = 200) {
  const size = { scrollHeight, scrollWidth };
  function Harness() {
    const viewportRef = React.useRef<HTMLDivElement>(null);
    return (
      <div data-testid="shell">
        <div
          ref={(node) => {
            viewportRef.current = node;
            if (node)
              Object.defineProperties(node, {
                clientHeight: { configurable: true, value: 200 },
                clientWidth: { configurable: true, value: 200 },
                scrollHeight: { configurable: true, get: () => size.scrollHeight },
                scrollWidth: { configurable: true, get: () => size.scrollWidth },
              });
          }}
        >
          <div />
        </div>
        <OverlayScrollbars viewportRef={viewportRef} />
      </div>
    );
  }
  const result = render(<Harness />);
  const shell = result.getByTestId("shell");
  const viewport = defined(shell.firstElementChild);
  const layer = defined(shell.querySelector<HTMLElement>("[data-slot=overlay-scrollbars]"));
  const vertical = defined(
    layer.querySelector<HTMLElement>("[data-slot=overlay-scrollbar-vertical]"),
  );
  const horizontal = defined(
    layer.querySelector<HTMLElement>("[data-slot=overlay-scrollbar-horizontal]"),
  );
  vertical.getBoundingClientRect = () => new DOMRect(194, 44, 12, 192);
  horizontal.getBoundingClientRect = () => new DOMRect(14, 224, 192, 12);
  const thumb = defined(vertical.firstElementChild) as HTMLElement;
  return { ...result, shell, viewport, layer, vertical, horizontal, thumb, size };
}

const idle = () => act(() => vi.advanceTimersByTime(1001));

function pointer(thumb: HTMLElement, type: string) {
  const event = new MouseEvent(type, { bubbles: true, button: 0, clientY: 20 });
  Object.defineProperty(event, "pointerId", { value: 1 });
  fireEvent(thumb, event);
}

function moveCursor(shell: HTMLElement, x: number, y: number, pointerType = "mouse") {
  const event = new MouseEvent("pointermove", { bubbles: true, clientX: x, clientY: y });
  Object.defineProperty(event, "pointerType", { value: pointerType });
  fireEvent(shell, event);
}

describe("overlay scrollbar visibility", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("starts hidden, reveals on activity, and fades even if the pointer stays in the table", () => {
    const { shell, layer, vertical, horizontal } = mountScrollbars();
    expect(layer).not.toHaveAttribute("data-active");
    expect(vertical).not.toHaveAttribute("hidden");
    expect(horizontal).toHaveAttribute("hidden");
    fireEvent.pointerMove(shell);
    expect(layer).toHaveAttribute("data-active", "true");
    act(() => vi.advanceTimersByTime(600));
    fireEvent.pointerMove(shell);
    act(() => vi.advanceTimersByTime(600));
    expect(layer).toHaveAttribute("data-active", "true");
    idle();
    expect(layer).not.toHaveAttribute("data-active");
  });

  it("reveals on scrolling and keyboard activity and rechecks each overflow direction", () => {
    const { shell, viewport, layer, vertical, horizontal, size } = mountScrollbars(200, 800);
    fireEvent.scroll(viewport);
    expect(layer).toHaveAttribute("data-active", "true");
    expect(vertical).toHaveAttribute("hidden");
    expect(horizontal).not.toHaveAttribute("hidden");
    idle();
    fireEvent.keyDown(shell, { key: "ArrowRight" });
    expect(layer).toHaveAttribute("data-active", "true");
    size.scrollWidth = 200;
    fireEvent.scroll(viewport);
    expect(horizontal).toHaveAttribute("hidden");
    expect(vertical).toHaveAttribute("hidden");
  });

  it.each([
    { axis: "vertical", height: 800, width: 200, x: 170, y: 100 },
    { axis: "horizontal", height: 200, width: 800, x: 100, y: 200 },
  ])(
    "keeps the $axis handle visible near its track, then fades away from it",
    ({ height, width, x, y }) => {
      const { shell, layer } = mountScrollbars(height, width);
      moveCursor(shell, x, y);
      idle();
      idle();
      expect(layer).toHaveAttribute("data-active", "true");
      moveCursor(shell, 100, 100);
      expect(layer).toHaveAttribute("data-active", "true");
      idle();
      expect(layer).not.toHaveAttribute("data-active");
    },
  );

  it.each(["pointerleave", "pointercancel"])("releases proximity on %s", (type) => {
    const { shell, layer } = mountScrollbars();
    moveCursor(shell, 170, 100);
    idle();
    fireEvent(shell, new MouseEvent(type));
    idle();
    expect(layer).not.toHaveAttribute("data-active");
  });

  it("does not hold visibility near an axis without overflow or after touch activity", () => {
    const { shell, layer } = mountScrollbars();
    moveCursor(shell, 100, 230);
    idle();
    expect(layer).not.toHaveAttribute("data-active");
    moveCursor(shell, 170, 100, "touch");
    idle();
    expect(layer).not.toHaveAttribute("data-active");
  });

  it("rechecks stationary cursor proximity when overflow changes", () => {
    let resize: ResizeObserverCallback | undefined;
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: ResizeObserverCallback) {
          resize = callback;
        }
        observe() {}
        disconnect() {}
      },
    );
    try {
      const { shell, layer, vertical, size } = mountScrollbars();
      moveCursor(shell, 170, 100);
      idle();
      size.scrollHeight = 200;
      act(() => defined(resize)([], {} as ResizeObserver));
      idle();
      expect(vertical).toHaveAttribute("hidden");
      expect(layer).not.toHaveAttribute("data-active");
      size.scrollHeight = 800;
      act(() => defined(resize)([], {} as ResizeObserver));
      idle();
      expect(vertical).not.toHaveAttribute("hidden");
      expect(layer).toHaveAttribute("data-active", "true");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("keeps a hovered handle available until the pointer leaves", () => {
    const { layer, thumb } = mountScrollbars();
    fireEvent.pointerEnter(thumb);
    idle();
    expect(layer).toHaveAttribute("data-active", "true");
    fireEvent.pointerLeave(thumb);
    idle();
    expect(layer).not.toHaveAttribute("data-active");
  });

  it.each(["pointerup", "pointercancel", "lostpointercapture"])(
    "holds visibility during drag and resumes hiding after %s",
    (type) => {
      const { layer, thumb } = mountScrollbars();
      thumb.setPointerCapture = vi.fn();
      thumb.hasPointerCapture = vi.fn(() => false);
      pointer(thumb, "pointerdown");
      idle();
      expect(thumb).toHaveAttribute("data-dragging", "true");
      expect(layer).toHaveAttribute("data-active", "true");
      pointer(thumb, type);
      expect(thumb).not.toHaveAttribute("data-dragging");
      idle();
      expect(layer).not.toHaveAttribute("data-active");
    },
  );

  it("cleans up its idle timer on unmount", () => {
    const { shell, unmount } = mountScrollbars();
    fireEvent.pointerMove(shell);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
