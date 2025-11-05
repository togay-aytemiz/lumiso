import { useContext } from 'react';
import { ProfileContext } from '@/contexts/profile-context';

export function useProfile() {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
}
