import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { Layout } from './components';
import { ProtectedRoute } from './components/ProtectedRoute';
import { HomePage, SignupPage, LoginPage, ForgotPasswordPage, ResetPasswordPage, VerifyEmailPage, DashboardPage, AccountsPage, LedgerPage, DocsLayout, ApiTokensPage, PrivacyPage } from './pages';
import { OverviewPage } from './pages/Docs/pages/OverviewPage';
import { QuickstartPage } from './pages/Docs/pages/QuickstartPage';
import { ConceptsPage } from './pages/Docs/pages/ConceptsPage';
import { AccountsGuidePage } from './pages/Docs/pages/AccountsGuidePage';
import { LedgerGuidePage } from './pages/Docs/pages/LedgerGuidePage';
import { PnLPage } from './pages/Docs/pages/PnLPage';
import { CsvExportPage } from './pages/Docs/pages/CsvExportPage';
import { MetadataPage } from './pages/Docs/pages/MetadataPage';
import { AuthApiPage } from './pages/Docs/pages/api/AuthApiPage';
import { AccountsApiPage } from './pages/Docs/pages/api/AccountsApiPage';
import { LedgerApiPage } from './pages/Docs/pages/api/LedgerApiPage';
import { AssetsApiPage } from './pages/Docs/pages/api/AssetsApiPage';

function AppDocsRedirect() {
  const { '*': splat } = useParams();
  return <Navigate to={`/docs/${splat}`} replace />;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />

          {/* Redirect legacy /app/docs/* URLs to the public /docs route */}
          <Route path="/app/docs" element={<Navigate to="/docs" replace />} />
          <Route path="/app/docs/*" element={<AppDocsRedirect />} />

          {/* Public docs — no auth required */}
          <Route path="/docs" element={<DocsLayout />}>
            <Route index element={<Navigate to="overview" replace />} />
            <Route path="overview" element={<OverviewPage />} />
            <Route path="quickstart" element={<QuickstartPage />} />
            <Route path="concepts" element={<ConceptsPage />} />
            <Route path="accounts" element={<AccountsGuidePage />} />
            <Route path="ledger" element={<LedgerGuidePage />} />
            <Route path="pnl" element={<PnLPage />} />
            <Route path="csv-export" element={<CsvExportPage />} />
            <Route path="metadata" element={<MetadataPage />} />
            <Route path="api/authentication" element={<AuthApiPage />} />
            <Route path="api/accounts" element={<AccountsApiPage />} />
            <Route path="api/ledger" element={<LedgerApiPage />} />
            <Route path="api/assets" element={<AssetsApiPage />} />
          </Route>

          <Route
            path="/app"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="accounts" element={<AccountsPage />} />
            <Route path="ledger" element={<LedgerPage />} />
            <Route path="settings/tokens" element={<ApiTokensPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
