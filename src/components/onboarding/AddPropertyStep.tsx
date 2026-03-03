import React, { useState } from "react";
import { Box, Typography, Button, IconButton, TextField, Autocomplete } from "@mui/material";
import AddressAutocomplete from "./AddressAutocomplete";
import type { StructuredAddress } from "./AddressAutocomplete";
import { ArrowLeft } from "lucide-react";

interface AddPropertyStepProps {
  data?: { address?: StructuredAddress; type?: string };
  onChange: (data: { address?: StructuredAddress; type?: string }) => void;
  onNext: () => void;
  onBack: () => void;
}

const AddPropertyStep: React.FC<AddPropertyStepProps> = ({
  data,
  onChange,
  onNext,
  onBack,
}) => {
  const [error, setError] = useState("");

  const handleNext = () => {
    // Check if address has required fields (street, city, state, zip)
    const hasAddress = !!(data?.address?.street && data?.address?.city && data?.address?.state && data?.address?.zip);
    let hasType = !!typeInputValue && typeInputValue.trim() !== "";
    // Always call onChange with the latest type value before validation
    onChange({ ...data, type: typeInputValue ? typeInputValue : "" });
    if (!hasAddress || !hasType) {
      let addressError = "";
      if (!hasAddress) {
        addressError = "Address is required.";
      }
      if (!hasType) {
        addressError += (addressError ? "\n" : "") + "Property Tag is required.";
      }
      setError(addressError);
      return;
    }
    setError("");
    // Ensure the latest type is in onboarding data before next step
    onChange({ ...data, type: typeInputValue ? typeInputValue : "" });
    onNext();
  };

  const defaultPropertyNames = ["Our Home", "Parents House", "Rental"];

  const [typeInputValue, setTypeInputValue] = useState(data?.type || "");

  React.useEffect(() => {
    setTypeInputValue(data?.type || "");
  }, [data?.type]);

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
        2/5
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
        Add your <span style={{ fontWeight: 400 }}>property</span> here
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
        Enter your address below.
      </Typography>

      {/* Address Autocomplete Field */}
      <AddressAutocomplete
        value={data?.address?.full || ""}
        onChange={(addressObj) => onChange({ ...data, address: addressObj })}
      />
      {/* Editable Dropdown for Property Tag */}
      <Box sx={{ width: "100%", maxWidth: 520, mb: 32 }}>

        <Autocomplete
          freeSolo
          options={defaultPropertyNames}
          value={typeInputValue}
          inputValue={typeInputValue}
          onInputChange={(_, newValue) => {
            if(newValue.length <= 15) setTypeInputValue(newValue);
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Property Name"
              variant="outlined"
              inputProps={{
                ...params.inputProps,
                maxLength: 15,
                placeholder: "Example - Our Home, Parents House or Rental"
              }}
            />
          )}
        />
      </Box>

      {/* Next Button */}
      {error && (
        <Typography color="error" sx={{ mb: 2, fontSize: "18px" }}>{error}</Typography>
      )}
      <Button
        variant="contained"
        onClick={handleNext}
        disabled={!(data?.address?.street && data?.address?.city && data?.address?.state && data?.address?.zip && typeInputValue && typeInputValue.trim() !== "")}
        sx={{
          backgroundColor: "#89AE99",
          fontSize: "24px",
          fontWeight: 400,
          borderRadius: "8px",
          textTransform: "none",
          width: "100%",
          fontFamily: 'Nunito, Arial, sans-serif',
          maxWidth: 260,
          opacity: !(data?.address?.street && data?.address?.city && data?.address?.state && data?.address?.zip && typeInputValue && typeInputValue.trim() !== "") ? 0.6 : 1,
        }}
      >
        Next
      </Button>
    </Box>
  );
}

export default AddPropertyStep;
