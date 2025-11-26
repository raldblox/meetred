'use client'

import { Disclosure } from '@headlessui/react'
import { Link } from '@heroui/react'
import Image from 'next/image'
import { usePathname } from 'next/navigation'

const navigationItems = [{ name: 'Source', href: 'https://github.com/libp2p/universal-connectivity' }]

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ')
}

export default function Navigation({ connectionInfoButton }: { connectionInfoButton?: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <Disclosure as="nav" className="border-b border-gray-200 bg-white">
      {({ open }) => (
        <>
          <div className="mx-auto w-full px-4 sm:px-6 lg:px-8">
            <div className="flex h-16 justify-between items-center">
              <div className="flex items-center">
                <div className="flex flex-shrink-0 items-center">
                  <Image alt="libp2p logo" height="24" src="/libp2p-logo.svg" width="24" />
                  <div className="ml-3 flex items-center">
                    <h1 className="text-xl font-semibold text-gray-900 hidden sm:block">Universal Connectivity</h1>
                    <Image
                      alt="libp2p hero"
                      className="ml-2 hidden sm:block"
                      height="24"
                      src="/libp2p-hero.svg"
                      width="24"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <div className="flex space-x-4">
                  {navigationItems.map((item, i) => (
                    <Link key={i} href={item.href} color={pathname === item.href ? 'secondary' : 'foreground'}>
                      {item.name}
                    </Link>
                  ))}
                </div>
                <div className="flex items-center">{connectionInfoButton}</div>
              </div>
            </div>
          </div>
        </>
      )}
    </Disclosure>
  )
}
