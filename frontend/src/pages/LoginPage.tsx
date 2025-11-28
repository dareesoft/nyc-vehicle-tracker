/**
 * Cyberpunk Login Page
 * Themed access terminal with glitch effects and neon glow
 */

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../hooks/useAuth'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [loadingText, setLoadingText] = useState('')
  const [showGlitch, setShowGlitch] = useState(false)
  const { login } = useAuth()
  const usernameRef = useRef<HTMLInputElement>(null)

  // Focus username input on mount
  useEffect(() => {
    usernameRef.current?.focus()
  }, [])

  // Loading text animation
  useEffect(() => {
    if (!isLoading) {
      setLoadingText('')
      return
    }

    const texts = ['AUTHENTICATING', 'AUTHENTICATING.', 'AUTHENTICATING..', 'AUTHENTICATING...']
    let i = 0
    const interval = setInterval(() => {
      setLoadingText(texts[i % texts.length])
      i++
    }, 300)

    return () => clearInterval(interval)
  }, [isLoading])

  // Random glitch effect
  useEffect(() => {
    const glitchInterval = setInterval(() => {
      if (Math.random() > 0.95) {
        setShowGlitch(true)
        setTimeout(() => setShowGlitch(false), 100)
      }
    }, 500)

    return () => clearInterval(glitchInterval)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const result = await login(username, password)
      
      if (!result.success) {
        setError(result.message || 'ACCESS DENIED')
        // Trigger error glitch
        setShowGlitch(true)
        setTimeout(() => setShowGlitch(false), 500)
      }
    } catch (err) {
      setError('SYSTEM ERROR - CONNECTION FAILED')
      setShowGlitch(true)
      setTimeout(() => setShowGlitch(false), 500)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={`
      min-h-screen bg-cyber-black flex items-center justify-center p-4
      relative overflow-hidden
      ${showGlitch ? 'animate-glitch-shake' : ''}
    `}>
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Grid pattern */}
        <div 
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `
              linear-gradient(rgba(0, 255, 247, 0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0, 255, 247, 0.1) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px',
            animation: 'grid-scroll 20s linear infinite'
          }}
        />
        
        {/* Scanline effect */}
        <div 
          className="absolute inset-0 pointer-events-none opacity-20"
          style={{
            background: `linear-gradient(
              to bottom,
              transparent 50%,
              rgba(0, 0, 0, 0.3) 50%
            )`,
            backgroundSize: '100% 4px',
            animation: 'scanline 8s linear infinite'
          }}
        />
        
        {/* Radial gradient */}
        <div className="absolute inset-0 bg-gradient-radial from-transparent via-transparent to-cyber-black opacity-80" />
        
        {/* Floating particles */}
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-cyber-cyan/30 rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animation: `float ${3 + Math.random() * 4}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 2}s`
            }}
          />
        ))}
      </div>

      {/* Login container */}
      <div className="relative z-10 w-full max-w-md">
        {/* Terminal header */}
        <div className="text-center mb-8">
          <h1 className={`
            text-3xl md:text-4xl font-mono font-bold tracking-wider
            ${showGlitch ? 'glitch-text' : ''}
          `}>
            <span className="text-cyber-cyan drop-shadow-[0_0_10px_rgba(0,255,247,0.5)]">
              ░▒▓ SYSTEM ACCESS ▓▒░
            </span>
          </h1>
          <p className="text-cyber-cyan/50 text-sm font-mono mt-2 tracking-widest">
            NYC VEHICLE SURVEILLANCE TERMINAL
          </p>
        </div>

        {/* Login form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="glass-panel border border-cyber-cyan/30 rounded-lg p-6 md:p-8 relative overflow-hidden">
            {/* Corner decorations */}
            <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-cyber-cyan" />
            <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-cyber-cyan" />
            <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-cyber-cyan" />
            <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-cyber-cyan" />

            {/* Glitch overlay */}
            {showGlitch && (
              <div className="absolute inset-0 bg-cyber-magenta/10 animate-pulse" />
            )}

            {/* Username field */}
            <div className="mb-6">
              <label className="block text-cyber-cyan/70 text-xs font-mono tracking-wider mb-2">
                ╔═══ USER ID ═══╗
              </label>
              <div className="relative">
                <input
                  ref={usernameRef}
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={isLoading}
                  className={`
                    w-full bg-cyber-dark/50 border-2 rounded px-4 py-3
                    font-mono text-lg tracking-wider
                    transition-all duration-300
                    focus:outline-none
                    disabled:opacity-50
                    ${error 
                      ? 'border-cyber-magenta text-cyber-magenta' 
                      : 'border-cyber-cyan/30 text-cyber-cyan focus:border-cyber-cyan focus:shadow-[0_0_20px_rgba(0,255,247,0.3)]'
                    }
                  `}
                  placeholder="ENTER USER ID"
                  autoComplete="username"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-cyber-cyan/30">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Password field */}
            <div className="mb-6">
              <label className="block text-cyber-cyan/70 text-xs font-mono tracking-wider mb-2">
                ╔═══ ACCESS CODE ═══╗
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  className={`
                    w-full bg-cyber-dark/50 border-2 rounded px-4 py-3
                    font-mono text-lg tracking-wider
                    transition-all duration-300
                    focus:outline-none
                    disabled:opacity-50
                    ${error 
                      ? 'border-cyber-magenta text-cyber-magenta' 
                      : 'border-cyber-cyan/30 text-cyber-cyan focus:border-cyber-cyan focus:shadow-[0_0_20px_rgba(0,255,247,0.3)]'
                    }
                  `}
                  placeholder="●●●●●●●●●●"
                  autoComplete="current-password"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-cyber-cyan/30">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div className={`
                mb-6 p-3 border border-cyber-magenta/50 rounded
                bg-cyber-magenta/10 text-cyber-magenta font-mono text-sm
                ${showGlitch ? 'animate-pulse' : ''}
              `}>
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span>⚠ {error}</span>
                </div>
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={isLoading || !username || !password}
              className={`
                w-full py-4 rounded font-mono text-lg tracking-wider
                transition-all duration-300 relative overflow-hidden
                disabled:opacity-50 disabled:cursor-not-allowed
                ${isLoading
                  ? 'bg-cyber-cyan/20 border-2 border-cyber-cyan text-cyber-cyan'
                  : 'bg-cyber-cyan/10 border-2 border-cyber-cyan text-cyber-cyan hover:bg-cyber-cyan/20 hover:shadow-[0_0_30px_rgba(0,255,247,0.4)]'
                }
              `}
            >
              {/* Button glow effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyber-cyan/20 to-transparent -translate-x-full hover:translate-x-full transition-transform duration-700" />
              
              {isLoading ? (
                <span className="relative z-10 flex items-center justify-center gap-3">
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                  </svg>
                  {loadingText}
                </span>
              ) : (
                <span className="relative z-10 flex items-center justify-center gap-2">
                  <span>▶</span>
                  <span>AUTHENTICATE</span>
                </span>
              )}
            </button>
          </div>
        </form>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-cyber-cyan/30 text-xs font-mono tracking-wider">
            NYC VEHICLE SURVEILLANCE SYSTEM v1.0
          </p>
          <p className="text-cyber-cyan/20 text-[10px] font-mono mt-1">
            AUTHORIZED PERSONNEL ONLY
          </p>
        </div>
      </div>

      {/* Custom CSS for animations */}
      <style>{`
        @keyframes grid-scroll {
          0% { transform: translate(0, 0); }
          100% { transform: translate(50px, 50px); }
        }
        
        @keyframes scanline {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100vh); }
        }
        
        @keyframes float {
          0%, 100% { transform: translateY(0) scale(1); opacity: 0.3; }
          50% { transform: translateY(-20px) scale(1.5); opacity: 0.6; }
        }
        
        .glitch-text {
          animation: glitch 0.3s ease infinite;
        }
        
        @keyframes glitch {
          0% { text-shadow: 2px 0 #ff00ff, -2px 0 #00ffff; }
          25% { text-shadow: -2px 0 #ff00ff, 2px 0 #00ffff; }
          50% { text-shadow: 2px 2px #ff00ff, -2px -2px #00ffff; }
          75% { text-shadow: -2px 2px #ff00ff, 2px -2px #00ffff; }
          100% { text-shadow: 2px 0 #ff00ff, -2px 0 #00ffff; }
        }
        
        .animate-glitch-shake {
          animation: shake 0.5s ease-in-out;
        }
        
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        
        .bg-gradient-radial {
          background: radial-gradient(circle at center, var(--tw-gradient-from), var(--tw-gradient-via), var(--tw-gradient-to));
        }
      `}</style>
    </div>
  )
}

