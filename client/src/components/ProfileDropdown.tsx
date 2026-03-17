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
  LogOut,
  Wrench
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

        <DropdownMenuContent align="end" className="w-56 animate-slide-down">
          {/* User Info Section */}
          <DropdownMenuLabel className="flex flex-col space-y-1 py-2">
            <p className="font-semibold text-sm">{userName}</p>
            <p className="text-xs text-muted-foreground truncate">{userProfile?.email}</p>
          </DropdownMenuLabel>

          <DropdownMenuSeparator />

          {/* Navigation Items */}
          <DropdownMenuItem asChild className="cursor-pointer transition-colors hover:bg-yellow-50">
            <Link to="/profile" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <span>{t('navigation.profile')}</span>
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem asChild className="cursor-pointer transition-colors hover:bg-yellow-50">
            <Link to="/bookings" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span>{t('navigation.bookings')}</span>
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem asChild className="cursor-pointer transition-colors hover:bg-yellow-50">
            <Link to="/invoices" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span>{t('navigation.invoices')}</span>
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem asChild className="cursor-pointer transition-colors hover:bg-yellow-50">
            <Link to="/my-repair-requests" className="flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              <span>Repair Requests</span>
            </Link>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Logout Item */}
          <DropdownMenuItem
            onClick={handleLogout}
            className="cursor-pointer transition-colors hover:bg-red-50 text-red-600 hover:text-red-700"
          >
            <LogOut className="h-4 w-4 mr-2" />
            <span>{t('navigation.logout')}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
