import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import appLoader from "@/assets/app-loader.lottie";

type AppLoadingScreenProps = {
  message?: string;
};

export const AppLoadingScreen = ({ message = "Loading..." }: AppLoadingScreenProps) => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="flex flex-col items-center gap-4">
      <DotLottieReact
        src={appLoader}
        loop
        autoplay
        style={{ width: 220, height: 220 }}
      />
      <p className="mt-2 text-muted-foreground">{message}</p>
    </div>
  </div>
);
