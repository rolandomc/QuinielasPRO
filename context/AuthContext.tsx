import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

type Usuario = {
  id: string;
  nombre: string | null;
  username: string | null;
  telefono: string | null;
  es_admin: boolean;
};

type AuthContextType = {
  session: Session | null;
  user: User | null;
  usuario: Usuario | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshUsuario: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  usuario: null,
  loading: true,
  signOut: async () => {},
  refreshUsuario: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUsuario = async (userId: string) => {
    const { data } = await supabase
      .from('usuarios')
      .select('id, nombre, username, telefono, es_admin')
      .eq('id', userId)
      .single();
    if (data) setUsuario(data);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) fetchUsuario(session.user.id);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) fetchUsuario(session.user.id);
      else setUsuario(null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUsuario(null);
  };

  const refreshUsuario = async () => {
    if (session?.user) await fetchUsuario(session.user.id);
  };

  return (
    <AuthContext.Provider value={{
      session,
      user: session?.user ?? null,
      usuario,
      loading,
      signOut,
      refreshUsuario,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
