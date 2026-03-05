import React, { useState } from 'react';
import { auth } from '../services/firebase';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { 
  Box, 
  Typography, 
  // TextField, 
  Button, 
  // Switch, 
  // FormControlLabel,
  Link,
  Paper
} from '@mui/material';
import { styled } from '@mui/material/styles';
// import AppleIcon from '@mui/icons-material/Apple';
import logoImage from "/All_Properly_logo-01.png";

const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: '1.5rem 2rem',
  borderRadius: '15.52px',
  maxWidth: '465.6px',
  width: '100%',
  backgroundColor: '#ffffff',
  boxShadow: '0px 4px 20px rgba(0, 0, 0, 0.08)',
  border: '2px solid #E5E7EB',
  maxHeight: 'none',
  overflow: 'visible',
  transform: 'scale(0.97)',
  transformOrigin: 'center',
  [theme.breakpoints.down('sm')]: {
    padding: '2rem 2rem',
    maxWidth: '92vw',
    borderRadius: '11.64px',
    border: '1.5px solid #E5E7EB',
  },
}));

const LogoContainer = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexDirection: 'column',
  marginBottom: '-2rem',
  padding: '0.097rem',
  gap: '0.7275rem',
});

const SignInTitle = styled(Typography)({
  fontSize: '1.6975rem',
  fontWeight: '400',
  color: '#111827',
  marginBottom: '0rem',
  textAlign: 'left',
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif',
});

const SocialButton = styled(Button)({
  width: '100%',
  padding: '0.84875rem 0.97rem',
  marginBottom: '0.84875rem',
  textTransform: 'none',
  fontSize: '1.067rem',
  fontWeight: '400',
  borderRadius: '11.64px',
  border: '1px solid #E5E7EB',
  backgroundColor: '#ffffff',
  color: '#374151',
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif',
  '&:hover': {
    backgroundColor: '#F9FAFB',
    borderColor: '#D1D5DB',
  },
  '&:disabled': {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
    color: '#9CA3AF',
  },
});

const GoogleButton = styled(SocialButton)({
  backgroundColor: '#FFFFFF',
  color: '#374151',
  border: '1px solid #D1D5DB',
  fontWeight: 400,
  '&:hover': {
    backgroundColor: '#F9FAFB',
    borderColor: '#D1D5DB',
    color: '#374151',
  },
  '&:disabled': {
    backgroundColor: '#F3F4F6',
    borderColor: '#D1D5DB',
    color: '#9CA3AF',
  },
  '& .MuiButton-startIcon': {
    marginRight: '0.7275rem',
  },
});

// const AppleButton = styled(SocialButton)({
//   backgroundColor: '#F3F4F6',
//   color: '#374151',
//   border: '1px solid #E5E7EB',
//   fontWeight: 400,
//   '&:hover': {
//     backgroundColor: '#E5E7EB',
//     borderColor: '#D1D5DB',
//     color: '#374151',
//   },
//   '&:disabled': {
//     backgroundColor: '#F3F4F6',
//     borderColor: '#D1D5DB',
//     color: '#9CA3AF',
//   },
//   '& .MuiButton-startIcon': {
//     marginRight: '0.7275rem',
//   },
// });

// const StyledTextField = styled(TextField)({
//   '& .MuiOutlinedInput-root': {
//     borderRadius: '11.64px',
//     backgroundColor: '#F9FAFB',
//     fontSize: '1.067rem',
//     fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif',
//     '& .MuiOutlinedInput-input': {
//       padding: '13.58px 15.52px',
//     },
//     '& fieldset': {
//       borderColor: '#E5E7EB',
//     },
//     '&:hover fieldset': {
//       borderColor: '#D1D5DB',
//     },
//     '&.Mui-focused fieldset': {
//       borderColor: '#3B82F6',
//       borderWidth: '2px',
//     },
//   },
//   '& .MuiInputLabel-root': {
//     color: '#6B7280',
//     fontSize: '1.067rem',
//     fontWeight: '400',
//     fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif',
//     '&.Mui-focused': {
//       color: '#3B82F6',
//     },
//   },
// });

// const SignInButton = styled(Button)({
//   width: '100%',
//   padding: '0.84875rem',
//   textTransform: 'none',
//   fontSize: '1.067rem',
//   fontWeight: '400',
//   borderRadius: '11.64px',
//   backgroundColor: '#89AE99',
//   color: '#ffffff',
//   marginTop: '1.455rem',
//   fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif',
//   boxShadow: 'none',
//   '&:hover': {
//     boxShadow: '10px 4px 15px rgba(137, 174, 153, 0.4)',
//   },
//   '&:disabled': {
//     backgroundColor: '#D1D5DB',
//     color: '#9CA3AF',
//   },
// });



