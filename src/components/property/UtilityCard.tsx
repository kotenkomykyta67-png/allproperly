import React from 'react';
import { Box, Typography } from '@mui/material';

export interface UtilityItem {
  type: string;
  company: string;
  number?: string;
  link?: string;
}

interface UtilityCardProps {
  utility: UtilityItem;
  onEdit: () => void;
}

const iconMap: Record<string, { icon: string; color: string; linkColor: string }> = {
  Water: { icon: '/utility/water.svg', color: '#89AE99', linkColor: '#89AE99' },
  Electricity: { icon: '/utility/electricity.svg', color: '#E57373', linkColor: '#E57373' },
  Gas: { icon: '/utility/gas.svg', color: '#B39DDB', linkColor: '#B39DDB' },
  Trash: { icon: '/utility/trash.svg', color: '#FFB74D', linkColor: '#FFB74D' },
};

const UtilityCard: React.FC<UtilityCardProps> = ({ utility, onEdit }) => {
  const isStandardType = ['Electricity', 'Water', 'Gas', 'Trash'].includes(utility.type);
  const iconData = iconMap[utility.type] || { icon: '', color: '#E5B26B', linkColor: '#E5B26B' };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
      <Box sx={{ width: 64, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {isStandardType ? (
          iconData.icon && (
            <img src={iconData.icon} alt={utility.type + ' icon'} style={{ width: 64, height: 64 }} />
          )
        ) : (
          <Box sx={{ width: 64, height: 64, borderRadius: '50%', background: '#E5B26B' }} />
        )}
      </Box>
      <Box sx={{ flex: 1 }}>
        <Typography fontWeight={550} sx={{ color: '#343748', fontSize: 20, fontFamily: 'Nunito, Arial, sans-serif' }}>
          {utility.type}: {utility.link ? (
            <span
              style={{ fontWeight: 400, fontFamily: 'Nunito, Arial, sans-serif', color: '#D36666', cursor: 'pointer', textDecoration: 'none' }}
              onClick={e => {
                e.stopPropagation();
                if (utility.link) {
                  window.open(utility.link.startsWith('http') ? utility.link : `https://${utility.link}`, '_blank');
                }
              }}
            >
              {utility.company}
            </span>
          ) : (
            <span style={{ fontWeight: 400, fontFamily: 'Nunito, Arial, sans-serif' }}>{utility.company}</span>
          )}
        </Typography>
        {utility.number && (
          <Typography
            sx={{
              color: '#343748',
              fontFamily: 'Nunito, Arial, sans-serif',
              fontSize: 16,
              fontWeight: 400,
              mt: 0.5,
            }}
          >
            Account Number: {utility.number}
          </Typography>
        )}
      </Box>
      <Typography
        sx={{
          color: '#A8A8A8',
          fontWeight: 400,
          fontSize: 18,
          minWidth: 0,
          py: 0.5,
          fontFamily: 'Nunito, Arial, sans-serif',
          textTransform: 'none',
          borderRadius: 2,
          boxShadow: 'none',
          cursor: 'pointer',
          transition: 'color 0.2s',
          userSelect: 'none',
          ":hover": {
            color: '#343748',
          }
        }}
        onClick={onEdit}
      >
        Edit
      </Typography>
    </Box>
  );
};

export default React.memo(UtilityCard);
