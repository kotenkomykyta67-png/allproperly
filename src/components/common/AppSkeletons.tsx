import React from 'react';
import { Box, Skeleton } from '@mui/material';

interface TaskCardSkeletonProps {
  count?: number;
  compact?: boolean;
}

export const TaskCardSkeleton: React.FC<TaskCardSkeletonProps> = ({ count = 4, compact = false }) => {
  return (
    <>
      {Array.from({ length: count }).map((_, idx) => (
        <Box
          key={idx}
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            bgcolor: '#f8f9fb',
            borderRadius: 2,
            p: compact ? 1.5 : 2,
            mb: 1.1,
            mx: { xs: 1, sm: 2.2 },
            border: '1.5px solid #e4e8ef',
            boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
            minHeight: compact ? 88 : 98,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0, flex: 1 }}>
            <Skeleton animation="wave" variant="rectangular" width={32} height={32} sx={{ borderRadius: 1.5, flexShrink: 0 }} />
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Skeleton animation="wave" variant="text" width="50%" height={28} sx={{ borderRadius: 1 }} />
              <Skeleton animation="wave" variant="text" width="78%" height={18} sx={{ borderRadius: 1 }} />
              <Skeleton animation="wave" variant="text" width="44%" height={16} sx={{ borderRadius: 1 }} />
            </Box>
          </Box>
          <Skeleton animation="wave" variant="circular" width={24} height={24} sx={{ ml: 1.5, flexShrink: 0 }} />
        </Box>
      ))}
    </>
  );
};

export const CalendarPanelSkeleton: React.FC = () => {
  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5 }}>
        <Skeleton animation="wave" variant="circular" width={40} height={40} />
        <Skeleton animation="wave" variant="text" width={150} height={34} />
        <Skeleton animation="wave" variant="circular" width={40} height={40} />
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, mb: 1.25 }}>
        {Array.from({ length: 7 }).map((_, idx) => (
          <Skeleton key={idx} animation="wave" variant="text" width="70%" height={18} sx={{ mx: 'auto' }} />
        ))}
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
        {Array.from({ length: 35 }).map((_, idx) => (
          <Skeleton
            key={idx}
            animation="wave"
            variant="rounded"
            width="100%"
            height={44}
            sx={{ borderRadius: 2, maxWidth: 60, mx: 'auto' }}
          />
        ))}
      </Box>
    </Box>
  );
};

export const PropertyOverviewSkeleton: React.FC = () => {
  return (
    <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box sx={{ display: 'flex', gap: 1.5, flexDirection: { xs: 'column', lg: 'row' } }}>
        <Box sx={{ flex: 1 }}>
          <Box sx={{ bgcolor: '#fff', borderRadius: 2, p: 2.5, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            <Skeleton animation="wave" variant="rounded" width="100%" height={260} sx={{ borderRadius: 2, mb: 2 }} />
            <Skeleton animation="wave" variant="text" width="78%" height={26} />
            <Skeleton animation="wave" variant="text" width="52%" height={20} />
          </Box>
        </Box>
        <Box sx={{ flex: 1 }}>
          <Box sx={{ bgcolor: '#fff', borderRadius: 2, p: 2.5, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', minHeight: 340 }}>
            <Skeleton animation="wave" variant="text" width="45%" height={34} sx={{ mb: 1 }} />
            <Skeleton animation="wave" variant="text" width="100%" height={20} />
            <Skeleton animation="wave" variant="text" width="95%" height={20} />
            <Skeleton animation="wave" variant="text" width="90%" height={20} />
            <Skeleton animation="wave" variant="text" width="92%" height={20} />
            <Skeleton animation="wave" variant="rounded" width="100%" height={150} sx={{ mt: 1.5, borderRadius: 2 }} />
          </Box>
        </Box>
      </Box>
      <Box sx={{ bgcolor: '#fff', borderRadius: 2, p: 2.5, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
        <Skeleton animation="wave" variant="text" width={220} height={34} sx={{ mx: 'auto', mb: 2 }} />
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 2 }}>
          <Skeleton animation="wave" variant="rounded" width="100%" height={200} sx={{ borderRadius: 2 }} />
          <Skeleton animation="wave" variant="rounded" width="100%" height={200} sx={{ borderRadius: 2 }} />
          <Skeleton animation="wave" variant="rounded" width="100%" height={200} sx={{ borderRadius: 2 }} />
        </Box>
      </Box>
    </Box>
  );
};
