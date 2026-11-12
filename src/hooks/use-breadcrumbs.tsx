'use client';

import { usePathname } from 'next/navigation';
import { useMemo } from 'react';
import { navItems } from '@/constants/data';

type BreadcrumbItem = {
  title: string;
  link: string;
};

export function useBreadcrumbs() {
  const pathname = usePathname();

  const breadcrumbs = useMemo(() => {
    // Always start with AeroLMS
    const baseBreadcrumb: BreadcrumbItem = {
      title: 'ATC-LMS',
      link: '/'
    };

    // Find matching nav item from sidebar data
    const matchingNavItem = navItems.find((item) => item.url === pathname);

    if (matchingNavItem) {
      // Return AeroLMS / [Nav Item Title]
      return [
        baseBreadcrumb,
        {
          title: matchingNavItem.title,
          link: matchingNavItem.url
        }
      ];
    }

    // Check for nested items if needed
    for (const navItem of navItems) {
      if (navItem.items && navItem.items.length > 0) {
        const nestedItem = navItem.items.find((item) => item.url === pathname);
        if (nestedItem) {
          return [
            baseBreadcrumb,
            {
              title: navItem.title,
              link: navItem.url
            },
            {
              title: nestedItem.title,
              link: nestedItem.url
            }
          ];
        }
      }
    }

    // Fallback if no match found - just show AeroLMS
    return [baseBreadcrumb];
  }, [pathname]);

  return breadcrumbs;
}
