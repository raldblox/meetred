import type React from 'react'

import clsx from 'clsx'
import Link from 'next/link'

const baseButtonClasses =
  'inline-flex items-center gap-2 rounded-lg border border-default-200 bg-white px-3 py-2 text-sm font-semibold text-default-700 transition hover:bg-default-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-default-400 dark:bg-default-50/60'

type PaginationControlProps = {
  href?: string | null
  ariaLabel: string
  className?: string
  children: React.ReactNode
}

function PaginationControl({ href, ariaLabel, className, children }: PaginationControlProps) {
  if (!href) {
    return (
      <span aria-disabled="true" className={clsx(baseButtonClasses, className, 'cursor-not-allowed opacity-50')}>
        {children}
      </span>
    )
  }

  return (
    <Link aria-label={ariaLabel} className={clsx(baseButtonClasses, className)} href={href}>
      {children}
    </Link>
  )
}

export function Pagination({
  'aria-label': ariaLabel = 'Page navigation',
  className,
  ...props
}: React.ComponentPropsWithoutRef<'nav'>) {
  return <nav aria-label={ariaLabel} {...props} className={clsx(className, 'flex gap-x-2')} />
}

export function PaginationPrevious({
  href = null,
  children = 'Previous',
}: {
  href?: string | null
  children?: React.ReactNode
}) {
  return (
    <span className="grow basis-0">
      <PaginationControl ariaLabel="Previous page" className="justify-start" href={href}>
        <svg aria-hidden="true" className="stroke-current" fill="none" viewBox="0 0 16 16">
          <path
            d="M2.75 8H13.25M2.75 8L5.25 5.5M2.75 8L5.25 10.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
          />
        </svg>
        {children}
      </PaginationControl>
    </span>
  )
}

export function PaginationNext({
  href = null,
  children = 'Next',
}: {
  href?: string | null
  children?: React.ReactNode
}) {
  return (
    <span className="flex grow basis-0 justify-end">
      <PaginationControl ariaLabel="Next page" className="justify-end" href={href}>
        {children}
        <svg aria-hidden="true" className="stroke-current" fill="none" viewBox="0 0 16 16">
          <path
            d="M13.25 8L2.75 8M13.25 8L10.75 10.5M13.25 8L10.75 5.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
          />
        </svg>
      </PaginationControl>
    </span>
  )
}

export function PaginationList({ children }: { children: React.ReactNode }) {
  return <span className="hidden items-baseline gap-x-2 sm:flex">{children}</span>
}

export function PaginationPage({
  href,
  children,
  current = false,
}: {
  href: string
  children: string
  current?: boolean
}) {
  return (
    <PaginationControl
      ariaLabel={`Page ${children}`}
      className={clsx(
        'justify-center before:absolute before:-inset-px before:rounded-lg',
        current && 'before:bg-zinc-950/5 dark:before:bg-white/10',
      )}
      href={href}
    >
      <span aria-current={current ? 'page' : undefined} className="-mx-0.5">
        {children}
      </span>
    </PaginationControl>
  )
}

export function PaginationGap() {
  return (
    <div
      aria-hidden="true"
      className="w-[2.25rem] select-none text-center text-sm/6 font-semibold text-zinc-950 dark:text-white"
    >
      &hellip;
    </div>
  )
}
