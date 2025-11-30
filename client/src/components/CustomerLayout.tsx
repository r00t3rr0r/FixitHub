import { Outlet } from "react-router-dom";
import { CustomerNavbar } from "./CustomerNavbar";
import { Footer } from "./Footer";

export function CustomerLayout() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20 flex flex-col">
      {/* Navigation bar */}
      <CustomerNavbar />

      {/* Main content area with padding for navbar */}
      <main className="flex-1 overflow-y-auto pt-4 pb-16">
        <div className="container mx-auto px-4">
          <Outlet />
        </div>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