// const StyledSwitch = styled(Switch)({
//   '& .MuiSwitch-switchBase.Mui-checked': {
//     color: '#81C784',
//     '&:hover': {
//       backgroundColor: 'rgba(129, 199, 132, 0.08)',
//     },
//   },
//   '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
//     backgroundColor: '#81C784',
//   },
//   '& .MuiSwitch-track': {
//     backgroundColor: '#D1D5DB',
//   },
// });

// const BottomContainer = styled(Box)({
//   textAlign: 'center',
//   marginTop: '1.94rem',
//   paddingTop: '0rem',
//   paddingBottom: '1.455rem',
// });

const FooterText = styled(Typography)({
  fontSize: '0.7275rem',
  color: '#9CA3AF',
  lineHeight: '1.4',
  marginTop: '0.97rem',
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif',
});

const FooterLink = styled(Link)({
  color: '#3B82F6',
  textDecoration: 'none',
  '&:hover': {
    textDecoration: 'underline',
  },
});

interface LoginProps {
  onEmailSignIn?: (email: string, password: string, staySignedIn?: boolean) => void;
  onEmailSignUp?: (email: string, password: string, staySignedIn?: boolean) => void;
}

const Login: React.FC<LoginProps> = ({ 
  // onEmailSignIn,
  // onEmailSignUp
}) => {
  // const [email, setEmail] = useState('');
  // const [password, setPassword] = useState('');
  // const [confirmPassword, setConfirmPassword] = useState('');
  // const [staySignedIn, setStaySignedIn] = useState(false);
  // const [isSignUpMode, setIsSignUpMode] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);

  // const handleEmailAuth = () => {
  //   // ...existing code...
  //   if (isSignUpMode) {
  //     if (password !== confirmPassword) {
  //       // ...existing code...
  //       return;
  //     }
  //     if (onEmailSignUp && email && password) {
  //       onEmailSignUp(email, password, staySignedIn);
  //     }
  //   } else {
  //     if (onEmailSignIn && email && password) {
  //       onEmailSignIn(email, password, staySignedIn);
  //     }
  //   }
  // };

  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.log("singin cancelled");
    }
    setIsSigningIn(false);
  };

  // const handleAppleSignIn = () => {
  // };

  return (
    <Box
      sx={{
        height: '100vh',
        width: '100vw',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F7FAFC',
        padding: '0.97rem',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif',
        overflow: 'hidden',
        position: 'fixed',
        top: -30,
        left: 0,
      }}
    >
      {/* Logo Section - Outside the card */}
      <LogoContainer>
        <Box
          component="img"
          src={logoImage}
          alt="AllProperly Logo"
          sx={{
            height: '155.2px',
            width: 'auto',
            objectFit: 'contain',
            maxWidth: '100%',
          }}
        />
      </LogoContainer>

      <StyledPaper sx={{ maxWidth: '533.5px', width: '100%', minHeight: 'auto', maxHeight: 'none' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          {/* <SignInTitle>{isSignUpMode ? 'Sign Up' : 'Sign In'}</SignInTitle> */}
          <SignInTitle>Sign In</SignInTitle>
          {/* <FormControlLabel
            control={
              <StyledSwitch
                checked={staySignedIn}
                onChange={(e) => {
                  setStaySignedIn(e.target.checked);
                }}
                size="small"
              />
            }
            label={
              <Typography sx={{ 
                fontSize: '0.84875rem',
                color: '#6B7280', 
                fontWeight: '400',
                fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif'
              }}>
                Stay signed in
              </Typography>
            }
            labelPlacement="start"
            sx={{ margin: 0, gap: 0.75 }}
          /> */}
        </Box>
        
        <Box sx={{ display: 'flex', alignItems: 'center', my: 4 }}>
          <Box sx={{ flex: 1, height: '1px', backgroundColor: '#E5E7EB' }} />
        </Box>

        {/* Apple Sign In Button */}
        {/* <AppleButton
          startIcon={<AppleIcon />}
          onClick={handleAppleSignIn}
          disabled={isSigningIn}
        >
          Continue with Apple
        </AppleButton> */}

        {/* Google Sign In Button */}
        <GoogleButton
          startIcon={
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <g clipPath="url(#clip0_17_40)">
                  <path d="M19.805 10.2306C19.805 9.55172 19.7491 8.90263 19.6468 8.28223H10.2V12.0491H15.6373C15.4018 13.2491 14.6841 14.2491 13.6841 14.8763V17.1263H16.6373C18.305 15.6263 19.805 13.2306 19.805 10.2306Z" fill="#4285F4"/>
                  <path d="M10.2 19.0006C12.6841 19.0006 14.7373 18.1263 16.1373 17.1263L13.6841 14.8763C12.9373 15.3763 11.9841 15.6841 10.2 15.6841C7.805 15.6841 5.805 14.1263 5.08409 11.8763H2.03186V14.1841C3.42682 16.3763 6.005 19.0006 10.2 19.0006Z" fill="#34A853"/>
                  <path d="M5.08409 11.8763C4.88409 11.3763 4.805 10.8763 4.805 10.3763C4.805 9.8763 4.88409 9.3763 5.08409 8.8763V6.56854H2.03186C1.42682 7.76854 1.005 9.005 1.005 10.3763C1.005 11.7476 1.42682 12.9841 2.03186 14.1841L5.08409 11.8763Z" fill="#FBBC05"/>
                  <path d="M10.2 4.68409C11.6841 4.68409 12.805 5.22632 13.5373 5.90523L16.2 3.24201C14.7373 1.87632 12.6841 1.005 10.2 1.005C6.005 1.005 3.42682 3.62632 2.03186 5.90523L5.08409 8.87632C5.805 6.62632 7.805 4.68409 10.2 4.68409Z" fill="#EA4335"/>
                </g>
                <defs>
                  <clipPath id="clip0_17_40">
                    <rect width="20" height="20" fill="white"/>
                  </clipPath>
                </defs>
              </svg>
            </Box>
          }
          onClick={handleGoogleSignIn}
          disabled={isSigningIn}
        >
          Continue with Google
        </GoogleButton>

        {/* Divider */}
        {/* <Box sx={{ display: 'flex', alignItems: 'center', my: 2 }}>
          <Box sx={{ flex: 1, height: '1px', backgroundColor: '#E5E7EB' }} />
          <Typography sx={{ mx: 2, color: '#9CA3AF', fontSize: '0.875rem', fontWeight: 400 }}>OR</Typography>
          <Box sx={{ flex: 1, height: '1px', backgroundColor: '#E5E7EB' }} />
        </Box> */}

        {/* Email Input */}
        {/* Email Field with Bold Label */}
        {/* <Box sx={{ mb: 1.5 }}>
          <Typography sx={{ fontWeight: 400, fontSize: '1rem', color: '#111827', mb: 0.5, fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif' }}>
            Email address
          </Typography>
          <StyledTextField
            fullWidth
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            margin="none"
            InputLabelProps={{ shrink: false }}
          />
        </Box> */}

        {/* Password Field with Bold Label and Forgot Link */}
        {/* <Box sx={{ mb: isSignUpMode ? 1.5 : 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
            <Typography sx={{ fontWeight: 400, fontSize: '1rem', color: '#111827', fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif' }}>
              Password
            </Typography>
            {!isSignUpMode && (
              <Link
                href="#"
                sx={{
                  color: '#3B82F6',
                  fontSize: '0.875rem',
                  textDecoration: 'none',
                  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif',
                  fontWeight: '400',
                  '&:hover': {
                    textDecoration: 'underline',
                  },
                }}
              >
                Forgot your password?
              </Link>
            )}
          </Box>
          <StyledTextField
            fullWidth
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            margin="none"
            InputLabelProps={{ shrink: false }}
          />
        </Box> */}

        {/* Confirm Password Input - Only for Sign Up */}
        {/* {isSignUpMode && (
          <StyledTextField
            fullWidth
            label="Confirm Password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            margin="normal"
            sx={{ mt: 0, mb: 1 }}
          />
        )} */}

        {/* Sign In/Up Button */}
        {/* <SignInButton
          onClick={handleEmailAuth}
          disabled={isSigningIn || !email || !password || (isSignUpMode && (!confirmPassword || password !== confirmPassword))}
        >
          {isSignUpMode ? 'Sign Up' : 'Sign In'}
        </SignInButton> */}

        {/* Bottom Section - improved spacing */}
        {/* <BottomContainer sx={{ mt: 3 }}>
          <Typography sx={{ 
            color: '#6B7280', 
            fontSize: '0.875rem',
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif',
            fontWeight: '400',
            mb: -1
          }}>
            {isSignUpMode ? "Already have an account?" : "Don't have an account?"}{' '}
            <Link
              href="#"
              onClick={(e) => {
                e.preventDefault();
                setIsSignUpMode(!isSignUpMode);
              }}
              sx={{
                color: '#3B82F6',
                textDecoration: 'none',
                fontWeight: '400',
                fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif',
                cursor: 'pointer',
                '&:hover': {
                  textDecoration: 'underline',
                },
              }}
            >
              {isSignUpMode ? 'Sign in' : 'Sign up'}
            </Link>
          </Typography>
        </BottomContainer> */}
      </StyledPaper>

      {/* Footer Text - Outside the modal */}
      <FooterText sx={{ 
        fontSize: '0.875rem', 
        color: '#9CA3AF', 
        textAlign: 'center', 
        lineHeight: 1.5,
        mt: 2,
        maxWidth: '480px'
      }}>
        This site is protected by reCAPTCHA and the Google{' '}
        <FooterLink href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</FooterLink> and{' '}
        <FooterLink href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer">Terms of Service</FooterLink> apply.
      </FooterText>
    </Box>
  );
};

export default Login;
