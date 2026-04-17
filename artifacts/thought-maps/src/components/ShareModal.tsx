import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListMapShares,
  useCreateMapShare,
  useDeleteMapShare,
  getListMapSharesQueryKey,
} from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Copy, Link2, Trash2, Eye, Pencil, Check, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface ShareModalProps {
  mapId: number;
  mapTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShareModal({ mapId, mapTitle, open, onOpenChange }: ShareModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const { data: shares = [], isLoading } = useListMapShares(mapId, {
    query: { enabled: open },
  });

  const { mutate: createShare, isPending: isCreating } = useCreateMapShare({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListMapSharesQueryKey(mapId) });
      },
      onError: () => toast({ description: "Failed to create link", variant: "destructive" }),
    },
  });

  const { mutate: deleteShare, isPending: isDeleting } = useDeleteMapShare({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListMapSharesQueryKey(mapId) });
        toast({ description: "Link revoked" });
      },
      onError: () => toast({ description: "Failed to revoke link", variant: "destructive" }),
    },
  });

  const buildShareUrl = (token: string) => {
    const origin = window.location.origin;
    return `${origin}${basePath}/s/${token}`;
  };

  const handleCopy = async (share: { id: number; token: string }) => {
    const url = buildShareUrl(share.token);
    await navigator.clipboard.writeText(url);
    setCopiedId(share.id);
    toast({ description: "Link copied to clipboard" });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCreate = (permission: "read" | "edit") => {
    createShare(
      { mapId, data: { permission } },
      {
        onSuccess: () =>
          toast({ description: `${permission === "read" ? "View-only" : "Edit"} link created` }),
      }
    );
  };

  const handleRevoke = (shareId: number) => {
    deleteShare({ mapId, shareId });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="w-4 h-4" />
            Share "{mapTitle}"
          </DialogTitle>
          <DialogDescription>
            Anyone with a link must sign in to access this map.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-1">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-1.5 text-sm"
              onClick={() => handleCreate("read")}
              disabled={isCreating}
            >
              {isCreating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Eye className="w-3.5 h-3.5" />
              )}
              New view-only link
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-1.5 text-sm"
              onClick={() => handleCreate("edit")}
              disabled={isCreating}
            >
              {isCreating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Pencil className="w-3.5 h-3.5" />
              )}
              New edit link
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : shares.length > 0 ? (
            <>
              <Separator />
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {shares.map((share) => (
                  <div
                    key={share.id}
                    className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50 border border-border/50"
                  >
                    <Badge
                      variant={share.permission === "edit" ? "default" : "secondary"}
                      className="text-[10px] h-5 px-1.5 shrink-0 gap-0.5"
                    >
                      {share.permission === "edit" ? (
                        <>
                          <Pencil className="w-2.5 h-2.5" />
                          Edit
                        </>
                      ) : (
                        <>
                          <Eye className="w-2.5 h-2.5" />
                          View
                        </>
                      )}
                    </Badge>

                    <code className="flex-1 text-xs text-muted-foreground min-w-0 truncate font-mono">
                      {buildShareUrl(share.token)}
                    </code>

                    <div className="flex items-center gap-0.5 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                          "w-7 h-7",
                          copiedId === share.id
                            ? "text-green-600"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                        onClick={() => handleCopy(share)}
                        title="Copy link"
                      >
                        {copiedId === share.id ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-7 h-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleRevoke(share.id)}
                        disabled={isDeleting}
                        title="Revoke link"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No active share links. Create one above.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
