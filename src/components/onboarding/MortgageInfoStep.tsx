import React from "react";
import { Box, Typography, Button, TextField, IconButton, InputAdornment } from "@mui/material";
import { ArrowLeft } from "lucide-react";

interface MortgageInfoStep {
  data?: { interestRate?: string; balance?: string; lender?: string };
  onChange: (data: { interestRate?: string; balance?: string; lender?: string }) => void;
  onNext: () => void;
  onBack: () => void;
}

const MortgageInfoStep: React.FC<MortgageInfoStep> = ({
  data,
  onChange,
  onNext,
  onBack,
}) => {
  const [interestRateError, setInterestRateError] = React.useState<string>("");
  // Local state for editing interest rate (numeric only)
  const [interestRateInput, setInterestRateInput] = React.useState<string>("");

  // Sync prop to local state on mount or prop change
  React.useEffect(() => {
    if (data?.interestRate) {
      // Accept either "83%" or "83" or "83.5%"
      const match = String(data.interestRate).match(/([\d.]+)/);
      setInterestRateInput(match ? match[1] : "");
    } else {
      setInterestRateInput("");
    }
  }, [data?.interestRate]);

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
      4/5
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
        Add your <span style={{ fontWeight: 400 }}>mortgage</span> info
      </Typography>

      {/* Subtitle */}
      <Typography
        sx={{
          fontSize: "22px",
          color: "#6B7280",
          fontFamily: 'Nunito, Arial, sans-serif',
          mb: 15,
        }}
      >
        This is a quick reference to track your property's value.
      </Typography>

      {/* Address Field */}
      <TextField
        placeholder="Interest Rate (Optional)"
        value={interestRateInput === "" ? "" : `${interestRateInput}%`}
        onChange={e => {
          let raw = e.target.value.replace(/%/g, "");
          // Only allow numbers and one dot
          if (!/^\d*(\.\d{0,2})?$/.test(raw)) return;
          // Remove leading zeros
          if (raw.startsWith("00")) raw = raw.replace(/^0+/, "0");
          // Validate range
          const rateNum = parseFloat(raw);
          if (
            raw && (isNaN(rateNum) || rateNum < 0 || rateNum > 100)
          ) {
            setInterestRateError("Interest rate must be between 0 and 100.");
          } else {
            setInterestRateError("");
          }
          setInterestRateInput(raw);
          // Move cursor before %
          const input = e.target as HTMLInputElement;
          window.requestAnimationFrame(() => {
            input.setSelectionRange(raw.length, raw.length);
          });
        }}
        onFocus={e => {
          const input = e.target as HTMLInputElement;
          const pos = input.value.replace(/%/g, "").length;
          window.requestAnimationFrame(() => {
            input.setSelectionRange(pos, pos);
          });
        }}
        onClick={e => {
          const input = e.target as HTMLInputElement;
          const pos = input.value.replace(/%/g, "").length;
          window.requestAnimationFrame(() => {
            input.setSelectionRange(pos, pos);
          });
        }}
        onBlur={() => {
          // Update parent with formatted value
          const formatted = interestRateInput ? `${interestRateInput}%` : "";
          onChange({ ...data, interestRate: formatted });
        }}
        error={!!interestRateError}
        helperText={interestRateError}
        variant="outlined"
        id="interest-rate-input"
        sx={{
          width: "100%",
          maxWidth: 520,
          mb: 3,
        }}
        inputProps={{
          style: { textAlign: "left" },
          maxLength: 6,
        }}
      />
      <TextField
        placeholder="Balance (Optional)"
        type="text"
        autoComplete="off"
        value={(() => {
          if (!data?.balance) return "";
          const parts = data.balance.split(".");
          const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
          return parts.length > 1 ? `${intPart}.${parts[1]}` : intPart;
        })()}
        onChange={e => {
          // Remove commas for processing
          let val = e.target.value.replace(/,/g, "");
          // Allow digits and one decimal point with up to 2 decimal places
          val = val.replace(/[^\d.]/g, "");
          // Only allow one decimal point
          const parts = val.split(".");
          if (parts.length > 2) {
            val = parts[0] + "." + parts.slice(1).join("");
          }
          // Limit to 2 decimal places
          if (parts.length === 2 && parts[1].length > 2) {
            val = parts[0] + "." + parts[1].slice(0, 2);
          }
          onChange({ ...data, balance: val });
        }}
        variant="outlined"
        InputProps={{
          startAdornment: <InputAdornment position="start">$</InputAdornment>
        }}
        inputProps={{ inputMode: "decimal", min: 0, maxLength: 18 }}
        sx={{
          width: "100%",
          maxWidth: 520,
          mb: 3,
        }}
      />
      <TextField
        placeholder="Current Lender (Optional)"
        value={data?.lender || ""}
        onChange={(e) => {
          const val = e.target.value.slice(0, 25);
          onChange({ ...data, lender: val });
        }}
        inputProps={{ maxLength: 25 }}
        variant="outlined"
        sx={{
          width: "100%",
          maxWidth: 520,
          mb: 20,
        }}
      />

      {/* Next Button */}
      <Button
        variant="contained"
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
        onClick={() => {
          if (interestRateError) return;
          onNext();
        }}
      >
        Next
      </Button>
    </Box>
  );
};

export default MortgageInfoStep;
