/**
 * Cyberpunk Login Page
 * Themed access terminal with glitch effects and neon glow
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../hooks/useAuth'

// Words and items for Matrix rain
const MATRIX_ITEMS = [
  // 한글
  '다리소프트', '다리', '도로', '위험', '정보', '안전', '균열', '포장', '노면', '유지보수', '시설물', '관리',
  '교통', '환경',
  // English - short words
  'ARA20', 'ARA30', 'RiaaS', 'AI', 'Edge', 'road', 'analyzer', 'daree',
  'dareesoft', 'safe', 'road', 'hazard', 'wise', 'view', 'keeper',
  'VisionX', 'Seoul', 'NYC', 'Canada', 'Gemini', 'Elizabeth', 'Mandella',
  'dongha', 'sohee', 'IRI', 'PCI', 'pothole', 'crack', 'rutting',
  'roughness', 'asphalt', 'concrete', 'defect', 'lane', 'guardrail',
  'curb', 'bridge', 'tunnel', 'manhole', 'drainage', 'crosswalk',
  'camera', 'dashcam', 'GPS', 'GNSS', 'RTK', 'telematics', 'IoT',
  '5G', 'LTE', 'V2X', 'sensor', 'fusion', 'GIS', 'mapping', 'Tokyo',
  'London', 'Singapore', 'LA', 'Chicago', 'Toronto', 'Vancouver',
  'Berlin', 'Sydney', 'Melbourne', 'Busan', 'Incheon', 'Daegu',
  'Bundang', 'Gangnam', 'Specter', 'Scan', 'Trace',
  'Profile', 'Pattern', 'Evidence', 'Overwatch', 'Optic', 'Lens', 'Sensor',
  'detection', 'inference', 'digital twin', 'hazardmap', 'debris', 'DOT', 'ITS', 'FHWA', 
  'speed', 'limit', 'sign', 'warning', 'alert', 'danger', 'speed-limit-sign', 'road-sign',
  // Numbers
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '01',
  '42', '2001', '02', '18', '2020', '8967', '0110',
  '192', '168', '205', '3001'
]

// Get random word from MATRIX_ITEMS
function getRandomWord(): string {
  return MATRIX_ITEMS[Math.floor(Math.random() * MATRIX_ITEMS.length)]
}

// Generate array of 3-5 random words
function getRandomWords(): string[] {
  const count = 3 + Math.floor(Math.random() * 3) // 3-5 words
  return Array.from({ length: count }, () => getRandomWord())
}

// Calculate total character count from words array (including gaps)
function getTotalLength(words: string[]): number {
  const charCount = words.reduce((sum, word) => sum + word.length, 0)
  const gapCount = words.length  // 1 gap after each word
  return charCount + gapCount
}

interface Drop {
  x: number
  y: number
  speed: number
  words: string[]       // Array of connected words
  totalLength: number   // Total character count
  layer: 'front' | 'back'
}

// Canvas-based Matrix Rain - Connected words with gradient
function MatrixCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dropsRef = useRef<Drop[]>([])
  const animationRef = useRef<number>(0)

  const initDrops = useCallback((width: number, height: number) => {
    const drops: Drop[] = []
    const columnWidth = 80

    for (let i = 0; i < Math.ceil(width / columnWidth); i++) {
      // Front layer - 70% of columns
      if (Math.random() > 0.3) {
        const words = getRandomWords()
        drops.push({
          x: i * columnWidth + columnWidth / 2,
          y: -Math.random() * height,
          speed: 1.0 + Math.random() * 1.2,
          words,
          totalLength: getTotalLength(words),
          layer: 'front',
        })
      }
      // Back layer - 40% of columns
      if (Math.random() > 0.6) {
        const words = getRandomWords()
        drops.push({
          x: i * columnWidth + columnWidth / 3,
          y: -Math.random() * height - 300,
          speed: 0.5 + Math.random() * 0.6,
          words,
          totalLength: getTotalLength(words),
          layer: 'back',
        })
      }
    }
    dropsRef.current = drops
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const handleResize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      initDrops(canvas.width, canvas.height)
    }
    handleResize()
    window.addEventListener('resize', handleResize)

    const animate = () => {
      // Clear canvas completely - no trail effect
      ctx.fillStyle = '#0a0a0f'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      dropsRef.current.forEach((drop) => {
        const isBack = drop.layer === 'back'
        const fontSize = isBack ? 11 : 14
        const baseOpacity = isBack ? 0.5 : 1.0
        const charHeight = fontSize + 3

        ctx.font = `${fontSize}px "Courier New", monospace`

        // Draw words with gaps between them
        let yOffset = 0
        const totalSlots = drop.totalLength  // includes gaps

        drop.words.forEach((word) => {
          const chars = word.split('')
          
          chars.forEach((char, charIndex) => {
            const charY = drop.y + yOffset * charHeight

            // Only draw if on screen
            if (charY >= -charHeight && charY <= canvas.height + charHeight) {
              // Brightness: top (dark) → bottom (bright)
              const brightness = 0.15 + (yOffset / totalSlots) * 0.85
              const opacity = brightness * baseOpacity

              // Last character of each word gets glow effect
              const isLastCharOfWord = charIndex === chars.length - 1

              if (isLastCharOfWord) {
                ctx.shadowBlur = 12
                ctx.shadowColor = '#00fff7'
                ctx.fillStyle = `rgba(200, 255, 255, ${opacity})`
              } else {
                ctx.shadowBlur = 0
                ctx.fillStyle = `rgba(0, 255, 247, ${opacity})`
              }

              ctx.fillText(char, drop.x, charY)
            }

            yOffset++
          })
          
          // Add 1 character gap after each word
          yOffset++
        })

        ctx.shadowBlur = 0

        // Update position
        drop.y += drop.speed

        // Reset when completely off screen
        if (drop.y > canvas.height + 50) {
          const newWords = getRandomWords()
          drop.y = -getTotalLength(newWords) * charHeight - Math.random() * 100
          drop.words = newWords
          drop.totalLength = getTotalLength(newWords)
          drop.speed = drop.layer === 'back'
            ? 0.5 + Math.random() * 0.6
            : 1.0 + Math.random() * 1.2
        }

        // Word morphing - 0.5% chance per frame
        if (Math.random() < 0.005) {
          const randomIndex = Math.floor(Math.random() * drop.words.length)
          drop.words[randomIndex] = getRandomWord()
          drop.totalLength = getTotalLength(drop.words)
        }
      })

      animationRef.current = requestAnimationFrame(animate)
    }

    animationRef.current = requestAnimationFrame(animate)

    return () => {
      window.removeEventListener('resize', handleResize)
      cancelAnimationFrame(animationRef.current)
    }
  }, [initDrops])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ background: 'transparent' }}
    />
  )
}

// Authentication overlay with typing animation
function AuthenticatingOverlay({ onComplete }: { onComplete: () => void }) {
  const [text, setText] = useState('')
  const [isFadingOut, setIsFadingOut] = useState(false)
  const fullText = 'AUTHENTICATING...'

  useEffect(() => {
    let charIndex = 0
    const typingInterval = setInterval(() => {
      if (charIndex <= fullText.length) {
        setText(fullText.substring(0, charIndex))
        charIndex++
      } else {
        clearInterval(typingInterval)
      }
    }, 120) // ~2s for full text

    // After 2.5s total, start fade out
    const fadeTimer = setTimeout(() => {
      setIsFadingOut(true)
    }, 2500)

    // After fade (1s), complete
    const completeTimer = setTimeout(() => {
      onComplete()
    }, 3500)

    return () => {
      clearInterval(typingInterval)
      clearTimeout(fadeTimer)
      clearTimeout(completeTimer)
    }
  }, [onComplete])

  return (
    <div className={`
      fixed inset-0 z-[9999] bg-cyber-black flex items-center justify-center
      transition-opacity duration-1000
      ${isFadingOut ? 'opacity-0' : 'opacity-100'}
    `}>
      {/* Matrix rain in auth overlay too */}
      <MatrixCanvas />
      
      <div className="text-center relative z-10">
        <div className="cyber-spinner mx-auto mb-6 w-16 h-16" />
        <p className="text-cyber-cyan font-mono text-2xl tracking-widest">
          {text}
          <span className="animate-pulse">_</span>
        </p>
        <div className="mt-4 flex justify-center gap-1">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="w-2 h-2 bg-cyber-cyan rounded-full animate-pulse"
              style={{ animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showAuthOverlay, setShowAuthOverlay] = useState(false)
  const [showGlitch, setShowGlitch] = useState(false)
  const [pendingAuth, setPendingAuth] = useState<{ token: string; user: string; expiresAt: string } | null>(null)
  const { validateCredentials, setAuthenticated } = useAuth()
  const usernameRef = useRef<HTMLInputElement>(null)

  // Focus username input on mount
  useEffect(() => {
    usernameRef.current?.focus()
  }, [])

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
      // Validate credentials without setting auth state
      const result = await validateCredentials(username, password)
      
      if (result.success && result.token && result.user && result.expiresAt) {
        // Store credentials for later
        setPendingAuth({
          token: result.token,
          user: result.user,
          expiresAt: result.expiresAt,
        })
        // Show authenticating overlay
        setShowAuthOverlay(true)
        setIsLoading(false)
      } else {
        setError(result.message || 'ACCESS DENIED')
        setShowGlitch(true)
        setTimeout(() => setShowGlitch(false), 500)
        setIsLoading(false)
      }
    } catch (err) {
      setError('SYSTEM ERROR - CONNECTION FAILED')
      setShowGlitch(true)
      setTimeout(() => setShowGlitch(false), 500)
      setIsLoading(false)
    }
  }

  const handleAuthComplete = () => {
    // Now actually set the authenticated state
    if (pendingAuth) {
      setAuthenticated(pendingAuth.token, pendingAuth.user, pendingAuth.expiresAt)
    }
    setShowAuthOverlay(false)
  }

  if (showAuthOverlay) {
    return <AuthenticatingOverlay onComplete={handleAuthComplete} />
  }

  return (
    <div className={`
      min-h-screen flex items-center justify-center p-4
      relative overflow-hidden
      ${showGlitch ? 'animate-glitch-shake' : ''}
    `}
    style={{ background: '#0a0a0f' }}
    >
      {/* Canvas Matrix rain background */}
      <MatrixCanvas />
      
      {/* Animated background overlays */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Grid pattern */}
        <div 
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: `
              linear-gradient(rgba(0, 255, 247, 0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0, 255, 247, 0.1) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px',
          }}
        />
        
        {/* Scanline effect */}
        <div 
          className="absolute inset-0 pointer-events-none opacity-10"
          style={{
            background: `linear-gradient(
              to bottom,
              transparent 50%,
              rgba(0, 0, 0, 0.3) 50%
            )`,
            backgroundSize: '100% 4px',
          }}
        />
        
        {/* Radial vignette */}
        <div 
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(circle at center, transparent 30%, #0a0a0f 100%)',
            opacity: 0.7,
          }}
        />
      </div>

      {/* Login container */}
      <div className="relative z-10 w-full max-w-md">
        {/* Terminal header */}
        <div className="text-center mb-8">
          <h1 className={`
            text-3xl md:text-4xl font-mono font-bold tracking-wider
            ${showGlitch ? 'glitch-text' : ''}
          `}>
            <span className="text-cyber-cyan drop-shadow-[0_0_10px_rgba(0,255,247,0.5)] flex items-center justify-center gap-3">
              <span className="flex gap-0.5">
                <span className="inline-block w-2 h-6 bg-cyber-cyan opacity-30"></span>
                <span className="inline-block w-2 h-6 bg-cyber-cyan opacity-50"></span>
                <span className="inline-block w-2 h-6 bg-cyber-cyan opacity-70"></span>
                <span className="inline-block w-2 h-6 bg-cyber-cyan opacity-90"></span>
              </span>
              <span>SYSTEM ACCESS</span>
              <span className="flex gap-0.5">
                <span className="inline-block w-2 h-6 bg-cyber-cyan opacity-90"></span>
                <span className="inline-block w-2 h-6 bg-cyber-cyan opacity-70"></span>
                <span className="inline-block w-2 h-6 bg-cyber-cyan opacity-50"></span>
                <span className="inline-block w-2 h-6 bg-cyber-cyan opacity-30"></span>
              </span>
            </span>
          </h1>
          <p className="text-cyber-cyan/50 text-sm font-mono mt-3 tracking-widest">
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
              <label className="flex items-center text-cyber-cyan/70 text-xs font-mono tracking-wider mb-2">
                <span className="text-cyber-cyan/40">══</span>
                <span className="mx-2">USER ID</span>
                <span className="text-cyber-cyan/40">══</span>
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
              <label className="flex items-center text-cyber-cyan/70 text-xs font-mono tracking-wider mb-2">
                <span className="text-cyber-cyan/40">══</span>
                <span className="mx-2">ACCESS CODE</span>
                <span className="text-cyber-cyan/40">══</span>
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
                bg-cyber-cyan/10 border-2 border-cyber-cyan text-cyber-cyan 
                hover:bg-cyber-cyan/20 hover:shadow-[0_0_30px_rgba(0,255,247,0.4)]
              `}
            >
              {/* Button glow effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyber-cyan/20 to-transparent -translate-x-full hover:translate-x-full transition-transform duration-700" />
              
              <span className="relative z-10 flex items-center justify-center gap-2">
                <span>▶</span>
                <span>AUTHENTICATE</span>
              </span>
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
      `}</style>
    </div>
  )
}
