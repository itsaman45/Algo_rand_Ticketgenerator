import React from 'react';
import { Link } from 'react-router-dom';

const Landing = () => {
  return (
    <div className="relative min-h-[90vh] overflow-hidden">
      {/* Grid & gradient background */}
      <div className="absolute inset-0 grid-bg" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-gray-900/80" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[600px] bg-cyan-500/5 rounded-full blur-[120px] -z-10" />
      <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[400px] bg-purple-500/5 rounded-full blur-[100px] -z-10" />

      <div className="relative flex flex-col items-center justify-center px-4 py-16 md:py-24">
        {/* Header */}
        <div className="text-center mb-16 md:mb-20">
          <div
            className="inline-flex items-center gap-2 px-5 py-2 rounded-full border border-cyan-500/30 bg-cyan-500/5 mb-8 font-mono text-xs md:text-sm tracking-[0.3em] text-cyan-300"
            style={{ boxShadow: 'inset 0 0 20px rgba(34, 211, 238, 0.05)' }}
          >
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            ALGORAND · LAYER-1 · ASAs
          </div>
          <h1
            className="font-orbitron text-5xl md:text-7xl lg:text-8xl font-bold mb-6 tracking-tight"
            style={{
              background: 'linear-gradient(135deg, #22d3ee 0%, #a78bfa 50%, #22d3ee 100%)',
              backgroundSize: '200% auto',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            INITIALIZE
          </h1>
          <h2 className="font-orbitron text-3xl md:text-5xl font-semibold text-white/90 mb-4">
            Select Access Mode
          </h2>
          <p className="font-mono text-gray-400 text-sm md:text-base max-w-2xl mx-auto tracking-wider">
            &gt; Choose your role to connect with the NEXUS event protocol
          </p>
        </div>

        {/* Role cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10 w-full max-w-5xl">
          {/* Attendee Card */}
          <Link
            to="/attendee/marketplace"
            className="group relative block"
          >
            <div className="absolute -inset-[1px] bg-gradient-to-br from-cyan-500/40 via-transparent to-blue-500/40 rounded-2xl blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="tech-card relative h-full p-8 md:p-10 rounded-2xl flex flex-col items-center text-center overflow-hidden transition-all duration-300 group-hover:-translate-y-1 group-hover:border-cyan-500/40">
              <div
                className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent"
                style={{ opacity: 0.8 }}
              />
              <div
                className="w-20 h-20 md:w-24 md:h-24 rounded-2xl flex items-center justify-center mb-6 border border-cyan-500/20 bg-cyan-500/10 group-hover:bg-cyan-500/20 transition-colors"
                style={{ boxShadow: 'inset 0 0 30px rgba(34, 211, 238, 0.1)' }}
              >
                <span className="text-4xl md:text-5xl">🎟️</span>
              </div>
              <h3 className="font-orbitron text-2xl md:text-3xl font-bold text-white mb-3 tracking-wide">
                ATTENDEE
              </h3>
              <p className="font-mono text-gray-400 text-sm md:text-base mb-8 flex-grow leading-relaxed tracking-wide">
                Access marketplace · Mint NFT passes · Verify on-chain · QR gate entry
              </p>
              <span className="font-mono text-cyan-400 text-xs md:text-sm tracking-[0.2em] group-hover:text-cyan-300 transition-colors flex items-center gap-2">
                <span>ENTER_MARKETPLACE</span>
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </span>
            </div>
          </Link>

          {/* Organizer Card */}
          <Link
            to="/organizer/dashboard"
            className="group relative block"
          >
            <div className="absolute -inset-[1px] bg-gradient-to-br from-purple-500/40 via-transparent to-pink-500/40 rounded-2xl blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div
              className="relative h-full p-8 md:p-10 rounded-2xl flex flex-col items-center text-center overflow-hidden transition-all duration-300 group-hover:-translate-y-1 border border-white/5"
              style={{
                background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 41, 59, 0.8) 100%)',
                boxShadow: 'inset 0 0 60px rgba(168, 85, 247, 0.03), 0 0 30px rgba(0, 0, 0, 0.3)',
                borderColor: 'rgba(168, 85, 247, 0.2)',
              }}
            >
              <div
                className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-400/60 to-transparent"
                style={{ opacity: 0.8 }}
              />
              <div
                className="w-20 h-20 md:w-24 md:h-24 rounded-2xl flex items-center justify-center mb-6 border border-purple-500/20 bg-purple-500/10 group-hover:bg-purple-500/20 transition-colors"
                style={{ boxShadow: 'inset 0 0 30px rgba(168, 85, 247, 0.1)' }}
              >
                <span className="text-4xl md:text-5xl">⚡</span>
              </div>
              <h3 className="font-orbitron text-2xl md:text-3xl font-bold text-white mb-3 tracking-wide">
                ORGANIZER
              </h3>
              <p className="font-mono text-gray-400 text-sm md:text-base mb-8 flex-grow leading-relaxed tracking-wide">
                Create events · Mint ASAs · Track sales · Verify attendees at door
              </p>
              <span className="font-mono text-purple-400 text-xs md:text-sm tracking-[0.2em] group-hover:text-purple-300 transition-colors flex items-center gap-2">
                <span>MANAGE_PROTOCOL</span>
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </span>
            </div>
          </Link>
        </div>

        {/* Footer tech badges */}
        <div className="mt-16 md:mt-20 flex flex-wrap justify-center gap-6 md:gap-12 font-mono text-[10px] md:text-xs text-gray-500 tracking-[0.2em] uppercase">
          <span className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500/60" />
            ALGORITHMICALLY SECURE
          </span>
          <span className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500/60" />
            ZERO-KNOWLEDGE VERIFY
          </span>
          <span className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500/60" />
            INSTANT SETTLEMENT
          </span>
          <span className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500/60" />
            PERA WALLET SYNC
          </span>
        </div>
      </div>
    </div>
  );
};

export default Landing;
