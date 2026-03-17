import { Outlet } from "react-router-dom";
import { TopBar } from "./home/TopBar";
import { McRepairNav } from "./home/McRepairNav";
import { Footer } from "./Footer";

export function CustomerLayout() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20 flex flex-col">
      <style>{`
        @keyframes fadeInDown {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fade-in-down {
          animation: fadeInDown 0.6s ease-out;
        }

        .animate-slide-up {
          animation: slideUp 0.8s ease-out 0.2s both;
        }

        /* Footer styling - positioned at the bottom */
        footer {
          position: relative;
          margin-top: auto;
        }
      `}</style>

      {/* Navigation bar with fade-in animation */}
      <div className="animate-fade-in-down">
        <TopBar />
        <McRepairNav />
      </div>

      {/* Main content area with padding for navbar and footer */}
      <main className="flex-1 overflow-y-auto pt-6 pb-12">
        <div className="container mx-auto px-4 animate-slide-up">
          <Outlet />
        </div>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
