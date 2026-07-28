import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { LogIn } from "lucide-react";

export default function LoginPage() {
  const handleLogin = () => {
    window.location.href = getLoginUrl();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-sm w-full bg-card border border-border rounded-2xl p-8 flex flex-col items-center text-center shadow-sm">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-6">
          <LogIn className="w-8 h-8 text-primary" />
        </div>
        
        <h1 className="text-2xl font-bold mb-2">Welcome to BOSS OS</h1>
        <p className="text-muted-foreground mb-8">
          Please log in to access your dashboard, projects, and tasks.
        </p>
        
        <Button 
          size="lg" 
          className="w-full font-semibold rounded-xl"
          onClick={handleLogin}
        >
          Log In to Continue
        </Button>
      </div>
    </div>
  );
}
