import { createContext, useContext, useReducer } from 'react';

export const ChatContext = createContext(null);

const initialState = { messages: [] };

function chatReducer(state, action) {
  switch (action.type) {
    case 'SET_MESSAGES':
      return { messages: action.payload };
    case 'APPEND_MESSAGE':
      return { messages: [...state.messages, action.payload] };
    default:
      return state;
  }
}

export function ChatProvider({ children }) {
  const [state, dispatch] = useReducer(chatReducer, initialState);

  return (
    <ChatContext.Provider value={{ ...state, dispatch }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  return useContext(ChatContext);
}
