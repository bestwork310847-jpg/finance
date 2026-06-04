import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider } from './store/appStore'
import Questionnaire from './pages/Questionnaire'
import Output1 from './pages/Output1'
import Output2 from './pages/Output2'
import Output3 from './pages/Output3'
import Admin from './pages/Admin'

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Questionnaire />} />
          <Route path="/output1" element={<Output1 />} />
          <Route path="/output2" element={<Output2 />} />
          <Route path="/output3" element={<Output3 />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  )
}
