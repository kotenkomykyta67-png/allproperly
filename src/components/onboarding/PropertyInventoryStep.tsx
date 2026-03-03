import React, { useState } from "react";
import {
  Box,
  Typography,
  Button,
  IconButton,
  Checkbox,
  FormGroup,
  FormControlLabel,
} from "@mui/material";
import { ArrowLeft } from "lucide-react";

interface PropertyInventoryStep {
  data?: string[];
  onChange: (data: string[]) => void;
  onNext: () => void;
  onBack: () => void;
}

const ITEMS = [
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

const PropertyInventoryStep: React.FC<PropertyInventoryStep> = ({
  data,
  onChange,
  onNext,
  onBack,
}) => {
  const [selected, setSelected] = useState<string[]>(
    data && data.length > 0 ? data : ITEMS.filter(i => i !== 'Hot Tub' && i !== 'Pool')
  );

  // Ensure parent state is updated on mount (for default selection)
  React.useEffect(() => {
    onChange(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleToggle = (item: string) => {
    const updated = selected.includes(item)
      ? selected.filter((i) => i !== item)
      : [...selected, item];
    setSelected(updated);
    onChange(updated);
  };

  // When Finish is clicked, ensure latest selection is saved before next step
  const handleFinish = () => {
    onChange(selected);
    onNext();
  };

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
        5/5
      </Typography>

      {/* Title */}
      <Typography
        sx={{
          fontSize: "44px",
          fontWeight: 400,
          color: "#374151",
          mb: 2,
          fontFamily: 'Nunito, Arial, sans-serif',
        }}
      >
        Property inventory
      </Typography>

      {/* Subtitle */}
      <Typography
        sx={{
          fontSize: "22px",
          color: "#6B7280",
          mb: 6,
          fontFamily: 'Nunito, Arial, sans-serif',
        }}
      >
        Check the items you have.
      </Typography>

      {/* Checkbox List */}
      <FormGroup
        sx={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr", // two equal columns
          gap: "12px 40px", // row gap + column gap
          justifyContent: "center",
          alignItems: "center",
          mb: 18,
          ml: 8,
          "& .MuiFormControlLabel-root": {
            justifyContent: "flex-start",
            margin: 0,
          },
          "& .MuiCheckbox-root": {
            color: "#89AE99",
            "&.Mui-checked": {
              color: "#89AE99",
            },
          },
          "& .MuiFormControlLabel-label": {
            fontSize: "22px", // increased font size
            color: "#374151",
          },
        }}
      >
        {ITEMS.map((item) => (
          <FormControlLabel
            key={item}
            control={
              <Checkbox
                checked={selected.includes(item)}
                onChange={() => handleToggle(item)}
              />
            }
            label={item}
          />
        ))}
      </FormGroup>

      {/* Finish Button */}
      <Button
        variant="contained"
        onClick={handleFinish}
        sx={{
          backgroundColor: "#89AE99",
          fontSize: "24px",
          fontWeight: 400,
          fontFamily: 'Nunito, Arial, sans-serif',
          borderRadius: "8px",
          textTransform: "none",
          width: "100%",
          maxWidth: 260,
        }}
      >
        Finish
      </Button>
    </Box>
  );
};

export default PropertyInventoryStep;
