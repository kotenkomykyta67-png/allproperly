import React from 'react';
import { Box, Typography, Button } from '@mui/material';

const InviteExpired: React.FC = () => {
  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      minHeight="100vh"
      width="100vw"
      bgcolor="#F9F8F6"
      sx={{ borderRadius: '24px', boxSizing: 'border-box', p: { xs: 2, sm: 4 } }}
    >
      <img src="/warning.png" alt="Warning" style={{ maxWidth: 180, width: '100%', height: 'auto', marginBottom: 32 }} />
      <Typography
        sx={{
          fontSize: { xs: '2rem', sm: '2.5rem' },
          fontWeight: 550,
          color: '#343748',
          mb: 2,
          textAlign: 'center',
          fontFamily: 'Nunito, Arial, sans-serif',
        }}
      >
        Oops — this invitation has expired.
      </Typography>
      <Typography
        sx={{
          fontSize: { xs: '1.1rem', sm: '1.35rem' },
          color: '#343748',
          fontWeight: 400,
          mb: 4,
          textAlign: 'center',
          maxWidth: 600,
          fontFamily: 'Nunito, Arial, sans-serif',
        }}
      >
        No worries! You can reach out to the person who invited you to get a new link and continue managing your property with AllProperly.
      </Typography>
      <Button
        variant="contained"
        sx={{
          background: '#8ab7a3',
          borderRadius: '8px',
          fontWeight: 400,
          fontSize: '1rem',
          px: 4,
          fontFamily: 'Nunito, Arial, sans-serif',
          py: 1.5,
          textTransform: 'none',
          boxShadow: 2,
          '&:hover': { background: '#7aa08e' },
          mb: 2,
        }}
        onClick={() => window.location.href = 'https://allproperly.com'}
      >
        Go to homepage
      </Button>
    </Box>
  );
};

export default InviteExpired;
