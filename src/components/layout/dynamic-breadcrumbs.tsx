'use client';

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from '@/components/ui/breadcrumb';
import { IconSlash } from '@tabler/icons-react';
import { Fragment, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

type BreadcrumbItem = {
  title: string;
  link: string;
};

export function DynamicBreadcrumbs() {
  const pathname = usePathname();
  const [items, setItems] = useState<BreadcrumbItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBreadcrumbs = async () => {
      // Always start with AeroLMS
      const breadcrumbs: BreadcrumbItem[] = [{ title: 'ATC-LMS', link: '/' }];

      // Parse the pathname
      const segments = pathname.split('/').filter(Boolean);

      // Special routes that are not trainings
      const specialRoutes: Record<string, string> = {
        'trainer': 'Školitel',
        'admin': 'Administrace',
        'profil': 'Profil',
        'login': 'Přihlášení'
      };

      // If we're on a training page
      if (segments.length > 0) {
        const slug = segments[0];

        // Check if it's a special route first
        if (specialRoutes[slug]) {
          breadcrumbs.push({
            title: specialRoutes[slug],
            link: `/${slug}`
          });
        } else {
          // It's a training page - fetch from API
          try {
            // Fetch training name from API
            const response = await fetch(`/api/trainings/slug/${slug}`);
            if (response.ok) {
              const training = await response.json();
              breadcrumbs.push({
                title: training.name,
                link: `/${slug}`
              });
            }
          } catch (error) {
            // Fallback to formatted slug if API fails
            const title = slug
              .split('-')
              .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ');
            breadcrumbs.push({
              title,
              link: `/${slug}`
            });
          }
        }
      }

      setItems(breadcrumbs);
      setLoading(false);
    };

    fetchBreadcrumbs();
  }, [pathname]);

  if (loading || items.length === 0) return null;

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {items.map((item, index) => (
          <Fragment key={item.title}>
            {index !== items.length - 1 && (
              <BreadcrumbItem className='hidden md:block'>
                <BreadcrumbLink href={item.link}>{item.title}</BreadcrumbLink>
              </BreadcrumbItem>
            )}
            {index < items.length - 1 && (
              <BreadcrumbSeparator className='hidden md:block'>
                <IconSlash />
              </BreadcrumbSeparator>
            )}
            {index === items.length - 1 && (
              <BreadcrumbPage>{item.title}</BreadcrumbPage>
            )}
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
