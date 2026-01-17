import { ReactNode, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { PullToRefreshWrapper } from './PullToRefreshWrapper';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
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

interface Column<T> {
  key: string;
  header: string;
  render: (item: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  emptyMessage?: string;
  getRowId: (item: T) => string;
  onRowClick?: (item: T) => void;
  onRefresh?: () => Promise<void> | void;
  onDelete?: (id: string) => Promise<void>;
  deleteConfirmMessage?: string;
}

export function DataTable<T>({
  columns,
  data,
  isLoading = false,
  emptyMessage = 'No data available',
  getRowId,
  onRowClick,
  onRefresh,
  onDelete,
  deleteConfirmMessage = 'Are you sure you want to delete this item? This action cannot be undone.',
}: DataTableProps<T>) {
  const isMobile = useIsMobile();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setItemToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete || !onDelete) return;
    
    setIsDeleting(true);
    try {
      await onDelete(itemToDelete);
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    }
  };

  // Add delete column if onDelete is provided
  const allColumns = onDelete
    ? [
        ...columns,
        {
          key: 'delete',
          header: '',
          render: (item: T) => (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
              onClick={(e) => handleDeleteClick(getRowId(item), e)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          ),
          className: 'w-12',
        },
      ]
    : columns;

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  const tableContent = (
    <>
      <div className="rounded-md border overflow-x-auto">
        <Table className="min-w-[640px]">
          <TableHeader>
            <TableRow>
              {allColumns.map((column) => (
                <TableHead key={column.key} className={column.className}>
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={allColumns.length} className="h-24 text-center text-muted-foreground">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              data.map((item) => (
                <TableRow
                  key={getRowId(item)}
                  onClick={() => onRowClick?.(item)}
                  className={onRowClick ? 'cursor-pointer hover:bg-muted/50' : ''}
                >
                  {allColumns.map((column) => (
                    <TableCell key={column.key} className={column.className}>
                      {column.render(item)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      
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
    </>
  );

  // Wrap with pull-to-refresh on mobile if onRefresh is provided
  if (isMobile && onRefresh) {
    return (
      <PullToRefreshWrapper onRefresh={onRefresh}>
        {tableContent}
      </PullToRefreshWrapper>
    );
  }

  return tableContent;
}
