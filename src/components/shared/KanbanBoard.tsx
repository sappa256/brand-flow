import { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

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
}

export function KanbanBoard<T>({
  columns,
  items,
  getItemColumn,
  renderItem,
  getItemId,
  emptyMessage = 'No items',
}: KanbanBoardProps<T>) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin">
      {columns.map((column) => {
        const columnItems = items.filter((item) => getItemColumn(item) === column.id);
        
        return (
          <div
            key={column.id}
            className="flex-shrink-0 w-80"
          >
            <Card className="h-full bg-card/50">
              <CardHeader className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-foreground">
                    {column.title}
                  </CardTitle>
                  <span className={cn(
                    "text-xs font-medium px-2 py-1 rounded-full",
                    "bg-muted text-muted-foreground"
                  )}>
                    {columnItems.length}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="px-2 pb-2">
                <ScrollArea className="h-[calc(100vh-280px)]">
                  <div className="space-y-2 p-2">
                    {columnItems.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        {emptyMessage}
                      </div>
                    ) : (
                      columnItems.map((item) => (
                        <div key={getItemId(item)} className="animate-fade-in">
                          {renderItem(item)}
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        );
      })}
    </div>
  );
}
