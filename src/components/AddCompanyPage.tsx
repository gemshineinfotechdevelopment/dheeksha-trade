import { useState, type FC, type ChangeEvent } from 'react';
import {
  Box,
  Typography,
  Button,
  InputBase,
  Paper,
  CircularProgress,
} from '@mui/material';
import DomainOutlinedIcon from '@mui/icons-material/DomainOutlined';
import AddCircleOutlineRoundedIcon from '@mui/icons-material/AddCircleOutlineRounded';
import { CompaniesApi } from '../services/api';

interface AddCompanyPageProps {
  onCancel?: () => void;
  onSubmitSuccess?: () => void;
  onNavigateCompanies?: () => void;
}

export const AddCompanyPage: FC<AddCompanyPageProps> = ({
  onCancel,
  onSubmitSuccess,
  onNavigateCompanies,
}) => {
  const [formData, setFormData] = useState({
    companyName: '',
    gstNumber: '',
    registeredAddress: '',
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (field: string) => (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: e.target.value,
    }));
  };

  const handleSubmit = async () => {
    if (!formData.companyName.trim() || !formData.registeredAddress.trim()) {
      alert('Please fill in required fields (Company Name and Registered Address)');
      return;
    }

    try {
      setLoading(true);
      await CompaniesApi.create({
        name: formData.companyName.trim(),
        gstin: formData.gstNumber.trim() || 'N/A',
        address: formData.registeredAddress.trim(),
        avatarLetter: formData.companyName.trim().charAt(0).toUpperCase(),
        avatarBg: '#DBEAFE',
        avatarColor: '#0B4DB7',
      });
      if (onSubmitSuccess) {
        onSubmitSuccess();
      }
    } catch (err) {
      console.error('Failed to create company:', err);
      alert('Error creating company. Please check your backend connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        width: '100%',
        px: { xs: 2, sm: 3, md: 4 },
        py: { xs: 2.5, md: 3 },
        boxSizing: 'border-box',
      }}
    >
      {/* Breadcrumbs Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          mb: 2.5,
        }}
      >
        <DomainOutlinedIcon sx={{ fontSize: 18, color: '#64748B' }} />
        <Typography
          onClick={onNavigateCompanies}
          sx={{
            fontSize: '13.5px',
            fontWeight: 600,
            color: '#64748B',
            cursor: 'pointer',
            '&:hover': { color: '#0B4DB7' },
          }}
        >
          Companies
        </Typography>
        <Typography
          sx={{
            fontSize: '13.5px',
            color: '#94A3B8',
            userSelect: 'none',
          }}
        >
          ›
        </Typography>
        <Typography
          sx={{
            fontSize: '13.5px',
            fontWeight: 700,
            color: '#0B4DB7',
          }}
        >
          Add New Company
        </Typography>
      </Box>

      {/* Main Form Card */}
      <Paper
        elevation={0}
        sx={{
          width: '100%',
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          border: '1px solid #EEF2F6',
          boxShadow: '0 1px 3px 0 rgba(15, 23, 42, 0.03), 0 1px 2px -1px rgba(15, 23, 42, 0.03)',
          p: { xs: 2.5, sm: 3.5, md: 4 },
          boxSizing: 'border-box',
        }}
      >
        <Box component="form" noValidate autoComplete="off">
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
              gap: 2.5,
            }}
          >
            {/* Company Name Field */}
            <Box>
              <Typography
                sx={{
                  fontSize: '13px',
                  fontWeight: 700,
                  color: '#1E293B',
                  mb: 1,
                  letterSpacing: '-0.01em',
                }}
              >
                Company Legal Name *
              </Typography>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  px: 1.5,
                  height: '42px',
                  transition: 'all 0.15s ease',
                  '&:focus-within': {
                    borderColor: '#0B4DB7',
                    backgroundColor: '#FFFFFF',
                    boxShadow: '0 0 0 3px rgba(11, 77, 183, 0.1)',
                  },
                }}
              >
                <InputBase
                  fullWidth
                  placeholder="e.g. Acme Fireworks Pvt Ltd"
                  value={formData.companyName}
                  onChange={handleChange('companyName')}
                  sx={{
                    fontSize: '13.5px',
                    fontWeight: 500,
                    color: '#0F172A',
                    '& input::placeholder': {
                      color: '#94A3B8',
                      opacity: 1,
                    },
                  }}
                />
              </Box>
            </Box>

            {/* GST Number Field */}
            <Box>
              <Typography
                sx={{
                  fontSize: '13px',
                  fontWeight: 700,
                  color: '#1E293B',
                  mb: 1,
                  letterSpacing: '-0.01em',
                }}
              >
                GSTIN / Tax Registration Number
              </Typography>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  px: 1.5,
                  height: '42px',
                  transition: 'all 0.15s ease',
                  '&:focus-within': {
                    borderColor: '#0B4DB7',
                    backgroundColor: '#FFFFFF',
                    boxShadow: '0 0 0 3px rgba(11, 77, 183, 0.1)',
                  },
                }}
              >
                <InputBase
                  fullWidth
                  placeholder="e.g. 33AADCS5678Q1Z4"
                  value={formData.gstNumber}
                  onChange={handleChange('gstNumber')}
                  sx={{
                    fontSize: '13.5px',
                    fontWeight: 500,
                    color: '#0F172A',
                    '& input::placeholder': {
                      color: '#94A3B8',
                      opacity: 1,
                    },
                  }}
                />
              </Box>
            </Box>

            {/* Registered Address Field */}
            <Box sx={{ gridColumn: { sm: 'span 2' } }}>
              <Typography
                sx={{
                  fontSize: '13px',
                  fontWeight: 700,
                  color: '#1E293B',
                  mb: 1,
                  letterSpacing: '-0.01em',
                }}
              >
                Registered Office Address *
              </Typography>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  px: 1.5,
                  height: '42px',
                  transition: 'all 0.15s ease',
                  '&:focus-within': {
                    borderColor: '#0B4DB7',
                    backgroundColor: '#FFFFFF',
                    boxShadow: '0 0 0 3px rgba(11, 77, 183, 0.1)',
                  },
                }}
              >
                <InputBase
                  fullWidth
                  placeholder="e.g. 124 Industrial Area, Phase 1, Sivakasi, Tamil Nadu"
                  value={formData.registeredAddress}
                  onChange={handleChange('registeredAddress')}
                  sx={{
                    fontSize: '13.5px',
                    fontWeight: 500,
                    color: '#0F172A',
                    '& input::placeholder': {
                      color: '#94A3B8',
                      opacity: 1,
                    },
                  }}
                />
              </Box>
            </Box>
          </Box>

          {/* Action Buttons */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 1.5,
              mt: 4,
              pt: 3,
              borderTop: '1px solid #EEF2F6',
            }}
          >
            <Button
              variant="outlined"
              onClick={onCancel}
              disabled={loading}
              sx={{
                height: '40px',
                px: 2.5,
                borderRadius: '8px',
                fontSize: '13.5px',
                fontWeight: 600,
                color: '#64748B',
                borderColor: '#E2E8F0',
                textTransform: 'none',
                '&:hover': {
                  borderColor: '#CBD5E1',
                  backgroundColor: '#F8FAFC',
                },
              }}
            >
              Cancel
            </Button>

            <Button
              variant="contained"
              disableElevation
              onClick={handleSubmit}
              disabled={loading}
              startIcon={
                loading ? <CircularProgress size={16} color="inherit" /> : <AddCircleOutlineRoundedIcon sx={{ fontSize: 18 }} />
              }
              sx={{
                height: '40px',
                px: 3,
                borderRadius: '8px',
                fontSize: '13.5px',
                fontWeight: 700,
                backgroundColor: '#0B4DB7',
                color: '#FFFFFF',
                textTransform: 'none',
                '&:hover': {
                  backgroundColor: '#083B8D',
                },
              }}
            >
              {loading ? 'Creating...' : 'Register Company'}
            </Button>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};
