import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import { Layout } from './components/Layout.js';
import { Dashboard } from './pages/Dashboard.js';
import { TestCaseForm } from './pages/TestCaseForm.js';
import { TestCaseList } from './pages/TestCaseList.js';
import { TestRunDetailPage } from './pages/TestRunDetail.js';
import { TestRunList } from './pages/TestRunList.js';
import { TestRunNew } from './pages/TestRunNew.js';
import { TestSuiteDetailPage } from './pages/TestSuiteDetail.js';
import { TestSuiteList } from './pages/TestSuiteList.js';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
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
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </Router>
  );
}
