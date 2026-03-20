
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

function getRoleHome(role?: string): string {
  switch (role) {
    case 'admin': return '/admin';
    case 'staff': return '/staff';
    default: return '/';
  }
}

export function ProtectedRoute({ children, requiredRole }: { children: React.ReactNode; requiredRole?: string | string[] }) {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredRole) {
    const allowedRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    if (!user?.role || !allowedRoles.includes(user.role)) {
      return <Navigate to={getRoleHome(user?.role)} replace />;
    }
  }

  return <>{children}</>;
}
