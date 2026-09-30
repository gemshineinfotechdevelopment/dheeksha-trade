import { useState, useEffect, useMemo, type FC } from 'react';
import {
  Box,
  Typography,
  Button,
  InputBase,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  Autocomplete,
} from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ModeEditOutlineRoundedIcon from '@mui/icons-material/ModeEditOutlineRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import AccountBalanceWalletRoundedIcon from '@mui/icons-material/AccountBalanceWalletRounded';
import PaymentsRoundedIcon from '@mui/icons-material/PaymentsRounded';
import PeopleAltRoundedIcon from '@mui/icons-material/PeopleAltRounded';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import SavingsRoundedIcon from '@mui/icons-material/SavingsRounded';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import { CustomersApi, AccountsApi, CompaniesApi } from '../services/api';
import { printCustomerListDirectly } from '../utils/printUtils';
import { shareLedgerOnWhatsApp } from '../utils/whatsappUtils';
import { DateRangePrintModal } from './DateRangePrintModal';

export interface CustomerFinancial {
  _id?: string;
  id?: string;
  idCode?: string;
  name: string;
  avatarLetter?: string;
  avatarBg?: string;
  avatarColor?: string;
  address: string;
  mobile: string;
  gst: string;
  totalDebit?: number;
  totalCredit?: number;
  pendingDue?: number;
  netBalance?: number;
  totalAdvanceReceived?: number;
  totalAdvanceUsed?: number;
  availableAdvance?: number;
  availableAmount?: number;
  masterPerformaNumber?: string;
  masterPerformaId?: string;
  status?: 'PENDING' | 'SETTLED' | 'ADVANCE';
  lastTransactionDate?: string;
}

interface AllCustomersPageProps {
  onAddNewCustomer?: () => void;
  onSelectCustomerForParticular?: (customerName: string, subTab?: 'Account Details' | 'Create Particular') => void;
}

