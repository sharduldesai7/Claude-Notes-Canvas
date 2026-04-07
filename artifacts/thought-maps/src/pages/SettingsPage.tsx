import { useEffect, useState } from "react";
import { useLocation, Redirect } from "wouter";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { useUser, useClerk, Show } from "@clerk/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function SettingsPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useUser();
  const { signOut } = useClerk();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [model, setModel] = useState("claude-sonnet-4-6");
  const [customKey, setCustomKey] = useState("");
  const [customUrl, setCustomUrl] = useState("");

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch("/api/user/settings");
        if (res.ok) {
          const data = await res.json();
          setModel(data.preferredModel || "claude-sonnet-4-6");
          setCustomKey(data.customApiKey || "");
          setCustomUrl(data.customBaseUrl || "");
        }
      } catch (error) {
        console.error("Failed to load settings", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload = {
        preferredModel: model,
        ...(model === "custom" ? {
          customApiKey: customKey,
          customBaseUrl: customUrl
        } : {
          customApiKey: "",
          customBaseUrl: ""
        })
      };

      const res = await fetch("/api/user/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error("Failed to save");

      toast({
        title: "Settings saved",
        description: "Your preferences have been updated successfully.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save settings.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <Show when="signed-out">
        <Redirect to="/" />
      </Show>
      <Show when="signed-in">
        <div className="min-h-screen bg-background p-6">
          <div className="max-w-2xl mx-auto space-y-8">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => setLocation("/m")}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <h1 className="text-2xl font-display font-bold">Settings</h1>
            </div>

            {/* Profile Section */}
            <Card>
              <CardHeader>
                <CardTitle>Profile</CardTitle>
                <CardDescription>Manage your Synaptica account.</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Avatar className="w-16 h-16">
                    <AvatarImage src={user?.imageUrl} />
                    <AvatarFallback className="text-xl">{user?.firstName?.[0] || user?.emailAddresses[0]?.emailAddress?.[0]}</AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-semibold text-lg">{user?.fullName || "Synaptica User"}</h3>
                    <p className="text-muted-foreground">{user?.emailAddresses[0]?.emailAddress}</p>
                  </div>
                </div>
                <Button variant="outline" onClick={() => signOut()}>Sign Out</Button>
              </CardContent>
            </Card>

            {/* AI Model Section */}
            <Card>
              <CardHeader>
                <CardTitle>AI Model Configuration</CardTitle>
                <CardDescription>
                  Choose which AI model powers your /claude commands. Default uses Replit's free Claude access.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <RadioGroup value={model} onValueChange={setModel} className="space-y-3">
                  <div className="flex items-center space-x-3 space-y-0">
                    <RadioGroupItem value="claude-sonnet-4-6" id="sonnet" />
                    <Label htmlFor="sonnet" className="font-normal">Claude Sonnet 4.6 (Free — default)</Label>
                  </div>
                  <div className="flex items-center space-x-3 space-y-0">
                    <RadioGroupItem value="claude-opus-4-6" id="opus" />
                    <Label htmlFor="opus" className="font-normal">Claude Opus 4.6</Label>
                  </div>
                  <div className="flex items-center space-x-3 space-y-0">
                    <RadioGroupItem value="claude-haiku-4-5" id="haiku" />
                    <Label htmlFor="haiku" className="font-normal">Claude Haiku 4.5 (Fast)</Label>
                  </div>
                  <div className="flex items-center space-x-3 space-y-0">
                    <RadioGroupItem value="custom" id="custom" />
                    <Label htmlFor="custom" className="font-normal">Custom (use my own API key)</Label>
                  </div>
                </RadioGroup>

                {model === "custom" && (
                  <div className="space-y-4 pl-7 border-l-2 border-border/50 ml-2 mt-4 pt-2">
                    <div className="space-y-2">
                      <Label htmlFor="api-key">API Key</Label>
                      <Input 
                        id="api-key" 
                        type="password" 
                        placeholder="sk-ant-..." 
                        value={customKey}
                        onChange={(e) => setCustomKey(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="base-url">Base URL (optional)</Label>
                      <Input 
                        id="base-url" 
                        type="text" 
                        placeholder="https://api.anthropic.com" 
                        value={customUrl}
                        onChange={(e) => setCustomUrl(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
              <CardFooter className="border-t border-border/50 px-6 py-4">
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Settings
                </Button>
              </CardFooter>
            </Card>

          </div>
        </div>
      </Show>
    </>
  );
}
