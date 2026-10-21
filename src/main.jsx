import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { AuthProvider } from './lib/auth.jsx'
import { ShopProvider } from './lib/shop.jsx'
import { CustomerProvider } from './lib/customer.jsx'
import './index.css'
ReactDOM.createRoot(document.getElementById('root')).render(
  <AuthProvider><ShopProvider><CustomerProvider><App /></CustomerProvider></ShopProvider></AuthProvider>
)
