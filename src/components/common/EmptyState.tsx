import React from 'react';
import { Box, Button, Typography } from '@mui/material';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import BarChartOutlinedIcon from '@mui/icons-material/BarChartOutlined';
import GroupOutlinedIcon from '@mui/icons-material/GroupOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';

type EmptyStateIcon =
  | 'property'
  | 'task'
  | 'calendar'
  | 'report'
  | 'shared'
  | 'default';

interface EmptyStateProps {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
  iconType?: EmptyStateIcon;
  compact?: boolean;
  minHeight?: number | string;
}

const resolveIcon = (iconType: EmptyStateIcon, compact: boolean) => {
  const size = compact ? 44 : 56;
  const color = '#8AA093';

  switch (iconType) {
    case 'property':
      return <HomeOutlinedIcon sx={{ fontSize: size, color }} />;
    case 'task':
      return <AssignmentOutlinedIcon sx={{ fontSize: size, color }} />;
    case 'calendar':
      return <CalendarMonthOutlinedIcon sx={{ fontSize: size, color }} />;
    case 'report':
      return <BarChartOutlinedIcon sx={{ fontSize: size, color }} />;
    case 'shared':
      return <GroupOutlinedIcon sx={{ fontSize: size, color }} />;
    default:
      return <DescriptionOutlinedIcon sx={{ fontSize: size, color }} />;
  }
};

const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  actionLabel,
  onAction,
  icon,
  iconType = 'default',
  compact = false,
  minHeight,
}) => {
  return (
    <Box
      sx={{
        width: '100%',
        minHeight: minHeight ?? (compact ? 180 : 260),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: { xs: 2, sm: 3 },
        py: { xs: 2.5, sm: 3.5 },
        textAlign: 'center',
        animation: 'emptyStateFadeIn 220ms ease-out',
      }}
    >
      <Box
        sx={{
          maxWidth: compact ? 420 : 520,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: compact ? 1.25 : 1.75,
        }}
      >
        <Box
          sx={{
            width: compact ? 56 : 68,
            height: compact ? 56 : 68,
            borderRadius: '50%',
            bgcolor: 'rgba(137, 174, 153, 0.14)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mb: compact ? 0.5 : 0.75,
            flexShrink: 0,
          }}
        >
          {icon || resolveIcon(iconType, compact)}
        </Box>

        <Typography
          sx={{
            fontFamily: 'Nunito, Arial, sans-serif',
            fontWeight: 650,
            color: '#2F3441',
            fontSize: compact ? { xs: 18, sm: 20 } : { xs: 21, sm: 24 },
            lineHeight: 1.3,
          }}
        >
          {title}
        </Typography>

        {description && (
          <Typography
            sx={{
              fontFamily: 'Nunito, Arial, sans-serif',
              fontWeight: 400,
              color: '#667082',
              fontSize: compact ? { xs: 14, sm: 15 } : { xs: 14, sm: 16 },
              lineHeight: 1.5,
              maxWidth: compact ? 380 : 460,
            }}
          >
            {description}
          </Typography>
        )}

        {actionLabel && onAction && (
          <Button
            variant="contained"
            onClick={onAction}
            sx={{
              mt: compact ? 0.5 : 1,
              bgcolor: '#89AE99',
              color: '#fff',
              fontFamily: 'Nunito, Arial, sans-serif',
              textTransform: 'none',
              borderRadius: 2,
              fontWeight: 550,
              px: { xs: 2.75, sm: 3.5 },
              py: 1,
              minHeight: 44,
              boxShadow: 'none',
              '&:hover': {
                bgcolor: '#7BA08E',
                boxShadow: 'none',
              },
            }}
          >
            {actionLabel}
          </Button>
        )}
      </Box>
    </Box>
  );
};

export default EmptyState;
