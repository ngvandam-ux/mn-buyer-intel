import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import { Layout } from './components/Layout.tsx';
import './styles.css';
import { Contacts } from './views/Contacts.tsx';
import { Dashboard } from './views/Dashboard.tsx';
import { Entities } from './views/Entities.tsx';
import { EntityDetail } from './views/EntityDetail.tsx';
import { Opportunities } from './views/Opportunities.tsx';
import { OpportunityDetail } from './views/OpportunityDetail.tsx';
import { SellerMatching } from './views/SellerMatching.tsx';
import { Signals } from './views/Signals.tsx';
import { SourceHealth } from './views/SourceHealth.tsx';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 } },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <Router>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/buyers" element={<Entities />} />
            <Route path="/buyers/:id" element={<EntityDetail />} />
            <Route path="/opportunities" element={<Opportunities />} />
            <Route path="/opportunities/:id" element={<OpportunityDetail />} />
            <Route path="/contacts" element={<Contacts />} />
            <Route path="/signals" element={<Signals />} />
            <Route path="/matching" element={<SellerMatching />} />
            <Route path="/sources" element={<SourceHealth />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Router>
    </QueryClientProvider>
  </React.StrictMode>,
);
