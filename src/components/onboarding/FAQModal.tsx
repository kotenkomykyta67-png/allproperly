import React from 'react';
import { Modal, Box, Typography, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

interface FAQModalProps {
  open: boolean;
  onClose: () => void;
}

const faqItems = [
  {
    question: 'Why are you asking for my address?',
    answer:
      "We ask for your address so we can connect the app to your home. That way, you'll see all the important details about your property in one place and can keep track of its care over time.",
  },
  {
    question: 'What does property name mean?',
    answer:
      'The property name is just a label you create—like “Our Home” or “Mom’s House”. It helps you stay organized, especially if someone shares another property with you (like a rental or parent’s home). You’ll be able to tell at a glance which house is which.',
  },
  {
    question: 'Why do you want to know purchase price and date?',
    answer:
      "This is optional, but it’s nice to have. By adding when you bought your home and for how much, you’ll be able to see how much it’s gone up in value over the years. It’s a simple way to track your home's story and share it with family.",
  },
  {
    question: 'Why do you need to know my mortgage information?',
    answer:
      "Keeping your mortgage info here puts everything in one safe place. If you don’t have a mortgage, it will proudly show as “Paid Off.” Later on, it’s fun to look back and see what things cost when you bought your home, and how far you’ve come.",
  },
  {
    question: 'Why do I need to check these property inventory boxes?',
    answer:
      "This is where you tell us what’s in your home—like HVAC, water heater, or dishwasher. When you check these boxes, the app automatically gives you helpful reminders for maintenance (like changing filters or cleaning gutters), so you don’t have to remember on your own.",
  },
];

const FAQModal: React.FC<FAQModalProps> = ({ open, onClose }) => {
  return (
    <Modal open={open} onClose={onClose}>
      <Box
        sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 700,
          bgcolor: 'background.paper',
          boxShadow: 24,
          borderRadius: 2,
          p: 0,
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Sticky header */}
        <Box
          sx={{
            position: 'sticky',
            top: 0,
            zIndex: 2,
            backgroundColor: 'background.paper',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            px: 4,
            py: 3,
            borderTopLeftRadius: 12,
            borderTopRightRadius: 12,
          }}
        >
          <Typography variant="h5" sx={{mt: 3, color: "#343748"}} fontWeight={400} fontFamily="Nunito, Arial, sans-serif">
            Frequently Asked Questions
          </Typography>
          <IconButton onClick={onClose}>
            <CloseIcon sx={{ fontSize: 24 }} />
          </IconButton>
        </Box>
        {/* Scrollable content */}
        <Box
          sx={{
            px: 4,
            pb: 4,
            pt: 2,
            overflowY: 'auto',
            maxHeight: 'calc(80vh - 80px)',
          }}
        >
          {faqItems.map((item, idx) => (
            <Box key={idx} sx={{ mb: 3 }}>
              <Typography variant="h6" fontWeight={400} sx={{ fontFamily: 'Nunito, Arial, sans-serif', mb: 0.5, color: "#343748" }}>
                {item.question}
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ fontFamily: 'Nunito, Arial, sans-serif' }} >
                {item.answer}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>
    </Modal>
  );
};

export default FAQModal;
