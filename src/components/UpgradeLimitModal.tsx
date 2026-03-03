import React from "react";
import { Dialog, Box, Typography, Button } from "@mui/material";

interface UpgradeLimitModalProps {
  open: boolean;
  onCancel: () => void;
  onUpgrade: () => void;
  planState: string;
}

const planMessages: Record<string, { limit: number; message: string }> = {
  free: {
    limit: 1,
    message:
      "Ready to track more homes? Upgrade to manage up to 5 properties for just $15/month.",
  },
  basic: {
    limit: 5,
    message:
      "Upgrade to Plus to manage up to 10 properties for just $30/month.",
  },
  plus: {
    limit: 10,
    message: "You have reached the maximum property limit for your plan.",
  },
};

const UpgradeLimitModal: React.FC<UpgradeLimitModalProps> = ({
  open,
  onCancel,
  onUpgrade,
  planState,
}) => {
  const { limit, message } = planMessages[planState] || planMessages["free"];
  // Capitalize planState for display
  const planLabel = planState.charAt(0).toUpperCase() + planState.slice(1);
  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
      <Box p={3}>
        <Typography variant="body2" mb={2} color="textSecondary" sx={{ fontFamily: 'Nunito, Arial, sans-serif' }}>
          {`${planLabel} plan limited to ${limit} ${limit > 1 ? "properties" : "property"}.`}
        </Typography>
        <Box bgcolor="#F7B563" color="#222" p={2} borderRadius={2} mb={3}>
          <Typography variant="body1" sx={{ fontFamily: 'Nunito, Arial, sans-serif' }}>{message}</Typography>
        </Box>
        <Box display="flex" justifyContent="flex-end" gap={2} mt={2}>
          <Button variant="outlined" sx={{             
            borderRadius: '8px',
            background: '#fff',
            color: '#343748',
            fontSize: 15,
            fontWeight: 200,
            fontFamily: 'Nunito, Arial, sans-serif',
            border: '1.5px solid #D9D9D9',
            textTransform: 'none',
            overflow: 'hidden',
            position: 'relative',
            '&:hover': {
              background: '#f5f5f5',
              borderColor: '#B0B8C1',
            },
            '&:active, &:focus-visible': {
              background: '#AEB0B3',
              color: '#343748',
              borderRadius: '8px',
              boxShadow: 'none',
            },
          }} onClick={onCancel}>Cancel</Button>
          <Button variant="contained" sx={{ textTransform: 'none', fontFamily: 'Nunito, Arial, sans-serif', borderRadius: '8px', background: '#89AE99' }} onClick={onUpgrade}>
            Upgrade Now
          </Button>
        </Box>
      </Box>
    </Dialog>
  );
};

export default UpgradeLimitModal;
