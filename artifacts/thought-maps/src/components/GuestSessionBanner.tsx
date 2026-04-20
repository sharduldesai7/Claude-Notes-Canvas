import { useLocation } from "wouter";
import { Clock, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { GuestSession, formatCountdown } from "@/hooks/use-guest-session";

interface GuestSessionBannerProps {
  session: GuestSession;
  onSignUp: () => void;
  onSignIn: () => void;
  onDismiss?: () => void;
}

export function GuestSessionBanner({ session, onSignUp, onSignIn, onDismiss }: GuestSessionBannerProps) {
  const { secondsRemaining } = session;
  const isWarning = secondsRemaining <= 5 * 60 && secondsRemaining > 60;
  const isCritical = secondsRemaining <= 60;

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-2 text-sm font-medium transition-colors border-b shrink-0",
        isCritical
          ? "bg-red-50 border-red-200 text-red-800 dark:bg-red-950/40 dark:border-red-800 dark:text-red-300"
          : isWarning
          ? "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300"
          : "bg-slate-50 border-slate-200 text-slate-700 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300"
      )}
    >
      <Clock className="w-4 h-4 shrink-0" />
      <span>
        Guest session &mdash;{" "}
        <span className={cn("tabular-nums font-semibold", isCritical && "text-red-600 dark:text-red-400")}>
          {formatCountdown(secondsRemaining)}
        </span>{" "}
        remaining
      </span>

      <span className="text-current opacity-40 mx-1">·</span>

      <span className="opacity-70">Your work won't be saved when time runs out.</span>

      <div className="ml-auto flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          className={cn(
            "h-7 text-xs gap-1.5 border",
            isCritical
              ? "border-red-400 text-red-700 hover:bg-red-100 dark:border-red-600 dark:text-red-300 dark:hover:bg-red-900/40"
              : isWarning
              ? "border-amber-400 text-amber-700 hover:bg-amber-100 dark:border-amber-600 dark:text-amber-300 dark:hover:bg-amber-900/40"
              : "border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
          )}
          onClick={onSignIn}
        >
          Sign in
        </Button>
        <Button
          size="sm"
          className={cn(
            "h-7 text-xs gap-1.5",
            isCritical
              ? "bg-red-600 hover:bg-red-700 text-white"
              : isWarning
              ? "bg-amber-600 hover:bg-amber-700 text-white"
              : ""
          )}
          onClick={onSignUp}
        >
          <UserPlus className="w-3.5 h-3.5" />
          Save my work
        </Button>
      </div>
    </div>
  );
}

interface GuestSessionExpiredBannerProps {
  onSignUp: () => void;
  onSignIn: () => void;
}

export function GuestSessionExpiredBanner({ onSignUp, onSignIn }: GuestSessionExpiredBannerProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 text-sm font-medium bg-red-50 border-b border-red-200 text-red-800 dark:bg-red-950/40 dark:border-red-800 dark:text-red-300 shrink-0">
      <Clock className="w-4 h-4 shrink-0" />
      <span className="font-semibold">Guest session expired.</span>
      <span className="opacity-70">Sign up to save your maps and continue working.</span>
      <div className="ml-auto flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs border-red-400 text-red-700 hover:bg-red-100 dark:border-red-600 dark:text-red-300 dark:hover:bg-red-900/40"
          onClick={onSignIn}
        >
          Sign in
        </Button>
        <Button
          size="sm"
          className="h-7 text-xs gap-1.5 bg-red-600 hover:bg-red-700 text-white"
          onClick={onSignUp}
        >
          <UserPlus className="w-3.5 h-3.5" />
          Sign up free
        </Button>
      </div>
    </div>
  );
}
