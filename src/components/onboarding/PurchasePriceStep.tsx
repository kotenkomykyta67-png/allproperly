import React from "react";
import { Box, Typography, Button, TextField, IconButton, InputAdornment } from "@mui/material";
import { ArrowLeft } from "lucide-react";
import { format as formatDateFns, parse as parseDateFns, isValid as isValidDateFns } from 'date-fns';
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";

interface PurchasePriceStep {
  data?: { price?: number; date?: string };
  onChange: (data: { price?: number; date?: string }) => void;
  onNext: () => void;
  onBack: () => void;
}

const PurchasePriceStep: React.FC<PurchasePriceStep> = ({
  data,
  onChange,
  onNext,
  onBack,
}) => {
  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      height="100vh"
      width="100%"
      bgcolor="white"
    fontFamily="Nunito, Arial, sans-serif"
      position="relative"
      textAlign="center"
      px={2}
    >
      {/* Back Arrow */}
      <IconButton
        onClick={onBack}
        sx={{ position: "absolute", top: 24, left: 24 }}
      >
        <ArrowLeft size={34} color="#374151" />
      </IconButton>

      {/* Step Counter */}
      <Typography
        sx={{
          position: "absolute",
          top: 28,
          right: 24,
          color: "#6B7280",
          fontSize: "24px",
        }}
      >
        3/5
      </Typography>

      {/* Title */}
      <Typography
        sx={{
          fontSize: "44px",
          fontWeight: 400,
          fontFamily: 'Nunito, Arial, sans-serif',
          color: "#374151",
          mb: 2,
        }}
      >
        Add your <span style={{ fontWeight: 600 }}>purchase</span> price
      </Typography>

      {/* Subtitle */}
      <Typography
        sx={{
          fontSize: "22px",
          fontFamily: 'Nunito, Arial, sans-serif',
          color: "#6B7280",
          mb: 15,
        }}
      >
        This will help you track your home value over time.
      </Typography>

      {/* Address Field */}
      <TextField
        placeholder="Purchase Price (Optional)"
        type="text"
        value={data?.price ? Number(data.price).toLocaleString() : ""}
        onChange={e => {
          const raw = e.target.value.replace(/[^\d]/g, "");
          onChange({ ...data, price: raw === "" ? 0 : Number(raw) });
        }}
        InputProps={{
          startAdornment: <InputAdornment position="start">$</InputAdornment>
        }}
        inputProps={{ inputMode: "numeric", min: 0, maxLength: 12 }}
        variant="outlined"
        sx={{
          width: "100%",
          maxWidth: 520,
          mb: 3,
        }}
      />

      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <DatePicker
          label="Purchased Date (Optional)"
          value={data?.date && isValidDateFns(parseDateFns(data.date, 'MM/dd/yyyy', new Date()))
            ? parseDateFns(data.date, 'MM/dd/yyyy', new Date())
            : null}
          disableFuture
          onChange={date => {
            let newDate = '';
            if (date instanceof Date && isValidDateFns(date)) {
              const today = new Date();
              today.setHours(0,0,0,0);
              if (date > today) {
                  // If future, do not update
                  date = today;
              }
              newDate = formatDateFns(date, 'MM/dd/yyyy');
            }
            onChange({ ...data, date: newDate });
          }}
          slotProps={{ 
            textField: { 
              fullWidth: true, 
              sx: { 
                mb: 30, 
                bgcolor: '#fff', 
                width: '100%', 
                maxWidth: 520,
                borderRadius: '6px',
                '& .MuiInputLabel-root': {
                  color: '#8A8A8A',
                  opacity: 0.8,
                },
            },  } }}
          format="MM/dd/yyyy"
        />
      </LocalizationProvider>
      {/* Next Button */}
      <Button
        variant="contained"
        onClick={onNext}
        sx={{
          backgroundColor: "#89AE99",
          fontSize: 24,
          fontWeight: 400,
          borderRadius: "8px",
          textTransform: "none",
          width: "100%",
          maxWidth: 260,
          fontFamily: 'Nunito, Arial, sans-serif',
        }}
      >
        Next
      </Button>
    </Box>
  );
};

export default PurchasePriceStep;
