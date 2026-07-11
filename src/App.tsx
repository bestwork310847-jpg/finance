import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider } from './store/appStore'
import { AuthProvider } from './auth/AuthContext'
import Questionnaire from './pages/Questionnaire'
import Output1 from './pages/Output1'
import Output2 from './pages/Output2'
import Output3 from './pages/Output3'
import Admin from './pages/Admin'
import AdminUser from './pages/AdminUser'
import AdminAssessment from './pages/AdminAssessment'
import Login from './pages/Login'
import Consent from './pages/Consent'
import History from './pages/History'

export default function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login"   element={<Login />} />
            <Route path="/consent" element={<Consent />} />
            <Route path="/"        element={<Questionnaire />} />
            <Route path="/output1" element={<Output1 />} />
            <Route path="/output2" element={<Output2 />} />
            <Route path="/output3" element={<Output3 />} />
            <Route path="/history" element={<History />} />
            <Route path="/admin"                         element={<Admin />} />
            <Route path="/admin/:userId"                 element={<AdminUser />} />
            <Route path="/admin/:userId/:assessmentId"   element={<AdminAssessment />} />
            <Route path="*"                              element={<Navigate to="/" />} />
          </Routes>
        </BrowserRouter>
      </AppProvider>
    </AuthProvider>
  )
}
