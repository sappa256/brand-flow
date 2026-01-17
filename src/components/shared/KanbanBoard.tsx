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
  useDroppable,
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
import { GripVertical, Trash2 } from 'lucide-react';
import { PullToRefreshWrapper } from './PullToRefreshWrapper';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

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
  onItemDelete?: (itemId: string) => Promise<void>;
  onRefresh?: () => Promise<void> | void;
  deleteConfirmMessage?: string;
}

interface SortableItemProps {
  id: string;
  children: ReactNode;
  onDelete?: () => void;
}

function SortableItem({ id, children, onDelete }: SortableItemProps) {
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
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative group animate-fade-in-up transition-all duration-200",
        isDragging && "z-50 opacity-50 scale-[1.02]",
        !isDragging && "hover-lift"
      )}
    >
      <div
        {...attributes}
        {...listeners}
        className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 opacity-0 group-hover:opacity-100 transition-all duration-200 cursor-grab active:cursor-grabbing p-1.5 rounded-lg hover:bg-muted/80 bg-card/50 backdrop-blur-sm shadow-soft"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>
      {onDelete && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-1 top-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-destructive/10 hover:text-destructive z-10"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      )}
      {children}
    </div>
  );
}

interface DroppableColumnProps {
  column: KanbanColumn;
  items: { id: string; element: ReactNode; onDelete?: () => void }[];
  emptyMessage: string;
  isOver: boolean;
}

function DroppableColumn({ column, items, emptyMessage, isOver }: DroppableColumnProps) {
  const { setNodeRef } = useDroppable({
    id: column.id,
  });

  return (
    <div ref={setNodeRef} className="flex-shrink-0 w-[280px] xs:w-72 sm:w-80 animate-fade-in-up">
      <Card className={cn(
        "h-full bg-card/50 transition-all duration-300 backdrop-blur-sm",
        isOver && "ring-2 ring-primary/50 bg-primary/5 shadow-glow"
      )}>
        <CardHeader className="py-2 sm:py-3 px-3 sm:px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs sm:text-sm font-medium text-foreground truncate max-w-[150px] sm:max-w-none">
              {column.title}
            </CardTitle>
            <span className={cn(
              "text-xs font-medium px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full transition-all duration-200",
              "bg-muted text-muted-foreground",
              isOver && "bg-primary/20 text-primary"
            )}>
              {items.length}
            </span>
          </div>
        </CardHeader>
        <CardContent className="px-1.5 sm:px-2 pb-2">
          <ScrollArea className="h-[calc(100vh-320px)] sm:h-[calc(100vh-280px)]">
            <SortableContext
              items={items.map(i => i.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className={cn(
                "space-y-2 p-2 min-h-[100px] rounded-xl transition-all duration-300",
                isOver && "bg-primary/10"
              )}>
                {items.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm animate-pulse-soft">
                    {emptyMessage}
                  </div>
                ) : (
                  items.map((item, index) => (
                    <div key={item.id} className={`stagger-${Math.min(index + 1, 6)}`}>
                      <SortableItem id={item.id} onDelete={item.onDelete}>
                        {item.element}
                      </SortableItem>
                    </div>
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
  onItemDelete,
  onRefresh,
  deleteConfirmMessage = 'Are you sure you want to delete this item? This action cannot be undone.',
}: KanbanBoardProps<T>) {
  const isMobile = useIsMobile();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteClick = (itemId: string) => {
    setItemToDelete(itemId);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete || !onItemDelete) return;
    
    setIsDeleting(true);
    try {
      await onItemDelete(itemToDelete);
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    }
  };

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
        onDelete: onItemDelete ? () => handleDeleteClick(getItemId(item)) : undefined,
      }));
    return acc;
  }, {} as Record<string, { id: string; element: ReactNode; item: T; onDelete?: () => void }[]>);

  const boardContent = (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-2 sm:gap-4 overflow-x-auto pb-4 scrollbar-thin -mx-2 px-2 sm:mx-0 sm:px-0">
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
          <div className="rotate-2 scale-105 shadow-soft-lg animate-scale-in-bounce">
            {renderItem(activeItem)}
          </div>
        ) : null}
      </DragOverlay>
      
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Item</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirmMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DndContext>
  );

  // Wrap with pull-to-refresh on mobile if onRefresh is provided
  if (isMobile && onRefresh) {
    return (
      <PullToRefreshWrapper onRefresh={onRefresh}>
        {boardContent}
      </PullToRefreshWrapper>
    );
  }

  return boardContent;
}
