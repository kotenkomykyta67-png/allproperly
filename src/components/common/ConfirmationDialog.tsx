import React from 'react';
import { Dialog, DialogTitle, DialogContent, Box, Button } from '@mui/material';

export interface ConfirmationDialogProps {
  open: boolean;
  title: string;
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
  confirmText?: string;
  cancelText?: string;
  loading?: boolean;
  /** Warning style with orange background */
  variant?: 'warning' | 'danger';
}

/**
 * Reusable confirmation dialog component.
 * Use for delete confirmations, remove actions, etc.
 */
const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  open,
  title,
  message,
  onCancel,
  onConfirm,
  confirmText = 'Delete',
  cancelText = 'Cancel',
  loading = false,
  variant = 'warning',
}) => {
  const bgColor = variant === 'danger' ? '#FFCDD2' : '#F9B55D';
  const confirmBgColor = variant === 'danger' ? '#d32f2f' : '#E57373';
  const confirmHoverBgColor = variant === 'danger' ? '#b71c1c' : '#d32f2f';

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 550, fontSize: 18 }}>
        {title}
      </DialogTitle>
      <DialogContent sx={{ p: 3 }}>
        <Box sx={{ 
          fontFamily: 'Nunito, Arial, sans-serif', 
          bgcolor: bgColor, 
          color: '#343748', 
          borderRadius: '8px', 
          p: '16px 24px', 
          mb: 2, 
          fontWeight: 400, 
          fontSize: 16, 
          letterSpacing: 0, 
          lineHeight: 1.4, 
          boxSizing: 'border-box' 
        }}>
          {message}
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
          <Button
            onClick={onCancel}
            disabled={loading}
            sx={{ 
              borderRadius: '8px', 
              minWidth: 110, 
              height: 44, 
              bgcolor: '#fff', 
              color: '#343748', 
              fontWeight: 400, 
              fontSize: 15, 
              fontFamily: 'Nunito, Arial, sans-serif', 
              border: '1.5px solid #D9D9D9', 
              boxShadow: 'none', 
              textTransform: 'none', 
              '&:hover': { bgcolor: '#f5f5f5', borderColor: '#B0B8C1' } 
            }}
          >
            {cancelText}
          </Button>
          <Button
            onClick={onConfirm}
            disabled={loading}
            sx={{ 
              borderRadius: '8px', 
              minWidth: 110, 
              height: 44, 
              bgcolor: confirmBgColor, 
              color: '#fff', 
              fontWeight: 550, 
              fontSize: 15, 
              fontFamily: 'Nunito, Arial, sans-serif', 
              boxShadow: 'none', 
              textTransform: 'none', 
              '&:hover': { bgcolor: confirmHoverBgColor } 
            }}
          >
            {loading ? 'Deleting...' : confirmText}
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default React.memo(ConfirmationDialog);
