'use client';

import Image from 'next/image';

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem
} from '@/components/ui/sidebar';

// Značka nahoře v postranním panelu: široké logo, ve sbaleném panelu jen znak.
// Logo je kreslené pro světlé pozadí, v tmavém motivu proto leží na bílé podložce.
export function OrgSwitcher() {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          size='lg'
          className='data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground h-15'
        >
          <span className='flex -translate-y-[5px] items-center rounded-md group-data-[collapsible=icon]:hidden dark:bg-white dark:px-2 dark:py-1'>
            <Image
              src='/atc-space-logo.png'
              alt='ATC Space'
              width={320}
              height={100}
              className='h-11 w-auto dark:h-9'
              priority
            />
          </span>
          <Image
            src='/atc-space-emblem.png'
            alt='ATC Space'
            width={32}
            height={32}
            className='hidden size-8 group-data-[collapsible=icon]:block'
          />
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
