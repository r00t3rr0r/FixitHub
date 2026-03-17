import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/useToast';
import { Eye, EyeOff, LogIn, X, Lock } from 'lucide-react';

interface LoginDialogProps {
  isOpen: boolean;
  onClose: () => void;
  anchorElement: HTMLElement | null;
  onLoginSuccess?: () => void;
}

export function LoginDialog({ isOpen, onClose, anchorElement, onLoginSuccess }: LoginDialogProps) {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, right: 0 });

  // Calculate position based on anchor element
  useEffect(() => {
    if (isOpen && anchorElement) {
      const rect = anchorElement.getBoundingClientRect();
      const newPosition = {
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right
      };
      setPosition(newPosition);
    }
  }, [isOpen, anchorElement]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dialogRef.current && 
        !dialogRef.current.contains(event.target as Node) &&
        anchorElement &&
        !anchorElement.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose, anchorElement]);

  if (!isOpen) {
    return null;
  }

  const dialogStyle: React.CSSProperties = {
    position: 'fixed',
    top: position.top > 0 ? `${position.top}px` : '60px',
    right: position.right > 0 ? `${position.right}px` : '20px',
    zIndex: 99999
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast({
        title: t('login.error', 'Error'),
        description: t('login.fillAllFields', 'Please fill in all fields'),
        variant: 'destructive'
      });
      return;
    }

    try {
      setIsLoading(true);
      await login(email, password);
      
      toast({
        title: t('login.success', 'Success'),
        description: t('login.loggedIn', 'You have been logged in successfully')
      });

      onClose();
      setEmail('');
      setPassword('');

      // If custom success handler provided, use it
      if (onLoginSuccess) {
        onLoginSuccess();
        return;
      }

      // Default behavior: Redirect based on role
      const userStr = localStorage.getItem('user');
      const userData = userStr ? JSON.parse(userStr) : null;

      if (userData?.role === 'admin') {
        navigate('/admin');
      } else if (userData?.role === 'staff') {
        navigate('/staff');
      } else {
        window.location.reload(); // Reload to update UI
      }
    } catch (error: any) {
      toast({
        title: t('login.error', 'Login Failed'),
        description: error.message || t('login.invalidCredentials', 'Invalid email or password'),
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div 
      ref={dialogRef}
      className="login-dialog login-dialog-dropdown"
      style={dialogStyle}
    >
      <button className="login-dialog-close" onClick={onClose} aria-label="Close">
        <X width={20} height={20} />
      </button>
        
        <div className="login-dialog-header">
          <div className="login-dialog-icon">
            <Lock width={32} height={32} />
          </div>
          <h2>{t('login.title', 'Anmelden')}</h2>
          <p>{t('login.subtitle', 'Melden Sie sich an, um fortzufahren')}</p>
        </div>

        <form onSubmit={handleLogin} className="login-dialog-form">
          <div className="form-group">
            <label htmlFor="dialog-email">{t('login.email', 'E-Mail')}</label>
            <input
              id="dialog-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('login.emailPlaceholder', 'ihre@email.de')}
              disabled={isLoading}
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="dialog-password">{t('login.password', 'Passwort')}</label>
            <div className="password-input-wrapper">
              <input
                id="dialog-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('login.passwordPlaceholder', '••••••••')}
                disabled={isLoading}
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff width={18} height={18} /> : <Eye width={18} height={18} />}
              </button>
            </div>
          </div>

          <div className="form-actions">
            <Link to="/forgot-password" className="forgot-password" onClick={onClose}>
              {t('login.forgotPassword', 'Passwort vergessen?')}
            </Link>
          </div>

          <button 
            type="submit" 
            className="btn-submit"
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="loading-spinner"></span>
            ) : (
              <>
                <LogIn width={18} height={18} />
                {t('login.loginButton', 'Anmelden')}
              </>
            )}
          </button>
        </form>

        <div className="login-dialog-footer">
          <span>{t('login.noAccount', 'Noch kein Konto?')}</span>
          <Link to="/register" onClick={onClose}>
            {t('login.register', 'Jetzt registrieren')}
          </Link>
        </div>
    </div>
  );
}
