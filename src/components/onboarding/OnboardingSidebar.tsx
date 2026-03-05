import React, { useState, useRef, useEffect } from 'react';
import { Box, Typography, Button, Avatar } from '@mui/material';
import { auth } from '../../services/firebase';
import { useUserAvatar } from '../../context/UserAvatarContext';
import { getAuth, signOut } from 'firebase/auth';
import CheckIcon from '@mui/icons-material/Check';

interface OnboardingSidebarProps {
  currentStep: number;
  totalSteps: number;
  onFaqClick?: () => void;
}

const stepLabels = [
  'Welcome',
  'Add Property',
  'Purchase Price',
  'Mortgage Information',
  'Property Inventory',
];

const OnboardingSidebar: React.FC<OnboardingSidebarProps> = ({ currentStep, totalSteps, onFaqClick }) => {
  const { avatarUrl } = useUserAvatar();
  const [emailDropdownOpen, setEmailDropdownOpen] = useState(false);
  const userEmail = auth.currentUser?.email || '';
  const emailMenuRef = useRef<HTMLDivElement>(null);
  const emailButtonRef = useRef<HTMLDivElement>(null);

  const handleSignOut = async () => {
    const authInstance = getAuth();
    await signOut(authInstance);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const isInMenu = emailMenuRef.current && emailMenuRef.current.contains(target);
      const isInButton = emailButtonRef.current && emailButtonRef.current.contains(target);
      if (!isInMenu && !isInButton) {
        setEmailDropdownOpen(false);
      }
    };
    if (emailDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [emailDropdownOpen]);

  return (
    <Box
      sx={{
        width: '30vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        fontFamily: 'Nunito, Arial, sans-serif',
        overflow: 'hidden',
      }}
    >
      {/* Top Section (Steps) */}
      <Box
        sx={{
          flex: '1 1 auto',
          backgroundColor: '#3a4755',
          padding: '20vh 0px 0px 5vw',
          display: 'flex',
          flexDirection: 'column',
          color: 'white',
          borderRight: '1px solid rgba(255, 255, 255, 0.1)',
          minHeight: 0,
        }}
      >
        {/* Progress Steps */}
        <Box sx={{ marginBottom: 'auto' }}>
          {stepLabels.map((label, index) => {
            const stepNumber = index + 1;
            const isCompleted = stepNumber < currentStep;
            const isActive = stepNumber === currentStep;

            return (
              <React.Fragment key={stepNumber}>
                {/* Step */}
                <Box sx={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
                  <Box
                    sx={{
                      width: '35px',
                      height: '35px',
                      backgroundColor:
                        isCompleted || isActive
                          ? '#89AE99'
                          : 'rgba(255, 255, 255, 0.25)',
                      borderRadius: '50%',
                      marginRight: '30px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.3s ease',
                      border:
                        isActive && !isCompleted
                          ? '2px solid rgba(255, 255, 255, 0.5)'
                          : 'none',
                      position: 'relative',
                    }}
                  >
                    {isCompleted && (
                      <CheckIcon
                        sx={{
                          fontSize: '20px',
                          color: 'white',
                        }}
                      />
                    )}
                    {isActive && !isCompleted && (
                      <Box
                        sx={{
                          width: '6px',
                          height: '6px',
                          backgroundColor: 'white',
                          borderRadius: '50%',
                        }}
                      />
                    )}
                  </Box>
                  <Typography
                    sx={{
                      fontSize: '26px',
                      fontWeight: isActive ? 600 : 500,
                      color:
                        isCompleted || isActive
                          ? 'white'
                          : 'rgba(255, 255, 255, 0.65)',
                      transition: 'all 0.3s ease',
                      fontFamily: 'Nunito, Arial, sans-serif',
                    }}
                  >
                    {label}
                  </Typography>
                </Box>

                {/* Connecting Line */}
                {stepNumber < totalSteps && (
                  <Box
                    sx={{
                      width: '2px',
                      height: '24px',
                      backgroundColor: isCompleted
                        ? '#89AE99'
                        : 'rgba(255, 255, 255, 0.15)',
                      marginLeft: '14px',
                      marginBottom: '24px',
                      transition: 'all 0.3s ease',
                    }}
                  />
                )}
              </React.Fragment>
            );
          })}
        </Box>
      </Box>

      {/* Bottom Section (Email Bar + FAQ Button) */}
      <Box
        sx={{
          backgroundColor: '#2f3945',
          padding: '24px 32px',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
          height: '80px',
        }}
      >
        {/* Email Bar with Popup */}
        <Box sx={{ position: 'relative', maxWidth: 250 }}>
          <Box
            ref={emailButtonRef}
            sx={{
              display: 'flex',
              alignItems: 'center',
              bgcolor: '#fafaf7',
              borderRadius: '6px',
              p: '0.5rem 0.75rem',
              height: 36,
              boxShadow: 'none',
              border: '1px solid #F0F0ED',
              cursor: 'pointer',
            }}
            onClick={() => setEmailDropdownOpen(!emailDropdownOpen)}
          >
            <Avatar
              src={avatarUrl || auth.currentUser?.photoURL || "/avatar.png"}
              alt={auth.currentUser?.displayName || userEmail || "User"}
              sx={{ width: 24, height: 24, mr: 1, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
            />
            <Typography
              sx={{
                fontSize: '0.9rem',
                fontWeight: 400,
                color: '#343748',
                fontFamily: 'Nunito, Arial, sans-serif',
                maxWidth: 160,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {userEmail.length > 20 ? userEmail.slice(0, 20) + '...' : userEmail}
            </Typography>
            <Box sx={{ display: 'flex', ml: 1, alignItems: 'center', height: 20 }}>
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4.10254 12.3076L9.84613 7.38454L15.5897 12.3076" stroke="#9CA3AF" strokeWidth="1.23077" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Box>
          </Box>

          {/* Sign Out Popup Menu */}
          <Box
            ref={emailMenuRef}
            sx={{
              position: 'absolute',
              left: 0,
              bottom: 'calc(100% + 8px)',
              width: '100%',
              height: 50,
              bgcolor: '#fff',
              borderRadius: '6px',
              boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
              border: '1px solid #E0E0E0',
              zIndex: 10,
              display: 'flex',
              alignItems: 'center',
              pointerEvents: emailDropdownOpen ? 'auto' : 'none',
              opacity: emailDropdownOpen ? 1 : 0,
              transform: emailDropdownOpen ? 'translateY(0)' : 'translateY(20px)',
              transition: 'opacity 0.35s cubic-bezier(.4,0,.2,1), transform 0.35s cubic-bezier(.4,0,.2,1)',
              boxSizing: 'border-box',
            }}
          >
            {/* Sign out item */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                borderRadius: '6px',
                cursor: 'pointer',
                px: 1.5,
                width: '100%',
                height: '100%',
                fontWeight: 400,
                transition: 'background 0.18s',
                '&:hover': {
                  background: '#F5F6F8',
                },
              }}
              onClick={handleSignOut}
            >
              <svg width="22" height="22" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M10.0107 4.92632V4.30432C10.0107 2.94766 8.91069 1.84766 7.55402 1.84766H4.30402C2.94802 1.84766 1.84802 2.94766 1.84802 4.30432V11.7243C1.84802 13.081 2.94802 14.181 4.30402 14.181H7.56069C8.91336 14.181 10.0107 13.0843 10.0107 11.7317V11.103" stroke="#C67D57" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M14.5397 8.01449H6.51233" stroke="#C67D57" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12.5875 6.0708L14.5395 8.01413L12.5875 9.95813" stroke="#C67D57" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 400, color: '#D97B53' }}>Sign out</Typography>
            </Box>
          </Box>
        </Box>

        <Button
          sx={{
            backgroundColor: 'white',
            color: '#4a5568',
            textTransform: 'none',
            borderRadius: '6px',
            padding: '4px 20px',
            height: 36,
            fontSize: '14px',
            fontWeight: 400,
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            fontFamily: 'Nunito, Arial, sans-serif',
            '&:hover': {
              backgroundColor: '#f8f9fa',
              boxShadow: '0 4px 8px rgba(0,0,0,0.15)',
            },
          }}
          onClick={onFaqClick}
        >
          FAQ's
        </Button>
      </Box>
    </Box>
  );
};

export default OnboardingSidebar;
