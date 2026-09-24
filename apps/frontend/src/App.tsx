import { useCallback, useEffect, useState } from 'react';
import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import { api, type AuthState } from './api/client.js';
import { Layout } from './components/Layout.js';
import { Alert, Spinner } from './components/ui.js';
import { Login } from './pages/Login.js';
import { Dashboard } from './pages/Dashboard.js';
import { TestCaseForm } from './pages/TestCaseForm.js';
import { TestCaseList } from './pages/TestCaseList.js';
import { TestRunDetailPage } from './pages/TestRunDetail.js';
import { TestRunList } from './pages/TestRunList.js';
import { TestRunNew } from './pages/TestRunNew.js';
import { TestSuiteDetailPage } from './pages/TestSuiteDetail.js';
import { TestSuiteList } from './pages/TestSuiteList.js';
import { ScenarioList } from './pages/ScenarioList.js';
import { ScenarioDetailPage } from './pages/ScenarioDetail.js';
import { TemplateList } from './pages/TemplateList.js';

export default function App() {
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    api
      .getAuthState()
      .then(setAuth)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Sunucuya ulaşılamadı'));
  }, []);

  useEffect(refresh, [refresh]);

  const logout = useCallback(() => {
    void api.logout().then(setAuth);
  }, []);

  if (error) return <div className="p-6"><Alert>{error}</Alert></div>;
  if (!auth) return <Spinner />;
  if (auth.required && !auth.authenticated) return <Login onSuccess={refresh} />;

  return (
    <Router>
      <Routes>
        <Route element={<Layout onLogout={auth.required ? logout : undefined} />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/test-cases" element={<TestCaseList />} />
          <Route path="/test-cases/new" element={<TestCaseForm />} />
          <Route path="/test-cases/:id" element={<TestCaseForm />} />
          <Route path="/test-suites" element={<TestSuiteList />} />
          <Route path="/test-suites/:id" element={<TestSuiteDetailPage />} />
          <Route path="/test-runs" element={<TestRunList />} />
          <Route path="/test-runs/new" element={<TestRunNew />} />
          <Route path="/test-runs/:id" element={<TestRunDetailPage />} />
          <Route path="/scenarios" element={<ScenarioList />} />
          <Route path="/scenarios/:id" element={<ScenarioDetailPage />} />
          <Route path="/scenario-templates" element={<TemplateList />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </Router>
  );
}
