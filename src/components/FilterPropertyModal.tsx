import React, { useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import * as PropertyService from '../services/PropertyService';
import { getAuth } from 'firebase/auth';

interface Property {
  id: string;
  name: string;
  image: string;
}

interface FilterPropertyModalProps {
  open: boolean;
  onClose: () => void;
}

const FilterPropertyModal: React.FC<FilterPropertyModalProps> = ({ open, onClose }) => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);

  React.useEffect(() => {
    if (open) {
      const auth = getAuth();
      const user = auth.currentUser;
      if (user) {
        PropertyService.getAllPropertiesForUser(user.uid)
          .then((data: any[]) => {
            const mapped = data.map((p) => ({
              id: p.id,
              name: p.name,
              image: p.image || '/public/daily/house.png',
            }));
            setProperties(mapped);
          })
          .catch(() => setProperties([]));
      } else {
        setProperties([]);
      }
    }
  }, [open]);

  const onDragEnd = (result: any) => {
    if (!result.destination) return;
    const reordered = Array.from(properties);
    const [removed] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, removed);
    setProperties(reordered);
  };

  const handleUpdate = () => {
    setIsUpdating(true);
    // Simulate update logic
    setTimeout(() => {
      setIsUpdating(false);
      onClose();
    }, 1000);
  };

  return (
    <Dialog
      open={open}
      onClose={(_, reason) => {
        if (reason !== 'backdropClick' && reason !== 'escapeKeyDown') return;
        onClose();
      }}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          boxShadow: 4,
          p: 0,
          background: '#F9F9F9',
        }
      }}
    >
      <DialogTitle sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 550, fontSize: 16, pb: 0, mb: 5 }}>Filter</DialogTitle>
      <DialogContent sx={{ pt: 2, pb: 0 }}>
        <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontSize: 20, color: '#333', mb: 3 }}>
          Want your properties in a different order? Drag them into place here - the top bar will match whatever order you set.
        </Typography>
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="properties-list">
            {(provided: any) => (
              <Box
                className="properties-list"
                {...provided.droppableProps}
                ref={provided.innerRef}
                sx={{ fontFamily: 'Nunito, Arial, sans-serif', display: 'flex', flexDirection: 'column', gap: 2, mb: 4 }}
              >
                {properties.map((property, index) => (
                  <Draggable key={property.id} draggableId={property.id} index={index}>
                    {(provided: any) => (
                      <Paper
                        elevation={0}
                        className="property-row"
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          background: '#f7f7f7',
                          borderRadius: 2,
                          p: '16px 16px',
                          boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                          cursor: 'grab',
                          transition: 'box-shadow 0.2s',
                        }}
                      >
                        <Box
                          component="img"
                          src={property.image || '/avatar.png'}
                          alt={property.name || 'Property Image'}
                          sx={{
                            width: 40,
                            height: 40,
                            borderRadius: '50%',
                            objectFit: 'cover',
                            mr: 2,
                            border: '2px solid #e0e0e0',
                          }}
                        />
                        <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontSize: 16, fontWeight: 400, flex: 1 }}>
                          {property.name || 'Unnamed Property'}
                        </Typography>
                        <Box sx={{ fontSize: '1.5rem', color: '#888', ml: 1, display: 'flex', alignItems: 'center' }}>
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path fillRule="evenodd" clipRule="evenodd" d="M7 5C7 3.89543 7.89543 3 9 3C10.1046 3 11 3.89543 11 5C11 6.10457 10.1046 7 9 7C7.89543 7 7 6.10457 7 5ZM13 5C13 3.89543 13.8954 3 15 3C16.1046 3 17 3.89543 17 5C17 6.10457 16.1046 7 15 7C13.8954 7 13 6.10457 13 5ZM7 12C7 10.8954 7.89543 10 9 10C10.1046 10 11 10.8954 11 12C11 13.1046 10.1046 14 9 14C7.89543 14 7 13.1046 7 12ZM13 12C13 10.8954 13.8954 10 15 10C16.1046 10 17 10.8954 17 12C17 13.1046 16.1046 14 15 14C13.8954 14 13 13.1046 13 12ZM7 19C7 17.8954 7.89543 17 9 17C10.1046 17 11 17.8954 11 19C11 20.1046 10.1046 21 9 21C7.89543 21 7 20.1046 7 19ZM13 19C13 17.8954 13.8954 17 15 17C16.1046 17 17 17.8954 17 19C17 20.1046 16.1046 21 15 21C13.8954 21 13 20.1046 13 19Z" fill="black"/>
                          </svg>
                        </Box>
                      </Paper>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </Box>
            )}
          </Droppable>
        </DragDropContext>
      </DialogContent>
      <DialogActions sx={{ pr: 3, pb: 2 }}>
        <Button variant="outlined" onClick={onClose} sx={{ fontFamily: 'Nunito, Arial, sans-serif', '&:hover': { background: '#f5f5f5', borderColor: '#B0B0B0' }, borderRadius: 2, color: '#333', borderColor: '#D9D9D9', px: 3, py: 1, background: '#fff', fontSize: 14, textTransform: 'none', fontWeight: 400 }}>
          Cancel
        </Button>
        <Button onClick={handleUpdate} disabled={isUpdating} variant="contained" sx={{ textTransform: 'none', bgcolor: '#89AE99', color: '#fff', fontFamily: 'Nunito, Arial, sans-serif', borderRadius: 2, fontWeight: 400, px: 3, py: 1, fontSize: 14, boxShadow: 'none', minWidth: 110 }}>
          {isUpdating ? 'Updating...' : 'Update'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default FilterPropertyModal;
