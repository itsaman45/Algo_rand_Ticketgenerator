import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import WalletConnect from './WalletConnect';
import { useAlgorand } from '../context/AlgorandContext';

const Navbar = () => {
    const { accountAddress } = useAlgorand();
    const location = useLocation();

    // Determine section based on path
    const isOrganizer = location.pathname.startsWith('/organizer');
    const isAttendee = location.pathname.startsWith('/attendee');
    const isLanding = location.pathname === '/';
    const isSelectRole = location.pathname === '/select-role';

    return (
        <nav className="fixed top-4 left-0 right-0 z-50 px-4">
            <div className="container mx-auto max-w-6xl">
                <div className="glass rounded-2xl px-6 py-4 flex items-center justify-between shadow-2xl bg-black/40 backdrop-blur-xl border border-white/10">
                    <Link to="/" className="text-2xl md:text-3xl font-bold tracking-tighter hover:opacity-80 transition-opacity flex items-center gap-2">
                        <span className="text-gradient">NEXUS</span>
                        {isOrganizer && <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded border border-purple-500/30">ORG</span>}
                        {isAttendee && <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded border border-blue-500/30">USER</span>}
                    </Link>

                    {/* Dynamic Links */}
                    <div className="hidden md:flex items-center gap-6">
                        {isOrganizer && (
                            <>
                                <NavLink to="/organizer/dashboard">Dashboard</NavLink>
                                <NavLink to="/organizer/create-event">Create Event</NavLink>
                                <NavLink to="/organizer/verify">Verify</NavLink>
                            </>
                        )}

                        {isAttendee && (
                            <>
                                <NavLink to="/attendee/marketplace">Marketplace</NavLink>
                                {accountAddress && <NavLink to="/attendee/my-tickets">My Tickets</NavLink>}
                            </>
                        )}

                        {/* Landing & Select Role - Navbar visible on both */}
                        {(isLanding || isSelectRole) && (
                            <>
                                {isSelectRole && <NavLink to="/">← Home</NavLink>}
                                <span className="text-sm text-gray-500 font-mono tracking-wider">Connect Wallet</span>
                            </>
                        )}
                    </div>

                    <div>
                        <WalletConnect />
                    </div>
                </div>
            </div>
        </nav>
    );
};

const NavLink = ({ to, children }) => (
    <Link
        to={to}
        className="text-gray-300 hover:text-white font-medium hover:text-neon-cyan transition-all relative group text-sm"
    >
        {children}
        <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-blue-500 to-purple-500 transition-all group-hover:w-full"></span>
    </Link>
);

export default Navbar;
