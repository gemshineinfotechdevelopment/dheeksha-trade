import { useState } from 'react';
import { ThemeProvider, CssBaseline, Box } from '@mui/material';
import { theme } from './theme/theme';
import { Navbar, type NavTab } from './components/Navbar';
import { LoginPage } from './components/LoginPage';
import { CustomersPage } from './components/CustomersPage';
import { AllCustomersPage } from './components/AllCustomersPage';
import { AddCustomerPage } from './components/AddCustomerPage';
import { CompaniesPage } from './components/CompaniesPage';
import { AddCompanyPage } from './components/AddCompanyPage';
import { ProductsPage } from './components/ProductsPage';
import { ParticularsPage, type ParticularSubTab } from './components/ParticularsPage';
import { PerformaPage } from './components/PerformaPage';
import { AllPerformaPage } from './components/AllPerformaPage';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return Boolean(localStorage.getItem('dheeksha_auth_token'));
  });

  const [activeTab, setActiveTab] = useState<NavTab>(() => {
    const saved = localStorage.getItem('dheeksha_active_tab') as NavTab;
    const validTabs: NavTab[] = [
      'Performa',
      'All Performa',
      'Particulars',
      'Product',
      'Company',
      'All Customers',
      'Customers',
    ];
    return validTabs.includes(saved) ? saved : 'Customers';
  });

  const [companySubView, setCompanySubView] = useState<'list' | 'add'>(() => {
    return (localStorage.getItem('dheeksha_company_subview') as 'list' | 'add') || 'list';
  });

  const [customerSubView, setCustomerSubView] = useState<'list' | 'add'>(() => {
    return (localStorage.getItem('dheeksha_customer_subview') as 'list' | 'add') || 'list';
  });

  const [selectedCustomerName, setSelectedCustomerName] = useState<string>(() => {
    return localStorage.getItem('dheeksha_active_customer') || '';
  });

  const [particularInitialSubTab, setParticularInitialSubTab] = useState<ParticularSubTab>(() => {
    return (localStorage.getItem('dheeksha_particular_subtab') as ParticularSubTab) || 'Select Customer';
  });

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('dheeksha_auth_token');
    localStorage.removeItem('dheeksha_auth_user');
    localStorage.removeItem('dheeksha_active_tab');
    localStorage.removeItem('dheeksha_company_subview');
    localStorage.removeItem('dheeksha_customer_subview');
    localStorage.removeItem('dheeksha_particular_subtab');
    localStorage.removeItem('dheeksha_active_customer');
    setIsAuthenticated(false);
  };

  const handleSelectTab = (tab: NavTab) => {
    setActiveTab(tab);
    localStorage.setItem('dheeksha_active_tab', tab);
    if (tab === 'Performa') {
      setSelectedCustomerName('');
      localStorage.removeItem('dheeksha_active_customer');
    }
    if (tab === 'Particulars') {
      setSelectedCustomerName('');
      localStorage.removeItem('dheeksha_active_customer');
      setParticularInitialSubTab('Select Customer');
      localStorage.setItem('dheeksha_particular_subtab', 'Select Customer');
    }
    if (tab === 'Company') {
      setCompanySubView('list');
      localStorage.setItem('dheeksha_company_subview', 'list');
    }
    if (tab === 'Customers') {
      setCustomerSubView('list');
      localStorage.setItem('dheeksha_customer_subview', 'list');
    }
  };

  const handleSetCompanySubView = (view: 'list' | 'add') => {
    setCompanySubView(view);
    localStorage.setItem('dheeksha_company_subview', view);
  };

  const handleSetCustomerSubView = (view: 'list' | 'add') => {
    setCustomerSubView(view);
    localStorage.setItem('dheeksha_customer_subview', view);
  };

  const handleCustomerSelectedForParticular = (customerName: string, subTab?: ParticularSubTab) => {
    setSelectedCustomerName(customerName);
    localStorage.setItem('dheeksha_active_customer', customerName);
    const targetSubTab = subTab || 'Account Details';
    setParticularInitialSubTab(targetSubTab);
    localStorage.setItem('dheeksha_particular_subtab', targetSubTab);
    setActiveTab('Particulars');
    localStorage.setItem('dheeksha_active_tab', 'Particulars');
  };

  if (!isAuthenticated) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <LoginPage onLoginSuccess={handleLoginSuccess} />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        sx={{
          minHeight: '100vh',
          backgroundColor: '#F8F9FD',
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
        }}
      >
        <Navbar
          activeTab={activeTab}
          onSelectTab={handleSelectTab}
          onNavigateCustomers={() => {
            handleSelectTab('Customers');
            handleSetCustomerSubView('list');
          }}
          onLogout={handleLogout}
        />

        <Box component="main" sx={{ flexGrow: 1, width: '100%' }}>
          {/* Performa Tab */}
          {activeTab === 'Performa' && (
            <PerformaPage
              initialCustomerName={selectedCustomerName}
              onNavigateAllPerforma={() => handleSelectTab('All Performa')}
              onSelectCustomerForBill={handleCustomerSelectedForParticular}
            />
          )}

          {/* All Performa Tab */}
          {activeTab === 'All Performa' && (
            <AllPerformaPage
              onAddNewPerforma={() => handleSelectTab('Performa')}
              onSelectCustomerForBill={handleCustomerSelectedForParticular}
            />
          )}

          {/* Particulars Tab */}
          {activeTab === 'Particulars' && (
            <ParticularsPage
              initialCustomerName={selectedCustomerName}
              initialSubTab={particularInitialSubTab}
            />
          )}

          {/* Product Tab */}
          {activeTab === 'Product' && <ProductsPage />}

          {/* Company Tab */}
          {activeTab === 'Company' && (
            <>
              {companySubView === 'add' ? (
                <AddCompanyPage
                  onCancel={() => handleSetCompanySubView('list')}
                  onSubmitSuccess={() => handleSetCompanySubView('list')}
                  onNavigateCompanies={() => handleSetCompanySubView('list')}
                />
              ) : (
                <CompaniesPage onAddCompany={() => handleSetCompanySubView('add')} />
              )}
            </>
          )}

          {/* All Customers Tab */}
          {activeTab === 'All Customers' && (
            <AllCustomersPage
              onAddNewCustomer={() => {
                handleSelectTab('Customers');
                handleSetCustomerSubView('add');
              }}
              onSelectCustomerForParticular={handleCustomerSelectedForParticular}
            />
          )}

          {/* Customers Tab */}
          {activeTab === 'Customers' && (
            <>
              {customerSubView === 'add' ? (
                <AddCustomerPage
                  onCancel={() => handleSetCustomerSubView('list')}
                  onSubmitSuccess={() => handleSetCustomerSubView('list')}
                />
              ) : (
                <CustomersPage
                  onAddNew={() => handleSetCustomerSubView('add')}
                  onSelectCustomerForParticular={handleCustomerSelectedForParticular}
                />
              )}
            </>
          )}

          {/* Other Tabs */}
          {activeTab !== 'Particulars' &&
            activeTab !== 'Product' &&
            activeTab !== 'Company' &&
            activeTab !== 'All Customers' &&
            activeTab !== 'Customers' && (
              <Box sx={{ p: 4, textAlign: 'center', color: '#64748B' }}>
                {activeTab} content coming soon.
              </Box>
            )}
        </Box>
      </Box>
    </ThemeProvider>
  );
}

export default App;
