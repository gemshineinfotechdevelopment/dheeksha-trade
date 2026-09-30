import { useState, useEffect, useMemo, type FC } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  TextField,
  Chip,
  IconButton,
} from '@mui/material';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import { parseDateToTimestamp, isDateInRange } from '../utils/printUtils';

interface DateRangePrintModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  items: any[];
  getDateFromItem?: (item: any) => string;
  onConfirmPrint: (filteredItems: any[], dateRangeText: string) => void;
}

export const DateRangePrintModal: FC<DateRangePrintModalProps> = ({
  open,
  onClose,
  title,
  subtitle,
  items,
  getDateFromItem = (item) => item.date || item.lastTransactionDate || item.createdAt || '',
  onConfirmPrint,
}) => {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [activePreset, setActivePreset] = useState<string>('ALL');

  // Format Helper for input YYYY-MM-DD
  const formatDateToYMD = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatDateToDMY = (d: Date) => {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  };

  // Reset when dialog opens
  useEffect(() => {
    if (open) {
      setActivePreset('ALL');
      setFromDate('');
      setToDate('');
    }
  }, [open]);

  // Quick preset handlers
  const handleSelectPreset = (preset: string) => {
    setActivePreset(preset);
    const now = new Date();

    if (preset === 'ALL') {
      setFromDate('');
      setToDate('');
    } else if (preset === 'TODAY') {
      const ymd = formatDateToYMD(now);
      setFromDate(ymd);
      setToDate(ymd);
    } else if (preset === 'THIS_MONTH') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setFromDate(formatDateToYMD(firstDay));
      setToDate(formatDateToYMD(lastDay));
    } else if (preset === 'LAST_MONTH') {
      const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
      setFromDate(formatDateToYMD(firstDay));
      setToDate(formatDateToYMD(lastDay));
    } else if (preset === 'LAST_30_DAYS') {
      const past = new Date();
      past.setDate(past.getDate() - 30);
      setFromDate(formatDateToYMD(past));
      setToDate(formatDateToYMD(now));
    } else if (preset === 'THIS_YEAR') {
      const firstDay = new Date(now.getFullYear(), 0, 1);
      const lastDay = new Date(now.getFullYear(), 11, 31);
      setFromDate(formatDateToYMD(firstDay));
      setToDate(formatDateToYMD(lastDay));
    }
  };

  // Filter items matching date range
  const filteredItems = useMemo(() => {
    if (!fromDate && !toDate) return items;

    return items.filter((item) => {
      const itemDate = getDateFromItem(item);
      if (!itemDate) return true; // If no date, include in general list
      return isDateInRange(itemDate, fromDate, toDate);
    });
  }, [items, fromDate, toDate, getDateFromItem]);

  const handlePrintClick = () => {
    let rangeText = 'All Records';
    if (fromDate && toDate) {
      const fromD = new Date(parseDateToTimestamp(fromDate));
      const toD = new Date(parseDateToTimestamp(toDate));
      rangeText = `Period: ${formatDateToDMY(fromD)} to ${formatDateToDMY(toD)}`;
    } else if (fromDate) {
      const fromD = new Date(parseDateToTimestamp(fromDate));
      rangeText = `From: ${formatDateToDMY(fromD)}`;
    } else if (toDate) {
      const toD = new Date(parseDateToTimestamp(toDate));
      rangeText = `Up to: ${formatDateToDMY(toD)}`;
    }

    onConfirmPrint(filteredItems, rangeText);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: '12px',
            p: 1,
          },
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pb: 1,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CalendarMonthRoundedIcon sx={{ color: '#0B4DB7', fontSize: 24 }} />
          <Typography sx={{ fontSize: '18px', fontWeight: 800, color: '#0F172A' }}>
            {title || 'Select Date Range for Print'}
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose} sx={{ color: '#64748B' }}>
          <CloseRoundedIcon sx={{ fontSize: 20 }} />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        <Typography sx={{ fontSize: '13px', color: '#64748B', mb: 2 }}>
          {subtitle || 'Filter the data between specific dates before printing on standard A4 format.'}
        </Typography>

        {/* Quick Date Presets */}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2.5 }}>
          <Chip
            label="All Time"
            onClick={() => handleSelectPreset('ALL')}
            sx={{
              fontWeight: 600,
              fontSize: '12px',
              backgroundColor: activePreset === 'ALL' ? '#0B4DB7' : '#F1F5F9',
              color: activePreset === 'ALL' ? '#FFFFFF' : '#334155',
              cursor: 'pointer',
              '&:hover': { backgroundColor: activePreset === 'ALL' ? '#083B8D' : '#E2E8F0' },
            }}
          />
          <Chip
            label="Today"
            onClick={() => handleSelectPreset('TODAY')}
            sx={{
              fontWeight: 600,
              fontSize: '12px',
              backgroundColor: activePreset === 'TODAY' ? '#0B4DB7' : '#F1F5F9',
              color: activePreset === 'TODAY' ? '#FFFFFF' : '#334155',
              cursor: 'pointer',
              '&:hover': { backgroundColor: activePreset === 'TODAY' ? '#083B8D' : '#E2E8F0' },
            }}
          />
          <Chip
            label="This Month"
            onClick={() => handleSelectPreset('THIS_MONTH')}
            sx={{
              fontWeight: 600,
              fontSize: '12px',
              backgroundColor: activePreset === 'THIS_MONTH' ? '#0B4DB7' : '#F1F5F9',
              color: activePreset === 'THIS_MONTH' ? '#FFFFFF' : '#334155',
              cursor: 'pointer',
              '&:hover': { backgroundColor: activePreset === 'THIS_MONTH' ? '#083B8D' : '#E2E8F0' },
            }}
          />
          <Chip
            label="Last Month"
            onClick={() => handleSelectPreset('LAST_MONTH')}
            sx={{
              fontWeight: 600,
              fontSize: '12px',
              backgroundColor: activePreset === 'LAST_MONTH' ? '#0B4DB7' : '#F1F5F9',
              color: activePreset === 'LAST_MONTH' ? '#FFFFFF' : '#334155',
              cursor: 'pointer',
              '&:hover': { backgroundColor: activePreset === 'LAST_MONTH' ? '#083B8D' : '#E2E8F0' },
            }}
          />
          <Chip
            label="Last 30 Days"
            onClick={() => handleSelectPreset('LAST_30_DAYS')}
            sx={{
              fontWeight: 600,
              fontSize: '12px',
              backgroundColor: activePreset === 'LAST_30_DAYS' ? '#0B4DB7' : '#F1F5F9',
              color: activePreset === 'LAST_30_DAYS' ? '#FFFFFF' : '#334155',
              cursor: 'pointer',
              '&:hover': { backgroundColor: activePreset === 'LAST_30_DAYS' ? '#083B8D' : '#E2E8F0' },
            }}
          />
          <Chip
            label="This Year"
            onClick={() => handleSelectPreset('THIS_YEAR')}
            sx={{
              fontWeight: 600,
              fontSize: '12px',
              backgroundColor: activePreset === 'THIS_YEAR' ? '#0B4DB7' : '#F1F5F9',
              color: activePreset === 'THIS_YEAR' ? '#FFFFFF' : '#334155',
              cursor: 'pointer',
              '&:hover': { backgroundColor: activePreset === 'THIS_YEAR' ? '#083B8D' : '#E2E8F0' },
            }}
          />
        </Box>

        {/* Date Inputs Grid */}
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 2.5 }}>
          <Box>
            <Typography sx={{ fontSize: '13px', fontWeight: 600, color: '#475569', mb: 0.6 }}>
              From Date
            </Typography>
            <TextField
              fullWidth
              size="small"
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setActivePreset('CUSTOM');
              }}
              slotProps={{
                input: {
                  sx: { fontSize: '13.5px', fontWeight: 500, borderRadius: '6px' },
                },
              }}
            />
          </Box>
          <Box>
            <Typography sx={{ fontSize: '13px', fontWeight: 600, color: '#475569', mb: 0.6 }}>
              To Date
            </Typography>
            <TextField
              fullWidth
              size="small"
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setActivePreset('CUSTOM');
              }}
              slotProps={{
                input: {
                  sx: { fontSize: '13.5px', fontWeight: 500, borderRadius: '6px' },
                },
              }}
            />
          </Box>
        </Box>

        {/* Live Filter Preview Banner */}
        <Box
          sx={{
            p: 1.6,
            borderRadius: '8px',
            backgroundColor: filteredItems.length > 0 ? '#F0FDF4' : '#FEF2F2',
            border: '1px solid',
            borderColor: filteredItems.length > 0 ? '#BBF7D0' : '#FECACA',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Box>
            <Typography
              sx={{
                fontSize: '13px',
                fontWeight: 700,
                color: filteredItems.length > 0 ? '#166534' : '#991B1B',
              }}
            >
              {filteredItems.length} Records ready to print
            </Typography>
            <Typography sx={{ fontSize: '11.5px', color: '#64748B', mt: 0.2 }}>
              Format: Standard A4 • Clean Multi-Page Layout
            </Typography>
          </Box>
          <Chip
            label={filteredItems.length > 0 ? 'Ready' : 'No Data'}
            size="small"
            sx={{
              backgroundColor: filteredItems.length > 0 ? '#DCFCE7' : '#FEE2E2',
              color: filteredItems.length > 0 ? '#15803D' : '#DC2626',
              fontWeight: 700,
              fontSize: '11px',
            }}
          />
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2, pt: 1 }}>
        <Button onClick={onClose} sx={{ color: '#64748B', fontWeight: 600, textTransform: 'none' }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          disableElevation
          onClick={handlePrintClick}
          disabled={filteredItems.length === 0}
          startIcon={<PrintOutlinedIcon sx={{ fontSize: 18 }} />}
          sx={{
            backgroundColor: '#0B4DB7',
            color: '#FFFFFF',
            fontWeight: 700,
            textTransform: 'none',
            px: 2.5,
            borderRadius: '6px',
            '&:hover': { backgroundColor: '#083B8D' },
          }}
        >
          Print A4 Report ({filteredItems.length})
        </Button>
      </DialogActions>
    </Dialog>
  );
};
