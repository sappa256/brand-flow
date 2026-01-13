import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Plus, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { CalendarEntryDialog } from '@/components/calendar/CalendarEntryDialog';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { toast } from 'sonner';
import type { Tables } from '@/integrations/supabase/types';

type ContentCalendarEntry = Tables<'content_calendar'>;
type Client = Tables<'clients'>;

export default function Calendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ContentCalendarEntry | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [clientFilter, setClientFilter] = useState<string>('all');
  const queryClient = useQueryClient();

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['content_calendar', format(currentMonth, 'yyyy-MM')],
    queryFn: async () => {
      const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
      const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('content_calendar')
        .select('*')
        .gte('post_date', start)
        .lte('post_date', end)
        .order('post_date');
      if (error) throw error;
      return data as ContentCalendarEntry[];
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('*').eq('status', 'active').order('client_name');
      if (error) throw error;
      return data as Client[];
    },
  });

  const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });
  const startDayOfWeek = startOfMonth(currentMonth).getDay();

  const filteredEntries = entries.filter((e) => clientFilter === 'all' || e.client_id === clientFilter);

  const getEntriesForDay = (day: Date) => 
    filteredEntries.filter((e) => isSameDay(new Date(e.post_date), day));

  const getClientName = (clientId: string) => 
    clients.find((c) => c.id === clientId)?.client_name || 'Unknown';

  const handleDayClick = (day: Date) => {
    setSelectedDate(day);
    setEditingEntry(null);
    setIsDialogOpen(true);
  };

  const handleEntryClick = (entry: ContentCalendarEntry, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingEntry(entry);
    setSelectedDate(new Date(entry.post_date));
    setIsDialogOpen(true);
  };

  const handleClose = () => {
    setIsDialogOpen(false);
    setEditingEntry(null);
    setSelectedDate(null);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'posted': return 'bg-success/20 border-success/30';
      case 'scheduled': return 'bg-info/20 border-info/30';
      case 'missed': return 'bg-destructive/20 border-destructive/30';
      default: return 'bg-muted';
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-foreground">Content Calendar</h1>
            <p className="text-sm text-muted-foreground">Schedule and track social media posts</p>
          </div>
          <Button onClick={() => { setSelectedDate(new Date()); setIsDialogOpen(true); }} size="sm" className="w-fit">
            <Plus className="h-4 w-4 md:mr-2" />
            <span className="hidden md:inline">Add Post</span>
            <span className="md:hidden">New</span>
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 md:gap-3">
            <Button variant="outline" size="icon" className="h-8 w-8 md:h-9 md:w-9" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-sm md:text-lg font-semibold min-w-[120px] md:min-w-[160px] text-center">
              {format(currentMonth, 'MMMM yyyy')}
            </h2>
            <Button variant="outline" size="icon" className="h-8 w-8 md:h-9 md:w-9" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Select value={clientFilter} onValueChange={setClientFilter}>
            <SelectTrigger className="w-36 md:w-48 text-xs md:text-sm">
              <SelectValue placeholder="Filter by client" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Clients</SelectItem>
              {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.client_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <Card>
            <CardContent className="p-2 md:p-4">
              <div className="grid grid-cols-7 gap-0.5 md:gap-1">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                  <div key={i} className="text-center text-[10px] md:text-sm font-medium text-muted-foreground py-1 md:py-2">
                    <span className="md:hidden">{day}</span>
                    <span className="hidden md:inline">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][i]}</span>
                  </div>
                ))}
                
                {Array.from({ length: startDayOfWeek }).map((_, i) => (
                  <div key={`empty-${i}`} className="min-h-[50px] md:min-h-[100px] bg-muted/30 rounded" />
                ))}
                
                {days.map((day) => {
                  const dayEntries = getEntriesForDay(day);
                  const isToday = isSameDay(day, new Date());
                  
                  return (
                    <div
                      key={day.toISOString()}
                      className={`min-h-[50px] md:min-h-[100px] p-0.5 md:p-1 border rounded cursor-pointer hover:bg-muted/50 transition-colors ${
                        isToday ? 'border-primary bg-primary/5' : 'border-border'
                      }`}
                      onClick={() => handleDayClick(day)}
                    >
                      <div className={`text-[10px] md:text-sm font-medium mb-0.5 md:mb-1 ${isToday ? 'text-primary' : 'text-foreground'}`}>
                        {format(day, 'd')}
                      </div>
                      <div className="space-y-0.5 md:space-y-1">
                        {dayEntries.slice(0, 2).map((entry) => (
                          <div
                            key={entry.id}
                            className={`text-[8px] md:text-xs p-0.5 md:p-1 rounded border truncate ${getStatusColor(entry.posting_status)}`}
                            onClick={(e) => handleEntryClick(entry, e)}
                          >
                            <span className="hidden md:inline">{getClientName(entry.client_id)}</span>
                            <span className="md:hidden">{getClientName(entry.client_id).charAt(0)}</span>
                          </div>
                        ))}
                        {dayEntries.length > 2 && (
                          <div className="text-[8px] md:text-xs text-muted-foreground text-center">
                            +{dayEntries.length - 2}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex flex-wrap gap-3 md:gap-4 text-xs md:text-sm">
          <div className="flex items-center gap-1.5 md:gap-2">
            <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded bg-info/50" />
            <span className="text-muted-foreground">Scheduled</span>
          </div>
          <div className="flex items-center gap-1.5 md:gap-2">
            <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded bg-success/50" />
            <span className="text-muted-foreground">Posted</span>
          </div>
          <div className="flex items-center gap-1.5 md:gap-2">
            <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded bg-destructive/50" />
            <span className="text-muted-foreground">Missed</span>
          </div>
        </div>
      </div>

      <CalendarEntryDialog
        open={isDialogOpen}
        onOpenChange={handleClose}
        entry={editingEntry}
        clients={clients}
        selectedDate={selectedDate}
      />
    </AppLayout>
  );
}
