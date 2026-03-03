import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

import { getAuth, onAuthStateChanged } from 'firebase/auth';

export const UserAvatarContext = createContext<{
  avatarUrl: string;
  setAvatarUrl: (url: string) => void;
}>({
  avatarUrl: '/avatar.png',
  setAvatarUrl: () => {},
});

export const useUserAvatar = () => useContext(UserAvatarContext);

export const UserAvatarProvider = ({ children }: { children: ReactNode }) => {
  const [avatarUrl, setAvatarUrl] = useState<string>('/avatar.png');

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user?.photoURL) {
        setAvatarUrl(user.photoURL);
      } else {
        setAvatarUrl('/avatar.png');
      }
    });
    return () => unsubscribe();
  }, []);

  return (
    <UserAvatarContext.Provider value={{ avatarUrl, setAvatarUrl }}>
      {children}
    </UserAvatarContext.Provider>
  );
};
