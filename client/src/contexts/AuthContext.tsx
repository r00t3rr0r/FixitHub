import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { login as apiLogin, register as apiRegister, getCurrentUser, logout as apiLogout } from "../api/auth";
import { mergeGuestCartWithUserCart } from "../utils/guestCart";
import { addToCart, addRepairOrderToCart } from "../api/shop";

type User = {
  _id?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  role?: string;
};

type AuthContextType = {
  isAuthenticated: boolean;
  user: User | null;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  register: (email: string, password: string, firstName?: string, lastName?: string, phone?: string) => Promise<void>;
  logout: () => void;
  isHydrated: boolean;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return !!localStorage.getItem("accessToken");
  });

  const [user, setUser] = useState<User | null>(() => {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      try {
        return JSON.parse(userStr);
      } catch (error) {
        console.error('AuthContext: Error parsing stored user:', error);
        return null;
      }
    }
    return null;
  });

  const [isHydrated, setIsHydrated] = useState(false);

  const login = async (email: string, password: string, rememberMe = false) => {
    try {
      const response = await apiLogin(email, password, rememberMe);
      if (response?._id) {
        localStorage.setItem("accessToken", "cookie-authenticated");

        // Extract user information from response
        const userData: User = {
          _id: response._id,
          email: response.email,
          firstName: response.firstName,
          lastName: response.lastName,
          role: response.role,
        };
        localStorage.setItem("user", JSON.stringify(userData));
        setUser(userData);
        setIsAuthenticated(true);

        console.log('AuthContext: Login successful for user:', response.email, 'with role:', response.role);

        // Merge guest cart with user cart after successful login
        console.log('AuthContext: Login successful, merging guest cart with user cart...');
        try {
          await mergeGuestCartWithUserCart({
            addToCart,
            addRepairOrderToCart
          });
          console.log('AuthContext: Guest cart merged successfully');
        } catch (mergeError) {
          console.error('AuthContext: Error merging guest cart:', mergeError);
          // Don't throw error - cart merge is not critical for login success
        }
      } else {
        throw new Error('Login failed');
      }
    } catch (error: any) {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("user");
      setUser(null);
      setIsAuthenticated(false);
      console.error('AuthContext: Login failed with error:', error);
      throw new Error(error?.message || 'Login failed');
    }
  };

  const register = async (email: string, password: string, firstName?: string, lastName?: string, phone?: string) => {
    try {
      const response = await apiRegister(email, password, firstName, lastName, phone);
      console.log('Registration successful:', response);
    } catch (error: any) {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("user");
      setUser(null);
      setIsAuthenticated(false);
      throw new Error(error?.message || 'Registration failed');
    }
  };

  const logout = () => {
    void (async () => {
      try {
        await apiLogout();
      } catch (error) {
        console.error('AuthContext: Logout request failed:', error);
      } finally {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("user");
        setUser(null);
        setIsAuthenticated(false);
        window.location.reload();
      }
    })();
  };

  // Initialize auth state on mount
  useEffect(() => {
    let isMounted = true;

    const hydrateAuth = async () => {
      try {
        const userData = await getCurrentUser();
        if (!isMounted) {
          return;
        }

        localStorage.setItem('accessToken', 'cookie-authenticated');
        localStorage.setItem('user', JSON.stringify(userData));
        setUser(userData);
        setIsAuthenticated(true);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        localStorage.removeItem('accessToken');
        localStorage.removeItem('user');
        setUser(null);
        setIsAuthenticated(false);
      } finally {
        if (isMounted) {
          setIsHydrated(true);
        }
      }
    };

    hydrateAuth();

    // Cross-tab logout: detect when another tab removes the access token
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "accessToken" && !e.newValue) {
        setUser(null);
        setIsAuthenticated(false);
      }
    };

    // Listen for auth logout events (e.g., from API interceptor)
    const handleAuthLogout = () => {
      console.log('AuthContext: Auth logout event received, clearing auth state');
      setIsAuthenticated(false);
      setUser(null);
      localStorage.removeItem('accessToken');
      localStorage.removeItem('user');
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener('auth-logout', handleAuthLogout);
    return () => {
      isMounted = false;
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener('auth-logout', handleAuthLogout);
    };
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, register, logout, isHydrated }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}