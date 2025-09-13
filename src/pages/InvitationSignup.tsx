import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, ArrowLeft } from "lucide-react";
import newbornBg from "@/assets/newborn-bg.jpg";

export default function InvitationSignup() {
  const navigate = useNavigate();

  return (
    <div 
      className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{
        backgroundImage: `url(${newbornBg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      <div className="absolute inset-0 bg-white/40 dark:bg-black/40 backdrop-blur-sm"></div>
      <div className="absolute inset-0 bg-gradient-to-br from-pink-50/60 via-purple-50/40 to-blue-50/60 dark:from-pink-950/60 dark:via-purple-950/40 dark:to-blue-950/60"></div>
      
      <div className="relative z-10 w-full max-w-md mx-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-pink-600 via-purple-600 to-blue-600 bg-clip-text text-transparent font-serif">
            Lumiso
          </h1>
        </div>

        <Card className="backdrop-blur-md bg-white/80 dark:bg-slate-800/80 border-white/20 shadow-2xl">
          <CardHeader className="text-center">
            <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <CardTitle>Team Invitations Not Available</CardTitle>
            <CardDescription>
              This is a single photographer application. Team signup is not available.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              If you need a photography business account, please visit our signup page.
            </p>
            <Button 
              onClick={() => navigate("/auth")}
              className="w-full"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go to Sign Up
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}