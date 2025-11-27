import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

interface Notification {
  id: number
  type: string
  device_id: string | null
  date: string | null
  message: string
  count: number
  read: number
  created_at: string
}

interface NotificationResponse {
  notifications: Notification[]
  unread_count: number
}

const API_BASE = '/api'

export default function NotificationPanel() {
  const [isOpen, setIsOpen] = useState(false)
  const queryClient = useQueryClient()
  
  // Fetch notifications
  const { data } = useQuery<NotificationResponse>({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/notifications?limit=20`)
      if (!res.ok) throw new Error('Failed to fetch notifications')
      return res.json()
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  })
  
  // Mark as read mutation
  const markReadMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      const res = await fetch(`${API_BASE}/notifications/mark-read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ids.length > 0 ? ids : null)
      })
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    }
  })
  
  const unreadCount = data?.unread_count || 0
  const notifications = data?.notifications || []
  
  // Mark all as read when panel opens
  useEffect(() => {
    if (isOpen && unreadCount > 0) {
      markReadMutation.mutate([])
    }
  }, [isOpen])
  
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'new_trip':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" 
            />
          </svg>
        )
      case 'detection_complete':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" 
            />
          </svg>
        )
      default:
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
            />
          </svg>
        )
    }
  }
  
  const formatTime = (timestamp: string) => {
    try {
      const date = new Date(timestamp)
      const now = new Date()
      const diff = now.getTime() - date.getTime()
      
      if (diff < 60000) return 'just now'
      if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
      if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
      return date.toLocaleDateString()
    } catch {
      return timestamp
    }
  }
  
  return (
    <div className="relative">
      {/* Bell Icon */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          relative p-2 rounded-lg transition-all duration-200
          ${isOpen 
            ? 'bg-cyber-cyan/20 text-cyber-cyan' 
            : 'text-cyber-cyan/50 hover:text-cyber-cyan hover:bg-cyber-cyan/10'
          }
        `}
        title="Notifications"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" 
          />
        </svg>
        
        {/* Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-cyber-magenta text-white text-[10px] 
            font-bold rounded-full flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      
      {/* Dropdown Panel - Portal to body for z-index isolation */}
      {isOpen && createPortal(
        <>
          {/* Backdrop - fixed full screen */}
          <div 
            className="fixed inset-0 bg-black/20"
            style={{ zIndex: 9998 }}
            onClick={() => setIsOpen(false)}
          />
          
          {/* Panel - fixed position from top-right */}
          <div 
            className="fixed right-4 top-20 w-80 bg-cyber-dark/95 backdrop-blur-md border border-cyber-cyan/40 
              rounded-lg shadow-2xl overflow-hidden"
            style={{ zIndex: 9999, boxShadow: '0 0 30px rgba(0, 255, 247, 0.2)' }}
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-cyber-cyan/30 flex items-center justify-between bg-cyber-dark/80">
              <h3 className="text-cyber-cyan text-sm font-mono tracking-wider">NOTIFICATIONS</h3>
              {notifications.length > 0 && (
                <button
                  onClick={() => markReadMutation.mutate([])}
                  className="text-[10px] text-cyber-cyan/50 hover:text-cyber-cyan transition-colors"
                >
                  MARK ALL READ
                </button>
              )}
            </div>
            
            {/* Notifications List */}
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <svg className="w-12 h-12 mx-auto text-cyber-cyan/20 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} 
                      d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" 
                    />
                  </svg>
                  <p className="text-cyber-cyan/30 text-sm">No notifications</p>
                </div>
              ) : (
                <div className="divide-y divide-cyber-cyan/10">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`
                        px-4 py-3 hover:bg-cyber-cyan/10 transition-colors
                        ${notification.read ? 'opacity-60' : ''}
                      `}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`
                          p-2 rounded-lg
                          ${notification.type === 'new_trip' 
                            ? 'bg-cyber-cyan/20 text-cyber-cyan' 
                            : 'bg-cyber-magenta/20 text-cyber-magenta'
                          }
                        `}>
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white font-medium truncate">
                            {notification.message}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            {notification.device_id && (
                              <span className="text-[10px] text-cyber-cyan/50 font-mono">
                                {notification.device_id.slice(-8)}
                              </span>
                            )}
                            <span className="text-[10px] text-cyber-cyan/30">
                              {formatTime(notification.created_at)}
                            </span>
                          </div>
                        </div>
                        {!notification.read && (
                          <div className="w-2 h-2 rounded-full bg-cyber-cyan animate-pulse" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  )
}

