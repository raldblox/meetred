'use client'

import { Navbar as HeroUINavbar, NavbarContent, NavbarBrand, NavbarItem } from '@heroui/navbar'
import NextLink from 'next/link'
import { Button, Tooltip } from '@heroui/react'
import { Earth, MessagesSquare, Radio, Video, Bot, EarthLock } from 'lucide-react'

import { NewIdentityButton } from '../chat/identity-manager'
import { InviteButton } from '../chat/invite-modal'
import { HelpLauncher } from '../chat/help-launcher'

import { UI_COPY } from '@/config/copy'
import { useLibp2pContext } from '@/context/libp2p-ctx'
import { Logo } from './icons'

export const Navbar = () => {
  const { libp2p } = useLibp2pContext()
  const selfId = libp2p.peerId?.toString() ?? ''

  const navLinks = [
    { label: UI_COPY.nav.chat, href: '/', icon: MessagesSquare, tooltip: UI_COPY.tooltips.nav.chat },
    {
      label: UI_COPY.nav.stream,
      href: selfId ? `/stream/${selfId}` : '/stream',
      icon: Radio,
      tooltip: UI_COPY.tooltips.nav.stream,
    },
    {
      label: UI_COPY.nav.call,
      href: selfId ? `/room/${selfId}` : '/room',
      icon: Video,
      tooltip: UI_COPY.tooltips.nav.call,
    },
    {
      label: UI_COPY.nav.ai,
      href: selfId ? `/agent/${selfId}` : '/agent',
      icon: Bot,
      tooltip: UI_COPY.tooltips.nav.ai,
    },
  ]

  return (
    <HeroUINavbar
      classNames={{ base: '!p-6', wrapper: 'container !p-0 h-fit lg:grid lg:grid-cols-6 lg:items-center', content: '' }}
      maxWidth="full"
      position="static"
    >
      <NavbarContent className="basis-auto lg:basis-auto lg:col-span-1" justify="start">
        <NavbarBrand as="li" className="max-w-fit">
          <NextLink
            className="flex rounded-sm aspect-square h-12 justify-center bg-primary/30 gap-2 p-2 items-center"
            href="/"
          >
            {/* <h1 className="h-7 font-semibold text-primary">red</h1> */}
            {/* <EarthLock className="h-7 text-primary" /> */}
            <Logo className="text-primary shadow" size={20} />
          </NextLink>
        </NavbarBrand>

        {/* <ul className="hidden lg:flex gap-1 justify-start ml-2">
          {siteConfig.navItems.map((item) => (
            <NavbarItem key={item.href}>
              <Button
                as={NextLink}
                className="h-7 hover:bg-primary"
                href={item.href}
                radius="none"
                size="sm"
                variant="flat"
              >
                {item.label}
              </Button>
            </NavbarItem>
          ))}
        </ul> */}
      </NavbarContent>
      <NavbarContent className="hidden lg:flex lg:col-span-2 lg:col-start-2" justify="start">
        <div className="flex flex-col text-xs gap-2">
          <h1 className="font-semibold text-foreground leading-0 text-sm">Meetred.</h1>
          <span className="leading-tight text-default-400">Live rooms. Paid by time.</span>
        </div>
      </NavbarContent>

      <NavbarContent
        className="hidden items-center sm:flex basis-1/5 gap-1.5 sm:basis-full lg:col-span-3"
        justify="end"
      >
        <ul className="hidden h-12 lg:flex gap-1 bg-default-100 p-1.5 rounded-sm justify-start items-center ml-2">
          {navLinks.map((item) => (
            <NavbarItem key={item.href}>
              <Tooltip content={item.tooltip} placement="bottom" radius="sm">
                <Button
                  as={NextLink}
                  className="!p-3 h-10 !text-tiny text-foreground bg-default-50 rounded-sm hover:bg-primary"
                  color="primary"
                  href={item.href}
                  radius="lg"
                  size="sm"
                  startContent={<item.icon className="h-4 w-4" />}
                  variant="flat"
                >
                  {item.label}
                </Button>
              </Tooltip>
            </NavbarItem>
          ))}
          <NavbarItem className="hidden md:flex">
            <Tooltip content={UI_COPY.tooltips.nav.invite} placement="bottom" radius="sm">
              <div>
                <InviteButton />
              </div>
            </Tooltip>
          </NavbarItem>
          <NavbarItem className="hidden md:flex">
            <HelpLauncher compact />
          </NavbarItem>
        </ul>
        {/* <NavbarItem className="hidden sm:flex gap-2">
          <Link isExternal aria-label="Github" href={siteConfig.links.github}>
            <GithubIcon className="text-default-500" />
          </Link>
          <ThemeSwitch />
        </NavbarItem> */}
        {/* <NavbarItem className="hidden lg:flex">{searchInput}</NavbarItem> */}
        {/* <NavbarItem className="hidden md:flex">
          <InviteButton />
        </NavbarItem> */}
        <NavbarItem className="hidden md:flex">
          <Tooltip content={UI_COPY.tooltips.nav.identity} placement="bottom" radius="sm">
            <div>
              <NewIdentityButton />
            </div>
          </Tooltip>
        </NavbarItem>
      </NavbarContent>

      <NavbarContent className="sm:hidden basis-1 gap-1" justify="end">
        {/* <InviteButton /> */}
        <NewIdentityButton variant="icon" />
        {/* <ThemeSwitch /> */}
      </NavbarContent>
    </HeroUINavbar>
  )
}
