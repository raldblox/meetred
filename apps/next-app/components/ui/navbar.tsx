import { Navbar as HeroUINavbar, NavbarContent, NavbarBrand, NavbarItem } from '@heroui/navbar'
import NextLink from 'next/link'
import { Button } from '@heroui/react'
import { Earth } from 'lucide-react'

import { NewIdentityButton } from '../chat/identity-manager'
import { InviteButton } from '../chat/invite-modal'

import { siteConfig } from '@/config/site'
import { ThemeSwitch } from '@/components/ui/theme-switch'

export const Navbar = () => {
  return (
    <HeroUINavbar
      classNames={{ base: '!p-6', wrapper: 'container !p-0 h-fit', content: '' }}
      maxWidth="full"
      position="static"
    >
      <NavbarContent className="basis-1/5 sm:basis-full" justify="start">
        <NavbarBrand as="li" className="max-w-fit">
          <NextLink
            className="flex rounded-sm aspect-square h-12 justify-center bg-primary gap-2 p-2 items-center"
            href="/"
          >
            <Earth className="h-7 text-background" />
            {/* <Logo className="text-background" size={16} /> */}
            {/* <div className="flex items-center text-lg justify-center gap-0.25">
              <h1 className="leading-0">meet</h1>
              <span className="font-bold p-0 m-0 leading-0 trac">red</span>
            </div> */}
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

      <NavbarContent className="hidden items-center sm:flex basis-1/5 gap-1.5 sm:basis-full" justify="end">
        <ul className="hidden h-12 lg:flex gap-1 bg-default-100 p-1.5 rounded-sm justify-start items-center ml-2">
          {siteConfig.navItems.map((item) => (
            <NavbarItem key={item.href}>
              <Button
                as={NextLink}
                className="!p-3 h-10 !text-tiny text-foreground bg-default-50 rounded-sm hover:bg-primary"
                color="primary"
                href={item.href}
                radius="lg"
                size="sm"
                variant="flat"
              >
                {item.label}
              </Button>
            </NavbarItem>
          ))}
          <NavbarItem className="hidden md:flex">
            <InviteButton />
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
          <NewIdentityButton />
        </NavbarItem>
      </NavbarContent>

      <NavbarContent className="sm:hidden basis-1 gap-1" justify="end">
        {/* <InviteButton /> */}
        <NewIdentityButton variant="icon" />
        <ThemeSwitch />
      </NavbarContent>
    </HeroUINavbar>
  )
}
