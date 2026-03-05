import { TextField, CircularProgress, List, ListItem, ListItemButton, ListItemText, Paper, Typography } from "@mui/material";
import Popper from "@mui/material/Popper";
import React, { useState, useRef, useEffect } from "react";

export interface StructuredAddress {
  full?: string;
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  lat?: number;
  lng?: number;
}

interface AddressAutocompleteAddPropertyProps {
  value: string;
  onChange: (address: StructuredAddress) => void;
}

const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;

const AddressAutocompleteAddProperty: React.FC<AddressAutocompleteAddPropertyProps> = ({ value, onChange }) => {
  const [input, setInput] = useState(value);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [error, setError] = useState("");
  const [addressSelected, setAddressSelected] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteServiceRef = useRef<any>(null);
  const placesServiceRef = useRef<any>(null);
  const win = window as any;

  // Load Google Maps Places API
  useEffect(() => {
    const tryInitServices = () => {
      if (win.google && win.google.maps && win.google.maps.places) {
        autocompleteServiceRef.current = new win.google.maps.places.AutocompleteService();
        const dummyDiv = document.createElement("div");
        placesServiceRef.current = new win.google.maps.places.PlacesService(dummyDiv);
      }
    };
    if (!win.google || !win.google.maps || !win.google.maps.places) {
      if (!document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]')) {
        const script = document.createElement("script");
        script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_API_KEY}&libraries=places&v=weekly`;
        script.async = true;
        script.onload = tryInitServices;
        document.body.appendChild(script);
      } else {
        const interval = setInterval(() => {
          if (win.google && win.google.maps && win.google.maps.places) {
            tryInitServices();
            clearInterval(interval);
          }
        }, 100);
      }
    } else {
      tryInitServices();
    }
  }, []);

  // Debounce input and fetch suggestions (imitate onboarding)
  useEffect(() => {
    if (addressSelected) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }
    const handler = setTimeout(() => {
      if (!input || !autocompleteServiceRef.current) {
        setSuggestions([]);
        setShowDropdown(false);
        return;
      }
      setLoading(true);
      autocompleteServiceRef.current.getPlacePredictions({ input, types: ["address"] }, (preds: any, status: any) => {
        if (win.google && status === win.google.maps.places.PlacesServiceStatus.OK && preds) {
          setSuggestions(preds);
          setShowDropdown(true);
          setError("");
        } else {
          setSuggestions([]);
          setShowDropdown(false);
        }
        setLoading(false);
      });
    }, 400);
    return () => clearTimeout(handler);
  }, [input, addressSelected]);

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    setAddressSelected(false);
  };

  // Handle suggestion select
  const handleSelect = (suggestion: any) => {
    setLoading(true);
    setShowDropdown(false);
    setInput(suggestion.description);
    setAddressSelected(true);
    if (placesServiceRef.current) {
      placesServiceRef.current.getDetails({ placeId: suggestion.place_id }, (result: any, status: any) => {
        if (win.google && status === win.google.maps.places.PlacesServiceStatus.OK && result) {
          const address: StructuredAddress = {
            full: result.formatted_address,
            lat: result.geometry?.location?.lat(),
            lng: result.geometry?.location?.lng(),
          };
          result.address_components.forEach((comp: any) => {
            if (comp.types.includes("street_number")) address.street = comp.long_name + (address.street ? " " + address.street : "");
            if (comp.types.includes("route")) address.street = (address.street ? address.street + " " : "") + comp.long_name;
            if (comp.types.includes("locality")) address.city = comp.long_name;
            if (comp.types.includes("administrative_area_level_1")) address.state = comp.short_name;
            if (comp.types.includes("postal_code")) address.zip = comp.long_name;
            if (comp.types.includes("country")) address.country = comp.long_name;
          });
          onChange(address);
          setError("");
        } else {
          setError("Failed to fetch address details.");
        }
        setLoading(false);
      });
    } else {
      setError("Google PlacesService not available.");
      setLoading(false);
    }
  };

  return (
    <div style={{ position: "relative", width: "520px" }}>
      <TextField
        inputRef={inputRef}
        label="Address"
        value={input}
        onChange={handleInputChange}
        fullWidth
        autoComplete="off"
        variant="outlined"
        sx={{ mb: 2 }}
      />
      {loading && <CircularProgress size={24} sx={{ position: "absolute", top: 12, right: 12 }} />}
      <Popper
        open={showDropdown && suggestions.length > 0}
        anchorEl={inputRef.current}
        placement="bottom-start"
        style={{ zIndex: 1300 }}
      >
        <Paper sx={{ width: inputRef.current ? inputRef.current.offsetWidth : 400, mt: 1 }}>
          <List>
            {suggestions.map((s) => (
              <ListItem key={s.place_id} disablePadding>
                <ListItemButton onClick={() => handleSelect(s)}>
                  <ListItemText primary={s.description} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Paper>
      </Popper>
      {error && (
        <Typography color="error" sx={{ mt: 1, fontSize: "14px" }}>{error}</Typography>
      )}
    </div>
  );
};

export default AddressAutocompleteAddProperty;
