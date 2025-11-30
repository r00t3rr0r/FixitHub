import { Outlet } from "react-router-dom";
import { CustomerNavbar } from "./CustomerNavbar";
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

        /* Enhanced footer styling */
        footer {
          position: relative;
          margin-top: auto;
          border-top: 2px solid rgba(251, 191, 36, 0.1);
        }

        footer::before {
          content: '';
          position: absolute;
          top: -1px;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgb(251, 191, 36), transparent);
          opacity: 0.5;
        }
      `}</style>

      {/* Navigation bar with fade-in animation */}
      <div className="animate-fade-in-down">
        <CustomerNavbar />
      </div>

      {/* Main content area with padding for navbar and footer */}
      <main className="flex-1 overflow-y-auto pt-6 pb-24">
        <div className="container mx-auto px-4 animate-slide-up">
          <Outlet />
        </div>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
