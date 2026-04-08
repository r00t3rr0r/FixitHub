import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { getUserProfile, UserProfile } from '@/api/user';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  User,
  Calendar,
  FileText,
  MessageSquare,
  Bell,
  LogOut,
  Wrench,
  AlertTriangle
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function ProfileDropdown() {
  const { isAuthenticated, logout } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const fetchUserProfile = async () => {
      try {
        setIsLoading(true);
        console.log('ProfileDropdown: Fetching user profile...');
        const response = await getUserProfile();
        const profile = (response as any).user;

        if (profile) {
          setUserProfile(profile);
          console.log('ProfileDropdown: User profile loaded successfully');
        }
      } catch (error) {
        console.error('ProfileDropdown: Error fetching user profile:', error);
        // Silently fail - don't show error to user
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserProfile();
  }, [isAuthenticated]);

  if (!isAuthenticated || isLoading) {
    return null;
  }

  const handleLogout = () => {
    console.log('ProfileDropdown: Logging out...');
    logout();
    navigate('/');
  };

  // Get user initials for avatar fallback
  const getInitials = () => {
    if (userProfile?.firstName && userProfile?.lastName) {
      return `${userProfile.firstName.charAt(0)}${userProfile.lastName.charAt(0)}`.toUpperCase();
    }
    if (userProfile?.firstName) {
      return userProfile.firstName.charAt(0).toUpperCase();
    }
    if (userProfile?.email) {
      return userProfile.email.charAt(0).toUpperCase();
    }
    return 'U';
  };

  const userName = userProfile?.firstName && userProfile?.lastName
    ? `${userProfile.firstName} ${userProfile.lastName}`
    : userProfile?.firstName || userProfile?.email || 'User';

  const itemClassName = 'cursor-pointer justify-start rounded-[10px] border border-white/10 bg-white/[0.03] px-3 py-2 text-left text-[13px] text-white/95 transition-colors hover:border-yellow-300/30 hover:bg-yellow-400/10';
  const linkClassName = 'flex w-full items-center justify-start gap-2 text-left';

  return (
    <>
      <style>{`
        @keyframes slideDownFadeIn {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-slide-down {
          animation: slideDownFadeIn 0.2s ease-out;
        }
      `}</style>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="relative group h-10 w-10 rounded-full"
            title={t('header.profileMenu')}
          >
            <Avatar className="h-9 w-9 group-hover:ring-2 group-hover:ring-yellow-400 group-hover:ring-offset-2 transition-all duration-200">
              {userProfile?.avatar && (
                <AvatarImage
                  src={userProfile.avatar}
                  alt={userName}
                  className="object-cover"
                />
              )}
              <AvatarFallback className="bg-yellow-400 text-gray-900 font-bold">
                {getInitials()}
              </AvatarFallback>
            </Avatar>

            {/* Subtle hover effect ring */}
            <div className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 ring-2 ring-yellow-400 ring-offset-2" />

            <span className="sr-only">Profile Menu</span>
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          className="w-72 animate-slide-down rounded-xl border border-white/15 bg-gradient-to-b from-[#1a2a5e] to-[#152553] p-2 text-left text-white shadow-2xl"
        >
          {/* User Info Section */}
          <DropdownMenuLabel className="mb-1 rounded-lg border border-yellow-300/25 bg-gradient-to-b from-yellow-400/15 to-white/[0.04] px-3 py-2">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-yellow-100/80">
              {t('navigation.accountArea', 'Mein Bereich')}
            </div>
            <p className="font-semibold text-sm text-white">{userName}</p>
            <p className="truncate text-xs text-white/70">{userProfile?.email}</p>
          </DropdownMenuLabel>

          <div className="px-3 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-white/45">
            {t('navigation.quickAccess', 'Schnellzugriff')}
          </div>

          {/* Navigation Items */}
          <DropdownMenuItem asChild className={itemClassName}>
            <Link to="/bookings" className={linkClassName}>
              <Calendar className="h-4 w-4" />
              <span>{t('navigation.bookings')}</span>
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem asChild className={itemClassName}>
            <Link to="/my-repair-requests" className={linkClassName}>
              <Wrench className="h-4 w-4" />
              <span>Repair Requests</span>
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem asChild className={itemClassName}>
            <Link to="/my-complaints" className={linkClassName}>
              <AlertTriangle className="h-4 w-4" />
              <span>Reklamationen</span>
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem asChild className={itemClassName}>
            <Link to="/invoices" className={linkClassName}>
              <FileText className="h-4 w-4" />
              <span>{t('navigation.invoices')}</span>
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem asChild className={itemClassName}>
            <Link to="/notifications" className={linkClassName}>
              <Bell className="h-4 w-4" />
              <span>{t('navigation.notifications', 'Benachrichtigungen')}</span>
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem asChild className={itemClassName}>
            <Link to="/messages" className={linkClassName}>
              <MessageSquare className="h-4 w-4" />
              <span>{t('navigation.messages', 'Nachrichten')}</span>
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem asChild className={itemClassName}>
            <Link to="/profile" className={linkClassName}>
              <User className="h-4 w-4" />
              <span>{t('navigation.profile')}</span>
            </Link>
          </DropdownMenuItem>

          <DropdownMenuSeparator className="my-1 bg-white/10" />

          {/* Logout Item */}
          <DropdownMenuItem
            onClick={handleLogout}
            className="cursor-pointer justify-start rounded-[10px] border border-red-300/20 bg-red-400/10 px-3 py-2 text-left text-[13px] text-red-100 transition-colors hover:bg-red-500/20 hover:text-white"
          >
            <LogOut className="h-4 w-4 mr-2" />
            <span>{t('navigation.logout')}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
