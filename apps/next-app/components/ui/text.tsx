import { clsx } from 'clsx'
import Link from 'next/link'

export function Text({ className, ...props }: React.ComponentPropsWithoutRef<'p'>) {
  return <p {...props} className={clsx(className, 'text-base/6 text-default-500 sm:text-sm/6')} data-slot="text" />
}

export function TextLink({ className, ...props }: React.ComponentPropsWithoutRef<typeof Link>) {
  return (
    <Link
      {...props}
      className={clsx(className, 'text-primary underline decoration-primary/50 data-[hover]:decoration-primary')}
    />
  )
}

export function Strong({ className, ...props }: React.ComponentPropsWithoutRef<'strong'>) {
  return <strong {...props} className={clsx(className, 'font-medium text-default-900')} />
}

export function Code({ className, ...props }: React.ComponentPropsWithoutRef<'code'>) {
  return (
    <code
      {...props}
      className={clsx(
        className,
        'rounded border border-default-100 bg-default-100 px-0.5 text-sm font-medium text-default-900 sm:text-[0.8125rem]',
      )}
    />
  )
}
