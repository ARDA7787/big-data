'use client'

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

export function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return '0'
  if (value < 1000) return String(value)
  if (value < 1000000) return `${(value / 1000).toFixed(1).replace(/\.0$/, '')}k`
  if (value < 1000000000) return `${(value / 1000000).toFixed(1).replace(/\.0$/, '')}m`
  return new Intl.NumberFormat('en-US').format(value)
}

export function truncate(text: string | null | undefined, maxLength: number): string {
  if (!text) return ''
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength).trim() + '...'
}
