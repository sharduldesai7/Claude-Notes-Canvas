import { createContext, useContext, useEffect, type ReactNode } from "react";
import { setShareToken } from "@workspace/api-client-react";

export interface ShareContextValue {
  isShared: boolean;
  shareToken: string | null;
  permission: "read" | "edit";
  isReadOnly: boolean;
}

const ShareContext = createContext<ShareContextValue>({
  isShared: false,
  shareToken: null,
  permission: "read",
  isReadOnly: false,
});

export function useShareContext() {
  return useContext(ShareContext);
}

interface ShareProviderProps {
  token: string;
  permission: "read" | "edit";
  children: ReactNode;
}

export function ShareProvider({ token, permission, children }: ShareProviderProps) {
  // Set immediately so children have the token on their very first render
  setShareToken(token);

  useEffect(() => {
    setShareToken(token);
    return () => {
      setShareToken(null);
    };
  }, [token]);

  return (
    <ShareContext.Provider
      value={{
        isShared: true,
        shareToken: token,
        permission,
        isReadOnly: permission === "read",
      }}
    >
      {children}
    </ShareContext.Provider>
  );
}
