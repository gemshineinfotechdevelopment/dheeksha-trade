import { useState, useEffect, type FC, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  IconButton,
  Tooltip,
  CircularProgress,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  Alert,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  InputAdornment,
  Card,
  CardContent,
  Autocomplete,
} from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import AccountBalanceWalletRoundedIcon from '@mui/icons-material/AccountBalanceWalletRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import ModeEditOutlineRoundedIcon from '@mui/icons-material/ModeEditOutlineRounded';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import { PerformasApi, CustomersApi, CompaniesApi, ProductsApi } from '../services/api';
import { PerformaPrintModal } from './PerformaPrintModal';
import type { PerformaPrintData } from './PerformaPrintTemplate';
import { sharePerformaOnWhatsApp, shareAllPerformasOnWhatsApp } from '../utils/whatsappUtils';

interface EditProductItem {
  id: string;
  productId?: string;
  productCode: string;
  productName: string;
  companyName: string;
  category: string;
  requiredCases: number | string;
  usedCases?: number;
  remainingCases?: number;
  rate: number | string;
  pktPerUnit: number | string;
  allocatedAmount: number | string;
}

interface AllPerformaPageProps {
  onAddNewPerforma?: () => void;
  onSelectCustomerForBill?: (customerName: string, subTab?: any) => void;
}

