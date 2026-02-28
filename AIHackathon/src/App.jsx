import { useState, useEffect } from 'react'
import { logout } from './services/authService'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from './firebase/firebaseConfig'
import LandingPage from './screens/LandingPage'
import LoginScreen from './screens/LoginScreen'
import OrgLoginScreen from './screens/OrgLoginScreen'
import Dashboard from './screens/Dashboard'
import OrgDashboard from './screens/OrgDashboard'
import './App.css'

function App() {
  const [currentScreen, setCurrentScreen] = useState('loading')
  const [authData, setAuthData] = useState(null)

  // Persist auth state across page refreshes
  useEffect(() => {
    const savedType = localStorage.getItem('authType')
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const idToken = await firebaseUser.getIdToken()
        const type = savedType || 'user'
        setAuthData({
          type,
          firebaseUser,
          userId: firebaseUser.uid,
          sellerId: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          firebaseToken: idToken,
        })
        setCurrentScreen(type === 'seller' ? 'org-dashboard' : 'dashboard')
      } else {
        setAuthData(null)
        setCurrentScreen('landing')
      }
    })
    return () => unsubscribe()
  }, [])

  const handleLoginAsUser = () => {
    setCurrentScreen('login-user')
  }

  const handleLoginAsOrg = () => {
    setCurrentScreen('login-org')
  }

  const handleUserLoginSuccess = (userData) => {
    localStorage.setItem('authType', 'user')
    setAuthData({ type: 'user', ...userData })
    setCurrentScreen('dashboard')
  }

  const handleOrgLoginSuccess = (sellerData) => {
    localStorage.setItem('authType', 'seller')
    setAuthData({ type: 'seller', ...sellerData })
    setCurrentScreen('org-dashboard')
  }

  const handleLogout = async () => {
    try {
      const userId = authData?.type === 'user' ? (authData.userId || authData.firebaseUser?.uid) : undefined
      const sellerId = authData?.type === 'seller' ? (authData.sellerId || authData.firebaseUser?.uid) : undefined
      await logout(userId, sellerId)
    } catch (err) {
      console.error('Logout error:', err)
    }
    setAuthData(null)
    localStorage.removeItem('authType')
    setCurrentScreen('landing')
  }

  const handleBackToHome = () => {
    setCurrentScreen('landing')
  }

  return (
    <>
      {currentScreen === 'loading' && (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f1117', color: '#fff' }}>
          <p>Loading...</p>
        </div>
      )}
      {currentScreen === 'landing' && (
        <LandingPage
          onLoginAsUser={handleLoginAsUser}
          onLoginAsOrg={handleLoginAsOrg}
        />
      )}
      {currentScreen === 'login-user' && (
        <LoginScreen
          onLoginSuccess={handleUserLoginSuccess}
          onBackToHome={handleBackToHome}
        />
      )}
      {currentScreen === 'login-org' && (
        <OrgLoginScreen
          onLoginSuccess={handleOrgLoginSuccess}
          onBackToHome={handleBackToHome}
        />
      )}
      {currentScreen === 'dashboard' && (
        <Dashboard onLogout={handleLogout} />
      )}
      {currentScreen === 'org-dashboard' && (
        <OrgDashboard onLogout={handleLogout} />
      )}
    </>
  )
}

export default App