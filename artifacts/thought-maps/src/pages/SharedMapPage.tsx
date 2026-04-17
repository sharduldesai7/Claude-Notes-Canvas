import { useParams, Redirect, useLocation } from "wouter";
import { useGetSharedMap, useGetThoughtMap } from "@workspace/api-client-react";
import { useAuth } from "@clerk/react";
import { ShareProvider, useShareContext } from "@/contexts/ShareContext";
import { Canvas } from "@/components/Canvas";
import { Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRealtimeSync } from "@/hooks/use-realtime-sync";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface SharedMapCanvasProps {
  mapId: number;
  mapTitle: string;
  permission: "read" | "edit";
}

function SharedMapCanvas({ mapId, mapTitle, permission }: SharedMapCanvasProps) {
  const { shareToken } = useShareContext();

  const { remoteCursors, sendCursorMove } = useRealtimeSync(mapId, shareToken);

  const { data: map, isLoading } = useGetThoughtMap(mapId, {
    query: { enabled: !!mapId },
  });

  if (isLoading || !map) {
    return (
      <div className="h-screen w-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-primary">
          <Loader2 className="w-8 h-8 animate-spin" />
          <p className="text-sm font-medium">Loading shared map...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      <main className="flex-1 relative flex flex-col h-full bg-background min-w-0">
        <div className="absolute top-3 left-3 z-50 flex items-center gap-2 bg-background/90 backdrop-blur-sm border border-border/60 rounded-full px-3 py-1.5 shadow-sm">
          <span className="text-xs font-medium text-muted-foreground truncate max-w-[160px]">
            {mapTitle}
          </span>
          <span className="text-xs px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium capitalize">
            {permission === "edit" ? "Can edit" : "View only"}
          </span>
        </div>
        <Canvas
          map={map}
          readOnly={permission === "read"}
          remoteCursors={remoteCursors}
          sendCursorMove={sendCursorMove}
        />
      </main>
    </div>
  );
}

export function SharedMapPage() {
  const { token } = useParams<{ token: string }>();
  const { isLoaded, isSignedIn } = useAuth();
  const [, setLocation] = useLocation();

  const { data, isLoading, error } = useGetSharedMap(token!, {
    query: { enabled: isLoaded && isSignedIn && !!token },
  });

  if (!isLoaded) {
    return (
      <div className="h-screen w-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isSignedIn) {
    const returnUrl = `${basePath}/s/${token}`;
    return (
      <Redirect to={`/sign-in?redirect_url=${encodeURIComponent(returnUrl)}`} />
    );
  }

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-primary">
          <Loader2 className="w-8 h-8 animate-spin" />
          <p className="text-sm font-medium">Loading shared map...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center text-center p-8 bg-dot-grid">
        <div className="max-w-sm space-y-4">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
            <Lock className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold">Link not found</h1>
          <p className="text-muted-foreground">
            This share link may have been revoked or does not exist.
          </p>
          <Button onClick={() => setLocation("/m")}>Go to my maps</Button>
        </div>
      </div>
    );
  }

  const { map, permission } = data;

  return (
    <ShareProvider token={token!} permission={permission as "read" | "edit"}>
      <SharedMapCanvas
        mapId={map.id}
        mapTitle={map.title}
        permission={permission as "read" | "edit"}
      />
    </ShareProvider>
  );
}