export const AllPerformaPage: FC<AllPerformaPageProps> = ({ onAddNewPerforma, onSelectCustomerForBill }) => {
  const [performas, setPerformas] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [customers, setCustomers] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [availableProducts, setAvailableProducts] = useState<any[]>([]);

  // Filters State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCustomerFilter, setSelectedCustomerFilter] = useState<string>('ALL');
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState<string>('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Sorting State
  const [sortBy, setSortBy] = useState<string>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Modals State
  const [selectedPerformaForView, setSelectedPerformaForView] = useState<any | null>(null);
  const [viewModalOpen, setViewModalOpen] = useState<boolean>(false);
  const [viewLoading, setViewLoading] = useState<boolean>(false);

  const [selectedPerformaForPrint, setSelectedPerformaForPrint] = useState<PerformaPrintData | null>(null);
  const [printModalOpen, setPrintModalOpen] = useState<boolean>(false);

  // Add Advance Modal State
  const [advanceModalOpen, setAdvanceModalOpen] = useState<boolean>(false);
  const [targetPerformaForAdvance, setTargetPerformaForAdvance] = useState<any | null>(null);
  const [advanceAmountInput, setAdvanceAmountInput] = useState<string>('');
  const [advanceNotesInput, setAdvanceNotesInput] = useState<string>('');
  const [advanceLoading, setAdvanceLoading] = useState<boolean>(false);

  // Edit Performa Modal State
  const [editModalOpen, setEditModalOpen] = useState<boolean>(false);
  const [editLoading, setEditLoading] = useState<boolean>(false);
  const [editPerformaId, setEditPerformaId] = useState<string>('');
  const [editPerformaNumber, setEditPerformaNumber] = useState<string>('');
  const [editCompanyName, setEditCompanyName] = useState<string>('');
  const [editCustomerName, setEditCustomerName] = useState<string>('');
  const [editCustomerPhone, setEditCustomerPhone] = useState<string>('');
  const [editCustomerAddress, setEditCustomerAddress] = useState<string>('');
  const [editCustomerGst, setEditCustomerGst] = useState<string>('');
  const [editDate, setEditDate] = useState<string>('');
  const [editAdvanceAmount, setEditAdvanceAmount] = useState<string>('0');
  const [editStatus, setEditStatus] = useState<string>('ACTIVE');
  const [editNotes, setEditNotes] = useState<string>('');
  const [editDiscount, setEditDiscount] = useState<string>('');
  const [editPacking, setEditPacking] = useState<string>('');
  const [editTax, setEditTax] = useState<string>('');
  const [editProducts, setEditProducts] = useState<EditProductItem[]>([]);

  // Edit Modal - Add Row sub-form
  const [newRowProductObj, setNewRowProductObj] = useState<any | null>(null);
  const [newRowProductName, setNewRowProductName] = useState<string>('');
  const [newRowProductCode, setNewRowProductCode] = useState<string>('');
  const [newRowProductCompany, setNewRowProductCompany] = useState<string>('');
  const [newRowCases, setNewRowCases] = useState<string>('');
  const [newRowRate, setNewRowRate] = useState<string>('');
  const [newRowPktUnit, setNewRowPktUnit] = useState<string>('1');

  // Toast State
  const [toast, setToast] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  // Load Performas, Customers, Companies, and Products
  const fetchPerformas = async () => {
    try {
      setLoading(true);
      const res = await PerformasApi.getAll({
        customerName: selectedCustomerFilter,
        companyName: selectedCompanyFilter,
        status: selectedStatusFilter,
        search: searchQuery,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        sortBy,
        sortOrder,
      });

      if (Array.isArray(res)) {
        setPerformas(res);
      } else if (res && res.data) {
        setPerformas(res.data);
        if (res.summary) setSummary(res.summary);
      }
    } catch (err: any) {
      console.error('Failed to load Performas:', err);
      setToast({ open: true, message: err?.message || 'Failed to load Performas', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    Promise.all([
      CustomersApi.getAll().catch(() => []),
      CompaniesApi.getAll().catch(() => []),
      ProductsApi.getAll().catch(() => []),
    ]).then(([custList, compList, prodList]) => {
      setCustomers(custList || []);
      setCompanies(compList || []);
      setAvailableProducts(prodList || []);
    });
  }, []);

  useEffect(() => {
    fetchPerformas();
  }, [selectedCustomerFilter, selectedCompanyFilter, selectedStatusFilter, startDate, endDate, sortBy, sortOrder]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchPerformas();
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedCustomerFilter('ALL');
    setSelectedCompanyFilter('ALL');
    setSelectedStatusFilter('ALL');
    setStartDate('');
    setEndDate('');
    setSortBy('date');
    setSortOrder('desc');
  };

  const handleSortRequest = (column: string) => {
    if (sortBy === column) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortOrder(column === 'date' || column === 'advance' || column === 'cases' ? 'desc' : 'asc');
    }
  };

  // View Performa Details Dialog
  const handleOpenViewModal = async (id: string) => {
    try {
      setViewLoading(true);
      setViewModalOpen(true);
      const res = await PerformasApi.getById(id);
      setSelectedPerformaForView(res);
    } catch (err: any) {
      setToast({ open: true, message: err?.message || 'Failed to load details', severity: 'error' });
    } finally {
      setViewLoading(false);
    }
  };

  // Open Print Modal
  const handleOpenPrintModal = (performa: any) => {
    const totalAvail = performa.totalAvailableAmount !== undefined ? performa.totalAvailableAmount : (performa.advanceAmount || 0);
    const usedAmt = performa.usedAmount !== undefined ? performa.usedAmount : (performa.advanceUsedAmount || 0);
    const remAmt = performa.remainingAmount !== undefined ? performa.remainingAmount : (performa.remainingAdvanceAmount !== undefined ? performa.remainingAdvanceAmount : Math.max(0, totalAvail - usedAmt));

    const printData: PerformaPrintData = {
      performaNumber: performa.performaNumber,
      companyName: performa.companyName || performa.customerSnapshot?.companyName,
      date: performa.date,
      customerSnapshot: performa.customerSnapshot,
      advanceAmount: totalAvail,
      advanceUsedAmount: usedAmt,
      remainingAdvanceAmount: remAmt,
      products: (performa.products || []).map((p: any) => ({
        productCode: p.productSnapshot?.productCode || p.productCode,
        productName: p.productSnapshot?.productName || p.productName,
        companyName: p.productSnapshot?.companyName || p.companyName,
        category: p.productSnapshot?.category || p.category,
        requiredCases: p.requiredCases,
        usedCases: p.usedCases,
        remainingCases: p.remainingCases,
        rate: p.rate,
        pktPerUnit: p.pktPerUnit || 1,
        allocatedAmount: p.allocatedAmount,
      })),
      totalRequiredCases: performa.totalRequiredCases,
      totalUsedCases: performa.totalUsedCases,
      totalRemainingCases: performa.totalRemainingCases,
      subtotal: performa.subtotal,
      discount: performa.discount,
      discountAmount: performa.discountAmount,
      packing: performa.packing,
      packingAmount: performa.packingAmount,
      tax: performa.tax,
      taxAmount: performa.taxAmount,
      totalAllocatedAmount: performa.totalAllocatedAmount,
      totalUsedAmount: performa.totalUsedAmount,
      totalRemainingAmount: performa.totalRemainingAmount,
      status: performa.status,
      notes: performa.notes,
    };
    setSelectedPerformaForPrint(printData);
    setPrintModalOpen(true);
  };

  // Open Edit Performa Modal
  const handleOpenEditModal = async (performa: any) => {
    try {
      setEditLoading(true);
      setEditModalOpen(true);
      const res = await PerformasApi.getById(performa._id);
      const data = res || performa;

      setEditPerformaId(data._id);
      setEditPerformaNumber(data.performaNumber || '');
      setEditCompanyName(data.companyName || data.customerSnapshot?.companyName || '');
      setEditCustomerName(data.customerSnapshot?.name || '');
      setEditCustomerPhone(data.customerSnapshot?.phone || '');
      setEditCustomerAddress(data.customerSnapshot?.address || '');
      setEditCustomerGst(data.customerSnapshot?.gst || '');
      setEditDate(data.date || '');
      setEditAdvanceAmount(String(data.advanceAmount || 0));
      setEditStatus(data.status || 'ACTIVE');
      setEditNotes(data.notes || '');
      setEditDiscount(data.discount !== undefined ? String(data.discount) : '');
      setEditPacking(data.packing !== undefined ? String(data.packing) : '');
      setEditTax(data.tax !== undefined ? String(data.tax) : '');

      const loadedProducts: EditProductItem[] = (data.products || []).map((p: any, idx: number) => ({
        id: p._id || String(idx) + '-' + Date.now(),
        productId: p.productId,
        productCode: p.productSnapshot?.productCode || p.productCode || '',
        productName: p.productSnapshot?.productName || p.productName || 'Product',
        companyName: p.productSnapshot?.companyName || p.companyName || data.companyName || '',
        category: p.productSnapshot?.category || p.category || '',
        requiredCases: p.requiredCases || 0,
        usedCases: p.usedCases || 0,
        remainingCases: p.remainingCases || p.requiredCases || 0,
        rate: p.rate || 0,
        pktPerUnit: p.pktPerUnit || 1,
        allocatedAmount: p.allocatedAmount || (p.requiredCases || 0) * (p.rate || 0) * (p.pktPerUnit || 1),
      }));

      setEditProducts(loadedProducts);
    } catch (err: any) {
      setToast({ open: true, message: err?.message || 'Failed to load Performa for edit', severity: 'error' });
      setEditModalOpen(false);
    } finally {
      setEditLoading(false);
    }
  };

  // Edit Modal Product Row actions
  const handleEditProductChange = (id: string, field: 'requiredCases' | 'rate' | 'pktPerUnit' | 'companyName' | 'productName', val: string) => {
    setEditProducts((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: val };
        const req = parseFloat(String(updated.requiredCases)) || 0;
        const rt = parseFloat(String(updated.rate)) || 0;
        const pkt = parseFloat(String(updated.pktPerUnit)) || 1;
        updated.allocatedAmount = (req * rt * pkt).toFixed(2);
        return updated;
      })
    );
  };

  const handleRemoveEditProductRow = (id: string) => {
    setEditProducts((prev) => prev.filter((p) => p.id !== id));
  };

  const handleAddProductToEditList = () => {
    const trimmed = newRowProductName.trim();
    if (!trimmed) {
      setToast({ open: true, message: 'Please select or type a product name', severity: 'error' });
      return;
    }
    const casesVal = parseFloat(newRowCases) || 0;
    if (casesVal <= 0) {
      setToast({ open: true, message: 'Enter a valid case quantity > 0', severity: 'error' });
      return;
    }
    const rateVal = parseFloat(newRowRate) || 0;
    if (rateVal <= 0) {
      setToast({ open: true, message: 'Enter a valid rate > 0', severity: 'error' });
      return;
    }
    const unitsVal = parseFloat(newRowPktUnit) || 1;
    const allocatedAmt = (casesVal * rateVal * unitsVal).toFixed(2);

    const newItem: EditProductItem = {
      id: Date.now().toString(),
      productId: newRowProductObj?._id,
      productCode: newRowProductCode.trim() || `SKU-${Date.now().toString().slice(-4)}`,
      productName: trimmed,
      companyName: newRowProductCompany.trim() || (editCompanyName && editCompanyName.toLowerCase() !== 'general' ? editCompanyName.trim() : '') || '',
      category: newRowProductObj?.category || 'Trading',
      requiredCases: casesVal,
      usedCases: 0,
      remainingCases: casesVal,
      rate: rateVal,
      pktPerUnit: unitsVal,
      allocatedAmount: allocatedAmt,
    };

    setEditProducts((prev) => [...prev, newItem]);

    // Reset row inputs
    setNewRowProductObj(null);
    setNewRowProductName('');
    setNewRowProductCode('');
    setNewRowCases('');
    setNewRowRate('');
    setNewRowPktUnit('1');
  };

  // Edit Aggregates
  const editTotalCases = useMemo(() => {
    return editProducts.reduce((sum, p) => sum + (parseFloat(String(p.requiredCases)) || 0), 0);
  }, [editProducts]);

  const editSubtotalAllocated = useMemo(() => {
    return editProducts.reduce((sum, p) => sum + (parseFloat(String(p.allocatedAmount)) || 0), 0);
  }, [editProducts]);

  const editDiscountVal = useMemo(() => {
    if (!editDiscount) return 0;
    const cleanDisc = String(editDiscount).trim();
    const num = parseFloat(cleanDisc) || 0;
    if (num <= 0) return 0;
    if (cleanDisc.endsWith('%') || num <= 100) {
      return (editSubtotalAllocated * num) / 100;
    }
    return num;
  }, [editDiscount, editSubtotalAllocated]);

  const editBaseAfterDiscount = useMemo(() => {
    return Math.max(0, editSubtotalAllocated - editDiscountVal);
  }, [editSubtotalAllocated, editDiscountVal]);

  const editPackingVal = useMemo(() => {
    if (!editPacking) return 0;
    const cleanPack = String(editPacking).trim();
    const num = parseFloat(cleanPack) || 0;
    if (num <= 0) return 0;
    if (cleanPack.endsWith('%') || num <= 100) {
      return (editBaseAfterDiscount * num) / 100;
    }
    return num;
  }, [editPacking, editBaseAfterDiscount]);

  const editTaxVal = useMemo(() => {
    if (!editTax) return 0;
    const cleanTax = String(editTax).trim().replace(/[^0-9.]/g, '');
    const num = parseFloat(cleanTax) || 0;
    if (num <= 0) return 0;
    return num;
  }, [editTax]);

  const editFinalTotalAllocated = useMemo(() => {
    const net = Math.max(0, editSubtotalAllocated - editDiscountVal + editPackingVal + editTaxVal);
    return Number(net.toFixed(2));
  }, [editSubtotalAllocated, editDiscountVal, editPackingVal, editTaxVal]);

  // Filter available products in Edit Modal by chosen brand
  const filteredEditModalProducts = useMemo(() => {
    if (!newRowProductCompany || !newRowProductCompany.trim() || newRowProductCompany.trim().toLowerCase() === 'general') return availableProducts;
    const comp = newRowProductCompany.trim().toLowerCase();
    const matched = availableProducts.filter(
      (p: any) => p.companyName && p.companyName.trim().toLowerCase() === comp
    );
    return matched.length > 0 ? matched : availableProducts;
  }, [availableProducts, newRowProductCompany]);

  // Save Performa Changes
  const handleSaveEditPerforma = async () => {
    if (!editPerformaId) return;
    if (editProducts.length === 0) {
      setToast({ open: true, message: 'At least one product item is required', severity: 'error' });
      return;
    }

    try {
      setEditLoading(true);
      const uniqueCompanies = Array.from(
        new Set(
          editProducts
            .map((p) => p.companyName?.trim())
            .filter((c): c is string => Boolean(c) && c.toLowerCase() !== 'general')
        )
      );
      const combinedCompanyName =
        uniqueCompanies.length > 0
          ? uniqueCompanies.join(', ')
          : (editCompanyName && editCompanyName.toLowerCase() !== 'general' ? editCompanyName.trim() : '');

      const payload = {
        companyName: combinedCompanyName,
        customerSnapshot: {
          name: editCustomerName.trim(),
          phone: editCustomerPhone.trim(),
          companyName: combinedCompanyName || editCustomerName.trim(),
          address: editCustomerAddress.trim(),
          gst: editCustomerGst.trim(),
        },
        advanceAmount: parseFloat(String(editAdvanceAmount).replace(/,/g, '')) || 0,
        date: editDate,
        status: editStatus,
        notes: editNotes.trim(),
        discount: editDiscount || '0',
        packing: editPacking || '0',
        tax: editTax || '0',
        products: editProducts.map((p) => ({
          productId: p.productId,
          productSnapshot: {
            productCode: p.productCode,
            productName: p.productName,
            companyName: p.companyName || editCompanyName || 'General',
            category: p.category,
          },
          requiredCases: parseFloat(String(p.requiredCases)) || 0,
          usedCases: p.usedCases || 0,
          rate: parseFloat(String(p.rate)) || 0,
          pktPerUnit: parseFloat(String(p.pktPerUnit)) || 1,
          allocatedAmount: parseFloat(String(p.allocatedAmount)) || 0,
        })),
      };

      await PerformasApi.update(editPerformaId, payload);
      setToast({ open: true, message: `Performa ${editPerformaNumber} updated successfully!`, severity: 'success' });
      setEditModalOpen(false);
      fetchPerformas();
    } catch (err: any) {
      console.error('Failed to update performa:', err);
      setToast({ open: true, message: err?.message || 'Failed to save changes', severity: 'error' });
    } finally {
      setEditLoading(false);
    }
  };

  // Cancel Performa
  const handleCancelPerforma = async (id: string, num: string) => {
    if (!window.confirm(`Are you sure you want to cancel Performa ${num}?`)) return;
    try {
      await PerformasApi.cancel(id);
      setToast({ open: true, message: `Performa ${num} cancelled successfully`, severity: 'success' });
      fetchPerformas();
    } catch (err: any) {
      setToast({ open: true, message: err?.message || 'Failed to cancel', severity: 'error' });
    }
  };

  // Delete Performa
  const handleDeletePerforma = async (id: string, num: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete Performa ${num}?`)) return;
    try {
      await PerformasApi.delete(id);
      setToast({ open: true, message: `Performa ${num} deleted successfully`, severity: 'success' });
      fetchPerformas();
    } catch (err: any) {
      setToast({ open: true, message: err?.message || 'Failed to delete', severity: 'error' });
    }
  };

  // Open Add Advance Dialog
  const handleOpenAdvanceDialog = (performa: any) => {
    setTargetPerformaForAdvance(performa);
    setAdvanceAmountInput('');
    setAdvanceNotesInput('');
    setAdvanceModalOpen(true);
  };

  const handleSaveAdvance = async () => {
    if (!targetPerformaForAdvance) return;
    const amt = parseFloat(advanceAmountInput);
    if (!amt || amt <= 0) {
      setToast({ open: true, message: 'Please enter a valid amount greater than 0', severity: 'error' });
      return;
    }

    try {
      setAdvanceLoading(true);
      await PerformasApi.addAdvance({
        customerId: targetPerformaForAdvance.customerId,
        customerName: targetPerformaForAdvance.customerSnapshot?.name,
        performaId: targetPerformaForAdvance._id,
        amount: amt,
        notes: advanceNotesInput.trim() || `Additional advance for ${targetPerformaForAdvance.performaNumber}`,
      });

      setToast({ open: true, message: 'Advance added successfully!', severity: 'success' });
      setAdvanceModalOpen(false);
      fetchPerformas();
    } catch (err: any) {
      setToast({ open: true, message: err?.message || 'Failed to add advance', severity: 'error' });
    } finally {
      setAdvanceLoading(false);
    }
  };

  const getStatusChip = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <Chip label="ACTIVE" size="small" sx={{ backgroundColor: '#DCFCE7', color: '#166534', fontWeight: 800, fontSize: '11px' }} />;
      case 'PARTIALLY_USED':
        return <Chip label="PARTIAL" size="small" sx={{ backgroundColor: '#FEF3C7', color: '#92400E', fontWeight: 800, fontSize: '11px' }} />;
      case 'COMPLETED':
        return <Chip label="COMPLETED" size="small" sx={{ backgroundColor: '#E2E8F0', color: '#475569', fontWeight: 800, fontSize: '11px' }} />;
      case 'CANCELLED':
        return <Chip label="CANCELLED" size="small" sx={{ backgroundColor: '#FEE2E2', color: '#991B1B', fontWeight: 800, fontSize: '11px' }} />;
      default:
        return <Chip label={status} size="small" />;
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3.5 }, maxWidth: '1440px', margin: '0 auto' }}>
      {/* Top Header Card */}
      <Paper
        elevation={0}
        sx={{
          p: 2.5,
          mb: 3,
          borderRadius: '12px',
          border: '1px solid #E2E8F0',
          backgroundColor: '#FFFFFF',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: '10px',
              backgroundColor: '#EFF6FF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AccountBalanceWalletRoundedIcon sx={{ fontSize: 26, color: '#0B4DB7' }} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800, color: '#0F172A', fontSize: '20px' }}>
              All Performas
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748B', fontSize: '13px' }}>
              Directory of customer advance performas, brand allocations, editing, and fulfillment
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Button
            variant="contained"
            disableElevation
            onClick={() => shareAllPerformasOnWhatsApp(performas, 'All Performas Summary', startDate, endDate)}
            startIcon={<WhatsAppIcon sx={{ fontSize: '18px !important', color: '#FFFFFF' }} />}
            sx={{
              backgroundColor: '#25D366',
              color: '#FFFFFF',
              fontWeight: 700,
              fontSize: '13px',
              textTransform: 'none',
              borderRadius: '8px',
              px: 2,
              '&:hover': {
                backgroundColor: '#1EBE5D',
              },
            }}
          >
            Share on WhatsApp
          </Button>
          <IconButton onClick={fetchPerformas} sx={{ border: '1px solid #E2E8F0', borderRadius: '8px' }}>
            <RefreshRoundedIcon sx={{ color: '#475569', fontSize: 20 }} />
          </IconButton>
          {onAddNewPerforma && (
            <Button
              variant="contained"
              disableElevation
              onClick={onAddNewPerforma}
              startIcon={<AddRoundedIcon />}
              sx={{
                backgroundColor: '#0B4DB7',
                color: '#FFFFFF',
                fontWeight: 700,
                fontSize: '13.5px',
                textTransform: 'none',
                borderRadius: '8px',
                px: 2.5,
                '&:hover': {
                  backgroundColor: '#083B8D',
                },
              }}
            >
              New Performa
            </Button>
          )}
        </Box>
      </Paper>

      {/* Aggregate Stats Cards */}
      {summary && (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 2, mb: 3 }}>
          <Card elevation={0} sx={{ border: '1px solid #E2E8F0', borderRadius: '10px', backgroundColor: '#FFFFFF' }}>
            <CardContent sx={{ p: '16px !important' }}>
              <Typography sx={{ fontSize: '11.5px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
                Total Performas
              </Typography>
              <Typography sx={{ fontSize: '22px', fontWeight: 800, color: '#0F172A', mt: 0.5 }}>
                {summary.totalPerformas || 0}
              </Typography>
            </CardContent>
          </Card>

          <Card elevation={0} sx={{ border: '1px solid #BBF7D0', borderRadius: '10px', backgroundColor: '#F0FDF4' }}>
            <CardContent sx={{ p: '16px !important' }}>
              <Typography sx={{ fontSize: '11.5px', fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>
                Available Advance (₹)
              </Typography>
              <Typography sx={{ fontSize: '22px', fontWeight: 800, color: '#15803D', mt: 0.5 }}>
                ₹{(summary.totalRemainingAdvance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </Typography>
            </CardContent>
          </Card>

          <Card elevation={0} sx={{ border: '1px solid #BFDBFE', borderRadius: '10px', backgroundColor: '#EFF6FF' }}>
            <CardContent sx={{ p: '16px !important' }}>
              <Typography sx={{ fontSize: '11.5px', fontWeight: 700, color: '#1E40AF', textTransform: 'uppercase' }}>
                Total Advance Received
              </Typography>
              <Typography sx={{ fontSize: '22px', fontWeight: 800, color: '#1D4ED8', mt: 0.5 }}>
                ₹{(summary.totalAdvance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </Typography>
            </CardContent>
          </Card>

          <Card elevation={0} sx={{ border: '1px solid #E2E8F0', borderRadius: '10px', backgroundColor: '#FFFFFF' }}>
            <CardContent sx={{ p: '16px !important' }}>
              <Typography sx={{ fontSize: '11.5px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
                Remaining Cases
              </Typography>
              <Typography sx={{ fontSize: '22px', fontWeight: 800, color: '#0B4DB7', mt: 0.5 }}>
                {summary.totalRemainingCases || 0} <span style={{ fontSize: '13px', color: '#64748B', fontWeight: 500 }}>/ {summary.totalRequiredCases || 0}</span>
              </Typography>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Advanced Filter & Sorting Toolbar */}
      <Paper
        elevation={0}
        sx={{
          p: 2.5,
          mb: 3,
          borderRadius: '12px',
          border: '1px solid #E2E8F0',
          backgroundColor: '#FFFFFF',
        }}
      >
        <Box
          component="form"
          onSubmit={handleSearchSubmit}
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1.2fr 1fr 1fr 1fr', md: '1.4fr 1fr 1fr 1fr 1.2fr 0.9fr 0.9fr auto' },
            gap: 1.5,
            alignItems: 'center',
          }}
        >
          {/* Search Box */}
          <TextField
            label="Search"
            size="small"
            placeholder="Search code, customer, SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRoundedIcon sx={{ color: '#94A3B8', fontSize: 18 }} />
                  </InputAdornment>
                ),
              },
            }}
          />

          {/* Company / Brand Filter Dropdown */}
          <FormControl size="small" fullWidth>
            <InputLabel>Company / Brand</InputLabel>
            <Select
              value={selectedCompanyFilter}
              label="Company / Brand"
              onChange={(e) => setSelectedCompanyFilter(e.target.value)}
            >
              <MenuItem value="ALL">All Companies</MenuItem>
              {companies.map((c) => (
                <MenuItem key={c._id || c.name} value={c.name}>
                  {c.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Customer Dropdown */}
          <FormControl size="small" fullWidth>
            <InputLabel>Customer</InputLabel>
            <Select
              value={selectedCustomerFilter}
              label="Customer"
              onChange={(e) => setSelectedCustomerFilter(e.target.value)}
            >
              <MenuItem value="ALL">All Customers</MenuItem>
              {customers.map((c) => (
                <MenuItem key={c._id || c.name} value={c.name}>
                  {c.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Status Dropdown */}
          <FormControl size="small" fullWidth>
            <InputLabel>Status</InputLabel>
            <Select
              value={selectedStatusFilter}
              label="Status"
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
            >
              <MenuItem value="ALL">All Statuses</MenuItem>
              <MenuItem value="ACTIVE">ACTIVE</MenuItem>
              <MenuItem value="PARTIALLY_USED">PARTIALLY USED</MenuItem>
              <MenuItem value="COMPLETED">COMPLETED</MenuItem>
              <MenuItem value="CANCELLED">CANCELLED</MenuItem>
            </Select>
          </FormControl>

          {/* Sort By Dropdown */}
          <FormControl size="small" fullWidth>
            <InputLabel>Sort By</InputLabel>
            <Select
              value={`${sortBy}-${sortOrder}`}
              label="Sort By"
              onChange={(e) => {
                const [sb, so] = e.target.value.split('-');
                setSortBy(sb);
                setSortOrder(so as 'asc' | 'desc');
              }}
            >
              <MenuItem value="date-desc">Date (Newest First)</MenuItem>
              <MenuItem value="date-asc">Date (Oldest First)</MenuItem>
              <MenuItem value="company-asc">Company (A to Z)</MenuItem>
              <MenuItem value="company-desc">Company (Z to A)</MenuItem>
              <MenuItem value="customer-asc">Customer (A to Z)</MenuItem>
              <MenuItem value="customer-desc">Customer (Z to A)</MenuItem>
              <MenuItem value="advance-desc">Advance (High to Low)</MenuItem>
              <MenuItem value="advance-asc">Advance (Low to High)</MenuItem>
              <MenuItem value="cases-desc">Total Cases (High to Low)</MenuItem>
              <MenuItem value="cases-asc">Total Cases (Low to High)</MenuItem>
              <MenuItem value="performaNumber-desc">Performa No (Desc)</MenuItem>
              <MenuItem value="performaNumber-asc">Performa No (Asc)</MenuItem>
            </Select>
          </FormControl>

          {/* Start Date */}
          <TextField
            label="From Date"
            type="date"
            size="small"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />

          {/* End Date */}
          <TextField
            label="To Date"
            type="date"
            size="small"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />

          {/* Reset Filters */}
          <Button
            variant="outlined"
            onClick={handleResetFilters}
            sx={{
              borderColor: '#CBD5E1',
              color: '#475569',
              fontWeight: 600,
              textTransform: 'none',
              height: '40px',
              borderRadius: '8px',
              whiteSpace: 'nowrap',
            }}
          >
            Clear
          </Button>
        </Box>
      </Paper>

      {/* Performas Table */}
      <Paper
        elevation={0}
        sx={{
          borderRadius: '12px',
          border: '1px solid #E2E8F0',
          backgroundColor: '#FFFFFF',
          overflow: 'hidden',
        }}
      >
        <TableContainer>
          <Table size="small">
            <TableHead sx={{ backgroundColor: '#F8FAFC' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 800, color: '#475569', py: 1.5 }}>
                  <TableSortLabel
                    active={sortBy === 'performaNumber'}
                    direction={sortBy === 'performaNumber' ? sortOrder : 'asc'}
                    onClick={() => handleSortRequest('performaNumber')}
                  >
                    Performa No
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 800, color: '#475569' }}>
                  <TableSortLabel
                    active={sortBy === 'date'}
                    direction={sortBy === 'date' ? sortOrder : 'desc'}
                    onClick={() => handleSortRequest('date')}
                  >
                    Date
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 800, color: '#475569' }}>
                  <TableSortLabel
                    active={sortBy === 'customer'}
                    direction={sortBy === 'customer' ? sortOrder : 'asc'}
                    onClick={() => handleSortRequest('customer')}
                  >
                    Customer
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 800, textAlign: 'right', color: '#475569' }}>
                  Initial Advance
                </TableCell>
                <TableCell sx={{ fontWeight: 800, textAlign: 'right', color: '#475569' }}>
                  Additional Credits
                </TableCell>
                <TableCell sx={{ fontWeight: 800, textAlign: 'right', color: '#475569' }}>
                  <TableSortLabel
                    active={sortBy === 'advance'}
                    direction={sortBy === 'advance' ? sortOrder : 'desc'}
                    onClick={() => handleSortRequest('advance')}
                  >
                    Total Available
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 800, textAlign: 'right', color: '#475569' }}>Used Amount</TableCell>
                <TableCell sx={{ fontWeight: 800, textAlign: 'right', color: '#475569' }}>Remaining Amount</TableCell>
                <TableCell sx={{ fontWeight: 800, textAlign: 'center', color: '#475569' }}>
                  <TableSortLabel
                    active={sortBy === 'cases'}
                    direction={sortBy === 'cases' ? sortOrder : 'desc'}
                    onClick={() => handleSortRequest('cases')}
                  >
                    Cases (Req / Used / Rem)
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 800, textAlign: 'center', color: '#475569' }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 800, textAlign: 'center', color: '#475569' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={11} sx={{ textAlign: 'center', py: 6 }}>
                    <CircularProgress size={30} sx={{ color: '#0B4DB7' }} />
                  </TableCell>
                </TableRow>
              ) : performas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} sx={{ textAlign: 'center', py: 6, color: '#94A3B8' }}>
                    No Performa records found matching the current filters.
                  </TableCell>
                </TableRow>
              ) : (
                performas.map((p) => {
                  const initAdv = p.initialAdvance !== undefined ? p.initialAdvance : p.advanceAmount || 0;
                  const addlCred = p.additionalCredits !== undefined ? p.additionalCredits : 0;
                  const totalAvail = p.totalAvailableAmount !== undefined ? p.totalAvailableAmount : p.advanceAmount || 0;
                  const usedAmt = p.usedAmount !== undefined ? p.usedAmount : p.advanceUsedAmount || 0;
                  const remAmt = p.remainingAmount !== undefined ? p.remainingAmount : p.remainingAdvanceAmount || 0;

                  return (
                    <TableRow key={p._id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                      <TableCell>
                        <Typography sx={{ fontWeight: 800, color: '#0B4DB7', fontSize: '13.5px' }}>
                          {p.performaNumber}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ color: '#475569', fontSize: '13px', whiteSpace: 'nowrap' }}>{p.date}</TableCell>
                      <TableCell>
                        <Typography sx={{ fontWeight: 700, fontSize: '13.5px', color: '#0F172A' }}>
                          {p.customerSnapshot?.name}
                        </Typography>
                        {p.companyName && (
                          <Typography sx={{ fontSize: '11px', color: '#64748B' }}>
                            {p.companyName}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell sx={{ textAlign: 'right', fontWeight: 700, color: '#0F172A' }}>
                        ₹{initAdv.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell sx={{ textAlign: 'right', fontWeight: 700, color: addlCred > 0 ? '#0B4DB7' : '#64748B' }}>
                        ₹{addlCred.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell sx={{ textAlign: 'right', fontWeight: 800, color: '#1D4ED8' }}>
                        ₹{totalAvail.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell sx={{ textAlign: 'right', color: usedAmt > 0 ? '#DC2626' : '#64748B', fontWeight: 600 }}>
                        ₹{usedAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell sx={{ textAlign: 'right', fontWeight: 800, color: '#166534' }}>
                        ₹{remAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell sx={{ textAlign: 'center' }}>
                        <Typography sx={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
                          {p.totalRequiredCases || 0} / <span style={{ color: p.totalUsedCases > 0 ? '#DC2626' : '#64748B' }}>{p.totalUsedCases || 0}</span> / <span style={{ color: '#166534' }}>{p.totalRemainingCases || 0}</span>
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ textAlign: 'center' }}>{getStatusChip(p.status)}</TableCell>
                      <TableCell sx={{ textAlign: 'center' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                          <Tooltip title="View Details">
                            <IconButton size="small" onClick={() => handleOpenViewModal(p._id)} sx={{ color: '#0B4DB7' }}>
                              <VisibilityRoundedIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                          </Tooltip>

                          <Tooltip title="Edit Performa">
                            <IconButton
                              size="small"
                              onClick={() => handleOpenEditModal(p)}
                              sx={{
                                color: '#2563EB',
                                backgroundColor: '#EFF6FF',
                                '&:hover': { backgroundColor: '#DBEAFE' },
                              }}
                            >
                              <ModeEditOutlineRoundedIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                          </Tooltip>

                          <Tooltip title="Share on WhatsApp">
                            <IconButton
                              size="small"
                              onClick={() => sharePerformaOnWhatsApp(p)}
                              sx={{
                                color: '#FFFFFF',
                                backgroundColor: '#25D366',
                                '&:hover': { backgroundColor: '#1EBE5D' },
                              }}
                            >
                              <WhatsAppIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                          </Tooltip>

                          <Tooltip title="Print Performa">
                            <IconButton size="small" onClick={() => handleOpenPrintModal(p)} sx={{ color: '#475569' }}>
                              <PrintOutlinedIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                          </Tooltip>

                          {onSelectCustomerForBill && p.status !== 'CANCELLED' && (
                            <Tooltip title="Create Bill from this Performa">
                              <IconButton
                                size="small"
                                onClick={() => onSelectCustomerForBill(p.customerSnapshot?.name, 'Create Particular')}
                                sx={{ color: '#7C3AED' }}
                              >
                                <ReceiptLongRoundedIcon sx={{ fontSize: 18 }} />
                              </IconButton>
                            </Tooltip>
                          )}

                          <Tooltip title="Add Customer Advance">
                            <IconButton size="small" onClick={() => handleOpenAdvanceDialog(p)} sx={{ color: '#16A34A' }}>
                              <AccountBalanceWalletRoundedIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                          </Tooltip>

                          {p.status !== 'CANCELLED' && p.status !== 'COMPLETED' && (
                            <Tooltip title="Cancel Performa">
                              <IconButton size="small" onClick={() => handleCancelPerforma(p._id, p.performaNumber)} sx={{ color: '#D97706' }}>
                                <CancelOutlinedIcon sx={{ fontSize: 18 }} />
                              </IconButton>
                            </Tooltip>
                          )}

                          {p.totalUsedCases === 0 && p.advanceUsedAmount === 0 && (
                            <Tooltip title="Delete">
                              <IconButton size="small" onClick={() => handleDeletePerforma(p._id, p.performaNumber)} sx={{ color: '#DC2626' }}>
                                <DeleteOutlineRoundedIcon sx={{ fontSize: 18 }} />
                              </IconButton>
                            </Tooltip>
                          )}
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

      {/* View Performa Details Dialog */}
      <Dialog
        open={viewModalOpen}
        onClose={() => setViewModalOpen(false)}
        maxWidth="md"
        fullWidth
        sx={{ '& .MuiDialog-paper': { borderRadius: '12px' } }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0F172A', color: '#FFFFFF', py: 1.8 }}>
          <Box>
            <Typography sx={{ fontWeight: 800, fontSize: '17px' }}>
              Performa Details - {selectedPerformaForView?.performaNumber}
            </Typography>
            <Typography sx={{ fontSize: '12px', color: '#94A3B8' }}>
              {selectedPerformaForView?.companyName || selectedPerformaForView?.customerSnapshot?.companyName || 'General'} | {selectedPerformaForView?.customerSnapshot?.name} | {selectedPerformaForView?.date}
            </Typography>
          </Box>
          <IconButton onClick={() => setViewModalOpen(false)} sx={{ color: '#FFFFFF' }}>
            <CloseRoundedIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 3, backgroundColor: '#F8FAFC' }}>
          {viewLoading || !selectedPerformaForView ? (
            <Box sx={{ py: 6, textAlign: 'center' }}>
              <CircularProgress size={30} sx={{ color: '#0B4DB7' }} />
            </Box>
          ) : (
            <Box>
              {/* Customer and Status Overview */}
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 3 }}>
                <Paper elevation={0} sx={{ p: 2, border: '1px solid #E2E8F0', borderRadius: '8px' }}>
                  <Typography sx={{ fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', mb: 0.5 }}>
                    Customer & Company Snapshot
                  </Typography>
                  <Typography sx={{ fontWeight: 800, fontSize: '15px', color: '#0F172A' }}>
                    {selectedPerformaForView.customerSnapshot?.name}
                  </Typography>
                  <Typography sx={{ fontSize: '12.5px', color: '#475569' }}>
                    <strong>Company / Brand:</strong> {selectedPerformaForView.companyName || selectedPerformaForView.customerSnapshot?.companyName || 'General'}
                  </Typography>
                  <Typography sx={{ fontSize: '12.5px', color: '#475569' }}>
                    <strong>Phone:</strong> {selectedPerformaForView.customerSnapshot?.phone || '-'}
                  </Typography>
                  <Typography sx={{ fontSize: '12.5px', color: '#475569' }}>
                    <strong>Address:</strong> {selectedPerformaForView.customerSnapshot?.address || '-'}
                  </Typography>
                </Paper>

                <Paper elevation={0} sx={{ p: 2, border: '1px solid #E2E8F0', borderRadius: '8px' }}>
                  <Typography sx={{ fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', mb: 0.5 }}>
                    Performa Financial Breakdown
                  </Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.8, fontSize: '12px', mb: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748B' }}>Subtotal:</span>
                      <strong>₹{(selectedPerformaForView.subtotal ?? (selectedPerformaForView.products || []).reduce((s: number, p: any) => s + (p.allocatedAmount || 0), 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748B' }}>Discount:</span>
                      <strong style={{ color: selectedPerformaForView.discountAmount ? '#DC2626' : undefined }}>
                        {selectedPerformaForView.discountAmount ? `- ₹${selectedPerformaForView.discountAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : (selectedPerformaForView.discount || '-')}
                      </strong>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748B' }}>Packing Charge:</span>
                      <strong style={{ color: selectedPerformaForView.packingAmount ? '#0B4DB7' : undefined }}>
                        {selectedPerformaForView.packingAmount ? `+ ₹${selectedPerformaForView.packingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : (selectedPerformaForView.packing ? `${selectedPerformaForView.packing}%` : '-')}
                      </strong>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748B' }}>Tax Amount:</span>
                      <strong style={{ color: selectedPerformaForView.taxAmount ? '#166534' : undefined }}>
                        {selectedPerformaForView.taxAmount ? `+ ₹${selectedPerformaForView.taxAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : (selectedPerformaForView.tax ? `₹${selectedPerformaForView.tax}` : '-')}
                      </strong>
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 0.5, borderTop: '1px solid #EEF2F6', mb: 0.5 }}>
                    <span style={{ fontSize: '12.5px', color: '#0B4DB7', fontWeight: 700 }}>Total Value:</span>
                    <strong style={{ color: '#0B4DB7', fontSize: '13.5px' }}>₹{(selectedPerformaForView.totalAllocatedAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <span style={{ fontSize: '12.5px', color: '#475569' }}>Advance / Remaining:</span>
                    <strong style={{ color: '#166534' }}>₹{selectedPerformaForView.advanceAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })} / ₹{selectedPerformaForView.remainingAdvanceAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.5 }}>
                    <span style={{ fontSize: '12.5px', color: '#475569' }}>Current Status:</span>
                    {getStatusChip(selectedPerformaForView.status)}
                  </Box>
                </Paper>
              </Box>

              {/* Product Allocation Breakdown */}
              <Typography sx={{ fontSize: '14px', fontWeight: 800, color: '#0F172A', mb: 1.5 }}>
                Allocated Products & Consumption
              </Typography>
              <TableContainer sx={{ border: '1px solid #E2E8F0', borderRadius: '8px', mb: 3, backgroundColor: '#FFFFFF' }}>
                <Table size="small">
                  <TableHead sx={{ backgroundColor: '#F1F5F9' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 800 }}>Product</TableCell>
                      <TableCell sx={{ fontWeight: 800, textAlign: 'center' }}>Required</TableCell>
                      <TableCell sx={{ fontWeight: 800, textAlign: 'center' }}>Used (Billed)</TableCell>
                      <TableCell sx={{ fontWeight: 800, textAlign: 'center' }}>Remaining</TableCell>
                      <TableCell sx={{ fontWeight: 800, textAlign: 'right' }}>Rate (₹)</TableCell>
                      <TableCell sx={{ fontWeight: 800, textAlign: 'right' }}>Allocated Value</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(selectedPerformaForView.products || []).map((prod: any, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <strong>{prod.productSnapshot?.productName || prod.productName}</strong>
                          {prod.productSnapshot?.productCode && (
                            <div style={{ fontSize: '11px', color: '#64748B' }}>Code: {prod.productSnapshot.productCode}</div>
                          )}
                        </TableCell>
                        <TableCell sx={{ textAlign: 'center', fontWeight: 700 }}>{prod.requiredCases}</TableCell>
                        <TableCell sx={{ textAlign: 'center', color: '#0B4DB7', fontWeight: 700 }}>{prod.usedCases}</TableCell>
                        <TableCell sx={{ textAlign: 'center', fontWeight: 700, color: prod.remainingCases > 0 ? '#166534' : '#64748B' }}>
                          {prod.remainingCases}
                        </TableCell>
                        <TableCell sx={{ textAlign: 'right' }}>₹{prod.rate?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell sx={{ textAlign: 'right', fontWeight: 700 }}>₹{prod.allocatedAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Audit / Consumption History */}
              {selectedPerformaForView.auditHistory && selectedPerformaForView.auditHistory.length > 0 && (
                <Box>
                  <Typography sx={{ fontSize: '14px', fontWeight: 800, color: '#0F172A', mb: 1.5 }}>
                    Audit & Bill Consumption Trail
                  </Typography>
                  <TableContainer sx={{ border: '1px solid #E2E8F0', borderRadius: '8px', backgroundColor: '#FFFFFF' }}>
                    <Table size="small">
                      <TableHead sx={{ backgroundColor: '#F1F5F9' }}>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 800 }}>Date</TableCell>
                          <TableCell sx={{ fontWeight: 800 }}>Type</TableCell>
                          <TableCell sx={{ fontWeight: 800 }}>Reference / Bill</TableCell>
                          <TableCell sx={{ fontWeight: 800 }}>Product</TableCell>
                          <TableCell sx={{ fontWeight: 800, textAlign: 'center' }}>Cases</TableCell>
                          <TableCell sx={{ fontWeight: 800, textAlign: 'right' }}>Amount (₹)</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {selectedPerformaForView.auditHistory.map((audit: any, idx: number) => (
                          <TableRow key={idx}>
                            <TableCell sx={{ fontSize: '12.5px' }}>{audit.date}</TableCell>
                            <TableCell>
                              <Chip
                                label={audit.type}
                                size="small"
                                sx={{
                                  fontSize: '10px',
                                  fontWeight: 700,
                                  backgroundColor:
                                    audit.type === 'PERFORMA_CONSUMED'
                                      ? '#FEF3C7'
                                      : audit.type === 'ADVANCE_RECEIVED'
                                      ? '#DCFCE7'
                                      : '#F1F5F9',
                                }}
                              />
                            </TableCell>
                            <TableCell sx={{ fontSize: '12.5px' }}>{audit.reference || audit.billNo || '-'}</TableCell>
                            <TableCell sx={{ fontSize: '12.5px' }}>{audit.productName || '-'}</TableCell>
                            <TableCell sx={{ textAlign: 'center', fontWeight: 700 }}>{audit.cases || '-'}</TableCell>
                            <TableCell sx={{ textAlign: 'right', fontWeight: 700 }}>
                              ₹{audit.amount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 2, backgroundColor: '#FFFFFF', borderTop: '1px solid #E2E8F0' }}>
          <Button onClick={() => setViewModalOpen(false)} sx={{ textTransform: 'none', color: '#64748B', fontWeight: 600 }}>
            Close
          </Button>
          {selectedPerformaForView && (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="contained"
                disableElevation
                onClick={() => {
                  sharePerformaOnWhatsApp(selectedPerformaForView);
                }}
                startIcon={<WhatsAppIcon sx={{ fontSize: 18 }} />}
                sx={{
                  backgroundColor: '#25D366',
                  color: '#FFFFFF',
                  textTransform: 'none',
                  fontWeight: 700,
                  '&:hover': { backgroundColor: '#1EBE5D' },
                }}
              >
                Share on WhatsApp
              </Button>
              <Button
                variant="contained"
                disableElevation
                onClick={() => {
                  setViewModalOpen(false);
                  handleOpenPrintModal(selectedPerformaForView);
                }}
                startIcon={<PrintOutlinedIcon sx={{ fontSize: 18 }} />}
                sx={{ backgroundColor: '#0B4DB7', textTransform: 'none', fontWeight: 700 }}
              >
                Print Performa
              </Button>
            </Box>
          )}
        </DialogActions>
      </Dialog>

      {/* Edit Performa Dialog */}
      <Dialog
        open={editModalOpen}
        onClose={() => !editLoading && setEditModalOpen(false)}
        maxWidth="lg"
        fullWidth
        sx={{ '& .MuiDialog-paper': { borderRadius: '12px' } }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0F172A', color: '#FFFFFF', py: 1.8 }}>
          <Box>
            <Typography sx={{ fontWeight: 800, fontSize: '17px' }}>
              Edit Performa - {editPerformaNumber}
            </Typography>
            <Typography sx={{ fontSize: '12px', color: '#94A3B8' }}>
              Modify brand/company, customer information, status, advance amount, and product quantities
            </Typography>
          </Box>
          <IconButton onClick={() => !editLoading && setEditModalOpen(false)} sx={{ color: '#FFFFFF' }}>
            <CloseRoundedIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 3, backgroundColor: '#F8FAFC' }}>
          {editLoading ? (
            <Box sx={{ py: 6, textAlign: 'center' }}>
              <CircularProgress size={30} sx={{ color: '#0B4DB7' }} />
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              {/* Top Row: Company, Customer, Date, Status */}
              <Paper elevation={0} sx={{ p: 2.5, borderRadius: '8px', border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF' }}>
                <Typography sx={{ fontSize: '14px', fontWeight: 800, color: '#0F172A', mb: 2 }}>
                  Performa Information
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1.2fr 1fr 1fr 1fr 1fr' }, gap: 2 }}>
                  <Autocomplete
                    freeSolo
                    options={companies.map((c) => c.name).filter(Boolean)}
                    value={editCompanyName}
                    onChange={(_e, val) => setEditCompanyName(val || '')}
                    onInputChange={(_e, val) => setEditCompanyName(val || '')}
                    renderOption={(props, option) => {
                      const compObj = companies.find((c: any) => c.name === option);
                      return (
                        <Box component="li" {...props} key={props.key || option} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', py: 0.8 }}>
                          <Typography sx={{ fontWeight: 700, fontSize: '13.5px', color: '#0F172A' }}>
                            {option}
                          </Typography>
                          {compObj && (compObj.gstin || compObj.address) && (
                            <Typography sx={{ fontSize: '11px', color: '#64748B' }}>
                              {compObj.gstin && compObj.gstin !== 'N/A' ? `GST: ${compObj.gstin}` : ''}
                              {compObj.gstin && compObj.address ? ' • ' : ''}
                              {compObj.address || ''}
                            </Typography>
                          )}
                        </Box>
                      );
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Company / Brand"
                        placeholder="Select or enter brand..."
                        size="small"
                        fullWidth
                      />
                    )}
                  />

                  <TextField
                    label="Customer Name"
                    size="small"
                    value={editCustomerName}
                    onChange={(e) => setEditCustomerName(e.target.value)}
                    fullWidth
                  />

                  <TextField
                    label="Performa Date"
                    type="date"
                    size="small"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    slotProps={{ inputLabel: { shrink: true } }}
                    fullWidth
                  />

                  <TextField
                    label="Advance Amount (₹)"
                    type="number"
                    size="small"
                    value={editAdvanceAmount}
                    onChange={(e) => setEditAdvanceAmount(e.target.value)}
                    fullWidth
                  />

                  <FormControl size="small" fullWidth>
                    <InputLabel>Status</InputLabel>
                    <Select
                      value={editStatus}
                      label="Status"
                      onChange={(e) => setEditStatus(e.target.value)}
                    >
                      <MenuItem value="ACTIVE">ACTIVE</MenuItem>
                      <MenuItem value="PARTIALLY_USED">PARTIALLY USED</MenuItem>
                      <MenuItem value="COMPLETED">COMPLETED</MenuItem>
                      <MenuItem value="CANCELLED">CANCELLED</MenuItem>
                    </Select>
                  </FormControl>
                </Box>

                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 2fr' }, gap: 2, mt: 2 }}>
                  <TextField
                    label="Phone"
                    size="small"
                    value={editCustomerPhone}
                    onChange={(e) => setEditCustomerPhone(e.target.value)}
                  />
                  <TextField
                    label="GST Number"
                    size="small"
                    value={editCustomerGst}
                    onChange={(e) => setEditCustomerGst(e.target.value)}
                  />
                  <TextField
                    label="Address & Notes"
                    size="small"
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="Optional notes..."
                  />
                </Box>

                {/* Financial Adjustments in Edit Modal */}
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' }, gap: 2, mt: 2, pt: 2, borderTop: '1px solid #EEF2F6' }}>
                  <TextField
                    label="Discount (% or ₹)"
                    size="small"
                    value={editDiscount}
                    onChange={(e) => setEditDiscount(e.target.value)}
                    placeholder="e.g. 5% or 500"
                    helperText={editDiscountVal > 0 ? `- ₹${editDiscountVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : undefined}
                    slotProps={{
                      formHelperText: { sx: { color: '#DC2626', fontWeight: 700 } },
                    }}
                  />
                  <TextField
                    label="Packing Charge (%)"
                    size="small"
                    value={editPacking}
                    onChange={(e) => setEditPacking(e.target.value)}
                    placeholder="e.g. 2.5% or 3"
                    helperText={editPackingVal > 0 ? `+ ₹${editPackingVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : 'Supports decimal (%)'}
                    slotProps={{
                      formHelperText: { sx: { color: '#0B4DB7', fontWeight: 600 } },
                    }}
                  />
                  <TextField
                    label="Tax (₹ Amount)"
                    size="small"
                    type="number"
                    value={editTax}
                    onChange={(e) => setEditTax(e.target.value)}
                    placeholder="e.g. 1000"
                    helperText={editTaxVal > 0 ? `+ ₹${editTaxVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : undefined}
                    slotProps={{
                      formHelperText: { sx: { color: '#166534', fontWeight: 600 } },
                    }}
                  />
                </Box>
              </Paper>

              {/* Product Requirements Table */}
              <Paper elevation={0} sx={{ p: 2.5, borderRadius: '8px', border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
                  <Typography sx={{ fontSize: '14px', fontWeight: 800, color: '#0F172A' }}>
                    Allocated Products & Quantities
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                    <Chip label={`Cases: ${editTotalCases}`} sx={{ fontWeight: 800, backgroundColor: '#EFF6FF', color: '#0B4DB7' }} />
                    <Chip label={`Subtotal: ₹${editSubtotalAllocated.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`} sx={{ fontWeight: 700, backgroundColor: '#F1F5F9', color: '#475569' }} />
                    {editDiscountVal > 0 && (
                      <Chip label={`Discount: -₹${editDiscountVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`} sx={{ fontWeight: 700, backgroundColor: '#FEF2F2', color: '#DC2626' }} />
                    )}
                    {editPackingVal > 0 && (
                      <Chip label={`Packing: +₹${editPackingVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`} sx={{ fontWeight: 700, backgroundColor: '#EFF6FF', color: '#0B4DB7' }} />
                    )}
                    {editTaxVal > 0 && (
                      <Chip label={`Tax: +₹${editTaxVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`} sx={{ fontWeight: 700, backgroundColor: '#F0FDF4', color: '#166534' }} />
                    )}
                    <Chip label={`Net Total: ₹${editFinalTotalAllocated.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`} sx={{ fontWeight: 900, backgroundColor: '#DBEAFE', color: '#1E40AF' }} />
                  </Box>
                </Box>

                {/* Add new product line row */}
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: '1.5fr 1fr 1fr 1fr 0.8fr auto' },
                    gap: 1.5,
                    alignItems: 'center',
                    backgroundColor: '#F8FAFC',
                    p: 1.5,
                    borderRadius: '8px',
                    border: '1px solid #EEF2F6',
                    mb: 2,
                  }}
                >
                  <Autocomplete
                    options={filteredEditModalProducts}
                    getOptionLabel={(o) => {
                      if (typeof o === 'string') return o;
                      return `${o.name || ''} ${o.code ? `(${o.code})` : ''} ${o.companyName ? `• ${o.companyName}` : ''}`.trim();
                    }}
                    value={newRowProductObj}
                    onChange={(_e, val) => {
                      setNewRowProductObj(val);
                      if (val) {
                        setNewRowProductName(val.name || '');
                        setNewRowProductCode(val.code || val.idCode || '');
                        setNewRowProductCompany(val.companyName || editCompanyName || '');
                        setNewRowRate(val.rate ? String(val.rate) : '');
                        setNewRowPktUnit(val.pktUnit ? String(val.pktUnit) : '1');
                      }
                    }}
                    renderInput={(params) => (
                      <TextField {...params} label="Add Product" placeholder="Select product..." size="small" />
                    )}
                  />

                  <Autocomplete
                    freeSolo
                    options={companies.map((c) => c.name).filter(Boolean)}
                    value={newRowProductCompany}
                    onChange={(_e, val) => setNewRowProductCompany(val || '')}
                    onInputChange={(_e, val) => setNewRowProductCompany(val || '')}
                    renderInput={(params) => (
                      <TextField {...params} label="Company / Brand" size="small" placeholder="Brand name" />
                    )}
                  />

                  <TextField
                    label="Req Cases"
                    type="number"
                    size="small"
                    value={newRowCases}
                    onChange={(e) => setNewRowCases(e.target.value)}
                    placeholder="e.g. 50"
                  />

                  <TextField
                    label="Rate (₹)"
                    type="number"
                    size="small"
                    value={newRowRate}
                    onChange={(e) => setNewRowRate(e.target.value)}
                    placeholder="e.g. 120"
                  />

                  <TextField
                    label="Pkt/Unit"
                    type="number"
                    size="small"
                    value={newRowPktUnit}
                    onChange={(e) => setNewRowPktUnit(e.target.value)}
                  />

                  <Button
                    variant="contained"
                    disableElevation
                    onClick={handleAddProductToEditList}
                    startIcon={<AddRoundedIcon />}
                    sx={{ backgroundColor: '#0B4DB7', textTransform: 'none', fontWeight: 700, height: '40px' }}
                  >
                    Add
                  </Button>
                </Box>

                {/* Products Table */}
                <TableContainer sx={{ border: '1px solid #E2E8F0', borderRadius: '8px' }}>
                  <Table size="small">
                    <TableHead sx={{ backgroundColor: '#F8FAFC' }}>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 800 }}>Product Name & Code</TableCell>
                        <TableCell sx={{ fontWeight: 800 }}>Company / Brand</TableCell>
                        <TableCell sx={{ fontWeight: 800, width: '130px' }}>Req Cases</TableCell>
                        <TableCell sx={{ fontWeight: 800, width: '130px' }}>Rate (₹)</TableCell>
                        <TableCell sx={{ fontWeight: 800, width: '90px' }}>Pkt/Unit</TableCell>
                        <TableCell sx={{ fontWeight: 800, textAlign: 'right' }}>Allocated (₹)</TableCell>
                        <TableCell sx={{ fontWeight: 800, width: '50px', textAlign: 'center' }}>Remove</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {editProducts.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} sx={{ textAlign: 'center', py: 3, color: '#94A3B8' }}>
                            No products added to this performa.
                          </TableCell>
                        </TableRow>
                      ) : (
                        editProducts.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell>
                              <Typography sx={{ fontWeight: 700, fontSize: '13px' }}>{p.productName}</Typography>
                              <Typography sx={{ fontSize: '11px', color: '#64748B' }}>{p.productCode}</Typography>
                            </TableCell>
                            <TableCell>
                              <TextField
                                size="small"
                                value={p.companyName}
                                onChange={(e) => handleEditProductChange(p.id, 'companyName', e.target.value)}
                                sx={{ maxWidth: '140px' }}
                              />
                            </TableCell>
                            <TableCell>
                              <TextField
                                type="number"
                                size="small"
                                value={p.requiredCases}
                                onChange={(e) => handleEditProductChange(p.id, 'requiredCases', e.target.value)}
                                sx={{ width: '100px' }}
                              />
                            </TableCell>
                            <TableCell>
                              <TextField
                                type="number"
                                size="small"
                                value={p.rate}
                                onChange={(e) => handleEditProductChange(p.id, 'rate', e.target.value)}
                                sx={{ width: '100px' }}
                              />
                            </TableCell>
                            <TableCell>
                              <TextField
                                type="number"
                                size="small"
                                value={p.pktPerUnit}
                                onChange={(e) => handleEditProductChange(p.id, 'pktPerUnit', e.target.value)}
                                sx={{ width: '70px' }}
                              />
                            </TableCell>
                            <TableCell sx={{ textAlign: 'right', fontWeight: 700 }}>
                              ₹{(parseFloat(String(p.allocatedAmount)) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell sx={{ textAlign: 'center' }}>
                              <IconButton size="small" onClick={() => handleRemoveEditProductRow(p.id)} sx={{ color: '#DC2626' }}>
                                <DeleteOutlineRoundedIcon sx={{ fontSize: 18 }} />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 2.5, backgroundColor: '#FFFFFF', borderTop: '1px solid #E2E8F0' }}>
          <Button onClick={() => setEditModalOpen(false)} sx={{ textTransform: 'none', color: '#64748B', fontWeight: 600 }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disableElevation
            onClick={handleSaveEditPerforma}
            disabled={editLoading}
            sx={{ backgroundColor: '#0B4DB7', textTransform: 'none', fontWeight: 700, px: 3 }}
          >
            {editLoading ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Advance Dialog */}
      <Dialog
        open={advanceModalOpen}
        onClose={() => setAdvanceModalOpen(false)}
        maxWidth="xs"
        fullWidth
        sx={{ '& .MuiDialog-paper': { borderRadius: '12px' } }}
      >
        <DialogTitle sx={{ fontWeight: 800, color: '#0F172A', pb: 1 }}>
          Add Customer Advance
        </DialogTitle>
        <DialogContent sx={{ pt: '10px !important' }}>
          <Typography sx={{ fontSize: '13px', color: '#64748B', mb: 2 }}>
            Deposit advance against <strong>{targetPerformaForAdvance?.customerSnapshot?.name}</strong> ({targetPerformaForAdvance?.performaNumber})
          </Typography>
          <TextField
            label="Advance Amount (₹)"
            fullWidth
            size="small"
            type="number"
            value={advanceAmountInput}
            onChange={(e) => setAdvanceAmountInput(e.target.value)}
            placeholder="e.g. 500000"
            sx={{ mb: 2 }}
            autoFocus
          />
          <TextField
            label="Notes / Reference"
            fullWidth
            size="small"
            value={advanceNotesInput}
            onChange={(e) => setAdvanceNotesInput(e.target.value)}
            placeholder="e.g. NEFT transfer Ref #12345"
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setAdvanceModalOpen(false)} sx={{ textTransform: 'none', color: '#64748B' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disableElevation
            onClick={handleSaveAdvance}
            disabled={advanceLoading || !advanceAmountInput}
            sx={{ backgroundColor: '#0B4DB7', textTransform: 'none', fontWeight: 700 }}
          >
            {advanceLoading ? 'Saving...' : 'Add Advance'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Performa Print Modal */}
      <PerformaPrintModal
        open={printModalOpen}
        onClose={() => setPrintModalOpen(false)}
        performa={selectedPerformaForPrint}
      />

      {/* Feedback Toast */}
      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={() => setToast({ ...toast, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={toast.severity}
          onClose={() => setToast({ ...toast, open: false })}
          sx={{ width: '100%', fontWeight: 600 }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};
