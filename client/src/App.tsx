import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components';
import { DashboardPage, AccountsPage, LedgerPage } from './pages';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="accounts" element={<AccountsPage />} />
          <Route path="ledger" element={<LedgerPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
