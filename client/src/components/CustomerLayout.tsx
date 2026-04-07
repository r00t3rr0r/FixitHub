import { Outlet } from "react-router-dom";
import { useLocation } from "react-router-dom";
import { TopBar } from "./home/TopBar";
import { McRepairNav } from "./home/McRepairNav";
import { Footer } from "./Footer";

export function CustomerLayout() {
  const location = useLocation();
  const isOrderDetailsPage = /^\/orders\/[^/]+$/.test(location.pathname);
  const isMyComplaintsPage = location.pathname === "/my-complaints";

  return (
    <div className={`${isMyComplaintsPage ? "bg-white" : "bg-gradient-to-br from-background via-background to-secondary/20"} min-h-screen flex flex-col`}>
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
      <main className={`flex-1 overflow-y-auto ${isMyComplaintsPage ? "bg-white pt-0 pb-0" : "pt-6 pb-12"}`}>
        <div className={`${isMyComplaintsPage ? "w-full bg-white px-0" : isOrderDetailsPage ? "max-w-[1680px]" : "container"} mx-auto animate-slide-up ${isMyComplaintsPage ? "" : "px-4"}`}>
          <Outlet />
        </div>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