export const AllCustomersPage: FC<AllCustomersPageProps> = ({
  onAddNewCustomer,
  onSelectCustomerForParticular,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'SETTLED' | 'ADVANCE'>('ALL');
  const [customers, setCustomers] = useState<CustomerFinancial[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit Customer Dialog State
  const [openEditModal, setOpenEditModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerFinancial | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    mobile: '',
    gst: '',
    address: '',
  });
  const [editLoading, setEditLoading] = useState(false);

  // Quick Payment / Add Credit Modal State
  const [openPaymentModal, setOpenPaymentModal] = useState(false);
  const [openDatePrintModal, setOpenDatePrintModal] = useState(false);
  const [paymentCustomer, setPaymentCustomer] = useState<CustomerFinancial | null>(null);
  const [companies, setCompanies] = useState<any[]>([]);
  const [paymentForm, setPaymentForm] = useState({
    companyName: '',
    creditAmount: '',
    paymentType: 'Advance Payment',
    date: new Date().toLocaleDateString('en-GB').replace(/\//g, '-'),
    notes: '',
  });
  const [paymentLoading, setPaymentLoading] = useState(false);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const data = await CustomersApi.getAll();
      setCustomers(data || []);
    } catch (err) {
      console.error('Failed to fetch customers:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCompanies = async () => {
    try {
      const data = await CompaniesApi.getAll();
      setCompanies(data || []);
      if (data && data.length > 0 && !paymentForm.companyName) {
        setPaymentForm((prev) => ({ ...prev, companyName: data[0].name }));
      }
    } catch (err) {
      console.error('Failed to fetch companies:', err);
    }
  };

  useEffect(() => {
    fetchCustomers();
    fetchCompanies();
  }, []);

  // Overall Financial Aggregates
  const financialTotals = useMemo(() => {
    let totalDebit = 0;
    let totalCredit = 0;
    let totalPendingDue = 0;
    let totalAdvanceHeld = 0;
    let pendingCustomersCount = 0;
    let settledCustomersCount = 0;
    let advanceCustomersCount = 0;

    customers.forEach((c) => {
      const deb = c.totalDebit || 0;
      const cred = c.totalCredit || 0;
      const due = c.pendingDue || 0;
      const net = c.netBalance || 0;

      totalDebit += deb;
      totalCredit += cred;
      totalPendingDue += due;

      if (net > 0) {
        totalAdvanceHeld += net;
        advanceCustomersCount += 1;
      } else if (due > 0) {
        pendingCustomersCount += 1;
      } else {
        settledCustomersCount += 1;
      }
    });

    return {
      totalDebit,
      totalCredit,
      totalPendingDue,
      totalAdvanceHeld,
      pendingCustomersCount,
      settledCustomersCount,
      advanceCustomersCount,
      totalCount: customers.length,
    };
  }, [customers]);

  const handleOpenEdit = (customer: CustomerFinancial) => {
    setEditingCustomer(customer);
    setEditFormData({
      name: customer.name || '',
      mobile: customer.mobile || '',
      gst: customer.gst || '',
      address: customer.address || '',
    });
    setOpenEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editingCustomer) return;
    const id = editingCustomer._id || editingCustomer.id;
    if (!id) return;

    if (!editFormData.name.trim() || !editFormData.address.trim()) {
      alert('Please fill in Customer Name and Address');
      return;
    }

    try {
      setEditLoading(true);
      await CustomersApi.update(id, {
        name: editFormData.name.trim(),
        mobile: editFormData.mobile.trim() || 'N/A',
        gst: editFormData.gst.trim() || 'N/A',
        address: editFormData.address.trim(),
        avatarLetter: editFormData.name.trim().charAt(0).toUpperCase(),
      });
      setOpenEditModal(false);
      fetchCustomers();
    } catch (err) {
      console.error('Failed to update customer:', err);
      alert('Error updating customer');
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (
      !window.confirm(
        'Are you sure you want to delete this customer? This will also delete all associated particular bills and account ledger records.'
      )
    )
      return;
    try {
      const deletedCust = customers.find((c) => (c._id || c.id) === id);
      await CustomersApi.delete(id);
      setCustomers((prev) => prev.filter((c) => (c._id || c.id) !== id));
      if (deletedCust && localStorage.getItem('dheeksha_active_customer') === deletedCust.name) {
        localStorage.removeItem('dheeksha_active_customer');
      }
    } catch (err) {
      console.error('Failed to delete customer:', err);
      alert('Error deleting customer');
    }
  };

  // Open Quick Payment Dialog
  const handleOpenPayment = (customer: CustomerFinancial) => {
    setPaymentCustomer(customer);
    const due = customer.pendingDue || 0;
    setPaymentForm({
      companyName: companies.length > 0 ? companies[0].name : 'General',
      creditAmount: due > 0 ? String(due) : '',
      paymentType: due > 0 ? 'Bill Payment' : 'Advance Payment',
      date: new Date().toLocaleDateString('en-GB').replace(/\//g, '-'),
      notes: '',
    });
    setOpenPaymentModal(true);
  };

  // Save Quick Payment / Advance Credit
  const handleSavePayment = async () => {
    if (!paymentCustomer) return;
    const amountNum = parseFloat(paymentForm.creditAmount.replace(/,/g, ''));
    if (isNaN(amountNum) || amountNum <= 0) {
      alert('Please enter a valid payment/advance amount');
      return;
    }

    try {
      setPaymentLoading(true);
      await AccountsApi.addCredit({
        customerId: paymentCustomer._id || paymentCustomer.id,
        customerName: paymentCustomer.name,
        companyName: paymentForm.companyName || 'General',
        creditAmount: amountNum.toFixed(2),
        date: paymentForm.date || new Date().toLocaleDateString('en-GB').replace(/\//g, '-'),
        notes: paymentForm.notes || 'Payment / Advance received',
      });
      setOpenPaymentModal(false);
      await fetchCustomers();
    } catch (err) {
      console.error('Failed to record payment:', err);
      alert('Error recording payment');
    } finally {
      setPaymentLoading(false);
    }
  };

  // Share Customer Statement on WhatsApp
  const handleShareCustomerWhatsApp = async (customer: CustomerFinancial) => {
    try {
      const ledgerData = await AccountsApi.getAll(customer.name);
      await shareLedgerOnWhatsApp(customer.name, ledgerData || [], undefined, undefined, customer.mobile);
    } catch (err) {
      console.error('Failed to share customer statement on WhatsApp:', err);
    }
  };

  // Filtering Customers
  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      const matchesSearch =
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.address && c.address.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (c.gst && c.gst.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (c.mobile && c.mobile.includes(searchTerm)) ||
        (c.idCode && c.idCode.toLowerCase().includes(searchTerm.toLowerCase()));

      if (!matchesSearch) return false;

      if (statusFilter === 'PENDING') {
        return (c.pendingDue || 0) > 0;
      }
      if (statusFilter === 'SETTLED') {
        return (c.pendingDue || 0) === 0 && (c.netBalance || 0) <= 0;
      }
      if (statusFilter === 'ADVANCE') {
        return (c.netBalance || 0) > 0;
      }
      return true;
    });
  }, [customers, searchTerm, statusFilter]);

  // Live preview for Payment Modal
  const modalCalculations = useMemo(() => {
    if (!paymentCustomer) return null;
    const currentDebit = paymentCustomer.totalDebit || 0;
    const currentCredit = paymentCustomer.totalCredit || 0;
    const inputCredit = parseFloat(paymentForm.creditAmount.replace(/,/g, '')) || 0;
    const newTotalCredit = currentCredit + inputCredit;
    const newNetBalance = newTotalCredit - currentDebit;
    const newPendingDue = Math.max(0, currentDebit - newTotalCredit);

    return {
      currentDebit,
      currentCredit,
      inputCredit,
      newTotalCredit,
      newNetBalance,
      newPendingDue,
    };
  }, [paymentCustomer, paymentForm.creditAmount]);

  return (
    <Box
      sx={{
        width: '100%',
        px: { xs: 2, sm: 3, md: 4 },
        py: { xs: 2.5, md: 3.5 },
        boxSizing: 'border-box',
      }}
    >
      {/* Page Header */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'flex-start', md: 'center' },
          gap: 2,
          mb: 3,
        }}
      >
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography
              variant="h1"
              sx={{
                fontSize: { xs: '24px', sm: '28px', md: '30px' },
                fontWeight: 800,
                color: '#0F172A',
                letterSpacing: '-0.025em',
                lineHeight: 1.2,
              }}
            >
              All Customers & Ledger Balances
            </Typography>
          </Box>
          <Typography sx={{ fontSize: '13.5px', color: '#64748B', mt: 0.5, fontWeight: 500 }}>
            Complete overview of customer accounts with Debit (Purchases), Credit (Paid/Advance), and Net Balance
          </Typography>
        </Box>

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            width: { xs: '100%', md: 'auto' },
            flexWrap: 'wrap',
          }}
        >
          {/* Search Box */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: '#FFFFFF',
              borderRadius: '8px',
              border: '1px solid #E2E8F0',
              px: 1.5,
              height: '40px',
              width: { xs: '100%', sm: '280px' },
              boxSizing: 'border-box',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
              transition: 'all 0.2s',
              '&:hover': {
                borderColor: '#CBD5E1',
              },
              '&:focus-within': {
                borderColor: '#0B4DB7',
                boxShadow: '0 0 0 2px rgba(11, 77, 183, 0.1)',
              },
            }}
          >
            <SearchRoundedIcon
              sx={{
                color: '#8E9AA8',
                fontSize: 20,
                mr: 1,
              }}
            />
            <InputBase
              placeholder="Search by name, phone, GST..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              sx={{
                fontSize: '13.5px',
                fontWeight: 500,
                color: '#1E293B',
                width: '100%',
                '& input': {
                  p: 0,
                  '&::placeholder': {
                    color: '#8E9AA8',
                    opacity: 1,
                  },
                },
              }}
            />
          </Box>

          {/* Print All / Filtered Customers Report Button with Date Range Filter */}
          <Button
            variant="outlined"
            onClick={() => setOpenDatePrintModal(true)}
            startIcon={<PrintOutlinedIcon sx={{ fontSize: 19 }} />}
            sx={{
              backgroundColor: '#FFFFFF',
              color: '#0F172A',
              borderColor: '#CBD5E1',
              height: '40px',
              px: 2,
              borderRadius: '8px',
              fontSize: '13.5px',
              fontWeight: 700,
              textTransform: 'none',
              letterSpacing: '-0.01em',
              whiteSpace: 'nowrap',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
              '&:hover': {
                backgroundColor: '#F8FAFC',
                borderColor: '#94A3B8',
              },
            }}
          >
            Print Report ({filteredCustomers.length})
          </Button>

          {/* Add New Customer Button */}
          {onAddNewCustomer && (
            <Button
              variant="contained"
              disableElevation
              onClick={onAddNewCustomer}
              startIcon={<AddRoundedIcon sx={{ fontSize: 20 }} />}
              sx={{
                backgroundColor: '#0B4DB7',
                color: '#FFFFFF',
                height: '40px',
                px: 2.4,
                borderRadius: '8px',
                fontSize: '13.5px',
                fontWeight: 700,
                textTransform: 'none',
                letterSpacing: '-0.01em',
                whiteSpace: 'nowrap',
                boxShadow: '0 2px 4px rgba(11, 77, 183, 0.2)',
                '&:hover': {
                  backgroundColor: '#083B8D',
                },
              }}
            >
              Add Customer
            </Button>
          )}
        </Box>
      </Box>

      {/* Top Metric Cards (Overview: Debit, Credit, Net Due, Advance) */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, 1fr)',
            md: 'repeat(3, 1fr)',
            lg: 'repeat(5, 1fr)',
          },
          gap: 2,
          mb: 3,
        }}
      >
        {/* Card 1: Total Customers */}
        <Paper
          elevation={0}
          sx={{
            p: 2,
            borderRadius: '12px',
            border: '1px solid #EEF2F6',
            backgroundColor: '#FFFFFF',
            boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
            display: 'flex',
            alignItems: 'center',
            gap: 1.8,
          }}
        >
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: '10px',
              backgroundColor: '#EFF6FF',
              color: '#0B4DB7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <PeopleAltRoundedIcon sx={{ fontSize: 24 }} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: '11.5px', fontWeight: 600, color: '#64748B' }}>
              Total Customers
            </Typography>
            <Typography sx={{ fontSize: '20px', fontWeight: 800, color: '#0F172A', lineHeight: 1.2, mt: 0.3 }}>
              {financialTotals.totalCount}
            </Typography>
          </Box>
        </Paper>

        {/* Card 2: Total Debit (Total Purchases / Billed) */}
        <Paper
          elevation={0}
          sx={{
            p: 2,
            borderRadius: '12px',
            border: '1px solid #EEF2F6',
            backgroundColor: '#FFFFFF',
            boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
            display: 'flex',
            alignItems: 'center',
            gap: 1.8,
          }}
        >
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: '10px',
              backgroundColor: '#F8FAFC',
              color: '#334155',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              border: '1px solid #E2E8F0',
            }}
          >
            <TrendingUpRoundedIcon sx={{ fontSize: 24 }} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: '11.5px', fontWeight: 600, color: '#64748B' }}>
              Total Debit (Purchases)
            </Typography>
            <Typography sx={{ fontSize: '18px', fontWeight: 800, color: '#1E293B', lineHeight: 1.2, mt: 0.3 }}>
              ₹{financialTotals.totalDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </Typography>
          </Box>
        </Paper>

        {/* Card 3: Total Credit (Paid / Advances Received) */}
        <Paper
          elevation={0}
          sx={{
            p: 2,
            borderRadius: '12px',
            border: '1px solid #EEF2F6',
            backgroundColor: '#FFFFFF',
            boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
            display: 'flex',
            alignItems: 'center',
            gap: 1.8,
          }}
        >
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: '10px',
              backgroundColor: '#F0FDF4',
              color: '#16A34A',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <CheckCircleOutlineRoundedIcon sx={{ fontSize: 24 }} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: '11.5px', fontWeight: 600, color: '#16A34A' }}>
              Total Credit (Paid)
            </Typography>
            <Typography sx={{ fontSize: '18px', fontWeight: 800, color: '#16A34A', lineHeight: 1.2, mt: 0.3 }}>
              ₹{financialTotals.totalCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </Typography>
          </Box>
        </Paper>

        {/* Card 4: Total Pending Due (Receivables) */}
        <Paper
          elevation={0}
          sx={{
            p: 2,
            borderRadius: '12px',
            border: '1px solid #FECACA',
            backgroundColor: '#FEF2F2',
            boxShadow: '0 1px 3px rgba(220, 38, 38, 0.06)',
            display: 'flex',
            alignItems: 'center',
            gap: 1.8,
          }}
        >
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: '10px',
              backgroundColor: '#DC2626',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <ErrorOutlineRoundedIcon sx={{ fontSize: 24 }} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: '11.5px', fontWeight: 700, color: '#991B1B' }}>
              Total Pending Due
            </Typography>
            <Typography sx={{ fontSize: '18px', fontWeight: 800, color: '#DC2626', lineHeight: 1.2, mt: 0.3 }}>
              ₹{financialTotals.totalPendingDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </Typography>
          </Box>
        </Paper>

        {/* Card 5: Total Advance Held */}
        <Paper
          elevation={0}
          sx={{
            p: 2,
            borderRadius: '12px',
            border: '1px solid #BAE6FD',
            backgroundColor: '#F0F9FF',
            boxShadow: '0 1px 3px rgba(2, 132, 199, 0.06)',
            display: 'flex',
            alignItems: 'center',
            gap: 1.8,
          }}
        >
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: '10px',
              backgroundColor: '#0284C7',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <SavingsRoundedIcon sx={{ fontSize: 24 }} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: '11.5px', fontWeight: 700, color: '#0369A1' }}>
              Advance Balances
            </Typography>
            <Typography sx={{ fontSize: '18px', fontWeight: 800, color: '#0284C7', lineHeight: 1.2, mt: 0.3 }}>
              ₹{financialTotals.totalAdvanceHeld.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </Typography>
          </Box>
        </Paper>
      </Box>

      {/* Filter Tabs / Pills */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2.2, flexWrap: 'wrap', alignItems: 'center' }}>
        <Chip
          label={`All Customers (${financialTotals.totalCount})`}
          onClick={() => setStatusFilter('ALL')}
          sx={{
            fontWeight: 600,
            fontSize: '13px',
            backgroundColor: statusFilter === 'ALL' ? '#0B4DB7' : '#FFFFFF',
            color: statusFilter === 'ALL' ? '#FFFFFF' : '#475569',
            border: '1px solid',
            borderColor: statusFilter === 'ALL' ? '#0B4DB7' : '#E2E8F0',
            cursor: 'pointer',
            '&:hover': {
              backgroundColor: statusFilter === 'ALL' ? '#083B8D' : '#F1F5F9',
            },
          }}
        />
        <Chip
          label={`Pending Due (${financialTotals.pendingCustomersCount})`}
          onClick={() => setStatusFilter('PENDING')}
          sx={{
            fontWeight: 600,
            fontSize: '13px',
            backgroundColor: statusFilter === 'PENDING' ? '#DC2626' : '#FFFFFF',
            color: statusFilter === 'PENDING' ? '#FFFFFF' : '#DC2626',
            border: '1px solid',
            borderColor: statusFilter === 'PENDING' ? '#DC2626' : '#FECACA',
            cursor: 'pointer',
            '&:hover': {
              backgroundColor: statusFilter === 'PENDING' ? '#B91C1C' : '#FEF2F2',
            },
          }}
        />
        <Chip
          label={`Settled (${financialTotals.settledCustomersCount})`}
          onClick={() => setStatusFilter('SETTLED')}
          sx={{
            fontWeight: 600,
            fontSize: '13px',
            backgroundColor: statusFilter === 'SETTLED' ? '#16A34A' : '#FFFFFF',
            color: statusFilter === 'SETTLED' ? '#FFFFFF' : '#16A34A',
            border: '1px solid',
            borderColor: statusFilter === 'SETTLED' ? '#16A34A' : '#BBF7D0',
            cursor: 'pointer',
            '&:hover': {
              backgroundColor: statusFilter === 'SETTLED' ? '#15803D' : '#F0FDF4',
            },
          }}
        />
        <Chip
          label={`Advance Customers (${financialTotals.advanceCustomersCount})`}
          onClick={() => setStatusFilter('ADVANCE')}
          sx={{
            fontWeight: 600,
            fontSize: '13px',
            backgroundColor: statusFilter === 'ADVANCE' ? '#0284C7' : '#FFFFFF',
            color: statusFilter === 'ADVANCE' ? '#FFFFFF' : '#0284C7',
            border: '1px solid',
            borderColor: statusFilter === 'ADVANCE' ? '#0284C7' : '#BAE6FD',
            cursor: 'pointer',
            '&:hover': {
              backgroundColor: statusFilter === 'ADVANCE' ? '#0369A1' : '#F0F9FF',
            },
          }}
        />

        <Box sx={{ ml: 'auto', display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 0.8, color: '#64748B' }}>
          <InfoOutlinedIcon sx={{ fontSize: 16 }} />
          <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
            Advance: Credit &gt; Debit | Due: Debit &gt; Credit
          </Typography>
        </Box>
      </Box>

      {/* Main Table Card */}
      <Paper
        elevation={0}
        sx={{
          width: '100%',
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          border: '1px solid #EEF2F6',
          boxShadow: '0 1px 3px 0 rgba(15, 23, 42, 0.03), 0 1px 2px -1px rgba(15, 23, 42, 0.03)',
          overflow: 'hidden',
        }}
      >
        <TableContainer>
          <Table sx={{ minWidth: 950 }} aria-label="all customers balance table">
            <TableHead>
              <TableRow sx={{ backgroundColor: '#F8FAFC' }}>
                <TableCell
                  sx={{
                    py: 1.8,
                    px: 2.5,
                    fontSize: '11.5px',
                    fontWeight: 700,
                    color: '#475569',
                    letterSpacing: '0.04em',
                    borderBottom: '1px solid #EEF2F6',
                    width: '80px',
                  }}
                >
                  ID
                </TableCell>
                <TableCell
                  sx={{
                    py: 1.8,
                    px: 2.5,
                    fontSize: '11.5px',
                    fontWeight: 700,
                    color: '#475569',
                    letterSpacing: '0.04em',
                    borderBottom: '1px solid #EEF2F6',
                  }}
                >
                  CUSTOMER NAME & CONTACT
                </TableCell>
                <TableCell
                  sx={{
                    py: 1.8,
                    px: 2.5,
                    fontSize: '11.5px',
                    fontWeight: 700,
                    color: '#475569',
                    letterSpacing: '0.04em',
                    borderBottom: '1px solid #EEF2F6',
                  }}
                >
                  ADDRESS & GST
                </TableCell>
                <TableCell
                  align="right"
                  sx={{
                    py: 1.8,
                    px: 2.5,
                    fontSize: '11.5px',
                    fontWeight: 700,
                    color: '#1E293B',
                    letterSpacing: '0.04em',
                    borderBottom: '1px solid #EEF2F6',
                    width: '150px',
                  }}
                >
                  <Tooltip title="Total value of products billed / purchased by customer (Debit Dr)" arrow>
                    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, cursor: 'help' }}>
                      <span>DEBIT (DR)</span>
                      <InfoOutlinedIcon sx={{ fontSize: 13, color: '#94A3B8' }} />
                    </Box>
                  </Tooltip>
                  <Typography sx={{ fontSize: '10px', color: '#64748B', fontWeight: 500 }}>
                    Product Purchases
                  </Typography>
                </TableCell>
                <TableCell
                  align="right"
                  sx={{
                    py: 1.8,
                    px: 2.5,
                    fontSize: '11.5px',
                    fontWeight: 700,
                    color: '#16A34A',
                    letterSpacing: '0.04em',
                    borderBottom: '1px solid #EEF2F6',
                    width: '150px',
                  }}
                >
                  <Tooltip title="Total advance and payments received from customer (Credit Cr)" arrow>
                    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, cursor: 'help' }}>
                      <span>CREDIT (CR)</span>
                      <InfoOutlinedIcon sx={{ fontSize: 13, color: '#16A34A' }} />
                    </Box>
                  </Tooltip>
                  <Typography sx={{ fontSize: '10px', color: '#16A34A', fontWeight: 500 }}>
                    Paid / Advance
                  </Typography>
                </TableCell>
                <TableCell
                  align="right"
                  sx={{
                    py: 1.8,
                    px: 2.5,
                    fontSize: '11.5px',
                    fontWeight: 700,
                    color: '#475569',
                    letterSpacing: '0.04em',
                    borderBottom: '1px solid #EEF2F6',
                    width: '160px',
                  }}
                >
                  <Tooltip title="Net balance = Total Credit (Paid) minus Total Debit (Purchased)" arrow>
                    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, cursor: 'help' }}>
                      <span>NET BALANCE</span>
                      <InfoOutlinedIcon sx={{ fontSize: 13, color: '#94A3B8' }} />
                    </Box>
                  </Tooltip>
                  <Typography sx={{ fontSize: '10px', color: '#64748B', fontWeight: 500 }}>
                    Due / Advance Status
                  </Typography>
                </TableCell>
                <TableCell
                  align="center"
                  sx={{
                    py: 1.8,
                    px: 2.5,
                    fontSize: '11.5px',
                    fontWeight: 700,
                    color: '#475569',
                    letterSpacing: '0.04em',
                    borderBottom: '1px solid #EEF2F6',
                    width: '210px',
                  }}
                >
                  ACTIONS
                </TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                    <CircularProgress size={32} sx={{ color: '#0B4DB7' }} />
                  </TableCell>
                </TableRow>
              ) : filteredCustomers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 6, color: '#64748B' }}>
                    {searchTerm || statusFilter !== 'ALL'
                      ? 'No customers match your search criteria.'
                      : 'No customers found.'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredCustomers.map((customer, index) => {
                  const isLast = index === filteredCustomers.length - 1;
                  const recordId = customer._id || customer.id || '';
                  const idDisplay = customer.idCode || `#${(index + 1).toString().padStart(4, '0')}`;
                  const avatarInitial = customer.avatarLetter || customer.name.charAt(0).toUpperCase();

                  const totalDebitNum = customer.totalDebit || 0;
                  const totalCreditNum = customer.totalCredit || 0;
                  const pendingDueNum = customer.pendingDue || 0;
                  const netBalanceNum = customer.netBalance || 0;

                  return (
                    <TableRow
                      key={recordId || index}
                      sx={{
                        transition: 'background-color 0.15s ease',
                        '&:hover': {
                          backgroundColor: '#F8FAFC',
                        },
                      }}
                    >
                      {/* ID */}
                      <TableCell
                        sx={{
                          py: 1.8,
                          px: 2.5,
                          fontSize: '13px',
                          color: '#64748B',
                          fontWeight: 600,
                          borderBottom: isLast ? 'none' : '1px solid #F1F5F9',
                        }}
                      >
                        {idDisplay}
                      </TableCell>

                      {/* Customer Name & Mobile */}
                      <TableCell
                        sx={{
                          py: 1.8,
                          px: 2.5,
                          borderBottom: isLast ? 'none' : '1px solid #F1F5F9',
                        }}
                      >
                        <Box
                          onClick={() => onSelectCustomerForParticular?.(customer.name, 'Account Details')}
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1.5,
                            cursor: 'pointer',
                          }}
                        >
                          <Box
                            sx={{
                              width: 36,
                              height: 36,
                              borderRadius: '50%',
                              backgroundColor: customer.avatarBg || '#DBEAFE',
                              color: customer.avatarColor || '#0B4DB7',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '14px',
                              fontWeight: 700,
                              flexShrink: 0,
                            }}
                          >
                            {avatarInitial}
                          </Box>
                          <Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography
                                sx={{
                                  fontSize: '14.5px',
                                  fontWeight: 700,
                                  color: '#0F172A',
                                  letterSpacing: '-0.01em',
                                  '&:hover': {
                                    color: '#0B4DB7',
                                    textDecoration: 'underline',
                                  },
                                }}
                              >
                                {customer.name}
                              </Typography>
                              {customer.masterPerformaNumber && (
                                <Chip
                                  label={customer.masterPerformaNumber}
                                  size="small"
                                  sx={{
                                    height: '19px',
                                    fontSize: '10.5px',
                                    fontWeight: 800,
                                    backgroundColor: '#EFF6FF',
                                    color: '#1D4ED8',
                                  }}
                                />
                              )}
                            </Box>
                            <Typography sx={{ fontSize: '12px', color: '#64748B', fontWeight: 500 }}>
                              📞 {customer.mobile || 'N/A'}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>

                      {/* Address & GST */}
                      <TableCell
                        sx={{
                          py: 1.8,
                          px: 2.5,
                          fontSize: '13px',
                          color: '#334155',
                          fontWeight: 500,
                          borderBottom: isLast ? 'none' : '1px solid #F1F5F9',
                        }}
                      >
                        <Typography sx={{ fontSize: '13px', color: '#334155', fontWeight: 500, maxWidth: '240px' }}>
                          {customer.address}
                        </Typography>
                        {customer.gst && customer.gst !== 'N/A' && (
                          <Typography sx={{ fontSize: '11.5px', color: '#64748B', fontWeight: 600, mt: 0.2 }}>
                            GSTIN: {customer.gst}
                          </Typography>
                        )}
                      </TableCell>

                      {/* Total Debit (Dr) */}
                      <TableCell
                        align="right"
                        sx={{
                          py: 1.8,
                          px: 2.5,
                          fontSize: '14px',
                          color: '#1E293B',
                          fontWeight: 700,
                          borderBottom: isLast ? 'none' : '1px solid #F1F5F9',
                        }}
                      >
                        <Typography sx={{ fontSize: '14px', fontWeight: 700, color: '#1E293B' }}>
                          ₹{totalDebitNum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </Typography>
                        <Typography sx={{ fontSize: '10.5px', color: '#64748B', fontWeight: 500 }}>
                          Debit (Dr)
                        </Typography>
                      </TableCell>

                      {/* Total Credit (Cr) */}
                      <TableCell
                        align="right"
                        sx={{
                          py: 1.8,
                          px: 2.5,
                          fontSize: '14px',
                          color: '#16A34A',
                          fontWeight: 700,
                          borderBottom: isLast ? 'none' : '1px solid #F1F5F9',
                        }}
                      >
                        <Typography sx={{ fontSize: '14px', fontWeight: 700, color: '#16A34A' }}>
                          ₹{totalCreditNum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </Typography>
                        <Typography sx={{ fontSize: '10.5px', color: '#16A34A', fontWeight: 500 }}>
                          Credit (Cr)
                        </Typography>
                      </TableCell>

                      {/* Net Balance / Status */}
                      <TableCell
                        align="right"
                        sx={{
                          py: 1.8,
                          px: 2.5,
                          borderBottom: isLast ? 'none' : '1px solid #F1F5F9',
                        }}
                      >
                        {pendingDueNum > 0 ? (
                          <Box sx={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                            <Typography sx={{ fontSize: '14.5px', fontWeight: 800, color: '#DC2626' }}>
                              ₹{pendingDueNum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </Typography>
                            <Chip
                              label="Pending Due"
                              size="small"
                              sx={{
                                height: '20px',
                                fontSize: '10.5px',
                                fontWeight: 700,
                                backgroundColor: '#FEE2E2',
                                color: '#DC2626',
                                borderRadius: '4px',
                                mt: 0.3,
                              }}
                            />
                          </Box>
                        ) : netBalanceNum > 0 ? (
                          <Box sx={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                            <Typography sx={{ fontSize: '14.5px', fontWeight: 800, color: '#0284C7' }}>
                              +₹{netBalanceNum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </Typography>
                            <Chip
                              label="Advance Balance"
                              size="small"
                              sx={{
                                height: '20px',
                                fontSize: '10.5px',
                                fontWeight: 700,
                                backgroundColor: '#E0F2FE',
                                color: '#0284C7',
                                borderRadius: '4px',
                                mt: 0.3,
                              }}
                            />
                          </Box>
                        ) : (
                          <Box sx={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                            <Typography sx={{ fontSize: '14px', fontWeight: 700, color: '#16A34A' }}>
                              ₹0.00
                            </Typography>
                            <Chip
                              label="Settled"
                              size="small"
                              sx={{
                                height: '20px',
                                fontSize: '10.5px',
                                fontWeight: 700,
                                backgroundColor: '#DCFCE7',
                                color: '#16A34A',
                                borderRadius: '4px',
                                mt: 0.3,
                              }}
                            />
                          </Box>
                        )}
                      </TableCell>

                      {/* Actions */}
                      <TableCell
                        align="center"
                        sx={{
                          py: 1.8,
                          px: 2,
                          borderBottom: isLast ? 'none' : '1px solid #F1F5F9',
                        }}
                      >
                        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.8 }}>
                          {/* View Statement / Account Details Button */}
                          <Tooltip title="View Account Statement & Ledger History" arrow>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => onSelectCustomerForParticular?.(customer.name, 'Account Details')}
                              startIcon={<AccountBalanceWalletRoundedIcon sx={{ fontSize: '15px !important' }} />}
                              sx={{
                                height: '30px',
                                px: 1.2,
                                fontSize: '11.5px',
                                fontWeight: 700,
                                textTransform: 'none',
                                color: '#0B4DB7',
                                borderColor: '#BFDBFE',
                                backgroundColor: '#EFF6FF',
                                borderRadius: '6px',
                                '&:hover': {
                                  backgroundColor: '#DBEAFE',
                                  borderColor: '#93C5FD',
                                },
                              }}
                            >
                              Statement
                            </Button>
                          </Tooltip>

                          {/* WhatsApp Share Statement Button */}
                          <Tooltip title="Share Statement on WhatsApp" arrow>
                            <IconButton
                              size="small"
                              onClick={() => handleShareCustomerWhatsApp(customer)}
                              sx={{
                                color: '#FFFFFF',
                                backgroundColor: '#25D366',
                                border: '1px solid #22C55E',
                                borderRadius: '6px',
                                p: 0.7,
                                transition: 'all 0.15s ease',
                                '&:hover': {
                                  backgroundColor: '#1EBE5D',
                                  borderColor: '#1EBE5D',
                                },
                              }}
                            >
                              <WhatsAppIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>

                          {/* Quick Payment / Advance Button */}
                          <Tooltip title="Record Advance Payment or Settlement Credit" arrow>
                            <IconButton
                              size="small"
                              onClick={() => handleOpenPayment(customer)}
                              sx={{
                                color: '#16A34A',
                                backgroundColor: '#F0FDF4',
                                border: '1px solid #BBF7D0',
                                borderRadius: '6px',
                                p: 0.7,
                                transition: 'all 0.15s ease',
                                '&:hover': {
                                  color: '#FFFFFF',
                                  backgroundColor: '#16A34A',
                                  borderColor: '#16A34A',
                                },
                              }}
                            >
                              <PaymentsRoundedIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>

                          {/* Edit Customer Button */}
                          <Tooltip title="Edit Customer" arrow>
                            <IconButton
                              size="small"
                              onClick={() => handleOpenEdit(customer)}
                              sx={{
                                color: '#64748B',
                                backgroundColor: '#F8FAFC',
                                border: '1px solid #E2E8F0',
                                borderRadius: '6px',
                                p: 0.7,
                                transition: 'all 0.15s ease',
                                '&:hover': {
                                  color: '#0B4DB7',
                                  backgroundColor: '#EFF6FF',
                                  borderColor: '#BFDBFE',
                                },
                              }}
                            >
                              <ModeEditOutlineRoundedIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>

                          {/* Delete Customer Button */}
                          <Tooltip title="Delete Customer" arrow>
                            <IconButton
                              size="small"
                              onClick={() => handleDelete(recordId)}
                              sx={{
                                color: '#64748B',
                                backgroundColor: '#F8FAFC',
                                border: '1px solid #E2E8F0',
                                borderRadius: '6px',
                                p: 0.7,
                                transition: 'all 0.15s ease',
                                '&:hover': {
                                  color: '#DC2626',
                                  backgroundColor: '#FEF2F2',
                                  borderColor: '#FECACA',
                                },
                              }}
                            >
                              <DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Quick Payment / Add Credit Modal */}
      <Dialog
        open={openPaymentModal}
        onClose={() => setOpenPaymentModal(false)}
        maxWidth="xs"
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
        <DialogTitle sx={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', pb: 0.5 }}>
          Record Payment / Advance (Add Credit)
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            {paymentCustomer && (
              <Box
                sx={{
                  p: 1.6,
                  borderRadius: '8px',
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                }}
              >
                <Typography sx={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>
                  Customer
                </Typography>
                <Typography sx={{ fontSize: '15px', fontWeight: 800, color: '#0F172A' }}>
                  {paymentCustomer.name}
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1, pt: 1, borderTop: '1px dashed #CBD5E1' }}>
                  <Box>
                    <Typography sx={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>Total Debit (Dr)</Typography>
                    <Typography sx={{ fontSize: '13px', color: '#1E293B', fontWeight: 700 }}>
                      ₹{(paymentCustomer.totalDebit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>Total Credit (Cr)</Typography>
                    <Typography sx={{ fontSize: '13px', color: '#16A34A', fontWeight: 700 }}>
                      ₹{(paymentCustomer.totalCredit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography sx={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>Current Balance</Typography>
                    {(paymentCustomer.pendingDue || 0) > 0 ? (
                      <Typography sx={{ fontSize: '13px', color: '#DC2626', fontWeight: 800 }}>
                        ₹{(paymentCustomer.pendingDue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} Due
                      </Typography>
                    ) : (paymentCustomer.netBalance || 0) > 0 ? (
                      <Typography sx={{ fontSize: '13px', color: '#0284C7', fontWeight: 800 }}>
                        +₹{(paymentCustomer.netBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} Adv
                      </Typography>
                    ) : (
                      <Typography sx={{ fontSize: '13px', color: '#16A34A', fontWeight: 800 }}>
                        ₹0.00 Settled
                      </Typography>
                    )}
                  </Box>
                </Box>
              </Box>
            )}

            <Box>
              <Typography sx={{ fontSize: '13px', fontWeight: 600, color: '#475569', mb: 0.5 }}>
                Payment / Advance Credit Amount (₹) *
              </Typography>
              <TextField
                fullWidth
                size="small"
                type="number"
                placeholder="Enter amount (e.g. 1000000)"
                value={paymentForm.creditAmount}
                onChange={(e) => setPaymentForm({ ...paymentForm, creditAmount: e.target.value })}
                slotProps={{
                  input: {
                    sx: { fontSize: '14px', fontWeight: 700, borderRadius: '6px' },
                  },
                }}
              />
            </Box>

            {/* Live Calculation Preview */}
            {modalCalculations && modalCalculations.inputCredit > 0 && (
              <Box
                sx={{
                  p: 1.4,
                  borderRadius: '6px',
                  backgroundColor: '#F0FDF4',
                  border: '1px solid #BBF7D0',
                }}
              >
                <Typography sx={{ fontSize: '11.5px', color: '#15803D', fontWeight: 700, mb: 0.3 }}>
                  Calculation Preview:
                </Typography>
                <Typography sx={{ fontSize: '12px', color: '#166534', fontWeight: 500 }}>
                  New Total Credit: ₹{modalCalculations.newTotalCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </Typography>
                {modalCalculations.newPendingDue > 0 ? (
                  <Typography sx={{ fontSize: '12.5px', color: '#DC2626', fontWeight: 700, mt: 0.3 }}>
                    Remaining Due: ₹{modalCalculations.newPendingDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </Typography>
                ) : modalCalculations.newNetBalance > 0 ? (
                  <Typography sx={{ fontSize: '12.5px', color: '#0284C7', fontWeight: 700, mt: 0.3 }}>
                    Remaining Advance Balance: +₹{modalCalculations.newNetBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </Typography>
                ) : (
                  <Typography sx={{ fontSize: '12.5px', color: '#16A34A', fontWeight: 700, mt: 0.3 }}>
                    Account fully Settled (₹0.00)
                  </Typography>
                )}
              </Box>
            )}

            <Box>
              <Typography sx={{ fontSize: '13px', fontWeight: 600, color: '#475569', mb: 0.5 }}>
                Company / Account
              </Typography>
              <Autocomplete
                fullWidth
                size="small"
                autoHighlight
                options={companies.length > 0 ? companies.map((c) => c.name) : ['General']}
                value={paymentForm.companyName || null}
                onChange={(_, val) => setPaymentForm({ ...paymentForm, companyName: val || '' })}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder="Search or select company..."
                    sx={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: '6px',
                      '& .MuiOutlinedInput-root': {
                        fontSize: '13.5px',
                        fontWeight: 500,
                        borderRadius: '6px',
                        '& fieldset': {
                          borderColor: '#CBD5E1',
                        },
                        '&:hover fieldset': {
                          borderColor: '#94A3B8',
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: '#0B4DB7',
                          borderWidth: '1.5px',
                        },
                      },
                    }}
                  />
                )}
              />
            </Box>

            <Box>
              <Typography sx={{ fontSize: '13px', fontWeight: 600, color: '#475569', mb: 0.5 }}>
                Payment Date
              </Typography>
              <TextField
                fullWidth
                size="small"
                value={paymentForm.date}
                onChange={(e) => setPaymentForm({ ...paymentForm, date: e.target.value })}
                placeholder="DD-MM-YYYY"
                slotProps={{
                  input: { sx: { fontSize: '13.5px', fontWeight: 500, borderRadius: '6px' } },
                }}
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 1 }}>
          <Button
            onClick={() => setOpenPaymentModal(false)}
            sx={{ color: '#64748B', fontWeight: 600, textTransform: 'none' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            disableElevation
            onClick={handleSavePayment}
            disabled={paymentLoading}
            sx={{
              backgroundColor: '#16A34A',
              color: '#FFFFFF',
              fontWeight: 700,
              textTransform: 'none',
              px: 2.5,
              borderRadius: '6px',
              '&:hover': { backgroundColor: '#15803D' },
            }}
          >
            {paymentLoading ? 'Saving...' : 'Record Credit'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Customer Dialog Modal */}
      <Dialog
        open={openEditModal}
        onClose={() => setOpenEditModal(false)}
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
        <DialogTitle sx={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', pb: 1 }}>
          Edit Customer Details
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <Box>
              <Typography sx={{ fontSize: '13px', fontWeight: 600, color: '#475569', mb: 0.5 }}>
                Full Name / Business Name *
              </Typography>
              <TextField
                fullWidth
                size="small"
                value={editFormData.name}
                onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                slotProps={{
                  input: { sx: { fontSize: '13.5px', fontWeight: 500, borderRadius: '6px' } },
                }}
              />
            </Box>

            <Box>
              <Typography sx={{ fontSize: '13px', fontWeight: 600, color: '#475569', mb: 0.5 }}>
                Mobile Number
              </Typography>
              <TextField
                fullWidth
                size="small"
                value={editFormData.mobile}
                onChange={(e) => setEditFormData({ ...editFormData, mobile: e.target.value })}
                slotProps={{
                  input: { sx: { fontSize: '13.5px', fontWeight: 500, borderRadius: '6px' } },
                }}
              />
            </Box>

            <Box>
              <Typography sx={{ fontSize: '13px', fontWeight: 600, color: '#475569', mb: 0.5 }}>
                GSTIN
              </Typography>
              <TextField
                fullWidth
                size="small"
                value={editFormData.gst}
                onChange={(e) => setEditFormData({ ...editFormData, gst: e.target.value })}
                slotProps={{
                  input: { sx: { fontSize: '13.5px', fontWeight: 500, borderRadius: '6px' } },
                }}
              />
            </Box>

            <Box>
              <Typography sx={{ fontSize: '13px', fontWeight: 600, color: '#475569', mb: 0.5 }}>
                Address *
              </Typography>
              <TextField
                fullWidth
                size="small"
                value={editFormData.address}
                onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                slotProps={{
                  input: { sx: { fontSize: '13.5px', fontWeight: 500, borderRadius: '6px' } },
                }}
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 1 }}>
          <Button
            onClick={() => setOpenEditModal(false)}
            sx={{ color: '#64748B', fontWeight: 600, textTransform: 'none' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            disableElevation
            onClick={handleSaveEdit}
            disabled={editLoading}
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
            {editLoading ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Date Range Filter Print Modal */}
      <DateRangePrintModal
        open={openDatePrintModal}
        onClose={() => setOpenDatePrintModal(false)}
        title="Print Customer Ledger & Balances"
        subtitle="Select the transaction date interval to filter records for A4 printing."
        items={filteredCustomers}
        getDateFromItem={(c) => c.lastTransactionDate || ''}
        onConfirmPrint={(itemsToPrint, rangeText) => {
          const filterLabel = statusFilter !== 'ALL' ? ` - ${statusFilter}` : '';
          printCustomerListDirectly(
            itemsToPrint,
            `CUSTOMERS MASTER LEDGER & BALANCES REPORT${filterLabel}`,
            rangeText
          );
        }}
      />
    </Box>
  );
};
