/**
 * Mobile Tab Bar Component
 * Bottom navigation for switching between main views
 */

import { ReactNode } from 'react'

export type TabId = 'map' | 'camera' | 'info' | 'menu'

interface TabBarProps {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
  showBadge?: Partial<Record<TabId, number>>
}

interface TabItem {
  id: TabId
  label: string
  icon: ReactNode
}

const tabs: TabItem[] = [
  {
    id: 'map',
    label: 'MAP',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
          d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" 
        />
      </svg>
    ),
  },
  {
    id: 'camera',
    label: 'CAMERA',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
          d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" 
        />
      </svg>
    ),
  },
  {
    id: 'info',
    label: 'INFO',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" 
        />
      </svg>
    ),
  },
  {
    id: 'menu',
    label: 'MENU',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
          d="M4 6h16M4 12h16M4 18h16" 
        />
      </svg>
    ),
  },
]

export default function TabBar({ activeTab, onTabChange, showBadge = {} }: TabBarProps) {
  return (
    <nav className="h-14 glass-panel border-t border-cyber-cyan/20 flex items-center justify-around px-2 safe-area-bottom">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id
        const badge = showBadge[tab.id]
        
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`
              relative flex flex-col items-center justify-center gap-0.5 
              w-16 h-12 rounded-lg transition-all
              ${isActive 
                ? 'text-cyber-cyan bg-cyber-cyan/10' 
                : 'text-cyber-cyan/50 hover:text-cyber-cyan/70'
              }
            `}
          >
            {/* Icon */}
            <div className={`transition-transform ${isActive ? 'scale-110' : ''}`}>
              {tab.icon}
            </div>
            
            {/* Label */}
            <span className={`
              text-[9px] font-mono tracking-wider
              ${isActive ? 'text-cyber-cyan' : 'text-cyber-cyan/40'}
            `}>
              {tab.label}
            </span>
            
            {/* Badge */}
            {badge !== undefined && badge > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 
                bg-cyber-magenta text-white text-[10px] font-bold rounded-full 
                flex items-center justify-center">
                {badge > 99 ? '99+' : badge}
              </span>
            )}
            
            {/* Active indicator */}
            {isActive && (
              <div className="absolute -bottom-1 w-8 h-0.5 bg-cyber-cyan rounded-full" />
            )}
          </button>
        )
      })}
    </nav>
  )
}

// Safe area helper for iOS
export function SafeAreaBottom() {
  return <div className="h-safe-area-inset-bottom" />
}

