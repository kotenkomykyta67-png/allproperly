import React from 'react';
import { Box, Typography, TextField, Button, Autocomplete, Dialog, DialogTitle, DialogContent } from '@mui/material';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import type { PropertyData } from '../../pages/Property';

export interface InventoryEditFormProps {
  property: PropertyData;
  currentPropertyId: string;
  selectedInventory: { name: string; type: string; brand: string; model: string; serial: string };
  setInventoryModalOpen: (open: boolean) => void;
  setProperty: (property: PropertyData) => void;
}

const InventoryEditForm: React.FC<InventoryEditFormProps> = ({ 
  property, 
  currentPropertyId, 
  selectedInventory, 
  setInventoryModalOpen, 
  setProperty 
}) => {
  // Parse inventory string for prefill
  let type = selectedInventory.type;
  let brand = selectedInventory.brand || '';
  let model = selectedInventory.model || '';
  let serial = selectedInventory.serial || '';
  if (selectedInventory.name && selectedInventory.name.includes('~')) {
    const parts = selectedInventory.name.split('~').map(s => s.trim());
    type = parts[0] || '';
    brand = parts[1] || '';
    model = parts[2] || '';
    serial = parts[3] || '';
  }
  const [isSave, setIsSave] = React.useState(false);
  const [brandState, setBrand] = React.useState(brand);
  const [modelState, setModel] = React.useState(model);
  const [serialState, setSerial] = React.useState(serial);
  const airFilterSizes = ["16x20x1", "20x20x1", "16x25x1", "20x25x1"];
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);

  // Save changes to Firestore
  const handleSave = async () => {
    try {
      const oldString = selectedInventory.name;
      // Always save as 'type ~ brand ~ model ~ serial', using empty strings for missing fields
      const newString = `${type} ~ ${brandState || ''} ~ ${modelState || ''} ~ ${serialState || ''}`;
      const updatedInventory = (property.inventory || []).map((item: string) => item === oldString ? newString : item);
      const docRef = doc(db, 'properties', currentPropertyId);
      await updateDoc(docRef, { inventory: updatedInventory });
      setProperty({ ...property, inventory: updatedInventory });
      setInventoryModalOpen(false);
    } catch (err) {
      console.error('Failed to save changes.');
    }
  };

  // Delete item from Firestore
  const handleDelete = async () => {
    try {
      setInventoryModalOpen(false);
      const oldString = selectedInventory.name;
      const updatedInventory = (property.inventory || []).filter((item: string) => item !== oldString);
      const docRef = doc(db, 'properties', currentPropertyId);
      await updateDoc(docRef, { inventory: updatedInventory });
      setProperty({ ...property, inventory: updatedInventory });
    } catch (err) {
      console.error('Failed to delete item.');
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography sx={{ color: '#4A4A4A', fontWeight: 400, fontFamily: 'Nunito, Arial, sans-serif', mb: 0.2, fontSize: { xs: 13, sm: 15, md: 16 } }}><b>Type:</b> {type}</Typography>
      <TextField
        label="Brand"
        value={brandState}
        onChange={e => {
          const value = e.target.value;
          if (value.length <= 20) setBrand(value);
          setIsSave(true);
        }}
        fullWidth
        sx={{ bgcolor: '#fff' }}
        inputProps={{ maxLength: 20 }}
      />
      <TextField
        label="Model"
        value={modelState}
        onChange={e => {
          const value = e.target.value;
          if (value.length <= 32) setModel(value);
          setIsSave(true);
        }}
        fullWidth
        sx={{ bgcolor: '#fff' }}
        inputProps={{ maxLength: 32 }}
      />
      {(type === 'HVAC' || type === "Air Filter" || type === "HVAC System") ? (
        <Autocomplete
          freeSolo
          options={airFilterSizes}
          value={serialState}
          onChange={(_event, newValue) => {
            if ((newValue || '').length <= 32) setSerial(newValue || '');
            setIsSave(true);
          }}
          onInputChange={(_event, newInputValue) => {
            if ((newInputValue || '').length <= 32) setSerial(newInputValue);
            setIsSave(true);
          }}
          renderInput={params => (
            <TextField {...params} label="Filter Size" fullWidth sx={{ bgcolor: '#fff' }} inputProps={{ ...params.inputProps, maxLength: 32 }} />
          )}
        />
      ) : (
        <TextField
          label={
            type === 'Smoke Detectors' ? 'Number of Smoke Detectors'
            : type === 'CO Detectors' ? 'Number of CO Detectors'
            : 'Serial Number'
          }
          value={serialState}
          onChange={e => {
            if (type === 'Smoke Detectors' || type === 'CO Detectors') {
              const val = e.target.value.replace(/[^\d]/g, '');
              let num = parseInt(val, 10);
              if (isNaN(num)) num = 0;
              if (num > 50) num = 50;
              const numStr = num.toString();
              if (numStr.length <= 32) setSerial(numStr);
            } else {
              const value = e.target.value;
              if (value.length <= 32) setSerial(value);
            }
            setIsSave(true);
          }}
          fullWidth
          sx={{ bgcolor: '#fff' }}
          type={type === 'Smoke Detectors' || type === 'CO Detectors' ? 'number' : 'text'}
          inputProps={type === 'Smoke Detectors' || type === 'CO Detectors' ? { min: 0, max: 32, maxLength: 32 } : { maxLength: 32 }}
        />
      )}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2, gap: 2 }}>
        <Button variant="contained" color="error" onClick={() => setShowDeleteConfirm(true)} sx={{
          bgcolor: '#fff',
          color: '#555',
          px: 2,
          py: 1.5,
          borderRadius: 2,
          minWidth: 100,
          fontSize: 15,
          border: '1.5px solid #888',
          fontFamily: 'Nunito, Arial, sans-serif',
          boxShadow: 'none',
          textTransform: 'none',
          '&:hover': {
            bgcolor: '#E57373',
            color: '#fff',
            borderColor: '#d32f2f',
          },
        }}>
          Delete
        </Button>
        <Button variant="contained" disabled={!isSave} sx={{ textTransform: 'none', fontFamily: 'Nunito, Arial, sans-serif', bgcolor: '#89AE99', color: '#fff', borderRadius: 2, fontWeight: 550, px: 4, py: 1.5, fontSize: 15 }} onClick={handleSave}>
          Save
        </Button>
      </Box>

      {/* Confirmation modal for delete */}
      <Dialog open={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 550, mb: 1 }}>Remove Inventory Item</DialogTitle>
        <DialogContent sx={{ p: 4 }}>
          <Box sx={{ fontFamily: 'Nunito, Arial, sans-serif', bgcolor: '#F9B55D', color: '#343748', borderRadius: '8px', p: '12px 20px', mb: 4, fontWeight: 400, fontSize: 16 }}>
            Are you sure you want to remove this inventory item? This CANNOT be undone.
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
            <Button variant="outlined" sx={{ '&:hover': { bgcolor: '#f5f5f5', borderColor: '#B0B8C1' }, fontFamily: 'Nunito, Arial, sans-serif', borderRadius: 2, minWidth: 110, color: '#333', borderColor: '#D9D9D9', background: '#fff', textTransform: 'none', fontWeight: 400 }} onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </Button>
            <Button variant="contained" color="error" sx={{ fontFamily: 'Nunito, Arial, sans-serif', borderRadius: 2, minWidth: 110, background: '#E57373', textTransform: 'none', fontWeight: 550, boxShadow: 'none', fontSize: 15 }} onClick={handleDelete}>
              Delete
            </Button>
          </Box>
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default React.memo(InventoryEditForm);
