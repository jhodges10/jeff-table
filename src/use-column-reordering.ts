import type { RowData } from "@tanstack/react-table";
import * as React from "react";
import type { DataGridHeader, DataGridInstance } from "./features";
import {
  type ColumnDropTarget,
  moveColumn,
  reconcileColumnOrder,
  resolveColumnDropTarget,
} from "./utils";

export function useColumnReordering<TData extends RowData>(
  table: DataGridInstance<TData>,
  enabled: boolean,
) {
  const [dragColumnId, setDragColumnId] = React.useState<string | null>(null);
  const [dropTarget, setDropTarget] = React.useState<ColumnDropTarget | null>(null);

  const currentOrder = React.useCallback(() => {
    const allIds = table.getAllLeafColumns().map((column) => column.id);
    return reconcileColumnOrder(allIds, table.state.columnOrder);
  }, [table]);

  const move = React.useCallback(
    (sourceId: string, targetId: string, side: "left" | "right") => {
      table.setColumnOrder(moveColumn(currentOrder(), sourceId, targetId, side));
    },
    [currentOrder, table],
  );

  const moveBy = React.useCallback(
    (columnId: string, offset: -1 | 1) => {
      const visibleOrder = table.getVisibleLeafColumns().map((column) => column.id);
      const index = visibleOrder.indexOf(columnId);
      const target = visibleOrder[index + offset];
      if (target) move(columnId, target, offset < 0 ? "left" : "right");
    },
    [move, table],
  );

  const clear = React.useCallback(() => {
    setDragColumnId(null);
    setDropTarget(null);
  }, []);

  const getDragProps = React.useCallback(
    (header: DataGridHeader<TData>) => {
      const canReorder = enabled && header.column.columnDef.meta?.reorderable !== false;
      const resolveTarget = (event: React.DragEvent<HTMLElement>) => {
        const rectangle = event.currentTarget
          .closest("[data-column-header]")
          ?.getBoundingClientRect();
        const leftHalf = rectangle ? event.clientX < rectangle.left + rectangle.width / 2 : true;
        return resolveColumnDropTarget(
          table.getVisibleLeafColumns().map((column) => column.id),
          header.column.id,
          leftHalf,
        );
      };

      return {
        draggable: canReorder,
        isDragSource: dragColumnId === header.column.id,
        dropSide: dropTarget?.id === header.column.id ? dropTarget.side : undefined,
        onDragEnd: clear,
        onDragOver: (event: React.DragEvent<HTMLElement>) => {
          if (!dragColumnId || dragColumnId === header.column.id) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
          setDropTarget(resolveTarget(event));
        },
        onDragStart: (event: React.DragEvent<HTMLElement>) => {
          if (!canReorder) return;
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", header.column.id);
          setDragColumnId(header.column.id);
        },
        onDrop: (event: React.DragEvent<HTMLElement>) => {
          event.preventDefault();
          if (dragColumnId && dragColumnId !== header.column.id) {
            const target = resolveTarget(event);
            move(dragColumnId, target.id, target.side);
          }
          clear();
        },
      };
    },
    [clear, dragColumnId, dropTarget?.id, dropTarget?.side, enabled, move, table],
  );

  return { getDragProps, moveBy };
}
