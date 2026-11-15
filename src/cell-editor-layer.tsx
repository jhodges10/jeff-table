import * as React from "react";
import { createPortal } from "react-dom";

/** Gap between the anchor cell and the popover. */
const POPOVER_GAP = 4;
/** Breathing room kept between the popover and the edge of the grid. */
const POPOVER_MARGIN = 8;
/** Below this a flipped popover is more cramped than useful. */
const POPOVER_MINIMUM_HEIGHT = 96;
/** Floor for a column too narrow to give its own list a usable width. */
const POPOVER_MINIMUM_WIDTH = 144;

interface CellEditorPopoverProps {
  /** The cell the popover hangs from. */
  anchor: HTMLElement | null;
  children: React.ReactNode;
  /** The layer element inside the viewport shell. */
  layer: HTMLElement | null;
  onCancel: () => void;
  onLeave: () => void;
  /** The scrolling viewport, so the popover can follow its anchor. */
  viewport: HTMLElement | null;
}

/**
 * The popup half of a cell editor.
 *
 * A cell is `overflow: hidden` inside a viewport that is `overflow: auto`, so a
 * listbox rendered in place would be clipped twice. It is portalled instead
 * into a layer that sits in the viewport shell — outside both clippers, and
 * outside `role="grid"`, which is what keeps the grid's row/cell containment
 * valid. The layer is still inside `.jt-grid`, so every `--jt-*` token
 * inherits and no theme wrapper is needed.
 *
 * Position is written imperatively, like the header canvas and the overlay
 * scrollbars: a scroll must not cost a React render.
 */
export function CellEditorPopover({
  anchor,
  children,
  layer,
  viewport,
  onCancel,
  onLeave,
}: CellEditorPopoverProps) {
  const popoverReference = React.useRef<HTMLDivElement>(null);

  React.useLayoutEffect(() => {
    const popover = popoverReference.current;
    if (!anchor || !layer || !popover) return;

    const position = () => {
      const layerRect = layer.getBoundingClientRect();
      const anchorRect = anchor.getBoundingClientRect();
      // The list is as wide as the control it came from, and grows past it only
      // when an option needs the room.
      popover.style.minWidth = `${Math.max(anchorRect.width, POPOVER_MINIMUM_WIDTH)}px`;
      const below = anchorRect.bottom - layerRect.top + POPOVER_GAP;
      const above = anchorRect.top - layerRect.top - popover.offsetHeight - POPOVER_GAP;
      const roomBelow = layerRect.bottom - anchorRect.bottom - POPOVER_GAP - POPOVER_MARGIN;
      const roomAbove = anchorRect.top - layerRect.top - POPOVER_GAP - POPOVER_MARGIN;
      // The layer escapes the grid's clipping, not the host page's, so the
      // popover is confined to the grid's own box and flips rather than
      // overflowing it.
      const flip = popover.offsetHeight > roomBelow && roomAbove > roomBelow;

      popover.style.top = `${Math.max(POPOVER_MARGIN, flip ? above : below)}px`;
      popover.style.left = `${Math.max(
        POPOVER_MARGIN,
        Math.min(
          anchorRect.left - layerRect.left,
          layerRect.width - popover.offsetWidth - POPOVER_MARGIN,
        ),
      )}px`;
      popover.style.maxHeight = `${Math.max(
        POPOVER_MINIMUM_HEIGHT,
        flip ? roomAbove : roomBelow,
      )}px`;
    };

    position();
    viewport?.addEventListener("scroll", position, { passive: true });
    const observer =
      typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(position);
    observer?.observe(layer);
    observer?.observe(popover);
    return () => {
      viewport?.removeEventListener("scroll", position);
      observer?.disconnect();
    };
  }, [anchor, layer, viewport]);

  if (!layer) return null;
  return createPortal(
    // Pressing inside the popover must not blur the field that owns the
    // editor: the blur would commit first and the click would arrive to an
    // editor that had already closed, silently dropping the pick.
    // biome-ignore lint/a11y/noStaticElementInteractions: this is a focus guard, not an interaction — the popover's own controls stay the keyboard and pointer targets
    <div
      className="jt-grid__editor-popover"
      data-editor-owner={anchor?.dataset.cellId}
      onMouseDown={(event) => {
        if (!(event.target instanceof Element) || !event.target.closest("input,select,textarea"))
          event.preventDefault();
      }}
      onBlur={(event) => {
        const next = event.relatedTarget;
        if (next instanceof Node && (event.currentTarget.contains(next) || anchor?.contains(next)))
          return;
        onLeave();
      }}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Escape") {
          event.preventDefault();
          onCancel();
        }
      }}
      ref={popoverReference}
    >
      {children}
    </div>,
    layer,
  );
}
