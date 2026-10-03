import { useState, useEffect, useMemo, type FC } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  TextField,
  Autocomplete,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  CircularProgress,
  Chip,
  Card,
  CardContent,
  Snackbar,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  InputAdornment,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded';
import AccountBalanceWalletRoundedIcon from '@mui/icons-material/AccountBalanceWalletRounded';
import PersonOutlineRoundedIcon from '@mui/icons-material/PersonOutlineRounded';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import ModeEditOutlineRoundedIcon from '@mui/icons-material/ModeEditOutlineRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import BusinessRoundedIcon from '@mui/icons-material/BusinessRounded';
import ListAltRoundedIcon from '@mui/icons-material/ListAltRounded';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import { CustomersApi, ProductsApi, CompaniesApi, PerformasApi } from '../services/api';
import { PerformaPrintModal } from './PerformaPrintModal';
import type { PerformaPrintData } from './PerformaPrintTemplate';
import { sharePerformaOnWhatsApp } from '../utils/whatsappUtils';

export type PerformaSubTab = 'Create Performa' | 'Customer Performa List';

const SUB_TABS: PerformaSubTab[] = ['Create Performa', 'Customer Performa List'];

interface ProductRowItem {
  id: string;
  productId?: string;
  productCode: string;
  productName: string;
  companyName: string;
  category: string;
  requiredCases: string;
  rate: string;
  pktUnit: string;
  allocatedAmount: string;
}

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

interface PerformaPageProps {
  initialCustomerName?: string;
  initialSubTab?: PerformaSubTab;
  onNavigateAllPerforma?: () => void;
  onSelectCustomerForBill?: (customerName: string, subTab?: any) => void;
}

