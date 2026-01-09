'use client'

import { AnimatePresence } from 'framer-motion'
import { motion } from 'framer-motion'

import { Navbar } from '@/components/ui/navbar'

export default function Grid({
  main,
  panel,
  footer,
}: {
  main: React.ReactNode
  panel?: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <AnimatePresence>
      <motion.div
        animate={{ opacity: 1 }}
        className="relative text-foreground bg-background flex flex-col h-screen overflow-y-scroll md:overflow-y-hidden"
        exit={{ opacity: 1 }}
        initial={{ opacity: 0 }}
        layout="position"
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <Navbar />
        <main className="bg-background border-default-100 w-full flex flex-col flex-grow min-h-0">{main}</main>
        {panel}
        {footer}
      </motion.div>
    </AnimatePresence>
  )
}
