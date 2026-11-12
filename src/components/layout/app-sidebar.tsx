// src/components/layout/app-sidebar.tsx
'use client';

import * as React from 'react';
import { ROLES, isAdmin, isTrainer } from '@/types/roles';
import { getFullNameSafe } from '@/lib/user-helpers';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail
} from '@/components/ui/sidebar';
import { UserAvatarProfile } from '@/components/layout/user-avatar-profile';
import { navItems as staticNavItems } from '@/constants/data';
import { NavItem } from '@/types';

import {
  IconChevronRight,
  IconChevronsDown,
  IconLogout,
  IconMoon,
  IconSun,
  IconUserCircle
} from '@tabler/icons-react';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { Icons } from '../ui/icons';
import { OrgSwitcher } from './org-switcher';

import { useSession, signOut } from 'next-auth/react';

export default function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  // Next-Auth session
  const { data: session } = useSession();
  const user = session?.user ?? null;

  // State pro dynamické menu items
  const [navItems, setNavItems] = React.useState<NavItem[]>(staticNavItems);
  const [adminNavItems, setAdminNavItems] = React.useState<NavItem[]>([]);
  const [trainerNavItems, setTrainerNavItems] = React.useState<NavItem[]>([]);

  // Check user role
  const userRole = session?.user?.role || ROLES.WORKER;
  const hasAdminAccess = isAdmin(userRole);
  const hasTrainerAccess = isTrainer(userRole);

  // Načti školení z API
  React.useEffect(() => {
    const fetchTrainings = async () => {
      if (!session) return;

      try {
        const response = await fetch('/api/trainings');
        if (response.ok) {
          const data = await response.json();

          // Kombinuj statické položky s dynamickými školeními
          const dynamicNavItems: NavItem[] = [
            staticNavItems[0], // Přehled
            ...data.trainings.map((training: any) => ({
              title: training.name,
              url: training.url,
              icon: training.icon,
              isActive: false,
              items: []
            }))
          ];

          // Vytvoř admin menu items pouze pro admina
          if (hasAdminAccess) {
            const adminItems: NavItem[] = [
              {
                title: 'Admin přehled',
                url: '/admin/prehled',
                icon: 'settings',
                isActive: false,
                items: []
              },
              {
                title: 'Správa přiřazení',
                url: '/admin/assignments',
                icon: 'user',
                isActive: false,
                items: []
              },
              {
                title: 'Smazaná data',
                url: '/admin/smazana-data',
                icon: 'trash',
                isActive: false,
                items: []
              }
            ];
            setAdminNavItems(adminItems);
          }

          // Vytvoř trainer menu items pro školitele
          if (hasTrainerAccess) {
            const trainerItems: NavItem[] = [
              {
                title: 'Moje školení',
                url: '/trainer',
                icon: 'page',
                isActive: false,
                items: []
              },
              {
                title: 'První testy',
                url: '/trainer/prvni-testy',
                icon: 'add',
                isActive: false,
                items: []
              },
              {
                title: 'Výsledky testů',
                url: '/trainer/vysledky',
                icon: 'check',
                isActive: false,
                items: []
              }
            ];
            setTrainerNavItems(trainerItems);
          }

          setNavItems(dynamicNavItems);
        }
      } catch {
        // Silently fail - nav items will remain at default
      }
    };

    fetchTrainings();
  }, [session, hasAdminAccess, hasTrainerAccess]);

  return (
    <Sidebar collapsible='icon'>
      {/* ---------- HLAVIČKA ---------- */}
      <SidebarHeader>
        <OrgSwitcher />
      </SidebarHeader>

      {/* ---------- OBSAH ---------- */}
      <SidebarContent className='overflow-x-hidden'>
        {/* Admin Menu - zobrazí se jen pro admina */}
        {adminNavItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Admin Menu</SidebarGroupLabel>
            <SidebarMenu>
              {adminNavItems.map((item) => {
                const Icon = item.icon ? Icons[item.icon] : Icons.logo;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      tooltip={item.title}
                      isActive={pathname === item.url}
                    >
                      <Link href={item.url}>
                        <Icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        )}

        {/* Trainer Menu - zobrazí se jen pro školitele */}
        {trainerNavItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Školitel Menu</SidebarGroupLabel>
            <SidebarMenu>
              {trainerNavItems.map((item) => {
                const Icon = item.icon ? Icons[item.icon] : Icons.logo;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      tooltip={item.title}
                      isActive={pathname === item.url}
                    >
                      <Link href={item.url}>
                        <Icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        )}

        {/* Moje školení - požadovaná školení pro všechny role */}
        {(
          <SidebarGroup>
            <SidebarGroupLabel>Moje školení</SidebarGroupLabel>
            <SidebarMenu>
              {navItems.map((item) => {
                const Icon = item.icon ? Icons[item.icon] : Icons.logo;

                return item.items?.length ? (
                  <Collapsible
                    key={item.title}
                    asChild
                    defaultOpen={item.isActive}
                    className='group/collapsible'
                  >
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton
                          tooltip={item.title}
                          isActive={pathname === item.url}
                        >
                          {item.icon && <Icon />}
                          <span>{item.title}</span>
                          <IconChevronRight className='ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90' />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>

                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {item.items.map((sub) => (
                            <SidebarMenuSubItem key={sub.title}>
                              <SidebarMenuSubButton
                                asChild
                                isActive={pathname === sub.url}
                              >
                                <Link href={sub.url}>{sub.title}</Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                ) : (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      tooltip={item.title}
                      isActive={pathname === item.url}
                    >
                      <Link href={item.url}>
                        <Icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        )}
      </SidebarContent>

      {/* ---------- FOOTER ---------- */}
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size='lg'
                  className='data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground cursor-pointer'
                >
                  {user && (
                    <UserAvatarProfile
                      className='h-8 w-8 rounded-lg'
                      showInfo
                      /* adaptace pro Next-Auth: předáme jméno z firstName/lastName */
                      user={{
                        fullName: getFullNameSafe({
                          firstName: user.firstName,
                          lastName: user.lastName
                        }, 'User'),
                        imageUrl: (user as any).image ?? undefined
                      }}
                    />
                  )}
                  <IconChevronsDown className='ml-auto size-4' />
                </SidebarMenuButton>
              </DropdownMenuTrigger>

              <DropdownMenuContent
                className='w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg'
                side='bottom'
                align='end'
                sideOffset={4}
              >
                <DropdownMenuLabel className='p-0 font-normal'>
                  <div className='px-1 py-1.5'>
                    {user && (
                      <UserAvatarProfile
                        className='h-8 w-8 rounded-lg'
                        showInfo
                        user={{
                          fullName: getFullNameSafe({
                            firstName: user.firstName,
                            lastName: user.lastName
                          }, 'User'),
                          imageUrl: (user as any).image ?? undefined
                        }}
                      />
                    )}
                  </div>
                </DropdownMenuLabel>

                <DropdownMenuSeparator />

                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={() => router.push('/profil')} className='cursor-pointer'>
                    <IconUserCircle className='mr-2 h-4 w-4' />
                    Profil uživatele
                  </DropdownMenuItem>
                </DropdownMenuGroup>

                <DropdownMenuSeparator />

                <DropdownMenuGroup>
                  <DropdownMenuItem
                    onClick={() =>
                      setTheme(theme === 'dark' ? 'light' : 'dark')
                    }
                    className='cursor-pointer'
                  >
                    {theme === 'dark' ? (
                      <IconSun className='mr-2 h-4 w-4' />
                    ) : (
                      <IconMoon className='mr-2 h-4 w-4' />
                    )}
                    {theme === 'dark' ? 'Světlý režim' : 'Tmavý režim'}
                  </DropdownMenuItem>
                </DropdownMenuGroup>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  onClick={() => signOut({ callbackUrl: '/login' })}
                  className='cursor-pointer'
                >
                  <IconLogout className='mr-2 h-4 w-4' />
                  Odhlásit
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
