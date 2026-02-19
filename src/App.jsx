import { AlgorandProvider } from './context/AlgorandContext';
import Navbar from './components/Navbar';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import CreateEvent from './pages/CreateEvent';
import Marketplace from './pages/Marketplace';
import MyTickets from './pages/MyTickets';
import Verify from './pages/Verify';

import SplineLanding from './pages/SplineLanding';
import Landing from './pages/Landing';
import OrganizerDashboard from './pages/OrganizerDashboard';

const Home = () => {
  return (
    <div className="relative flex flex-col items-center justify-center min-h-[80vh] text-center px-4 overflow-hidden">

      {/* Background Glow FX */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-600/20 rounded-full blur-[120px] -z-10 animate-pulse-slow"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-blue-600/20 rounded-full blur-[100px] -z-10 animate-pulse-slow delay-1000"></div>

      <div className="glass px-8 py-2 rounded-full mb-8 border border-white/10 animate-float">
        <span className="text-neon-cyan text-sm uppercase tracking-widest font-bold">Web3 Event Ticketing</span>
      </div>

      <h1 className="text-6xl md:text-8xl font-bold mb-6 tracking-tighter leading-tight">
        The Future of <br />
        <span className="text-gradient">Live Events</span>
      </h1>

      <p className="text-xl md:text-2xl text-gray-400 max-w-3xl mb-12 font-light">
        Mint, sell, and verify tickets as **Algorand Standard Assets**.
        <br className="hidden md:block" />
        Eliminate scalping and fraud with the power of blockchain.
      </p>

      <div className="flex flex-col md:flex-row gap-6 w-full md:w-auto">
        <Link to="/events" className="group relative px-8 py-4 bg-white text-black font-bold rounded-xl overflow-hidden transition-all hover:scale-105 active:scale-95">
          <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-blue-400 to-purple-500 opacity-0 group-hover:opacity-20 transition-opacity"></div>
          <span className="relative text-lg">Explore Marketplace</span>
        </Link>

        <Link to="/create-event" className="px-8 py-4 glass border border-white/20 text-white font-bold rounded-xl hover:bg-white/10 transition-all hover:name-scale-105 active:scale-95">
          Create Event
        </Link>
      </div>

      <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-8 text-center text-gray-500 uppercase text-xs tracking-widest font-bold">
        <div>Algorithmically Secure</div>
        <div>Zero-Knowledge Verify</div>
        <div>Instant Settlement</div>
        <div>Pera Wallet Sync</div>
      </div>
    </div>
  );
};

function AppContent() {
  const location = useLocation();
  const isSplineLanding = location.pathname === '/';

  return (
    <div className="min-h-screen bg-gray-900 text-white font-inter">
      {!isSplineLanding && <Navbar />}
      <main className={isSplineLanding ? 'fixed inset-0 overflow-hidden' : 'container mx-auto px-4 py-8 pt-32'}>
        <Routes>
          {/* Spline 3D Landing */}
          <Route path="/" element={<SplineLanding />} />
          {/* Role Selection (after Get Started) */}
          <Route path="/select-role" element={<Landing />} />

          {/* Attendee Routes */}
          <Route path="/attendee/marketplace" element={<Marketplace />} />
          <Route path="/attendee/my-tickets" element={<MyTickets />} />

          {/* Organizer Routes */}
          <Route path="/organizer/dashboard" element={<OrganizerDashboard />} />
          <Route path="/organizer/create-event" element={<CreateEvent />} />
          <Route path="/organizer/verify" element={<Verify />} />

          {/* Fallback Redirects for legacy links */}
          <Route path="/events" element={<Marketplace />} />
          <Route path="/create-event" element={<CreateEvent />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <AlgorandProvider>
      <Router>
        <AppContent />
      </Router>
    </AlgorandProvider>
  );
}

export default App;
