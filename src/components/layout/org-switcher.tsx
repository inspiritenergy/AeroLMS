'use client';

import Image from 'next/image';

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem
} from '@/components/ui/sidebar';

// Značka nahoře v postranním panelu: široké logo, ve sbaleném panelu jen znak.
// Logo je kreslené pro světlé pozadí, v tmavém motivu se proto vykresluje bíle (filtr nad týmž souborem).
export function OrgSwitcher() {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          size='lg'
          className='data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground h-15'
        >
          <span className='flex -translate-y-[5px] items-center group-data-[collapsible=icon]:hidden'>
            <Image
              src='/atc-space-logo.png'
              alt='ATC Space'
              width={320}
              height={100}
              className='h-11 w-auto dark:brightness-0 dark:invert'
              priority
            />
          </span>
          <Image
            src='/atc-space-emblem.png'
            alt='ATC Space'
            width={32}
            height={32}
            className='hidden size-8 group-data-[collapsible=icon]:block dark:brightness-0 dark:invert'
          />
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
