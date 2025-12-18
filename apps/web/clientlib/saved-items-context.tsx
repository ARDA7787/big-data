'use client'

import React, { createContext, useContext, useMemo, useState, useEffect } from 'react'
import type { RankedPaper, RankedAuthor } from './api'

interface SavedItemsContextValue {
  savedPapers: RankedPaper[]
  savedAuthors: RankedAuthor[]
  toggleSavedPaper: (paper: RankedPaper) => void
  toggleSavedAuthor: (author: RankedAuthor) => void
  isSavedPaper: (id: string) => boolean
  isSavedAuthor: (id: string) => boolean
}

const SavedItemsContext = createContext<SavedItemsContextValue | undefined>(undefined)

const PAPERS_KEY = 'sg_saved_papers'
const AUTHORS_KEY = 'sg_saved_authors'

export function SavedItemsProvider({ children }: { children: React.ReactNode }) {
  const [savedPapers, setSavedPapers] = useState<RankedPaper[]>([])
  const [savedAuthors, setSavedAuthors] = useState<RankedAuthor[]>([])

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const p = JSON.parse(localStorage.getItem(PAPERS_KEY) || '[]')
      const a = JSON.parse(localStorage.getItem(AUTHORS_KEY) || '[]')
      setSavedPapers(Array.isArray(p) ? p : [])
      setSavedAuthors(Array.isArray(a) ? a : [])
    } catch {
      // ignore
    }
  }, [])

  // Persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(PAPERS_KEY, JSON.stringify(savedPapers))
      localStorage.setItem(AUTHORS_KEY, JSON.stringify(savedAuthors))
    } catch {
      // ignore
    }
  }, [savedPapers, savedAuthors])

  const toggleSavedPaper = (paper: RankedPaper) => {
    setSavedPapers((prev: RankedPaper[]) => {
      const exists = prev.some((p: RankedPaper) => p.work_id === paper.work_id)
      return exists ? prev.filter((p: RankedPaper) => p.work_id !== paper.work_id) : [paper, ...prev]
    })
  }

  const toggleSavedAuthor = (author: RankedAuthor) => {
    setSavedAuthors((prev: RankedAuthor[]) => {
      const exists = prev.some((a: RankedAuthor) => a.author_id === author.author_id)
      return exists ? prev.filter((a: RankedAuthor) => a.author_id !== author.author_id) : [author, ...prev]
    })
  }

  const isSavedPaper = (id: string) => savedPapers.some((p: RankedPaper) => p.work_id === id)
  const isSavedAuthor = (id: string) => savedAuthors.some((a: RankedAuthor) => a.author_id === id)

  const value = useMemo(
    () => ({ savedPapers, savedAuthors, toggleSavedPaper, toggleSavedAuthor, isSavedPaper, isSavedAuthor }),
    [savedPapers, savedAuthors]
  )

  return <SavedItemsContext.Provider value={value}>{children}</SavedItemsContext.Provider>
}

export function useSavedItems() {
  const ctx = useContext(SavedItemsContext)
  if (!ctx) throw new Error('useSavedItems must be used within SavedItemsProvider')
  return ctx
}
