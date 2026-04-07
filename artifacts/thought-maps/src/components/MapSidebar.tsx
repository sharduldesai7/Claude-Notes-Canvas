import { useLocation } from "wouter";
import { Plus, Trash2, Edit2, Check, X } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import { useThoughtMaps, useCreateThoughtMap, useUpdateThoughtMap, useDeleteThoughtMap } from "@/hooks/use-thought-maps";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { SynapticaLogo } from "@/components/SynapticaLogo";

export function MapSidebar() {
  const [location, setLocation] = useLocation();
  const { data: maps, isLoading } = useThoughtMaps();
  const { mutate: createMap, isPending: isCreating } = useCreateThoughtMap();
  const { mutate: updateMap } = useUpdateThoughtMap();
  const { mutate: deleteMap } = useDeleteThoughtMap();

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const handleCreate = () => {
    createMap(
      { data: { title: "Untitled Synaptica Map" } },
      { onSuccess: (data) => setLocation(`/m/${data.id}`) }
    );
  };

  const handleRename = (id: number) => {
    if (!editTitle.trim()) return;
    updateMap({ id, data: { title: editTitle } });
    setEditingId(null);
  };

  const handleDelete = (id: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this map?")) {
      deleteMap({ id }, {
        onSuccess: () => {
          if (location === `/m/${id}`) setLocation("/");
        }
      });
    }
  };

  return (
    <div className="w-72 border-r border-border bg-sidebar h-screen flex flex-col shadow-sm z-10 relative">
      <div className="p-4 border-b border-border/50 flex items-center justify-between bg-sidebar/80 backdrop-blur">
        <h2 className="font-display font-bold text-lg text-foreground flex items-center gap-2">
          <div className="bg-primary/10 p-1.5 rounded-lg text-primary">
            <SynapticaLogo size={20} />
          </div>
          Synaptica
        </h2>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={handleCreate} disabled={isCreating} className="hover:bg-primary/10 hover:text-primary">
              <Plus className="w-5 h-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Create new map</TooltipContent>
        </Tooltip>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))
        ) : maps?.length === 0 ? (
          <div className="text-center p-6 text-muted-foreground flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <SynapticaLogo size={24} className="opacity-50" />
            </div>
            <p className="text-sm">No maps yet</p>
          </div>
        ) : (
          maps?.map((map) => {
            const isActive = location === `/m/${map.id}`;
            const isEditing = editingId === map.id;

            return (
              <div 
                key={map.id}
                className={cn(
                  "group relative rounded-xl transition-all duration-200 cursor-pointer overflow-hidden",
                  isActive 
                    ? "bg-white shadow-sm border border-border/50" 
                    : "hover:bg-black/5 border border-transparent"
                )}
                onClick={() => !isEditing && setLocation(`/m/${map.id}`)}
              >
                <div className="p-3">
                  {isEditing ? (
                    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                      <Input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="h-8 text-sm"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRename(map.id);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                      />
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600" onClick={() => handleRename(map.id)}>
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setEditingId(null)}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex justify-between items-start">
                      <div className="flex-1 pr-6">
                        <h3 className={cn("font-medium text-sm truncate", isActive ? "text-primary" : "text-foreground")}>
                          {map.title}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1 font-medium">
                          {format(new Date(map.updatedAt), "MMM d, yyyy")}
                        </p>
                      </div>
                      
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 flex items-center gap-1 bg-gradient-to-l from-white via-white to-transparent pl-4 py-2">
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditTitle(map.title);
                            setEditingId(map.id);
                          }}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          onClick={(e) => handleDelete(map.id, e)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
                {isActive && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r-full" />
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
