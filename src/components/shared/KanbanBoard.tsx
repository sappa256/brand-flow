import { ReactNode, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { GripVertical } from 'lucide-react';

interface KanbanColumn {
  id: string;
  title: string;
  count: number;
  color?: string;
}

interface KanbanBoardProps<T> {
  columns: KanbanColumn[];
  items: T[];
  getItemColumn: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  getItemId: (item: T) => string;
  emptyMessage?: string;
  onItemMove?: (itemId: string, newColumn: string) => void;
}

interface SortableItemProps {
  id: string;
  children: ReactNode;
}

function SortableItem({ id, children }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative group animate-fade-in",
        isDragging && "z-50"
      )}
    >
      <div
        {...attributes}
        {...listeners}
        className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing p-1 rounded hover:bg-muted"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>
      {children}
    </div>
  );
}

interface DroppableColumnProps {
  column: KanbanColumn;
  items: { id: string; element: ReactNode }[];
  emptyMessage: string;
  isOver: boolean;
}

function DroppableColumn({ column, items, emptyMessage, isOver }: DroppableColumnProps) {
  return (
    <div className="flex-shrink-0 w-80">
      <Card className={cn(
        "h-full bg-card/50 transition-colors duration-200",
        isOver && "ring-2 ring-primary/50 bg-primary/5"
      )}>
        <CardHeader className="py-3 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-foreground">
              {column.title}
            </CardTitle>
            <span className={cn(
              "text-xs font-medium px-2 py-1 rounded-full",
              "bg-muted text-muted-foreground"
            )}>
              {items.length}
            </span>
          </div>
        </CardHeader>
        <CardContent className="px-2 pb-2">
          <ScrollArea className="h-[calc(100vh-280px)]">
            <SortableContext
              items={items.map(i => i.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className={cn(
                "space-y-2 p-2 min-h-[100px] rounded-lg transition-colors",
                isOver && "bg-primary/10"
              )}>
                {items.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    {emptyMessage}
                  </div>
                ) : (
                  items.map((item) => (
                    <SortableItem key={item.id} id={item.id}>
                      {item.element}
                    </SortableItem>
                  ))
                )}
              </div>
            </SortableContext>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

export function KanbanBoard<T>({
  columns,
  items,
  getItemColumn,
  renderItem,
  getItemId,
  emptyMessage = 'No items',
  onItemMove,
}: KanbanBoardProps<T>) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const activeItem = activeId ? items.find(item => getItemId(item) === activeId) : null;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    if (!over) {
      setOverColumn(null);
      return;
    }

    // Check if we're over a column or an item
    const overId = over.id as string;
    const isColumn = columns.some(col => col.id === overId);
    
    if (isColumn) {
      setOverColumn(overId);
    } else {
      // We're over an item, find which column it belongs to
      const overItem = items.find(item => getItemId(item) === overId);
      if (overItem) {
        setOverColumn(getItemColumn(overItem));
      }
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setOverColumn(null);

    if (!over || !onItemMove) return;

    const activeItemId = active.id as string;
    const overId = over.id as string;

    // Determine target column
    let targetColumn: string | null = null;
    
    // Check if dropped on a column
    if (columns.some(col => col.id === overId)) {
      targetColumn = overId;
    } else {
      // Dropped on an item, get its column
      const overItem = items.find(item => getItemId(item) === overId);
      if (overItem) {
        targetColumn = getItemColumn(overItem);
      }
    }

    if (targetColumn) {
      const currentItem = items.find(item => getItemId(item) === activeItemId);
      if (currentItem && getItemColumn(currentItem) !== targetColumn) {
        onItemMove(activeItemId, targetColumn);
      }
    }
  };

  // Prepare items with their rendered elements
  const columnItemsMap = columns.reduce((acc, column) => {
    acc[column.id] = items
      .filter(item => getItemColumn(item) === column.id)
      .map(item => ({
        id: getItemId(item),
        element: renderItem(item),
        item,
      }));
    return acc;
  }, {} as Record<string, { id: string; element: ReactNode; item: T }[]>);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin">
        {columns.map((column) => (
          <DroppableColumn
            key={column.id}
            column={column}
            items={columnItemsMap[column.id] || []}
            emptyMessage={emptyMessage}
            isOver={overColumn === column.id}
          />
        ))}
      </div>
      
      <DragOverlay>
        {activeItem ? (
          <div className="opacity-90 rotate-2 scale-105 shadow-xl">
            {renderItem(activeItem)}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
