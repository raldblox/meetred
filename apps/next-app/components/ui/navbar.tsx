import { Navbar as HeroUINavbar, NavbarContent, NavbarBrand, NavbarItem } from '@heroui/navbar'
import NextLink from 'next/link'
import { Button, Link } from '@heroui/react'
import Image from 'next/image'

import { NewIdentityButton } from '../chat/identity-manager'
import { InviteButton } from '../chat/invite-modal'

import { siteConfig } from '@/config/site'
import { ThemeSwitch } from '@/components/ui/theme-switch'
import { GithubIcon } from '@/components/ui/icons'

export const Navbar = () => {
  return (
    <HeroUINavbar classNames={{ base: '', wrapper: '!px-3 !py-0 h-10', content: '' }} maxWidth="full" position="static">
      <NavbarContent className="basis-1/5 sm:basis-full" justify="start">
        <NavbarBrand as="li" className="gap-3 max-w-fit">
          <NextLink className="flex justify-start items-center gap-2" href="/">
            <Image alt="metered logo" className={`text-foreground`} height="16" src="/metered.svg" width="16" />
            <div className="space-x-0.5 flex items-center uppercase">
              {/* <span className="text-foreground font-bold bg-primary rounded-full h-2 w-2" /> */}
              <h1 className="font-bold tracking-wide text-inherit leading-0 ">Meetred</h1>
              {/* <span className="text-foreground font-bold bg-primary rounded-sm px-1 leading-none py-0.5"></span> */}
            </div>
          </NextLink>
        </NavbarBrand>
        <ul className="hidden lg:flex gap-1 justify-start ml-2">
          {siteConfig.navItems.map((item) => (
            <NavbarItem key={item.href}>
              <Button as={NextLink} className="h-7 border-1" href={item.href} size="sm" variant="ghost">
                {item.label}
              </Button>
            </NavbarItem>
          ))}
        </ul>
      </NavbarContent>

      <NavbarContent className="hidden sm:flex basis-1/5 gap-1 sm:basis-full" justify="end">
        <NavbarItem className="hidden sm:flex gap-2">
          <Link isExternal aria-label="Github" href={siteConfig.links.github}>
            <GithubIcon className="text-default-500" />
          </Link>
          <ThemeSwitch />
        </NavbarItem>
        {/* <NavbarItem className="hidden lg:flex">{searchInput}</NavbarItem> */}
        <NavbarItem className="hidden md:flex">
          <InviteButton />
        </NavbarItem>
        <NavbarItem className="hidden md:flex">
          <NewIdentityButton />
        </NavbarItem>
      </NavbarContent>

      <NavbarContent className="sm:hidden basis-1 gap-1" justify="end">
        <InviteButton />
        <NewIdentityButton variant="icon" />

        <ThemeSwitch />
      </NavbarContent>
    </HeroUINavbar>
  )
}
