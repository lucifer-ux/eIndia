import { useState } from 'react'
   import LandingPage from './screens/LandingPage'
   import LoginScreen from './screens/LoginScreen'
   import Dashboard from './screens/Dashboard'
   import './App.css'
   
   function App() {
     const [currentScreen, setCurrentScreen] = useState('landing')
     const [isAuthenticated, setIsAuthenticated] = useState(false)
   
     const handleLoginAsUser = () => {
       setCurrentScreen('login')
     }
   
     const handleLoginSuccess = () => {
       setIsAuthenticated(true)
       setCurrentScreen('dashboard')
     }
   
     const handleLogout = () => {
       setIsAuthenticated(false)
       setCurrentScreen('landing')
     }
   
     const handleBackToHome = () => {
       setCurrentScreen('landing')
     }
   
     return (
       <>
         {currentScreen === 'landing' && (
           <LandingPage onLoginAsUser={handleLoginAsUser} />
         )}
         {currentScreen === 'login' && (
           <LoginScreen 
             onLoginSuccess={handleLoginSuccess} 
             onBackToHome={handleBackToHome}
           />
         )}
         {currentScreen === 'dashboard' && (
           <Dashboard onLogout={handleLogout} />
         )}
       </>
     )
   }
   
   export default App