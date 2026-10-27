import React, { useRef, type FC } from 'react';
import {
  Box,
  TextField,
  IconButton,
  InputAdornment,
  type SxProps,
  type Theme,
} from '@mui/material';
import CalendarTodayOutlinedIcon from '@mui/icons-material/CalendarTodayOutlined';

interface DatePickerFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  size?: 'small' | 'medium';
  fullWidth?: boolean;
  disabled?: boolean;
  sx?: SxProps<Theme>;
  inputSx?: SxProps<Theme>;
  iconSize?: number;
}

// Convert "DD-MM-YYYY" or "DD/MM/YYYY" to "YYYY-MM-DD" for HTML input[type="date"]
export const formatToIso = (dStr: string): string => {
  if (!dStr) return '';
  const clean = dStr.trim().replace(/\//g, '-');
  const parts = clean.split('-');
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      const [y, m, d] = parts;
      const numY = parseInt(y, 10);
      const numM = parseInt(m, 10);
      const numD = parseInt(d, 10);
      if (!isNaN(numY) && !isNaN(numM) && !isNaN(numD)) {
        return `${numY.toString().padStart(4, '0')}-${numM.toString().padStart(2, '0')}-${numD.toString().padStart(2, '0')}`;
      }
    }
    if (parts[2].length === 4) {
      const [d, m, y] = parts;
      const numY = parseInt(y, 10);
      const numM = parseInt(m, 10);
      const numD = parseInt(d, 10);
      if (!isNaN(numY) && !isNaN(numM) && !isNaN(numD)) {
        return `${numY.toString().padStart(4, '0')}-${numM.toString().padStart(2, '0')}-${numD.toString().padStart(2, '0')}`;
      }
    }
  }
  return '';
};

// Convert "YYYY-MM-DD" to "DD-MM-YYYY"
export const formatIsoToDdMmYyyy = (isoStr: string): string => {
  if (!isoStr) return '';
  const parts = isoStr.split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    const [y, m, d] = parts;
    return `${d.padStart(2, '0')}-${m.padStart(2, '0')}-${y}`;
  }
  return isoStr;
};

export const DatePickerField: FC<DatePickerFieldProps> = ({
  value,
  onChange,
  placeholder = 'dd-mm-yyyy',
  size = 'small',
  fullWidth = true,
  disabled = false,
  sx,
  inputSx,
  iconSize = 16,
}) => {
  const hiddenInputRef = useRef<HTMLInputElement>(null);

  const handleOpenPicker = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;

    if (hiddenInputRef.current) {
      if (typeof hiddenInputRef.current.showPicker === 'function') {
        try {
          hiddenInputRef.current.showPicker();
          return;
        } catch (err) {
          console.warn('showPicker error:', err);
        }
      }
      hiddenInputRef.current.focus();
      hiddenInputRef.current.click();
    }
  };

  return (
    <Box
      sx={{
        position: 'relative',
        width: fullWidth ? '100%' : 'auto',
        display: 'inline-block',
        ...sx,
      }}
    >
      <TextField
        fullWidth={fullWidth}
        size={size}
        disabled={disabled}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        slotProps={{
          input: {
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  size="small"
                  disabled={disabled}
                  onClick={handleOpenPicker}
                  title="Open Calendar"
                  sx={{
                    p: 0.5,
                    color: '#1E293B',
                    cursor: disabled ? 'default' : 'pointer',
                    transition: 'all 0.15s ease',
                    '&:hover': {
                      color: disabled ? '#94A3B8' : '#0B4DB7',
                      backgroundColor: disabled ? 'transparent' : 'rgba(11, 77, 183, 0.08)',
                    },
                  }}
                >
                  <CalendarTodayOutlinedIcon sx={{ fontSize: iconSize }} />
                </IconButton>
              </InputAdornment>
            ),
            sx: {
              fontSize: '12.5px',
              fontWeight: 500,
              backgroundColor: '#FFFFFF',
              borderRadius: '6px',
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: '#CBD5E1',
              },
              '&:hover .MuiOutlinedInput-notchedOutline': {
                borderColor: '#94A3B8',
              },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                borderColor: '#0B4DB7',
              },
              ...inputSx,
            },
          },
        }}
      />

      {/* Hidden Native Date Input for Browser Calendar Picker Dialog */}
      <input
        type="date"
        ref={hiddenInputRef}
        value={formatToIso(value)}
        disabled={disabled}
        onChange={(e) => {
          if (e.target.value) {
            onChange(formatIsoToDdMmYyyy(e.target.value));
          }
        }}
        tabIndex={-1}
        aria-hidden="true"
        style={{
          position: 'absolute',
          right: '8px',
          bottom: '8px',
          width: '24px',
          height: '24px',
          opacity: 0,
          pointerEvents: 'none',
          border: 'none',
          padding: 0,
          margin: 0,
          zIndex: -1,
        }}
      />
    </Box>
  );
};
