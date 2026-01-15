import { createContext, useContext, useState, ReactNode } from "react";
import { login as apiLogin, register as apiRegister } from "../api/auth";
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
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, firstName?: string, lastName?: string, phone?: string) => Promise<void>;
  logout: () => void;
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

  const login = async (email: string, password: string) => {
    try {
      const response = await apiLogin(email, password);
      if (response?.refreshToken || response?.accessToken) {
        localStorage.setItem("refreshToken", response.refreshToken);
        localStorage.setItem("accessToken", response.accessToken);

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
    } catch (error) {
      localStorage.removeItem("refreshToken");
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
    } catch (error) {
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("accessToken");
      localStorage.removeItem("user");
      setUser(null);
      setIsAuthenticated(false);
      throw new Error(error?.message || 'Registration failed');
    }
  };

  const logout = () => {
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("accessToken");
    localStorage.removeItem("user");
    setUser(null);
    setIsAuthenticated(false);
    window.location.reload();
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, register, logout }}>
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