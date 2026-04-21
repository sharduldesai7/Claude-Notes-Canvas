import { useEffect, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { useThoughtMaps, useCreateThoughtMap, useThoughtMap } from "@/hooks/use-thought-maps";
import { useGuestSession } from "@/hooks/use-guest-session";
import { GuestSessionBanner, GuestSessionExpiredBanner } from "@/components/GuestSessionBanner";
import { MapSidebar } from "@/components/MapSidebar";
import { Canvas } from "@/components/Canvas";
import { OnboardingModal, useGuestOnboarding } from "@/components/OnboardingModal";
import { useRealtimeSync } from "@/hooks/use-realtime-sync";
import { AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function GuestMapPage() {
  const { mapId } = useParams<{ mapId?: string }>();
  const [, setLocation] = useLocation();
  const { isGuest, isExpired, session, clearSession } = useGuestSession();
  const { data: maps, isLoading: isMapsLoading } = useThoughtMaps();
  const { mutate: createMap, isPending: isCreating } = useCreateThoughtMap();
  const hasCreatedMap = useRef(false);
  const { toast } = useToast();
  const { open: showOnboarding, dismiss: dismissOnboarding } = useGuestOnboarding();

  // Redirect to landing if no session at all (not guest, not expired)
  useEffect(() => {
    if (!isGuest && !isExpired) {
      setLocation("/");
    }
  }, [isGuest, isExpired, setLocation]);

  // Clean up on tab close via sendBeacon (the only reliable unload mechanism)
  useEffect(() => {
    if (!session) return;
    const token = session.token;
    const handleBeforeUnload = () => {
      navigator.sendBeacon(
        `${import.meta.env.BASE_URL}api/guest-sessions/${token}/cleanup`,
        new Blob([], { type: "application/json" })
      );
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [session]);

  // Auto-select or auto-create first map
  useEffect(() => {
    if (!isMapsLoading && maps && !mapId && !hasCreatedMap.current) {
      if (maps.length > 0) {
        setLocation(`/guest-map/${maps[0].id}`, { replace: true });
      } else {
        hasCreatedMap.current = true;
        createMap(
          { data: { title: "My First Synaptica Map" } },
          {
            onSuccess: (data) => setLocation(`/guest-map/${data.id}`, { replace: true }),
            onError: (err: any) => {
              const msg = err?.message ?? "";
              if (msg.includes("limited to")) {
                toast({
                  title: "Map limit reached",
                  description: "Guest sessions can have at most 2 maps. Sign up to create unlimited maps.",
                  variant: "destructive",
                });
              }
            },
          }
        );
      }
    }
  }, [isMapsLoading, maps, mapId, createMap, setLocation, toast]);

  const { data: map, isLoading: isMapLoading } = useThoughtMap(mapId ? parseInt(mapId) : null);
  const { remoteCursors, sendCursorMove } = useRealtimeSync(mapId ? parseInt(mapId) : null);

  const handleSignUp = () => {
    clearSession();
    setLocation("/sign-up");
  };

  const handleSignIn = () => {
    clearSession();
    setLocation("/sign-in");
  };

  // Don't render anything while waiting for session state to settle
  if (!isGuest && !isExpired) return null;

  return (
    <>
      <div className="flex h-screen w-full bg-background overflow-hidden selection:bg-primary/20">
        {/* Sidebar — guest-aware variant */}
        <MapSidebar isGuest onSignUp={handleSignUp} onSignIn={handleSignIn} />

        {/* Main content */}
        <main className="flex-1 flex flex-col h-full bg-background min-w-0 overflow-hidden">
          {/* Guest timer banner */}
          {isExpired ? (
            <GuestSessionExpiredBanner onSignUp={handleSignUp} onSignIn={handleSignIn} />
          ) : session ? (
            <GuestSessionBanner session={session} onSignUp={handleSignUp} onSignIn={handleSignIn} />
          ) : null}

          {/* Canvas area */}
          <div className="flex-1 relative overflow-hidden">
            {isMapsLoading || isCreating || (mapId && isMapLoading) ? (
              <div className="h-full flex items-center justify-center">
                <div className="flex flex-col items-center gap-4 text-primary">
                  <Loader2 className="w-8 h-8 animate-spin" />
                  <p className="text-sm font-medium">Setting up your canvas…</p>
                </div>
              </div>
            ) : map ? (
              <Canvas map={map} remoteCursors={remoteCursors} sendCursorMove={sendCursorMove} />
            ) : null}
          </div>
        </main>
      </div>

      {/* Onboarding — shown once per guest session */}
      <AnimatePresence>
        {showOnboarding && !isExpired && (
          <OnboardingModal onDismiss={dismissOnboarding} />
        )}
      </AnimatePresence>
    </>
  );
}
