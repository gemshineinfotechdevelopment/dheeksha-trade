import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  IconButton,
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import { BillPrintTemplate, type BillPrintData } from './BillPrintTemplate';
import { printBillDirectly } from '../utils/printUtils';

interface BillPrintModalProps {
  open: boolean;
  onClose: () => void;
  bill: BillPrintData | null;
}

export const BillPrintModal: React.FC<BillPrintModalProps> = ({ open, onClose, bill }) => {
  if (!bill) return null;

  const handleTriggerPrint = () => {
    printBillDirectly(bill);
  };

  return (
    <>
      {/* Hidden print styling that guarantees ONLY the bill template is printed */}
      <style>
        {`
          @media print {
            body * {
              visibility: hidden !important;
            }
            .dheeksha-printable-section,
            .dheeksha-printable-section * {
              visibility: visible !important;
            }
            .dheeksha-printable-section {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
              background-color: #FFFFFF !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .dheeksha-no-print {
              display: none !important;
            }
            @page {
              size: A4 portrait;
              margin: 10mm;
            }
          }
        `}
      </style>

      {/* Screen Dialog for Previewing */}
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="md"
        fullWidth
        sx={{
          '& .MuiDialog-paper': {
            borderRadius: '12px',
            overflow: 'hidden',
            backgroundColor: '#F8FAFC',
          },
        }}
      >
        {/* Modal Top Bar */}
        <Box
          className="dheeksha-no-print"
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 3,
            py: 1.8,
            backgroundColor: '#0B4DB7',
            color: '#FFFFFF',
          }}
        >
          <Box>
            <Typography sx={{ fontSize: '16px', fontWeight: 800 }}>
              Bill Preview - #{bill.billNo || 'New'}
            </Typography>
            <Typography sx={{ fontSize: '12px', color: '#DBEAFE', fontWeight: 500 }}>
              {bill.customerName} | {bill.companyName}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button
              variant="contained"
              disableElevation
              onClick={handleTriggerPrint}
              startIcon={<PrintOutlinedIcon sx={{ fontSize: '18px !important', color: '#0F172A' }} />}
              sx={{
                backgroundColor: '#FFFFFF',
                color: '#0F172A',
                fontSize: '13px',
                fontWeight: 700,
                textTransform: 'none',
                px: 2,
                py: 0.6,
                borderRadius: '6px',
                '&:hover': {
                  backgroundColor: '#F1F5F9',
                },
              }}
            >
              Print Invoice
            </Button>
            <IconButton onClick={onClose} sx={{ color: '#FFFFFF', p: 0.8 }}>
              <CloseRoundedIcon sx={{ fontSize: 20 }} />
            </IconButton>
          </Box>
        </Box>

        {/* Modal Body with Bill Document */}
        <DialogContent
          sx={{
            p: { xs: 1.5, sm: 3 },
            backgroundColor: '#F1F5F9',
            display: 'flex',
            justifyContent: 'center',
            overflowY: 'auto',
          }}
        >
          <Box
            className="dheeksha-printable-section"
            sx={{
              backgroundColor: '#FFFFFF',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
              borderRadius: '4px',
              width: '100%',
              maxWidth: '750px',
            }}
          >
            <BillPrintTemplate bill={bill} />
          </Box>
        </DialogContent>

        {/* Modal Bottom Actions */}
        <DialogActions
          className="dheeksha-no-print"
          sx={{
            px: 3,
            py: 1.5,
            backgroundColor: '#FFFFFF',
            borderTop: '1px solid #E2E8F0',
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <Button
            onClick={onClose}
            sx={{
              color: '#64748B',
              fontSize: '13px',
              fontWeight: 600,
              textTransform: 'none',
            }}
          >
            Close
          </Button>

          <Button
            variant="contained"
            disableElevation
            onClick={handleTriggerPrint}
            startIcon={<PrintOutlinedIcon sx={{ fontSize: '18px !important' }} />}
            sx={{
              backgroundColor: '#0B4DB7',
              color: '#FFFFFF',
              fontSize: '13px',
              fontWeight: 700,
              textTransform: 'none',
              px: 3,
              py: 0.8,
              borderRadius: '6px',
              '&:hover': {
                backgroundColor: '#083B8D',
              },
            }}
          >
            Print
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
