import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import { Layout } from './components/Layout.js';
import { TestCaseForm } from './pages/TestCaseForm.js';
import { TestCaseList } from './pages/TestCaseList.js';
import { TestSuiteDetailPage } from './pages/TestSuiteDetail.js';
import { TestSuiteList } from './pages/TestSuiteList.js';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/test-cases" replace />} />
          <Route path="/test-cases" element={<TestCaseList />} />
          <Route path="/test-cases/new" element={<TestCaseForm />} />
          <Route path="/test-cases/:id" element={<TestCaseForm />} />
          <Route path="/test-suites" element={<TestSuiteList />} />
          <Route path="/test-suites/:id" element={<TestSuiteDetailPage />} />
          <Route path="*" element={<Navigate to="/test-cases" replace />} />
        </Route>
      </Routes>
    </Router>
  );
}
