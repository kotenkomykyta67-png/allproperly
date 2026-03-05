import React, { useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

const INVENTORY_ITEMS = [
  'Fridge',
  'Dishwasher',
  'Microwave',
  'Dryer',
  'Smoke Detectors',
  'CO Detectors',
  'Garage Door',
  'Washing Machine',
  'HVAC',
  'Water Heater Tank',
  'Pool',
  'Hot Tub',
];

interface PropertyInventoryModalProps {
  open: boolean;
  onClose: () => void;
  onFinish: (selected: string[]) => void;
}

const PropertyInventoryModal: React.FC<PropertyInventoryModalProps> = ({ open, onClose, onFinish }) => {
  const [selected, setSelected] = useState<string[]>(INVENTORY_ITEMS.filter(i => i !== 'Hot Tub' && i !== 'Pool'));

  const handleToggle = (item: string) => {
    setSelected(prev =>
      prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]
    );
  };

  const handleFinish = () => {
    onFinish(selected);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth transitionDuration={{ enter: 0, exit: 0 }}>
      <DialogContent sx={{ p: 4, textAlign: 'center' }}>
        <DialogTitle sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 550, fontSize: 32, textAlign: 'center' }}>Property inventory</DialogTitle>
        <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', color: '#89AE99', mb: 3, fontSize: 18 }}>Check the items you have.</Typography>
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 2,
          justifyContent: 'center',
          mb: 4,
          ml: 6,
          alignItems: 'center',
        }}>
          {INVENTORY_ITEMS.map((item) => (
            <Box key={item} sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 180, justifyContent: 'flex-start' }}>
              <Checkbox
                checked={selected.includes(item)}
                onChange={() => handleToggle(item)}
                sx={{
                  color: '#89AE99',
                  '&.Mui-checked': {
                    color: '#89AE99',
                  },
                }}
              />
              <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontSize: 18 }}>{item}</Typography>
            </Box>
          ))}
        </Box>
        <Button
          variant="contained"
          sx={{ textTransform: 'none', bgcolor: '#89AE99', color: '#fff', px: 6, py: 1, fontFamily: 'Nunito, Arial, sans-serif', borderRadius: 2, fontSize: 18, fontWeight: 400, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
          onClick={handleFinish}
        >
          Next
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default PropertyInventoryModal;
