import React, { useState, useRef, useEffect } from "react";
import { Autocomplete, TextField, CircularProgress, Typography } from "@mui/material";

export type StructuredAddress = {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  lat?: number;
  lng?: number;
  full?: string;
};

interface AddressAutocompleteProps {
  value: string;
  onChange: (address: StructuredAddress) => void;
}

const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;

const AddressAutocomplete: React.FC<AddressAutocompleteProps> = ({ value, onChange }) => {
  const placesServiceRef = useRef<any>(null);
  const [input, setInput] = useState(value);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [addressSelected, setAddressSelected] = useState(false);
  const autocompleteServiceRef = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const win = window as any;

  useEffect(() => {
    const tryInitPlacesService = () => {
      if (!placesServiceRef.current && win.google && win.google.maps && win.google.maps.places) {
        const dummyDiv = document.createElement('div');
        placesServiceRef.current = new win.google.maps.places.PlacesService(dummyDiv);
      }
    };
    tryInitPlacesService();
    if (!win.google || !win.google.maps || !win.google.maps.places) {
      if (!document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]')) {
        const script = document.createElement("script");
        script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_API_KEY}&libraries=places&v=weekly`;
        script.async = true;
        script.onload = () => {
          autocompleteServiceRef.current = new win.google.maps.places.AutocompleteService();
          tryInitPlacesService();
        };
        document.body.appendChild(script);
      } else {
        const interval = setInterval(() => {
          if (win.google && win.google.maps && win.google.maps.places) {
            autocompleteServiceRef.current = new win.google.maps.places.AutocompleteService();
            tryInitPlacesService();
            clearInterval(interval);
          }
        }, 100);
      }
    } else {
      autocompleteServiceRef.current = new win.google.maps.places.AutocompleteService();
      tryInitPlacesService();
    }
    if (!win.google || !win.google.maps || !win.google.maps.places) {
      if (!document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]')) {
        const script = document.createElement("script");
        script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_API_KEY}&libraries=places&v=weekly`;
        script.async = true;
        script.onload = () => {
          autocompleteServiceRef.current = new win.google.maps.places.AutocompleteService();
        };
        document.body.appendChild(script);
      } else {
        const interval = setInterval(() => {
          if (win.google && win.google.maps && win.google.maps.places) {
            autocompleteServiceRef.current = new win.google.maps.places.AutocompleteService();
            clearInterval(interval);
          }
        }, 100);
      }
    } else {
      autocompleteServiceRef.current = new win.google.maps.places.AutocompleteService();
    }
  }, []);

  useEffect(() => {
    if (addressSelected) {
      setSuggestions([]);
      return;
    }
    const handler = setTimeout(() => {
      if (!input || !autocompleteServiceRef.current) {
        setSuggestions([]);
        return;
      }
      setLoading(true);
      autocompleteServiceRef.current.getPlacePredictions({ input, types: ["address"] }, (preds: any, status: any) => {
        if (win.google && status === win.google.maps.places.PlacesServiceStatus.OK && preds) {
          setSuggestions(preds);
          setError("");
        } else {
          setSuggestions([]);
        }
        setLoading(false);
      });
    }, 400);
    return () => clearTimeout(handler);
  }, [input, addressSelected]);

  const handleInputChange = (value: string) => {
    setInput(value);
    setError("");
    
    // If input is cleared, notify parent that address is cleared
    if (!value || value.trim() === "") {
      setAddressSelected(false);
      onChange({
        street: "",
        city: "",
        state: "",
        zip: "",
        country: "",
        lat: 0,
        lng: 0,
        full: ""
      });
      setSuggestions([]);
      setLoading(false);
      return;
    }
    
    if (value.length < 3) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    autocompleteServiceRef.current.getPlacePredictions({ input: value, types: ["address"] }, (preds: any, status: any) => {
      if (win.google && status === win.google.maps.places.PlacesServiceStatus.OK && preds) {
        setSuggestions(preds);
        setError("");
      } else {
        setSuggestions([]);
      }
      setLoading(false);
    });
  };

  const handleSelect = (suggestion: any) => {
    setLoading(true);
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
          address.street = address.street || "";
          address.city = address.city || "";
          address.state = address.state || "";
          address.zip = address.zip || "";
          address.country = address.country || "";
          address.lat = typeof address.lat === "number" ? address.lat : 0;
          address.lng = typeof address.lng === "number" ? address.lng : 0;
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
    <Autocomplete
      freeSolo
      fullWidth
      options={suggestions}
      getOptionLabel={option => option.description || ""}
      inputValue={input}
      onInputChange={(_, value) => handleInputChange(value)}
      loading={loading}
      onChange={(_, value) => value && handleSelect(value)}
      renderInput={(params) => (
        <TextField
          {...params}
          inputRef={inputRef}
          label="Address"
          variant="outlined"
          autoComplete="off"
          sx={{ mb: 2 }}
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loading ? <CircularProgress color="inherit" size={20} /> : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
/>
{error && (
  <Typography color="error" sx={{ mt: 1, fontSize: "14px" }}>{error}</Typography>
)}
    </div>
  );
};

export default AddressAutocomplete;
