import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  components: {
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: '#6A7F91',
            borderWidth: '1.5px',
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: '#6A7F91',
            borderWidth: '1.5px',
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: '#6A7F91',
            borderWidth: '2px',
          },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: '#6A7F91',
          '&.Mui-focused': {
            color: '#6A7F91',
          },
        },
      },
    },
    MuiCssBaseline: {
      styleOverrides: {
        '.MuiPickersInputBase-root.MuiPickersOutlinedInput-root .MuiOutlinedInput-notchedOutline': {
          borderColor: '#6A7F91',
          borderWidth: '1.5px',
        },
        '.MuiPickersInputBase-root.MuiPickersOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
          borderColor: '#6A7F91',
          borderWidth: '2px',
          boxShadow: 'none',
        },
        '.MuiPickersInputBase-root.MuiPickersOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
          borderColor: '#6A7F91',
        },
        // Also target the Pickers-specific notchedOutline class (DatePicker main color)
        '.MuiPickersInputBase-root.MuiPickersOutlinedInput-root .MuiPickersOutlinedInput-notchedOutline': {
          borderColor: '#6A7F91',
          borderWidth: '1.5px',
        },
        '.MuiPickersInputBase-root.MuiPickersOutlinedInput-root:hover .MuiPickersOutlinedInput-notchedOutline': {
          borderColor: '#6A7F91',
        },
        // Fallback: target the pickers notchedOutline class directly
        '.MuiPickersOutlinedInput-notchedOutline': {
          borderColor: '#6A7F91 !important',
          borderWidth: '1.5px !important',
        },
        // Ensure the outline updates when the inner input element is focused
        '.MuiOutlinedInput-root .MuiOutlinedInput-input:focus ~ .MuiOutlinedInput-notchedOutline, .MuiOutlinedInput-root .MuiOutlinedInput-input:focus + .MuiOutlinedInput-notchedOutline': {
          borderColor: '#6A7F91',
          borderWidth: '1.5px',
        },
        '.MuiPickersOutlinedInput-root .MuiOutlinedInput-input:focus ~ .MuiOutlinedInput-notchedOutline, .MuiPickersOutlinedInput-root .MuiOutlinedInput-input:focus + .MuiOutlinedInput-notchedOutline': {
          borderColor: '#6A7F91',
          borderWidth: '2px',
        },
      },
    },
  },
});

export default theme;
