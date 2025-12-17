'use client'

import { cn } from '@/lib/utils'

interface IllustrationProps {
  className?: string
}

export function SearchIllustration({ className }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('h-32 w-32', className)}
    >
      {/* Document stack */}
      <rect x="20" y="35" width="50" height="65" rx="4" fill="#E7E5E4" />
      <rect x="25" y="30" width="50" height="65" rx="4" fill="#F5F5F4" />
      <rect x="30" y="25" width="50" height="65" rx="4" fill="white" stroke="#D6D3D1" strokeWidth="1.5" />
      
      {/* Document lines */}
      <line x1="38" y1="40" x2="72" y2="40" stroke="#D6D3D1" strokeWidth="2" strokeLinecap="round" />
      <line x1="38" y1="50" x2="65" y2="50" stroke="#E7E5E4" strokeWidth="2" strokeLinecap="round" />
      <line x1="38" y1="60" x2="70" y2="60" stroke="#E7E5E4" strokeWidth="2" strokeLinecap="round" />
      <line x1="38" y1="70" x2="55" y2="70" stroke="#E7E5E4" strokeWidth="2" strokeLinecap="round" />
      
      {/* Magnifying glass */}
      <circle cx="80" cy="65" r="22" fill="white" stroke="#5B72F2" strokeWidth="3" />
      <circle cx="80" cy="65" r="15" fill="#EEF2FF" />
      <line x1="95" y1="82" x2="108" y2="95" stroke="#5B72F2" strokeWidth="4" strokeLinecap="round" />
      
      {/* Sparkle */}
      <circle cx="75" cy="22" r="3" fill="#F59E0B" />
      <path d="M100 35L103 38L100 41L97 38L100 35Z" fill="#10B981" />
    </svg>
  )
}

export function NetworkIllustration({ className }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('h-32 w-32', className)}
    >
      {/* Connection lines */}
      <line x1="60" y1="40" x2="30" y2="60" stroke="#D6D3D1" strokeWidth="2" />
      <line x1="60" y1="40" x2="90" y2="55" stroke="#D6D3D1" strokeWidth="2" />
      <line x1="60" y1="40" x2="60" y2="80" stroke="#5B72F2" strokeWidth="2" />
      <line x1="30" y1="60" x2="40" y2="90" stroke="#D6D3D1" strokeWidth="2" />
      <line x1="90" y1="55" x2="85" y2="85" stroke="#D6D3D1" strokeWidth="2" />
      <line x1="60" y1="80" x2="40" y2="90" stroke="#D6D3D1" strokeWidth="2" />
      <line x1="60" y1="80" x2="85" y2="85" stroke="#D6D3D1" strokeWidth="2" />
      
      {/* Center node (highlighted) */}
      <circle cx="60" cy="40" r="12" fill="#5B72F2" />
      <circle cx="60" cy="40" r="8" fill="#818CF8" />
      
      {/* Secondary nodes */}
      <circle cx="30" cy="60" r="8" fill="white" stroke="#D6D3D1" strokeWidth="2" />
      <circle cx="90" cy="55" r="8" fill="white" stroke="#D6D3D1" strokeWidth="2" />
      <circle cx="60" cy="80" r="10" fill="#F59E0B" opacity="0.2" />
      <circle cx="60" cy="80" r="6" fill="#F59E0B" />
      
      {/* Outer nodes */}
      <circle cx="40" cy="90" r="6" fill="#E7E5E4" />
      <circle cx="85" cy="85" r="6" fill="#E7E5E4" />
      
      {/* Decorative dots */}
      <circle cx="18" cy="45" r="2" fill="#10B981" />
      <circle cx="102" cy="38" r="2" fill="#EC4899" />
    </svg>
  )
}

export function TopicsIllustration({ className }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('h-32 w-32', className)}
    >
      {/* Background circles */}
      <circle cx="60" cy="60" r="45" fill="#F5F5F4" />
      <circle cx="60" cy="60" r="32" fill="white" stroke="#E7E5E4" strokeWidth="1.5" />
      
      {/* Topic bubbles */}
      <circle cx="45" cy="48" r="14" fill="#EEF2FF" stroke="#5B72F2" strokeWidth="2" />
      <circle cx="75" cy="52" r="11" fill="#FEF3C7" stroke="#F59E0B" strokeWidth="2" />
      <circle cx="55" cy="72" r="12" fill="#D1FAE5" stroke="#10B981" strokeWidth="2" />
      <circle cx="78" cy="75" r="8" fill="#FCE7F3" stroke="#EC4899" strokeWidth="2" />
      
      {/* Text indicators */}
      <line x1="40" y1="46" x2="50" y2="46" stroke="#5B72F2" strokeWidth="2" strokeLinecap="round" />
      <line x1="42" y1="50" x2="48" y2="50" stroke="#818CF8" strokeWidth="1.5" strokeLinecap="round" />
      
      <line x1="70" y1="51" x2="80" y2="51" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" />
      
      {/* Trend arrow */}
      <path d="M95 30L105 25L100 35" fill="#10B981" />
      <line x1="85" y1="40" x2="100" y2="28" stroke="#10B981" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function EmptyDataIllustration({ className }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('h-32 w-32', className)}
    >
      {/* Folder */}
      <path
        d="M20 35C20 32.2386 22.2386 30 25 30H45L52 38H95C97.7614 38 100 40.2386 100 43V85C100 87.7614 97.7614 90 95 90H25C22.2386 90 20 87.7614 20 85V35Z"
        fill="#F5F5F4"
        stroke="#D6D3D1"
        strokeWidth="1.5"
      />
      
      {/* Folder tab highlight */}
      <path d="M20 35C20 32.2386 22.2386 30 25 30H45L52 38H20V35Z" fill="#E7E5E4" />
      
      {/* Empty state indicator */}
      <circle cx="60" cy="62" r="15" fill="white" stroke="#D6D3D1" strokeWidth="1.5" strokeDasharray="4 4" />
      <circle cx="60" cy="62" r="4" fill="#D6D3D1" />
      
      {/* Decorative elements */}
      <circle cx="35" cy="22" r="3" fill="#5B72F2" opacity="0.5" />
      <circle cx="90" cy="28" r="2" fill="#F59E0B" opacity="0.5" />
    </svg>
  )
}

export function ChartIllustration({ className }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('h-32 w-32', className)}
    >
      {/* Axes */}
      <line x1="25" y1="90" x2="95" y2="90" stroke="#D6D3D1" strokeWidth="2" strokeLinecap="round" />
      <line x1="25" y1="90" x2="25" y2="25" stroke="#D6D3D1" strokeWidth="2" strokeLinecap="round" />
      
      {/* Bars */}
      <rect x="32" y="70" width="10" height="20" rx="2" fill="#EEF2FF" />
      <rect x="47" y="55" width="10" height="35" rx="2" fill="#C7D2FE" />
      <rect x="62" y="40" width="10" height="50" rx="2" fill="#818CF8" />
      <rect x="77" y="50" width="10" height="40" rx="2" fill="#5B72F2" />
      
      {/* Trend line */}
      <path
        d="M37 68L52 52L67 38L82 45"
        stroke="#10B981"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      
      {/* Data points */}
      <circle cx="37" cy="68" r="3" fill="#10B981" />
      <circle cx="52" cy="52" r="3" fill="#10B981" />
      <circle cx="67" cy="38" r="3" fill="#10B981" />
      <circle cx="82" cy="45" r="3" fill="#10B981" />
      
      {/* Labels */}
      <rect x="20" y="20" width="25" height="8" rx="2" fill="#F5F5F4" />
    </svg>
  )
}