export const PerformaPage: FC<PerformaPageProps> = ({
  initialCustomerName,
  initialSubTab,
  onNavigateAllPerforma,
  onSelectCustomerForBill: _onSelectCustomerForBill,
}) => {
  // Subtab Navigation
  const [activeSubTab, setActiveSubTab] = useState<PerformaSubTab>(() => {
    return initialSubTab || (localStorage.getItem('dheeksha_performa_subtab') as PerformaSubTab) || 'Create Performa';
  });

  // Master Dropdown Data
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Selected Customer Details & Performa Summary
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [customerPerformaSummary, setCustomerPerformaSummary] = useState<any | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // Form State (Create Performa)
  const [performaNumber, setPerformaNumber] = useState<string>('PF-000001');
  const [date, setDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [depositAdvance, setDepositAdvance] = useState<string>('0');
  const [notes, setNotes] = useState<string>('');
  const [discount, setDiscount] = useState<string>('');
  const [packing, setPacking] = useState<string>('');
  const [tax, setTax] = useState<string>('');

  // Product Requirement Entry Line
  const [selectedProductObj, setSelectedProductObj] = useState<any | null>(null);
  const [productCode, setProductCode] = useState<string>('');
  const [productName, setProductName] = useState<string>('');
  const [productCompany, setProductCompany] = useState<string>('');
  const [requiredCases, setRequiredCases] = useState<string>('');
  const [rate, setRate] = useState<string>('');
  const [pktUnit, setPktUnit] = useState<string>('1');

  // Product Rows
  const [productRows, setProductRows] = useState<ProductRowItem[]>([]);
  const [submitLoading, setSubmitLoading] = useState(false);

  // Customer Performa List Sub-page State
  const [customerPerformas, setCustomerPerformas] = useState<any[]>([]);
  const [customerPerformasLoading, setCustomerPerformasLoading] = useState<boolean>(false);
  const [customerPerformaSearch, setCustomerPerformaSearch] = useState<string>('');

  // View Details Modal State
  const [selectedPerformaForView, setSelectedPerformaForView] = useState<any | null>(null);
  const [viewModalOpen, setViewModalOpen] = useState<boolean>(false);
  const [viewLoading, setViewLoading] = useState<boolean>(false);

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



  // Print Modal & Toast
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [currentPerformaForPrint, setCurrentPerformaForPrint] = useState<PerformaPrintData | null>(null);
  const [toast, setToast] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  // Load initial dropdowns & next performa number
  useEffect(() => {
    const initData = async () => {
      try {
        setLoadingInitial(true);
        const [custList, prodList, compList, nextNumRes] = await Promise.all([
          CustomersApi.getAll(),
          ProductsApi.getAll(),
          CompaniesApi.getAll(),
          PerformasApi.getNextNumber().catch(() => ({ nextPerformaNumber: 'PF-000001' })),
        ]);

        setCustomers(custList || []);
        setProducts(prodList || []);
        setCompanies(compList || []);
        if (nextNumRes?.nextPerformaNumber) {
          setPerformaNumber(nextNumRes.nextPerformaNumber);
        }

        // Auto-select initial customer only if explicitly provided
        if (initialCustomerName && custList && custList.length > 0) {
          const match = custList.find(
            (c: any) => c.name.toLowerCase() === initialCustomerName.toLowerCase()
          );
          if (match) {
            setSelectedCustomer(match);
          }
        }
      } catch (err) {
        console.error('Failed to load Performa initial data:', err);
      } finally {
        setLoadingInitial(false);
      }
    };

    initData();
  }, [initialCustomerName]);

  // Sync initialSubTab
  useEffect(() => {
    if (initialSubTab) {
      setActiveSubTab(initialSubTab);
      localStorage.setItem('dheeksha_performa_subtab', initialSubTab);
    }
  }, [initialSubTab]);

  // Persist activeSubTab on change
  useEffect(() => {
    if (activeSubTab) {
      localStorage.setItem('dheeksha_performa_subtab', activeSubTab);
    }
  }, [activeSubTab]);

  // Fetch summary and performas for selected customer
  const fetchCustomerPerformaData = async (customer: any) => {
    if (!customer) {
      setCustomerPerformaSummary(null);
      setCustomerPerformas([]);
      return;
    }

    try {
      setSummaryLoading(true);
      setCustomerPerformasLoading(true);
      const [sumRes, listRes] = await Promise.all([
        PerformasApi.getCustomerSummary(customer._id || customer.name).catch(() => null),
        PerformasApi.getAll({
          customerName: customer.name,
          search: customerPerformaSearch || undefined,
          sortBy: 'date',
          sortOrder: 'desc',
        }).catch(() => []),
      ]);

      setCustomerPerformaSummary(sumRes);
      if (Array.isArray(listRes)) {
        setCustomerPerformas(listRes);
      } else if (listRes && listRes.data) {
        setCustomerPerformas(listRes.data);
      }
    } catch (err) {
      console.error('Failed to load customer performa data:', err);
    } finally {
      setSummaryLoading(false);
      setCustomerPerformasLoading(false);
    }
  };

  useEffect(() => {
    if (selectedCustomer) {
      fetchCustomerPerformaData(selectedCustomer);
    }
  }, [selectedCustomer, customerPerformaSearch]);

  // Filter available products by selected productCompany for smart autofill/selection
  const filteredProductsForEntry = useMemo(() => {
    if (!productCompany || !productCompany.trim() || productCompany.trim().toLowerCase() === 'general') return products;
    const comp = productCompany.trim().toLowerCase();
    const matched = products.filter(
      (p: any) => p.companyName && p.companyName.trim().toLowerCase() === comp
    );
    return matched.length > 0 ? matched : products;
  }, [products, productCompany]);

  // When product dropdown selected, autofill code, company, rate without overwriting user entered company
  const handleProductSelect = (prod: any | null) => {
    setSelectedProductObj(prod);
    if (prod) {
      setProductName(prod.name || '');
      setProductCode(prod.code || prod.idCode || `#${prod.slNo || ''}`);
      setRate(prod.rate ? String(prod.rate) : '');
      setPktUnit(prod.pktUnit || '1');
      // If product has a brand name and user hasn't typed one yet, autofill it
      if (prod.companyName && prod.companyName.toLowerCase() !== 'general') {
        if (!productCompany.trim() || productCompany.trim().toLowerCase() === 'general') {
          setProductCompany(prod.companyName);
        }
      }
    } else {
      setProductName('');
      setProductCode('');
      setRate('');
      setPktUnit('1');
    }
  };

  // Add Product Row
  const handleAddProductRow = () => {
    const trimmedName = productName.trim();
    if (!trimmedName) {
      setToast({ open: true, message: 'Please select or enter a product name', severity: 'error' });
      return;
    }
    const casesVal = parseFloat(requiredCases) || 0;
    if (casesVal <= 0) {
      setToast({ open: true, message: 'Please enter a valid required case count > 0', severity: 'error' });
      return;
    }
    const rateVal = parseFloat(rate) || 0;
    if (rateVal <= 0) {
      setToast({ open: true, message: 'Please enter a valid rate > 0', severity: 'error' });
      return;
    }
    const unitsVal = parseFloat(pktUnit) || 1;
    const allocatedAmt = (casesVal * rateVal * unitsVal).toFixed(2);

    const rowCompany =
      productCompany.trim() ||
      (selectedProductObj?.companyName && selectedProductObj.companyName.toLowerCase() !== 'general' ? selectedProductObj.companyName : '') ||
      (selectedCustomer?.companyName && selectedCustomer.companyName.toLowerCase() !== 'general' ? selectedCustomer.companyName : '') ||
      '';

    const newRow: ProductRowItem = {
      id: Date.now().toString(),
      productId: selectedProductObj?._id,
      productCode: productCode.trim() || `SKU-${Date.now().toString().slice(-4)}`,
      productName: trimmedName,
      companyName: rowCompany,
      category: selectedProductObj?.category || 'Trading',
      requiredCases: String(casesVal),
      rate: String(rateVal),
      pktUnit: String(unitsVal),
      allocatedAmount: allocatedAmt,
    };

    setProductRows((prev) => [...prev, newRow]);

    // Reset entry fields but preserve company for rapid sequential additions
    setSelectedProductObj(null);
    setProductName('');
    setProductCode('');
    setRequiredCases('');
    setRate('');
    setPktUnit('1');
  };

  const handleRemoveProductRow = (id: string) => {
    setProductRows((prev) => prev.filter((r) => r.id !== id));
  };

  // Group products by Company Name (Set of products grouped like wholesale order sheet)
  const groupedProductRows = useMemo(() => {
    const groups: { [company: string]: ProductRowItem[] } = {};
    for (const row of productRows) {
      const comp = row.companyName?.trim() || 'General';
      if (!groups[comp]) {
        groups[comp] = [];
      }
      groups[comp].push(row);
    }
    return groups;
  }, [productRows]);

  // Unique companies added in current performa (excluding empty or general)
  const uniqueAddedCompanies = useMemo(() => {
    return Array.from(
      new Set(
        productRows
          .map((r) => r.companyName?.trim())
          .filter((c): c is string => Boolean(c) && c.toLowerCase() !== 'general')
      )
    );
  }, [productRows]);

  // Calculate Aggregates
  const totalRequiredCasesCount = useMemo(() => {
    return productRows.reduce((acc, r) => acc + (parseFloat(r.requiredCases) || 0), 0);
  }, [productRows]);

  const subtotalAllocatedValue = useMemo(() => {
    return productRows.reduce((acc, r) => acc + (parseFloat(r.allocatedAmount) || 0), 0);
  }, [productRows]);

  // Discount Calculation (Supports % like 5% or 5 or flat rupees)
  const discountVal = useMemo(() => {
    if (!discount) return 0;
    const cleanDisc = String(discount).trim();
    const num = parseFloat(cleanDisc) || 0;
    if (num <= 0) return 0;
    if (cleanDisc.endsWith('%') || num <= 100) {
      return (subtotalAllocatedValue * num) / 100;
    }
    return num;
  }, [discount, subtotalAllocatedValue]);

  // Discounted base (only on this discounted amount, packing charge is applied)
  const baseAfterDiscount = useMemo(() => {
    return Math.max(0, subtotalAllocatedValue - discountVal);
  }, [subtotalAllocatedValue, discountVal]);

  // Packing Calculation (Applied ONLY on discounted amount, supports decimals e.g. 2.5%, 3.75%)
  const packingVal = useMemo(() => {
    if (!packing) return 0;
    const cleanPack = String(packing).trim();
    const num = parseFloat(cleanPack) || 0;
    if (num <= 0) return 0;
    if (cleanPack.endsWith('%') || num <= 100) {
      return (baseAfterDiscount * num) / 100;
    }
    return num;
  }, [packing, baseAfterDiscount]);

  // Tax Calculation (Manual fixed amount directly added)
  const taxVal = useMemo(() => {
    if (!tax) return 0;
    const cleanTax = String(tax).trim().replace(/[^0-9.]/g, '');
    const num = parseFloat(cleanTax) || 0;
    if (num <= 0) return 0;
    return num;
  }, [tax]);

  // Final Net Total Allocated Amount
  const finalTotalAllocatedValue = useMemo(() => {
    const net = Math.max(0, subtotalAllocatedValue - discountVal + packingVal + taxVal);
    return Number(net.toFixed(2));
  }, [subtotalAllocatedValue, discountVal, packingVal, taxVal]);

  const currentEnteredAdvance = useMemo(() => {
    return parseFloat(String(depositAdvance).replace(/,/g, '')) || 0;
  }, [depositAdvance]);

  const totalReceivedAmount = useMemo(() => {
    if (customerPerformaSummary && typeof customerPerformaSummary.ledgerTotalCredit === 'number') {
      return customerPerformaSummary.ledgerTotalCredit;
    }
    if (selectedCustomer) {
      return Number(selectedCustomer.totalCredit || selectedCustomer.totalAdvanceReceived || 0);
    }
    return 0;
  }, [customerPerformaSummary, selectedCustomer]);

  const purchaseAmount = useMemo(() => {
    if (customerPerformaSummary && typeof customerPerformaSummary.ledgerTotalDebit === 'number') {
      return customerPerformaSummary.ledgerTotalDebit;
    }
    if (selectedCustomer) {
      return Number(selectedCustomer.totalDebit || 0);
    }
    return 0;
  }, [customerPerformaSummary, selectedCustomer]);

  const balanceAmount = useMemo(() => {
    if (customerPerformaSummary && typeof customerPerformaSummary.ledgerCreditBalance === 'number') {
      return customerPerformaSummary.ledgerCreditBalance;
    }
    return totalReceivedAmount - purchaseAmount;
  }, [customerPerformaSummary, totalReceivedAmount, purchaseAmount]);

  const existingAvailableAdvance = useMemo(() => {
    return balanceAmount;
  }, [balanceAmount]);

  // Reset Form
  const handleReset = async () => {
    setProductRows([]);
    setDepositAdvance('0');
    setNotes('');
    setDiscount('');
    setPacking('');
    setTax('');
    setSelectedProductObj(null);
    setProductName('');
    setProductCode('');
    setProductCompany('');
    setRequiredCases('');
    setRate('');
    setPktUnit('1');
    try {
      const nextRes = await PerformasApi.getNextNumber();
      if (nextRes?.nextPerformaNumber) setPerformaNumber(nextRes.nextPerformaNumber);
    } catch {
      // ignore
    }
  };

  // Submit Performa
  const handleCreatePerforma = async () => {
    if (!selectedCustomer) {
      setToast({ open: true, message: 'Please select a customer first', severity: 'error' });
      return;
    }

    if (productRows.length === 0) {
      setToast({ open: true, message: 'Please add at least one product requirement', severity: 'error' });
      return;
    }

    try {
      setSubmitLoading(true);
      const combinedCompanyName =
        uniqueAddedCompanies.length > 0
          ? uniqueAddedCompanies.join(', ')
          : productCompany?.trim() || selectedCustomer.companyName || '';

      const payload = {
        performaNumber,
        companyName: combinedCompanyName,
        customerId: selectedCustomer._id,
        customerSnapshot: {
          name: selectedCustomer.name,
          phone: selectedCustomer.mobile || selectedCustomer.phone || '',
          companyName: combinedCompanyName || selectedCustomer.companyName || '',
          address: selectedCustomer.address || '',
          gst: selectedCustomer.gst || '',
        },
        advanceAmount: currentEnteredAdvance,
        date: date,
        notes: notes.trim(),
        discount: discount || '0',
        packing: packing || '0',
        tax: tax || '0',
        products: productRows.map((r) => ({
          productId: r.productId,
          productSnapshot: {
            productCode: r.productCode,
            productName: r.productName,
            companyName: r.companyName || productCompany || '',
            category: r.category,
          },
          requiredCases: parseFloat(r.requiredCases) || 0,
          rate: parseFloat(r.rate) || 0,
          pktPerUnit: parseFloat(r.pktUnit) || 1,
          allocatedAmount: parseFloat(r.allocatedAmount) || 0,
        })),
      };

      const created = await PerformasApi.create(payload);

      setToast({
        open: true,
        message: `Performa ${created.performaNumber || performaNumber} created successfully!`,
        severity: 'success',
      });

      // Refresh customer performa data
      fetchCustomerPerformaData(selectedCustomer);

      // Prepare print data
      const printData: PerformaPrintData = {
        performaNumber: created.performaNumber || performaNumber,
        companyName: created.companyName || combinedCompanyName || productCompany,
        date: created.date || date,
        customerSnapshot: created.customerSnapshot || payload.customerSnapshot,
        advanceAmount: created.advanceAmount || currentEnteredAdvance,
        remainingAdvanceAmount: created.remainingAdvanceAmount || currentEnteredAdvance,
        products: (created.products || payload.products).map((p: any) => ({
          productCode: p.productSnapshot?.productCode || p.productCode,
          productName: p.productSnapshot?.productName || p.productName,
          companyName: p.productSnapshot?.companyName || p.companyName,
          category: p.productSnapshot?.category || p.category,
          requiredCases: p.requiredCases,
          remainingCases: p.remainingCases || p.requiredCases,
          rate: p.rate,
          pktPerUnit: p.pktPerUnit || 1,
          allocatedAmount: p.allocatedAmount,
        })),
        totalRequiredCases: created.totalRequiredCases || totalRequiredCasesCount,
        subtotal: created.subtotal || subtotalAllocatedValue,
        discount: created.discount || discount || '0',
        discountAmount: created.discountAmount !== undefined ? created.discountAmount : discountVal,
        packing: created.packing || packing || '0',
        packingAmount: created.packingAmount !== undefined ? created.packingAmount : packingVal,
        tax: created.tax || tax || '0',
        taxAmount: created.taxAmount !== undefined ? created.taxAmount : taxVal,
        totalAllocatedAmount: created.totalAllocatedAmount || finalTotalAllocatedValue,
        status: created.status || 'ACTIVE',
        notes: created.notes || notes,
      };

      setCurrentPerformaForPrint(printData);
      setPrintModalOpen(true);

      // Refresh customer data & reset form
      if (selectedCustomer) {
        fetchCustomerPerformaData(selectedCustomer);
      }
      handleReset();
    } catch (err: any) {
      console.error('Failed to create performa:', err);
      setToast({
        open: true,
        message: err.message || 'Failed to create Performa',
        severity: 'error',
      });
    } finally {
      setSubmitLoading(false);
    }
  };

  // Open View Performa Modal
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

  // Open Print Modal for a specific performa record
  const handleOpenPrintModal = (performa: any) => {
    const printData: PerformaPrintData = {
      performaNumber: performa.performaNumber,
      companyName: performa.companyName || performa.customerSnapshot?.companyName,
      date: performa.date,
      customerSnapshot: performa.customerSnapshot,
      advanceAmount: performa.advanceAmount,
      advanceUsedAmount: performa.advanceUsedAmount,
      remainingAdvanceAmount: performa.remainingAdvanceAmount,
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
    setCurrentPerformaForPrint(printData);
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
            .filter((c): c is string => Boolean(c))
        )
      );
      const combinedCompanyName =
        uniqueCompanies.length > 0
          ? uniqueCompanies.join(', ')
          : editCompanyName.trim() || 'General';

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
            companyName: p.companyName || editCompanyName || '',
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
      if (selectedCustomer) fetchCustomerPerformaData(selectedCustomer);
    } catch (err: any) {
      console.error('Failed to update performa:', err);
      setToast({ open: true, message: err?.message || 'Failed to save changes', severity: 'error' });
    } finally {
      setEditLoading(false);
    }
  };

  // Delete Performa
  const handleDeletePerforma = async (id: string, num: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete Performa ${num}?`)) return;
    try {
      await PerformasApi.delete(id);
      setToast({ open: true, message: `Performa ${num} deleted successfully`, severity: 'success' });
      if (selectedCustomer) fetchCustomerPerformaData(selectedCustomer);
    } catch (err: any) {
      setToast({ open: true, message: err?.message || 'Failed to delete', severity: 'error' });
    }
  };

  if (loadingInitial) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress sx={{ color: '#0B4DB7' }} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3.5 }, maxWidth: '1440px', margin: '0 auto' }}>
      {/* Subtabs Bar */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: { xs: 2, sm: 3, md: 4 },
          mb: 2.5,
          flexWrap: 'wrap',
          borderBottom: '1px solid #EEF2F6',
          pb: 0.5,
        }}
      >
        {SUB_TABS.map((tab) => {
          const isActive = activeSubTab === tab;
          return (
            <Box
              key={tab}
              onClick={() => setActiveSubTab(tab)}
              sx={{
                position: 'relative',
                pb: 1.2,
                cursor: 'pointer',
              }}
            >
              <Typography
                sx={{
                  fontSize: '14.5px',
                  fontWeight: isActive ? 800 : 600,
                  color: isActive ? '#0B4DB7' : '#64748B',
                  px: 0.5,
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.8,
                  '&:hover': {
                    color: '#0B4DB7',
                  },
                }}
              >
                {tab === 'Create Performa' ? (
                  <ReceiptLongRoundedIcon sx={{ fontSize: 18, color: isActive ? '#0B4DB7' : '#94A3B8' }} />
                ) : (
                  <ListAltRoundedIcon sx={{ fontSize: 18, color: isActive ? '#0B4DB7' : '#94A3B8' }} />
                )}
                {tab}
                {tab === 'Customer Performa List' && selectedCustomer && (
                  <Chip
                    label={customerPerformas.length}
                    size="small"
                    sx={{
                      height: '20px',
                      fontSize: '11px',
                      fontWeight: 700,
                      backgroundColor: isActive ? '#DBEAFE' : '#F1F5F9',
                      color: isActive ? '#0B4DB7' : '#64748B',
                    }}
                  />
                )}
              </Typography>

              {/* Active Tab Indicator */}
              {isActive && (
                <Box
                  sx={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: '2.5px',
                    backgroundColor: '#0B4DB7',
                    borderTopLeftRadius: '2px',
                    borderTopRightRadius: '2px',
                  }}
                />
              )}
            </Box>
          );
        })}
      </Box>

      {/* SUB-TAB 1: CREATE PERFORMA */}
      {activeSubTab === 'Create Performa' && (
        <Box>
          {/* Top Banner Header */}
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
                <ReceiptLongRoundedIcon sx={{ fontSize: 26, color: '#0B4DB7' }} />
              </Box>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 800, color: '#0F172A', fontSize: '20px' }}>
                  Create Performa
                </Typography>
                <Typography variant="body2" sx={{ color: '#64748B', fontSize: '13px' }}>
                  Customer advance allocation & product requirement order (Not a sales tax bill)
                </Typography>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Chip
                label={`Performa No: ${performaNumber}`}
                sx={{
                  backgroundColor: '#0F172A',
                  color: '#FFFFFF',
                  fontWeight: 800,
                  fontSize: '13.5px',
                  px: 1,
                  height: '36px',
                }}
              />
              {selectedCustomer && (
                <Button
                  variant="outlined"
                  onClick={() => setActiveSubTab('Customer Performa List')}
                  startIcon={<ListAltRoundedIcon />}
                  sx={{
                    borderColor: '#0B4DB7',
                    color: '#0B4DB7',
                    textTransform: 'none',
                    fontWeight: 700,
                    fontSize: '13px',
                    borderRadius: '8px',
                    '&:hover': {
                      backgroundColor: '#EFF6FF',
                    },
                  }}
                >
                  View Customer's Performas
                </Button>
              )}
              {onNavigateAllPerforma && (
                <Button
                  variant="outlined"
                  onClick={onNavigateAllPerforma}
                  sx={{
                    borderColor: '#CBD5E1',
                    color: '#334155',
                    textTransform: 'none',
                    fontWeight: 700,
                    fontSize: '13px',
                    borderRadius: '8px',
                    '&:hover': {
                      borderColor: '#94A3B8',
                      backgroundColor: '#F8FAFC',
                    },
                  }}
                >
                  View All Performas
                </Button>
              )}
            </Box>
          </Paper>

          {/* Grid: Left Customer Selection & Summary | Right Advance Information */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1.2fr 1fr' }, gap: 3, mb: 3 }}>
            {/* Customer Select Card */}
            <Paper
              elevation={0}
              sx={{
                p: 3,
                borderRadius: '12px',
                border: '1px solid #E2E8F0',
                backgroundColor: '#FFFFFF',
              }}
            >
              <Typography sx={{ fontSize: '15px', fontWeight: 800, color: '#0F172A', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <PersonOutlineRoundedIcon sx={{ color: '#0B4DB7', fontSize: 20 }} />
                Customer Details
              </Typography>

              {/* Customer Selector */}
              <Autocomplete
                options={customers}
                getOptionLabel={(option) => (typeof option === 'string' ? option : option?.name || '')}
                value={selectedCustomer}
                onChange={(_e, val) => setSelectedCustomer(val)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Search & Select Customer"
                    placeholder="Type customer name..."
                    size="small"
                    fullWidth
                  />
                )}
                sx={{ mb: 2.5 }}
              />

              {selectedCustomer ? (
                <Box
                  sx={{
                    p: 2,
                    borderRadius: '8px',
                    backgroundColor: '#F8FAFC',
                    border: '1px solid #EEF2F6',
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Typography sx={{ fontWeight: 800, fontSize: '15px', color: '#0F172A' }}>
                      {selectedCustomer.name}
                    </Typography>
                    <Chip
                      label={selectedCustomer.idCode || 'CUSTOMER'}
                      size="small"
                      sx={{ backgroundColor: '#DBEAFE', color: '#0B4DB7', fontWeight: 700, fontSize: '11px' }}
                    />
                  </Box>

                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, fontSize: '12.5px', color: '#475569' }}>
                    <div><strong>Phone:</strong> {selectedCustomer.mobile || selectedCustomer.phone || '-'}</div>
                    <div><strong>GST:</strong> {selectedCustomer.gst || '-'}</div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <strong>Address:</strong> {selectedCustomer.address || '-'}
                    </div>
                  </Box>
                </Box>
              ) : (
                <Typography sx={{ fontSize: '13px', color: '#94A3B8', fontStyle: 'italic' }}>
                  Please select a customer to view their account summary and advance balance.
                </Typography>
              )}
            </Paper>

            {/* Customer Account & Advance Summary Card */}
            <Paper
              elevation={0}
              sx={{
                p: 3,
                borderRadius: '12px',
                border: '1px solid #E2E8F0',
                backgroundColor: '#FFFFFF',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <Box>
                <Typography sx={{ fontSize: '15px', fontWeight: 800, color: '#0F172A', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AccountBalanceWalletRoundedIcon sx={{ color: '#16A34A', fontSize: 20 }} />
                  Customer Account Summary
                </Typography>

                {summaryLoading ? (
                  <Box sx={{ py: 3, textAlign: 'center' }}>
                    <CircularProgress size={24} sx={{ color: '#0B4DB7' }} />
                  </Box>
                ) : (
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' }, gap: 2, mb: 2 }}>
                    {/* 1. Total Receive Amount */}
                    <Card elevation={0} sx={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '10px' }}>
                      <CardContent sx={{ p: '14px !important' }}>
                        <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#1E40AF', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Total Receive Amount
                        </Typography>
                        <Typography sx={{ fontSize: '18px', fontWeight: 800, color: '#1D4ED8', mt: 0.5 }}>
                          ₹{totalReceivedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </Typography>
                        <Typography sx={{ fontSize: '11px', color: '#64748B', mt: 0.3, fontWeight: 500 }}>
                          Advance + Add Credit
                        </Typography>
                      </CardContent>
                    </Card>

                    {/* 2. Purchase Amount */}
                    <Card elevation={0} sx={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '10px' }}>
                      <CardContent sx={{ p: '14px !important' }}>
                        <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#991B1B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Purchase Amount
                        </Typography>
                        <Typography sx={{ fontSize: '18px', fontWeight: 800, color: '#DC2626', mt: 0.5 }}>
                          ₹{purchaseAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </Typography>
                        <Typography sx={{ fontSize: '11px', color: '#64748B', mt: 0.3, fontWeight: 500 }}>
                          Particulars Bills Total
                        </Typography>
                      </CardContent>
                    </Card>

                    {/* 3. Balance Amount */}
                    <Card
                      elevation={0}
                      sx={{
                        backgroundColor: balanceAmount >= 0 ? '#F0FDF4' : '#FFF1F2',
                        border: `1px solid ${balanceAmount >= 0 ? '#BBF7D0' : '#FECDD3'}`,
                        borderRadius: '10px',
                      }}
                    >
                      <CardContent sx={{ p: '14px !important' }}>
                        <Typography
                          sx={{
                            fontSize: '11px',
                            fontWeight: 700,
                            color: balanceAmount >= 0 ? '#166534' : '#9F1239',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                          }}
                        >
                          Balance Amount
                        </Typography>
                        <Typography
                          sx={{
                            fontSize: '18px',
                            fontWeight: 800,
                            color: balanceAmount >= 0 ? '#15803D' : '#E11D48',
                            mt: 0.5,
                          }}
                        >
                          ₹{balanceAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </Typography>
                        <Typography sx={{ fontSize: '11px', color: '#64748B', mt: 0.3, fontWeight: 500 }}>
                          Total Amt - Purchase Amt
                        </Typography>
                      </CardContent>
                    </Card>
                  </Box>
                )}
              </Box>

              {/* New Advance Deposit Input */}
              <Box sx={{ pt: 1.5, borderTop: '1px solid #EEF2F6' }}>
                {existingAvailableAdvance > 0 && (
                  <Box sx={{ mb: 1.5, p: 1, backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography sx={{ fontSize: '11.5px', color: '#166534', fontWeight: 600 }}>
                      💡 Customer has <strong>₹{existingAvailableAdvance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong> available credit / advance.
                    </Typography>
                    <Button
                      size="small"
                      variant="text"
                      onClick={() => setDepositAdvance(String(existingAvailableAdvance))}
                      sx={{ fontSize: '11px', textTransform: 'none', fontWeight: 700, color: '#15803D', py: 0 }}
                    >
                      Fill ₹{existingAvailableAdvance.toLocaleString('en-IN')}
                    </Button>
                  </Box>
                )}
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                  <TextField
                    label="Deposit New Advance (₹)"
                    placeholder="e.g. 200000"
                    size="small"
                    value={depositAdvance}
                    onChange={(e) => setDepositAdvance(e.target.value)}
                    type="number"
                    fullWidth
                    helperText="Optional: Adds new advance payment directly to this customer"
                  />
                  <TextField
                    label="Performa Date"
                    type="date"
                    size="small"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    sx={{ width: '180px' }}
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                </Box>
              </Box>
            </Paper>
          </Box>

          {/* Product Required Section (Grouped Wholesale Order Sheet Layout) */}
          <Paper
            elevation={0}
            sx={{
              p: 3,
              mb: 3,
              borderRadius: '12px',
              border: '1px solid #E2E8F0',
              backgroundColor: '#FFFFFF',
            }}
          >
            {/* Header Title and Tagline */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5, flexWrap: 'wrap', gap: 1.5 }}>
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                  <ReceiptLongRoundedIcon sx={{ color: '#0B4DB7', fontSize: 24 }} />
                  <Typography variant="h6" sx={{ fontSize: '18px', fontWeight: 900, color: '#0F172A', letterSpacing: '-0.2px' }}>
                    Product Required
                  </Typography>
                  <Chip
                    label="Customer Requirement Entry"
                    size="small"
                    sx={{
                      backgroundColor: '#EFF6FF',
                      color: '#0B4DB7',
                      fontWeight: 700,
                      fontSize: '11px',
                      border: '1px solid #DBEAFE',
                    }}
                  />
                </Box>
                <Typography sx={{ fontSize: '12px', color: '#64748B', mt: 0.4 }}>
                  Select/type company first at top. Then enter products and cases. Grouped like wholesale order sheets.
                </Typography>
              </Box>

              {productRows.length > 0 && (
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => {
                    if (window.confirm('Clear all added product requirements?')) {
                      setProductRows([]);
                    }
                  }}
                  startIcon={<RestartAltRoundedIcon />}
                  sx={{
                    borderColor: '#E2E8F0',
                    color: '#64748B',
                    textTransform: 'none',
                    fontWeight: 600,
                    fontSize: '12px',
                    borderRadius: '8px',
                    '&:hover': {
                      borderColor: '#CBD5E1',
                      backgroundColor: '#F8FAFC',
                    },
                  }}
                >
                  Reset Items
                </Button>
              )}
            </Box>

            {/* 1. Dedicated Company Selection Card */}
            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                mb: 2.5,
                borderRadius: '10px',
                border: '1.5px solid #BFDBFE',
                backgroundColor: '#F0F7FF',
              }}
            >
              <Typography sx={{ fontSize: '12px', fontWeight: 800, color: '#1E40AF', mb: 1.5, display: 'flex', alignItems: 'center', gap: 1, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                <BusinessRoundedIcon sx={{ fontSize: 18, color: '#0B4DB7' }} />
                Company Selection (Type / Select Company First)
              </Typography>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                <Autocomplete
                  freeSolo
                  options={companies.map((c: any) => c.name).filter(Boolean)}
                  value={productCompany}
                  onChange={(_e, val) => setProductCompany(val || '')}
                  onInputChange={(_e, val) => setProductCompany(val || '')}
                  sx={{ flex: 1, minWidth: '280px', backgroundColor: '#FFFFFF', borderRadius: '8px' }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      placeholder="Type / Select Company (e.g. AJANTA BRAND)..."
                      size="small"
                      fullWidth
                    />
                  )}
                />

                {/* Active Company Status Badge */}
                <Box
                  sx={{
                    px: 2.5,
                    py: 1.2,
                    borderRadius: '8px',
                    backgroundColor: productCompany ? '#DBEAFE' : '#E2E8F0',
                    border: `1.5px solid ${productCompany ? '#93C5FD' : '#CBD5E1'}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    minWidth: '220px',
                  }}
                >
                  <Box
                    sx={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      backgroundColor: productCompany ? '#0B4DB7' : '#94A3B8',
                      boxShadow: productCompany ? '0 0 0 3px rgba(11, 77, 183, 0.25)' : 'none',
                    }}
                  />
                  <Box>
                    <Typography sx={{ fontSize: '10px', fontWeight: 800, color: productCompany ? '#1E40AF' : '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Active Company
                    </Typography>
                    <Typography sx={{ fontSize: '13.5px', fontWeight: 900, color: productCompany ? '#0F172A' : '#64748B' }}>
                      {productCompany || 'None Selected'}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </Paper>

            {/* 2. Product Entry Input Row */}
            <Box
              sx={{
                p: 2,
                mb: 3,
                borderRadius: '10px',
                border: '1px solid #E2E8F0',
                backgroundColor: '#F8FAFC',
              }}
            >
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: '2.5fr 1.2fr 1fr 0.8fr auto' },
                  gap: 1.5,
                  alignItems: 'center',
                }}
              >
                {/* Customer Product Required */}
                <Autocomplete
                  options={filteredProductsForEntry}
                  getOptionLabel={(option) => {
                    if (typeof option === 'string') return option;
                    return `${option.name || ''} ${option.code ? `(${option.code})` : ''} ${option.companyName ? `• ${option.companyName}` : ''}`.trim();
                  }}
                  value={selectedProductObj}
                  onChange={(_e, val) => handleProductSelect(val)}
                  freeSolo
                  onInputChange={(_e, newInputValue) => setProductName(newInputValue)}
                  renderOption={(props, option) => (
                    <Box component="li" {...props} key={props.key || option._id || option.name} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', py: 0.8 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                        <Typography sx={{ fontWeight: 700, fontSize: '13px', color: '#0F172A' }}>
                          {option.name}
                        </Typography>
                        {option.rate && (
                          <Typography sx={{ fontWeight: 700, fontSize: '12px', color: '#16A34A' }}>
                            ₹{parseFloat(option.rate).toLocaleString('en-IN')}
                          </Typography>
                        )}
                      </Box>
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 0.3 }}>
                        {option.companyName && (
                          <Chip
                            label={option.companyName}
                            size="small"
                            sx={{ height: '18px', fontSize: '10px', fontWeight: 600, backgroundColor: '#EFF6FF', color: '#0B4DB7' }}
                          />
                        )}
                        {option.code && (
                          <Typography sx={{ fontSize: '11px', color: '#64748B' }}>
                            Code: {option.code}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  )}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Customer Product Required"
                      size="small"
                      placeholder={
                        productCompany
                          ? `Type product for ${productCompany} (e.g. 1000 WALA)...`
                          : 'Type product name (e.g. 1000 WALA)...'
                      }
                    />
                  )}
                />

                {/* Required Cases */}
                <TextField
                  label="Required Cases"
                  size="small"
                  type="number"
                  value={requiredCases}
                  onChange={(e) => setRequiredCases(e.target.value)}
                  placeholder="Enter Cases (e.g. 1)"
                />

                {/* Rate */}
                <TextField
                  label="Rate (₹)"
                  size="small"
                  type="number"
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  placeholder="e.g. 5000"
                />

                {/* Pkt / Units */}
                <TextField
                  label="Units/Pkt"
                  size="small"
                  type="number"
                  value={pktUnit}
                  onChange={(e) => setPktUnit(e.target.value)}
                />

                {/* Add Button */}
                <Button
                  variant="contained"
                  disableElevation
                  onClick={handleAddProductRow}
                  startIcon={<AddRoundedIcon />}
                  sx={{
                    backgroundColor: '#0B4DB7',
                    color: '#FFFFFF',
                    fontWeight: 800,
                    fontSize: '13px',
                    textTransform: 'none',
                    borderRadius: '8px',
                    height: '40px',
                    px: 3,
                    '&:hover': {
                      backgroundColor: '#083B8D',
                    },
                  }}
                >
                  + Add
                </Button>
              </Box>
            </Box>

            {/* 3. Grouped Products Tables (By Company / Brand) */}
            <Box sx={{ mb: 2.5 }}>
              {Object.keys(groupedProductRows).length === 0 ? (
                <Box
                  sx={{
                    p: 4,
                    textAlign: 'center',
                    border: '1.5px dashed #CBD5E1',
                    borderRadius: '10px',
                    backgroundColor: '#F8FAFC',
                    color: '#64748B',
                  }}
                >
                  <Typography sx={{ fontWeight: 600, fontSize: '14px', color: '#475569' }}>
                    No product requirements added yet.
                  </Typography>
                  <Typography sx={{ fontSize: '12.5px', color: '#94A3B8', mt: 0.5 }}>
                    Select a company above, enter product name & required cases, then click <strong>+ Add</strong>.
                  </Typography>
                </Box>
              ) : (
                Object.entries(groupedProductRows).map(([groupComp, items]) => {
                  const groupCases = items.reduce((acc, it) => acc + (parseFloat(it.requiredCases) || 0), 0);
                  const groupAmount = items.reduce((acc, it) => acc + (parseFloat(it.allocatedAmount) || 0), 0);

                  return (
                    <Box
                      key={groupComp}
                      sx={{
                        mb: 2.5,
                        border: '1px solid #E2E8F0',
                        borderRadius: '10px',
                        overflow: 'hidden',
                        backgroundColor: '#FFFFFF',
                      }}
                    >
                      {/* Group Header Row */}
                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          backgroundColor: '#F8FAFC',
                          px: 2.5,
                          py: 1.3,
                          borderBottom: '1.5px solid #E2E8F0',
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Typography
                            sx={{
                              fontWeight: 900,
                              fontSize: '15px',
                              color: '#0F172A',
                              textDecoration: 'underline',
                              textDecorationThickness: '2px',
                              textUnderlineOffset: '4px',
                              letterSpacing: '0.5px',
                            }}
                          >
                            {groupComp}
                          </Typography>
                          <Chip
                            label={`${items.length} ${items.length === 1 ? 'item' : 'items'}`}
                            size="small"
                            sx={{
                              height: '22px',
                              fontSize: '11px',
                              fontWeight: 700,
                              backgroundColor: '#FFFFFF',
                              color: '#475569',
                              border: '1px solid #CBD5E1',
                            }}
                          />
                        </Box>

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Chip
                            label={`Subtotal: ${groupCases} Cases • ₹${groupAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
                            size="small"
                            sx={{
                              height: '24px',
                              fontSize: '12px',
                              fontWeight: 800,
                              backgroundColor: '#EFF6FF',
                              color: '#0B4DB7',
                              border: '1px solid #BFDBFE',
                            }}
                          />
                        </Box>
                      </Box>

                      {/* Items Table */}
                      <TableContainer>
                        <Table size="small">
                          <TableHead sx={{ backgroundColor: '#FFFFFF' }}>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 800, color: '#64748B', width: '60px', textAlign: 'center', fontSize: '11px', textTransform: 'uppercase' }}>
                                S.NO
                              </TableCell>
                              <TableCell sx={{ fontWeight: 800, color: '#64748B', fontSize: '11px', textTransform: 'uppercase' }}>
                                CUSTOMER PRODUCT REQUIRED
                              </TableCell>
                              <TableCell sx={{ fontWeight: 800, textAlign: 'center', color: '#64748B', width: '130px', fontSize: '11px', textTransform: 'uppercase' }}>
                                REQUIRED CASES
                              </TableCell>
                              <TableCell sx={{ fontWeight: 800, textAlign: 'right', color: '#64748B', width: '110px', fontSize: '11px', textTransform: 'uppercase' }}>
                                RATE (₹)
                              </TableCell>
                              <TableCell sx={{ fontWeight: 800, textAlign: 'center', color: '#64748B', width: '90px', fontSize: '11px', textTransform: 'uppercase' }}>
                                UNITS/PKT
                              </TableCell>
                              <TableCell sx={{ fontWeight: 800, textAlign: 'right', color: '#64748B', width: '130px', fontSize: '11px', textTransform: 'uppercase' }}>
                                AMOUNT (₹)
                              </TableCell>
                              <TableCell sx={{ fontWeight: 800, textAlign: 'center', width: '80px', fontSize: '11px', textTransform: 'uppercase' }}>
                                ACTION
                              </TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {items.map((row, idx) => (
                              <TableRow key={row.id} hover sx={{ '&:last-child td': { borderBottom: 0 } }}>
                                <TableCell sx={{ textAlign: 'center', fontWeight: 700, color: '#64748B', fontSize: '12.5px' }}>
                                  {idx + 1}
                                </TableCell>
                                <TableCell sx={{ fontWeight: 700, color: '#0F172A', fontSize: '13.5px' }}>
                                  {row.productName}
                                </TableCell>
                                <TableCell sx={{ textAlign: 'center', fontWeight: 800, color: '#0B4DB7', fontSize: '13px' }}>
                                  {row.requiredCases} Cases
                                </TableCell>
                                <TableCell sx={{ textAlign: 'right', fontWeight: 600, color: '#334155', fontSize: '13px' }}>
                                  ₹{parseFloat(row.rate).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </TableCell>
                                <TableCell sx={{ textAlign: 'center', color: '#64748B', fontSize: '12.5px' }}>
                                  {row.pktUnit}
                                </TableCell>
                                <TableCell sx={{ textAlign: 'right', fontWeight: 800, color: '#16A34A', fontSize: '13px' }}>
                                  ₹{parseFloat(row.allocatedAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </TableCell>
                                <TableCell sx={{ textAlign: 'center' }}>
                                  <Tooltip title="Remove item">
                                    <IconButton
                                      size="small"
                                      onClick={() => handleRemoveProductRow(row.id)}
                                      sx={{ color: '#EF4444', '&:hover': { backgroundColor: '#FEE2E2' } }}
                                    >
                                      <DeleteOutlineRoundedIcon sx={{ fontSize: 18 }} />
                                    </IconButton>
                                  </Tooltip>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Box>
                  );
                })
              )}
            </Box>

            {/* 4. Total Cases & Items Summary Strip */}
            <Box
              sx={{
                p: 2,
                borderRadius: '8px',
                backgroundColor: '#F8FAFC',
                border: '1px solid #E2E8F0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 2,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#16A34A' }} />
                <Typography sx={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>
                  {productRows.length} items entered for{' '}
                  <span style={{ color: '#0B4DB7', fontWeight: 800 }}>{selectedCustomer?.name || 'Selected Customer'}</span>
                </Typography>
              </Box>

              <Card
                elevation={0}
                sx={{
                  backgroundColor: '#FFFFFF',
                  border: '1.5px solid #BFDBFE',
                  borderRadius: '8px',
                  px: 2,
                  py: 0.8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                }}
              >
                <Typography sx={{ fontSize: '11px', fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>
                  Case Total
                </Typography>
                <Typography sx={{ fontSize: '18px', fontWeight: 900, color: '#0B4DB7' }}>
                  {totalRequiredCasesCount} Cases
                </Typography>
              </Card>
            </Box>

            {/* Financial Adjustments: Discount, Packing (%), Tax (Amount) */}
            <Box
              sx={{
                mt: 3,
                p: 2.5,
                borderRadius: '10px',
                backgroundColor: '#F8FAFC',
                border: '1px solid #E2E8F0',
              }}
            >
              <Typography sx={{ fontSize: '13px', fontWeight: 800, color: '#0F172A', mb: 2, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Financial Adjustments & Charges
              </Typography>

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr 1.5fr' },
                  gap: 2,
                  mb: 2.5,
                  alignItems: 'flex-start',
                }}
              >
                {/* 1. Discount */}
                <Box>
                  <Typography sx={{ fontSize: '12px', fontWeight: 700, color: '#475569', mb: 0.5 }}>
                    Discount (% or ₹)
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="e.g. 5% or 500"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    helperText={discountVal > 0 ? `- ₹${discountVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : 'Optional discount'}
                    slotProps={{
                      formHelperText: { sx: { color: discountVal > 0 ? '#DC2626' : undefined, fontWeight: 700 } },
                    }}
                  />
                </Box>

                {/* 2. Packing Charge in % */}
                <Box>
                  <Typography sx={{ fontSize: '12px', fontWeight: 700, color: '#475569', mb: 0.5 }}>
                    Packing Charge (%)
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="e.g. 2.5% or 3"
                    value={packing}
                    onChange={(e) => setPacking(e.target.value)}
                    helperText={packingVal > 0 ? `+ ₹${packingVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })} (on discounted amt)` : 'Supports decimal (e.g. 2.5%)'}
                    slotProps={{
                      formHelperText: { sx: { color: packingVal > 0 ? '#0B4DB7' : undefined, fontWeight: 600 } },
                    }}
                  />
                </Box>

                {/* 3. Tax in Amount */}
                <Box>
                  <Typography sx={{ fontSize: '12px', fontWeight: 700, color: '#475569', mb: 0.5 }}>
                    Tax (₹ Amount)
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="e.g. 1000"
                    value={tax}
                    onChange={(e) => setTax(e.target.value)}
                    type="number"
                    helperText={taxVal > 0 ? `+ ₹${taxVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : 'Fixed tax amount'}
                    slotProps={{
                      formHelperText: { sx: { color: taxVal > 0 ? '#166534' : undefined, fontWeight: 600 } },
                    }}
                  />
                </Box>

                {/* 4. Notes */}
                <Box>
                  <Typography sx={{ fontSize: '12px', fontWeight: 700, color: '#475569', mb: 0.5 }}>
                    Performa Notes / Terms
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Optional notes or special delivery conditions..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </Box>
              </Box>

              {/* Aggregates Summary Box & Action Buttons */}
              <Box
                sx={{
                  pt: 2,
                  borderTop: '1px solid #E2E8F0',
                  display: 'flex',
                  flexWrap: 'wrap',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 2,
                }}
              >
                {/* Live Breakdown Badges */}
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: { xs: 1.5, sm: 2.5 }, alignItems: 'center' }}>
                  <Box>
                    <Typography sx={{ fontSize: '10.5px', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>
                      Total Cases
                    </Typography>
                    <Typography sx={{ fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>
                      {totalRequiredCasesCount}
                    </Typography>
                  </Box>

                  <Box sx={{ height: '28px', width: '1px', backgroundColor: '#CBD5E1', display: { xs: 'none', sm: 'block' } }} />

                  <Box>
                    <Typography sx={{ fontSize: '10.5px', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>
                      Subtotal
                    </Typography>
                    <Typography sx={{ fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>
                      ₹{subtotalAllocatedValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </Typography>
                  </Box>

                  {discountVal > 0 && (
                    <Box>
                      <Typography sx={{ fontSize: '10.5px', color: '#DC2626', fontWeight: 700, textTransform: 'uppercase' }}>
                        Discount ({discount})
                      </Typography>
                      <Typography sx={{ fontSize: '16px', fontWeight: 800, color: '#DC2626' }}>
                        - ₹{discountVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </Typography>
                    </Box>
                  )}

                  {packingVal > 0 && (
                    <Box>
                      <Typography sx={{ fontSize: '10.5px', color: '#475569', fontWeight: 700, textTransform: 'uppercase' }}>
                        Packing ({packing}%)
                      </Typography>
                      <Typography sx={{ fontSize: '16px', fontWeight: 800, color: '#0B4DB7' }}>
                        + ₹{packingVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </Typography>
                    </Box>
                  )}

                  {taxVal > 0 && (
                    <Box>
                      <Typography sx={{ fontSize: '10.5px', color: '#475569', fontWeight: 700, textTransform: 'uppercase' }}>
                        Tax (Amount)
                      </Typography>
                      <Typography sx={{ fontSize: '16px', fontWeight: 800, color: '#166534' }}>
                        + ₹{taxVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </Typography>
                    </Box>
                  )}

                  <Box sx={{ height: '28px', width: '1px', backgroundColor: '#CBD5E1', display: { xs: 'none', sm: 'block' } }} />

                  <Box>
                    <Typography sx={{ fontSize: '11px', color: '#0B4DB7', fontWeight: 800, textTransform: 'uppercase' }}>
                      Total Allocated Value
                    </Typography>
                    <Typography sx={{ fontSize: '20px', fontWeight: 900, color: '#0B4DB7' }}>
                      ₹{finalTotalAllocatedValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </Typography>
                  </Box>
                </Box>

                {/* Buttons */}
                <Box sx={{ display: 'flex', gap: 1.5, ml: 'auto' }}>
                  <Button
                    variant="outlined"
                    onClick={handleReset}
                    startIcon={<RestartAltRoundedIcon />}
                    sx={{
                      borderColor: '#CBD5E1',
                      color: '#475569',
                      fontWeight: 600,
                      textTransform: 'none',
                      borderRadius: '8px',
                    }}
                  >
                    Reset
                  </Button>
                  <Button
                    variant="contained"
                    disableElevation
                    onClick={handleCreatePerforma}
                    disabled={submitLoading || productRows.length === 0 || !selectedCustomer}
                    startIcon={<CheckCircleOutlineRoundedIcon />}
                    sx={{
                      backgroundColor: '#0B4DB7',
                      color: '#FFFFFF',
                      fontWeight: 700,
                      fontSize: '14px',
                      textTransform: 'none',
                      borderRadius: '8px',
                      px: 3,
                      py: 1,
                      '&:hover': {
                        backgroundColor: '#083B8D',
                      },
                    }}
                  >
                    {submitLoading ? 'Generating...' : 'Save & Generate Performa'}
                  </Button>
                </Box>
              </Box>
            </Box>
          </Paper>
        </Box>
      )}

      {/* SUB-TAB 2: CUSTOMER PERFORMA LIST */}
      {activeSubTab === 'Customer Performa List' && (
        <Box>
          {/* Top Customer Filter Card */}
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
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1, minWidth: '280px' }}>
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: '10px',
                  backgroundColor: '#EFF6FF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <ListAltRoundedIcon sx={{ fontSize: 26, color: '#0B4DB7' }} />
              </Box>
              <Box sx={{ flex: 1, maxWidth: '400px' }}>
                <Autocomplete
                  options={customers}
                  getOptionLabel={(option) => (typeof option === 'string' ? option : option?.name || '')}
                  value={selectedCustomer}
                  onChange={(_e, val) => setSelectedCustomer(val)}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Select Customer for Performa List"
                      placeholder="Type customer name..."
                      size="small"
                      fullWidth
                    />
                  )}
                />
              </Box>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <IconButton
                onClick={() => selectedCustomer && fetchCustomerPerformaData(selectedCustomer)}
                sx={{ border: '1px solid #E2E8F0', borderRadius: '8px' }}
              >
                <RefreshRoundedIcon sx={{ color: '#475569', fontSize: 20 }} />
              </IconButton>
              <Button
                variant="contained"
                disableElevation
                onClick={() => setActiveSubTab('Create Performa')}
                startIcon={<AddRoundedIcon />}
                sx={{
                  backgroundColor: '#0B4DB7',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '13px',
                  textTransform: 'none',
                  borderRadius: '8px',
                  px: 2,
                  '&:hover': {
                    backgroundColor: '#083B8D',
                  },
                }}
              >
                Create New Performa
              </Button>
            </Box>
          </Paper>

          {/* Customer Profile Summary Badges */}
          {selectedCustomer && (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(3, 1fr)', lg: 'repeat(6, 1fr)' }, gap: 2, mb: 3 }}>
              <Card elevation={0} sx={{ border: '1px solid #E2E8F0', borderRadius: '10px', backgroundColor: '#FFFFFF' }}>
                <CardContent sx={{ p: '14px !important' }}>
                  <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
                    Total Performas
                  </Typography>
                  <Typography sx={{ fontSize: '20px', fontWeight: 800, color: '#0F172A', mt: 0.5 }}>
                    {customerPerformas.length}
                  </Typography>
                </CardContent>
              </Card>

              <Card elevation={0} sx={{ border: '1px solid #BFDBFE', borderRadius: '10px', backgroundColor: '#EFF6FF' }}>
                <CardContent sx={{ p: '14px !important' }}>
                  <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#1E40AF', textTransform: 'uppercase' }}>
                    Total Cases Entered
                  </Typography>
                  <Typography sx={{ fontSize: '20px', fontWeight: 800, color: '#1D4ED8', mt: 0.5 }}>
                    {customerPerformas.reduce((acc, p) => acc + (p.totalRequiredCases || 0), 0)}
                  </Typography>
                </CardContent>
              </Card>

              <Card elevation={0} sx={{ border: '1px solid #BBF7D0', borderRadius: '10px', backgroundColor: '#F0FDF4' }}>
                <CardContent sx={{ p: '14px !important' }}>
                  <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>
                    Total Performa Value (₹)
                  </Typography>
                  <Typography sx={{ fontSize: '20px', fontWeight: 800, color: '#15803D', mt: 0.5 }}>
                    ₹{customerPerformas.reduce((acc, p) => acc + (p.totalAllocatedAmount || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </Typography>
                </CardContent>
              </Card>

              <Card elevation={0} sx={{ border: '1px solid #BFDBFE', borderRadius: '10px', backgroundColor: '#EFF6FF' }}>
                <CardContent sx={{ p: '14px !important' }}>
                  <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#1D4ED8', textTransform: 'uppercase' }}>
                    Total Advance Received (₹)
                  </Typography>
                  <Typography sx={{ fontSize: '20px', fontWeight: 800, color: '#1E40AF', mt: 0.5 }}>
                    ₹{((customerPerformaSummary?.totalAdvanceReceived ?? (selectedCustomer?.totalAdvanceReceived || selectedCustomer?.totalCredit || 0)) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </Typography>
                </CardContent>
              </Card>

              <Card elevation={0} sx={{ border: '1px solid #FECACA', borderRadius: '10px', backgroundColor: '#FEF2F2' }}>
                <CardContent sx={{ p: '14px !important' }}>
                  <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#991B1B', textTransform: 'uppercase' }}>
                    Total Advance Used (₹)
                  </Typography>
                  <Typography sx={{ fontSize: '20px', fontWeight: 800, color: '#B91C1C', mt: 0.5 }}>
                    ₹{((customerPerformaSummary?.totalAdvanceUsed ?? (selectedCustomer?.totalAdvanceUsed || selectedCustomer?.totalDebit || 0)) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </Typography>
                </CardContent>
              </Card>

              <Card elevation={0} sx={{ border: '1px solid #BBF7D0', borderRadius: '10px', backgroundColor: '#F0FDF4' }}>
                <CardContent sx={{ p: '14px !important' }}>
                  <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>
                    Available Advance (₹)
                  </Typography>
                  <Typography sx={{ fontSize: '20px', fontWeight: 800, color: '#15803D', mt: 0.5 }}>
                    ₹{existingAvailableAdvance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </Typography>
                </CardContent>
              </Card>
            </Box>
          )}

          {/* Filter Bar */}
          <Paper
            elevation={0}
            sx={{
              p: 2,
              mb: 3,
              borderRadius: '12px',
              border: '1px solid #E2E8F0',
              backgroundColor: '#FFFFFF',
              display: 'flex',
              flexWrap: 'wrap',
              gap: 2,
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Box sx={{ display: 'flex', gap: 1.5, flex: 1, minWidth: '220px' }}>
              <TextField
                size="small"
                placeholder="Search by Performa No, SKU..."
                value={customerPerformaSearch}
                onChange={(e) => setCustomerPerformaSearch(e.target.value)}
                fullWidth
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
            </Box>
          </Paper>

          {/* Customer Performas Table */}
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
                    <TableCell sx={{ fontWeight: 800, color: '#475569', py: 1.5, width: '40px' }}>#</TableCell>
                    <TableCell sx={{ fontWeight: 800, color: '#475569' }}>Performa No</TableCell>
                    <TableCell sx={{ fontWeight: 800, color: '#475569' }}>Date</TableCell>
                    <TableCell sx={{ fontWeight: 800, color: '#475569' }}>Company / Brand</TableCell>
                    <TableCell sx={{ fontWeight: 800, textAlign: 'center', color: '#475569' }}>Total Cases</TableCell>
                    <TableCell sx={{ fontWeight: 800, textAlign: 'right', color: '#475569' }}>Total Amount</TableCell>
                    <TableCell sx={{ fontWeight: 800, textAlign: 'right', color: '#475569' }}>Advance Amount</TableCell>
                    <TableCell sx={{ fontWeight: 800, color: '#475569' }}>Notes</TableCell>
                    <TableCell sx={{ fontWeight: 800, textAlign: 'center', color: '#475569' }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {customerPerformasLoading ? (
                    <TableRow>
                      <TableCell colSpan={9} sx={{ textAlign: 'center', py: 6 }}>
                        <CircularProgress size={30} sx={{ color: '#0B4DB7' }} />
                      </TableCell>
                    </TableRow>
                  ) : !selectedCustomer ? (
                    <TableRow>
                      <TableCell colSpan={9} sx={{ textAlign: 'center', py: 6, color: '#94A3B8' }}>
                        Please select a customer above to view their performa records.
                      </TableCell>
                    </TableRow>
                  ) : customerPerformas.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} sx={{ textAlign: 'center', py: 6 }}>
                        <Typography sx={{ color: '#64748B', fontWeight: 600, mb: 1 }}>
                          No performas found for {selectedCustomer.name}.
                        </Typography>
                        <Button
                          variant="contained"
                          disableElevation
                          onClick={() => setActiveSubTab('Create Performa')}
                          startIcon={<AddRoundedIcon />}
                          sx={{
                            backgroundColor: '#0B4DB7',
                            textTransform: 'none',
                            fontWeight: 700,
                            borderRadius: '8px',
                          }}
                        >
                          Create Performa for {selectedCustomer.name}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ) : (
                    customerPerformas.map((p, idx) => {
                      const compDisplay =
                        p.companyName || p.customerSnapshot?.companyName || (p.products?.[0]?.productSnapshot?.companyName) || 'General';
                      return (
                        <TableRow key={p._id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                          <TableCell sx={{ color: '#64748B' }}>{idx + 1}</TableCell>
                          <TableCell>
                            <Typography sx={{ fontWeight: 800, color: '#0B4DB7', fontSize: '13.5px' }}>
                              {p.performaNumber}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ color: '#475569', fontSize: '13px', whiteSpace: 'nowrap' }}>{p.date}</TableCell>
                          <TableCell>
                            <Chip
                              icon={<BusinessRoundedIcon sx={{ fontSize: '14px !important' }} />}
                              label={compDisplay}
                              size="small"
                              sx={{
                                backgroundColor: '#F1F5F9',
                                color: '#334155',
                                fontWeight: 700,
                                fontSize: '11.5px',
                                maxWidth: '170px',
                              }}
                            />
                          </TableCell>
                          <TableCell sx={{ textAlign: 'center', fontWeight: 800, color: '#0F172A', fontSize: '14px' }}>
                            {p.totalRequiredCases || 0}
                          </TableCell>
                          <TableCell sx={{ textAlign: 'right', fontWeight: 700, color: '#0F172A' }}>
                            ₹{(p.totalAllocatedAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell sx={{ textAlign: 'right', fontWeight: 800, color: '#166534' }}>
                            ₹{(p.advanceAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell sx={{ color: '#64748B', fontSize: '12.5px', maxWidth: '180px' }}>
                            {p.notes || '-'}
                          </TableCell>
                          <TableCell sx={{ textAlign: 'center' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
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
                                <IconButton
                                  size="small"
                                  onClick={() => handleOpenPrintModal(p)}
                                  sx={{
                                    color: '#0B4DB7',
                                    backgroundColor: '#EFF6FF',
                                    '&:hover': { backgroundColor: '#DBEAFE' },
                                  }}
                                >
                                  <PrintOutlinedIcon sx={{ fontSize: 18 }} />
                                </IconButton>
                              </Tooltip>

                              <Tooltip title="View Details">
                                <IconButton size="small" onClick={() => handleOpenViewModal(p._id)} sx={{ color: '#475569' }}>
                                  <VisibilityRoundedIcon sx={{ fontSize: 18 }} />
                                </IconButton>
                              </Tooltip>

                              <Tooltip title="Edit Performa">
                                <IconButton
                                  size="small"
                                  onClick={() => handleOpenEditModal(p)}
                                  sx={{ color: '#2563EB' }}
                                >
                                  <ModeEditOutlineRoundedIcon sx={{ fontSize: 18 }} />
                                </IconButton>
                              </Tooltip>

                              <Tooltip title="Delete">
                                <IconButton size="small" onClick={() => handleDeletePerforma(p._id, p.performaNumber)} sx={{ color: '#DC2626' }}>
                                  <DeleteOutlineRoundedIcon sx={{ fontSize: 18 }} />
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
        </Box>
      )}

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
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 3 }}>
                <Paper elevation={0} sx={{ p: 2, border: '1px solid #E2E8F0', borderRadius: '8px' }}>
                  <Typography sx={{ fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', mb: 0.5 }}>
                    Customer & Company Details
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
                  <Typography sx={{ fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', mb: 1 }}>
                    Performa Financial Summary
                  </Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, fontSize: '12.5px' }}>
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
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', gridColumn: 'span 2', pt: 0.8, borderTop: '1px solid #EEF2F6' }}>
                      <span style={{ color: '#0B4DB7', fontWeight: 800 }}>Total Value:</span>
                      <strong style={{ color: '#0B4DB7', fontSize: '14.5px', fontWeight: 900 }}>
                        ₹{(selectedPerformaForView.totalAllocatedAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </strong>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', gridColumn: 'span 2', pt: 0.5, borderTop: '1px dashed #EEF2F6' }}>
                      <span style={{ color: '#166534', fontWeight: 700 }}>Available Advance Balance:</span>
                      <strong style={{ color: '#16A34A', fontSize: '14px' }}>
                        ₹{(selectedPerformaForView.remainingAdvanceAmount ?? selectedPerformaForView.financialSummary?.availableAmount ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </strong>
                    </Box>
                  </Box>
                  {selectedPerformaForView.notes && (
                    <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid #EEF2F6', fontSize: '12px', color: '#475569' }}>
                      <strong>Notes:</strong> {selectedPerformaForView.notes}
                    </Box>
                  )}
                </Paper>
              </Box>

              <Typography sx={{ fontSize: '14px', fontWeight: 800, color: '#0F172A', mb: 1.5 }}>
                Product Allocation & Case Consumption
              </Typography>
              <TableContainer sx={{ border: '1px solid #E2E8F0', borderRadius: '8px', mb: 3, backgroundColor: '#FFFFFF' }}>
                <Table size="small">
                  <TableHead sx={{ backgroundColor: '#F1F5F9' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 800, width: '40px' }}>#</TableCell>
                      <TableCell sx={{ fontWeight: 800 }}>Product Name & Code</TableCell>
                      <TableCell sx={{ fontWeight: 800 }}>Company / Brand</TableCell>
                      <TableCell sx={{ fontWeight: 800, textAlign: 'center', width: '70px' }}>Req Cases</TableCell>
                      <TableCell sx={{ fontWeight: 800, textAlign: 'center', width: '70px' }}>Used</TableCell>
                      <TableCell sx={{ fontWeight: 800, textAlign: 'center', width: '70px' }}>Rem Cases</TableCell>
                      <TableCell sx={{ fontWeight: 800, textAlign: 'right', width: '90px' }}>Rate (₹)</TableCell>
                      <TableCell sx={{ fontWeight: 800, textAlign: 'right', width: '110px' }}>Allocated (₹)</TableCell>
                      <TableCell sx={{ fontWeight: 800, textAlign: 'right', width: '110px' }}>Used Amt (₹)</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(selectedPerformaForView.products || []).map((prod: any, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell sx={{ color: '#64748B' }}>{idx + 1}</TableCell>
                        <TableCell>
                          <strong>{prod.productSnapshot?.productName || prod.productName}</strong>
                          {prod.productSnapshot?.productCode && (
                            <div style={{ fontSize: '11px', color: '#64748B' }}>Code: {prod.productSnapshot.productCode}</div>
                          )}
                        </TableCell>
                        <TableCell sx={{ color: '#0B4DB7', fontWeight: 600 }}>
                          {prod.productSnapshot?.companyName || prod.companyName || selectedPerformaForView.companyName || '-'}
                        </TableCell>
                        <TableCell sx={{ textAlign: 'center', fontWeight: 800, color: '#0F172A' }}>
                          {prod.requiredCases}
                        </TableCell>
                        <TableCell sx={{ textAlign: 'center', fontWeight: 700, color: prod.usedCases > 0 ? '#DC2626' : '#64748B' }}>
                          {prod.usedCases || 0}
                        </TableCell>
                        <TableCell sx={{ textAlign: 'center', fontWeight: 800, color: '#166534' }}>
                          {prod.remainingCases !== undefined ? prod.remainingCases : Math.max(0, prod.requiredCases - (prod.usedCases || 0))}
                        </TableCell>
                        <TableCell sx={{ textAlign: 'right' }}>₹{prod.rate?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell sx={{ textAlign: 'right', fontWeight: 700, color: '#0F172A' }}>
                          ₹{prod.allocatedAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell sx={{ textAlign: 'right', fontWeight: 700, color: prod.usedAmount > 0 ? '#DC2626' : '#64748B' }}>
                          ₹{(prod.usedAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Performa Transaction History */}
              {selectedPerformaForView.transactionHistory && selectedPerformaForView.transactionHistory.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography sx={{ fontSize: '14px', fontWeight: 800, color: '#0F172A', mb: 1.5 }}>
                    Performa Financial Transaction History
                  </Typography>
                  <TableContainer sx={{ border: '1px solid #E2E8F0', borderRadius: '8px', backgroundColor: '#FFFFFF' }}>
                    <Table size="small">
                      <TableHead sx={{ backgroundColor: '#F1F5F9' }}>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 800 }}>Date</TableCell>
                          <TableCell sx={{ fontWeight: 800 }}>Type</TableCell>
                          <TableCell sx={{ fontWeight: 800 }}>Reference / Bill No</TableCell>
                          <TableCell sx={{ fontWeight: 800 }}>Payment Mode</TableCell>
                          <TableCell sx={{ fontWeight: 800, textAlign: 'right' }}>Amount (₹)</TableCell>
                          <TableCell sx={{ fontWeight: 800, textAlign: 'right' }}>Running Balance (₹)</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {selectedPerformaForView.transactionHistory.map((tx: any, idx: number) => {
                          const isNegative = tx.delta < 0 || tx.rawType === 'PERFORMA_CONSUMED';
                          return (
                            <TableRow key={idx}>
                              <TableCell sx={{ fontSize: '12.5px' }}>{tx.date}</TableCell>
                              <TableCell>
                                <Chip
                                  label={tx.type || tx.rawType}
                                  size="small"
                                  sx={{
                                    fontSize: '10.5px',
                                    fontWeight: 800,
                                    backgroundColor:
                                      tx.rawType === 'PERFORMA_CONSUMED'
                                        ? '#FEF2F2'
                                        : tx.rawType === 'ADVANCE_RECEIVED'
                                        ? '#DCFCE7'
                                        : '#EFF6FF',
                                    color:
                                      tx.rawType === 'PERFORMA_CONSUMED'
                                        ? '#991B1B'
                                        : tx.rawType === 'ADVANCE_RECEIVED'
                                        ? '#166534'
                                        : '#1D4ED8',
                                  }}
                                />
                              </TableCell>
                              <TableCell sx={{ fontSize: '12.5px' }}>{tx.reference || tx.billNo || '-'}</TableCell>
                              <TableCell sx={{ fontSize: '12.5px' }}>{tx.paymentMode || 'Bank'}</TableCell>
                              <TableCell sx={{ textAlign: 'right', fontWeight: 800, color: isNegative ? '#DC2626' : '#166534' }}>
                                {isNegative ? '-' : '+'}₹{tx.amount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </TableCell>
                              <TableCell sx={{ textAlign: 'right', fontWeight: 800, color: '#0F172A' }}>
                                ₹{tx.balance?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </TableCell>
                            </TableRow>
                          );
                        })}
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
                    renderInput={(params) => (
                      <TextField {...params} label="Company / Brand" size="small" fullWidth />
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
                      {editProducts.map((p) => (
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
                      ))}
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

      {/* Performa Print Modal */}
      <PerformaPrintModal
        open={printModalOpen}
        onClose={() => setPrintModalOpen(false)}
        performa={currentPerformaForPrint}
      />

      {/* Toast */}
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
