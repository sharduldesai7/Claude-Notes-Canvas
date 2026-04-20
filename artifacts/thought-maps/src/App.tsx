import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThoughtMapPage } from "@/pages/ThoughtMapPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { SharedMapPage } from "@/pages/SharedMapPage";
import { GuestMapPage } from "@/pages/GuestMapPage";
import NotFound from "@/pages/not-found";
import { ClerkProvider, SignIn, SignUp, useAuth, Show } from "@clerk/react";
import { queryClient } from "@/lib/queryClient";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useGuestSession } from "@/hooks/use-guest-session";

// The Clerk publishable key from environment
const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const PROXY_URL = import.meta.env.VITE_CLERK_PROXY_URL;

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing Publishable Key");
}

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

// Helper to strip the base path for wouter's setLocation
export const stripBase = (path: string) => {
  if (path.startsWith(basePath)) {
    return path.slice(basePath.length) || "/";
  }
  return path;
};

// Component to invalidate React Query cache when auth changes
function ClerkQueryClientCacheInvalidator() {
  const { userId } = useAuth();
  useEffect(() => {
    queryClient.invalidateQueries();
  }, [userId]);
  return null;
}

function HomeRedirect() {
  const { isLoaded, isSignedIn } = useAuth();
  const [, setLocation] = useLocation();
  const { isGuest, session, startGuestSession } = useGuestSession();
  const [isStartingGuest, setIsStartingGuest] = useState(false);

  if (!isLoaded) return <div className="h-screen w-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  if (isSignedIn) {
    return <Redirect to="/m" />;
  }

  if (isGuest && session) {
    return <Redirect to="/guest-map" />;
  }

  const handleGuestStart = async () => {
    setIsStartingGuest(true);
    try {
      await startGuestSession();
      setLocation("/guest-map");
    } catch {
      setIsStartingGuest(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-dot-grid h-screen w-screen">
      <div className="max-w-md space-y-6">
        <img 
          src={`${basePath}/images/empty-state.png`}
          alt="Empty notebook and floating shapes"
          className="w-48 h-48 mx-auto opacity-90 drop-shadow-xl"
        />
        <div className="space-y-2">
          <h1 className="text-3xl font-display font-bold text-foreground">Think Freely</h1>
          <p className="text-muted-foreground text-lg">
            Create visual notes, connect ideas, and collaborate with Claude AI on an infinite canvas.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <Button size="lg" className="h-14 px-8 text-base shadow-xl rounded-full" onClick={() => setLocation("/sign-up")}>
            Get Started
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="h-12 px-8 text-sm rounded-full border-dashed"
            disabled={isStartingGuest}
            onClick={handleGuestStart}
          >
            {isStartingGuest ? (
              <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Starting session…</>
            ) : (
              "Try without signing in"
            )}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Already have an account? <Button variant="link" className="p-0 h-auto" onClick={() => setLocation("/sign-in")}>Sign In</Button>
        </p>
      </div>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomeRedirect} />
      <Route path="/m" component={ThoughtMapPage} />
      <Route path="/m/:mapId" component={ThoughtMapPage} />
      <Route path="/guest-map" component={GuestMapPage} />
      <Route path="/guest-map/:mapId" component={GuestMapPage} />
      <Route path="/s/:token" component={SharedMapPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route path="/sign-in/*?">
        <div className="h-screen w-screen flex items-center justify-center bg-dot-grid">
          <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
        </div>
      </Route>
      <Route path="/sign-up/*?">
        <div className="h-screen w-screen flex items-center justify-center bg-dot-grid">
          <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
        </div>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ClerkProvider publishableKey={PUBLISHABLE_KEY} proxyUrl={PROXY_URL}>
      <ClerkQueryClientCacheInvalidator />
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delayDuration={300}>
          <WouterRouter base={basePath}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

export default App;
