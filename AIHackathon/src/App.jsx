import { useState } from 'react'
   import LandingPage from './screens/LandingPage'
   import LoginScreen from './screens/LoginScreen'
   import OrgLoginScreen from './screens/OrgLoginScreen'
   import Dashboard from './screens/Dashboard'
   import OrgDashboard from './screens/OrgDashboard'
   import './App.css'

   function App() {
     const [currentScreen, setCurrentScreen] = useState('landing')

     const handleLoginAsUser = () => {
       setCurrentScreen('login-user')
     }

     const handleLoginAsOrg = () => {
       setCurrentScreen('login-org')
     }

     const handleUserLoginSuccess = () => {
       setCurrentScreen('dashboard')
     }

     const handleOrgLoginSuccess = () => {
       setCurrentScreen('org-dashboard')
     }

     const handleLogout = () => {
       setCurrentScreen('landing')
     }

     const handleBackToHome = () => {
       setCurrentScreen('landing')
     }

     return (
       <>
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