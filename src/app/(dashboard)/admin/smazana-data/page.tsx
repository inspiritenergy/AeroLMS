import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdmin } from '@/types/roles';
import DeletedDataClient from './deleted-data-client';

export const metadata = {
  title: 'Správa smazaných dat | ATC-LMS Admin',
  description: 'Správa soft-deleted školení a souvisejících dat'
};

export default async function DeletedDataPage() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    redirect('/login');
  }

  if (!isAdmin(session.user.role)) {
    redirect('/');
  }

  return <DeletedDataClient />;
}
