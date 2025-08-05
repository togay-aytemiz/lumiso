import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import { useNavigate } from "react-router-dom";
import CrmDashboard from "@/components/CrmDashboard";
import { Button } from "@/components/ui/button";

const Index = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center relative overflow-hidden"
        style={{
          backgroundImage: `url(./src/assets/newborn-bg.jpg)`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      >
        {/* Soft overlay for better text readability */}
        <div className="absolute inset-0 bg-white/40 dark:bg-black/40 backdrop-blur-sm"></div>
        
        {/* Gradient overlay for extra softness */}
        <div className="absolute inset-0 bg-gradient-to-br from-pink-50/60 via-purple-50/40 to-blue-50/60 dark:from-pink-950/60 dark:via-purple-950/40 dark:to-blue-950/60"></div>
        
        <div className="relative z-10 text-center animate-fade-in">
          <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-pink-600 via-purple-600 to-blue-600 bg-clip-text text-transparent font-serif">
            Sweet Dreams CRM
          </h1>
          <p className="text-xl md:text-2xl text-slate-600 dark:text-slate-300 font-light mb-4">
            Where precious moments become lasting memories
          </p>
          <p className="text-lg text-slate-500 dark:text-slate-400 mb-12">
            Manage your newborn photography business with ease
          </p>
          <Button 
            onClick={() => navigate("/auth")} 
            size="lg"
            className="h-14 px-12 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-semibold text-lg rounded-xl shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105"
          >
            Get Started
          </Button>
        </div>
      </div>
    );
  }

  return <CrmDashboard />;
};

export default Index;
