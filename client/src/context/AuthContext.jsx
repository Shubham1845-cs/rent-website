import { createContext, useContext, useReducer, useEffect } from 'react';

export const AuthContext = createContext(null);

const initialState = { user: null, token: null };

function authReducer(state, action) {
  switch (action.type) {
    case 'LOGIN':
      return { user: action.payload.user, token: action.payload.token };
    case 'LOGOUT':
      return initialState;
    default:
      return state;
  }
}

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, initialState, () => {
    // Re-hydrate from localStorage on mount
    try {
      const token = localStorage.getItem('token');
      const user = JSON.parse(localStorage.getItem('user') || 'null');
      if (token && user) return { token, user };
    } catch {
      // ignore
    }
    return initialState;
  });

  useEffect(() => {
    if (state.token) {
      localStorage.setItem('token', state.token);
      localStorage.setItem('user', JSON.stringify(state.user));
    } else {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
  }, [state.token, state.user]);

  return (
    <AuthContext.Provider value={{ ...state, dispatch }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
