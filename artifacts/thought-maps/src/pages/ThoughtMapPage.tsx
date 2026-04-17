import { useParams, Redirect } from "wouter";
import { useEffect } from "react";
import { useThoughtMap, useThoughtMaps, useCreateThoughtMap } from "@/hooks/use-thought-maps";
import { MapSidebar } from "@/components/MapSidebar";
import { Canvas } from "@/components/Canvas";
import { OnboardingModal, useOnboarding } from "@/components/OnboardingModal";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Show } from "@clerk/react";
import { AnimatePresence } from "framer-motion";
import { useRealtimeSync } from "@/hooks/use-realtime-sync";

export function ThoughtMapPage() {
  const { mapId } = useParams();
  const [, setLocation] = useLocation();
  const { data: maps, isLoading: isMapsLoading } = useThoughtMaps();
  const { mutate: createMap } = useCreateThoughtMap();
  const { open: showOnboarding, dismiss: dismissOnboarding } = useOnboarding();

  useEffect(() => {
    if (!isMapsLoading && maps) {
      if (!mapId) {
        if (maps.length > 0) {
          setLocation(`/m/${maps[0].id}`);
        }
      }
    }
  }, [mapId, maps, isMapsLoading, setLocation]);

  const { data: map, isLoading: isMapLoading, error } = useThoughtMap(mapId ? parseInt(mapId) : null);

  useRealtimeSync(mapId ? parseInt(mapId) : null);

  const handleCreateDefault = () => {
    createMap({ data: { title: "My First Synaptica Map" } }, {
      onSuccess: (data) => setLocation(`/m/${data.id}`)
    });
  };

  return (
    <>
      <Show when="signed-out">
        <Redirect to="/" />
      </Show>
      <Show when="signed-in">
        <div className="flex h-screen w-full bg-background overflow-hidden selection:bg-primary/20">
          <MapSidebar />

          <main className="flex-1 relative flex flex-col h-full bg-background min-w-0">
            {isMapsLoading || (mapId && isMapLoading) ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4 text-primary">
                  <Loader2 className="w-8 h-8 animate-spin" />
                  <p className="text-sm font-medium">Loading map...</p>
                </div>
              </div>
            ) : error ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                <h2 className="text-2xl font-bold text-destructive mb-2">Error loading map</h2>
                <p className="text-muted-foreground">The map could not be found or you don't have access.</p>
                <Button variant="outline" className="mt-4" onClick={() => setLocation("/m")}>Go Home</Button>
              </div>
            ) : !mapId && maps?.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-dot-grid">
                <div className="max-w-md space-y-6">
                  <img
                    src={`${import.meta.env.BASE_URL}images/empty-state.png`}
                    alt="Empty notebook and floating shapes"
                    className="w-48 h-48 mx-auto opacity-90 drop-shadow-xl"
                  />
                  <div className="space-y-2">
                    <h1 className="text-3xl font-display font-bold text-foreground">Think Freely</h1>
                    <p className="text-muted-foreground text-lg">
                      Create visual notes, connect ideas, and collaborate with Claude AI on an infinite canvas.
                    </p>
                  </div>
                  <Button size="lg" className="h-14 px-8 text-base shadow-xl rounded-full" onClick={handleCreateDefault}>
                    Create Your First Map
                  </Button>
                </div>
              </div>
            ) : map ? (
              <Canvas map={map} />
            ) : null}
          </main>
        </div>

        {/* Onboarding overlay — shown once for new users */}
        <AnimatePresence>
          {showOnboarding && (
            <OnboardingModal onDismiss={dismissOnboarding} />
          )}
        </AnimatePresence>
      </Show>
    </>
  );
}
