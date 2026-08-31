"use client";

import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';

// ==========================================
// TYPE DEFINITIONS
// ==========================================

interface User {
  id: string;
  email: string;
  role: string;
  tenant_id: string;
}

interface Member {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  status: string;
  membership?: any;
}

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  category: string;
}

interface ScheduleItem {
  id: string;
  title: string;
  instructor: string;
  room: string;
  day: string;
  time: string;
  conflicts: string[];
}

interface Workflow {
  id: string;
  name: string;
  status: string;
  triggers: string[];
  successRate: number;
}

interface SyncStatus {
  is_syncing: boolean;
  pending_operations: number;
  conflicts: number;
  last_sync: string | null;
}

// ==========================================
// ACTION TYPES
// ==========================================

type AppState = {
  user: User | null;
  isLoading: boolean;
  offline: boolean;
  members: Member[];
  cart: CartItem[];
  schedules: ScheduleItem[];
  workflows: Workflow[];
  syncStatus: SyncStatus;
  selectedMember: Member | null;
  notification: {
    show: boolean;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
  } | null;
};

type AppAction =
  | { type: 'SET_USER'; payload: User | null }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_OFFLINE'; payload: boolean }
  | { type: 'SET_MEMBERS'; payload: Member[] }
  | { type: 'ADD_MEMBER'; payload: Member }
  | { type: 'UPDATE_MEMBER'; payload: { id: string; data: Partial<Member> } }
  | { type: 'REMOVE_MEMBER'; payload: string }
  | { type: 'SET_SELECTED_MEMBER'; payload: Member | null }
  | { type: 'ADD_TO_CART'; payload: CartItem }
  | { type: 'REMOVE_FROM_CART'; payload: string }
  | { type: 'UPDATE_CART_QUANTITY'; payload: { id: string; quantity: number } }
  | { type: 'CLEAR_CART' }
  | { type: 'SET_SCHEDULES'; payload: ScheduleItem[] }
  | { type: 'SET_WORKFLOWS'; payload: Workflow[] }
  | { type: 'SET_SYNC_STATUS'; payload: Partial<SyncStatus> }
  | { type: 'SHOW_NOTIFICATION'; payload: { message: string; type: 'success' | 'error' | 'warning' | 'info' } }
  | { type: 'HIDE_NOTIFICATION' };

// ==========================================
// REDUCER
// ==========================================

const initialState: AppState = {
  user: null,
  isLoading: false,
  offline: false,
  members: [],
  cart: [],
  schedules: [],
  workflows: [],
  syncStatus: {
    is_syncing: false,
    pending_operations: 0,
    conflicts: 0,
    last_sync: null
  },
  selectedMember: null,
  notification: null
};

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_USER':
      return { ...state, user: action.payload };
    
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    
    case 'SET_OFFLINE':
      return { ...state, offline: action.payload };
    
    case 'SET_MEMBERS':
      return { ...state, members: action.payload };
    
    case 'ADD_MEMBER':
      return { ...state, members: [...state.members, action.payload] };
    
    case 'UPDATE_MEMBER':
      return {
        ...state,
        members: state.members.map(member =>
          member.id === action.payload.id
            ? { ...member, ...action.payload.data }
            : member
        )
      };
    
    case 'REMOVE_MEMBER':
      return {
        ...state,
        members: state.members.filter(member => member.id !== action.payload)
      };
    
    case 'SET_SELECTED_MEMBER':
      return { ...state, selectedMember: action.payload };
    
    case 'ADD_TO_CART':
      const existingItem = state.cart.find(item => item.id === action.payload.id);
      if (existingItem) {
        return {
          ...state,
          cart: state.cart.map(item =>
            item.id === action.payload.id
              ? { ...item, quantity: item.quantity + action.payload.quantity }
              : item
          )
        };
      }
      return { ...state, cart: [...state.cart, action.payload] };
    
    case 'REMOVE_FROM_CART':
      return {
        ...state,
        cart: state.cart.filter(item => item.id !== action.payload)
      };
    
    case 'UPDATE_CART_QUANTITY':
      return {
        ...state,
        cart: state.cart.map(item =>
          item.id === action.payload.id
            ? { ...item, quantity: action.payload.quantity }
            : item
        ).filter(item => item.quantity > 0)
      };
    
    case 'CLEAR_CART':
      return { ...state, cart: [] };
    
    case 'SET_SCHEDULES':
      return { ...state, schedules: action.payload };
    
    case 'SET_WORKFLOWS':
      return { ...state, workflows: action.payload };
    
    case 'SET_SYNC_STATUS':
      return { ...state, syncStatus: { ...state.syncStatus, ...action.payload } };
    
    case 'SHOW_NOTIFICATION':
      return {
        ...state,
        notification: {
          show: true,
          message: action.payload.message,
          type: action.payload.type
        }
      };
    
    case 'HIDE_NOTIFICATION':
      return { ...state, notification: null };
    
    default:
      return state;
  }
}

// ==========================================
// CONTEXT
// ==========================================

const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  actions: {
    setUser: (user: User | null) => void;
    setLoading: (loading: boolean) => void;
    setOffline: (offline: boolean) => void;
    setMembers: (members: Member[]) => void;
    addMember: (member: Member) => void;
    updateMember: (id: string, data: Partial<Member>) => void;
    removeMember: (id: string) => void;
    setSelectedMember: (member: Member | null) => void;
    addToCart: (item: CartItem) => void;
    removeFromCart: (id: string) => void;
    updateCartQuantity: (id: string, quantity: number) => void;
    clearCart: () => void;
    setSchedules: (schedules: ScheduleItem[]) => void;
    setWorkflows: (workflows: Workflow[]) => void;
    setSyncStatus: (status: Partial<SyncStatus>) => void;
    showNotification: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
    hideNotification: () => void;
  };
} | undefined>(undefined);

// ==========================================
// PROVIDER
// ==========================================

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => dispatch({ type: 'SET_OFFLINE', payload: false });
    const handleOffline = () => dispatch({ type: 'SET_OFFLINE', payload: true });

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Set initial status
    dispatch({ type: 'SET_OFFLINE', payload: !navigator.onLine });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Create action functions
  const actions = {
    setUser: useCallback((user: User | null) => {
      dispatch({ type: 'SET_USER', payload: user });
    }, []),

    setLoading: useCallback((loading: boolean) => {
      dispatch({ type: 'SET_LOADING', payload: loading });
    }, []),

    setOffline: useCallback((offline: boolean) => {
      dispatch({ type: 'SET_OFFLINE', payload: offline });
    }, []),

    setMembers: useCallback((members: Member[]) => {
      dispatch({ type: 'SET_MEMBERS', payload: members });
    }, []),

    addMember: useCallback((member: Member) => {
      dispatch({ type: 'ADD_MEMBER', payload: member });
    }, []),

    updateMember: useCallback((id: string, data: Partial<Member>) => {
      dispatch({ type: 'UPDATE_MEMBER', payload: { id, data } });
    }, []),

    removeMember: useCallback((id: string) => {
      dispatch({ type: 'REMOVE_MEMBER', payload: id });
    }, []),

    setSelectedMember: useCallback((member: Member | null) => {
      dispatch({ type: 'SET_SELECTED_MEMBER', payload: member });
    }, []),

    addToCart: useCallback((item: CartItem) => {
      dispatch({ type: 'ADD_TO_CART', payload: item });
    }, []),

    removeFromCart: useCallback((id: string) => {
      dispatch({ type: 'REMOVE_FROM_CART', payload: id });
    }, []),

    updateCartQuantity: useCallback((id: string, quantity: number) => {
      dispatch({ type: 'UPDATE_CART_QUANTITY', payload: { id, quantity } });
    }, []),

    clearCart: useCallback(() => {
      dispatch({ type: 'CLEAR_CART' });
    }, []),

    setSchedules: useCallback((schedules: ScheduleItem[]) => {
      dispatch({ type: 'SET_SCHEDULES', payload: schedules });
    }, []),

    setWorkflows: useCallback((workflows: Workflow[]) => {
      dispatch({ type: 'SET_WORKFLOWS', payload: workflows });
    }, []),

    setSyncStatus: useCallback((status: Partial<SyncStatus>) => {
      dispatch({ type: 'SET_SYNC_STATUS', payload: status });
    }, []),

    showNotification: useCallback((message: string, type: 'success' | 'error' | 'warning' | 'info') => {
      dispatch({ type: 'SHOW_NOTIFICATION', payload: { message, type } });
    }, []),

    hideNotification: useCallback(() => {
      dispatch({ type: 'HIDE_NOTIFICATION' });
    }, [])
  };

  return (
    <AppContext.Provider value={{ state, dispatch, actions }}>
      {children}
    </AppContext.Provider>
  );
}

// ==========================================
// CUSTOM HOOKS
// ==========================================

export function useAppState() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppState must be used within an AppStateProvider');
  }
  return context;
}

export function useUser() {
  const { state } = useAppState();
  return state.user;
}

export function useMembers() {
  const { state, actions } = useAppState();
  return {
    members: state.members,
    selectedMember: state.selectedMember,
    setMembers: actions.setMembers,
    addMember: actions.addMember,
    updateMember: actions.updateMember,
    removeMember: actions.removeMember,
    setSelectedMember: actions.setSelectedMember
  };
}

export function useCart() {
  const { state, actions } = useAppState();
  const cartTotal = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  return {
    cart: state.cart,
    cartTotal,
    addToCart: actions.addToCart,
    removeFromCart: actions.removeFromCart,
    updateCartQuantity: actions.updateCartQuantity,
    clearCart: actions.clearCart
  };
}

export function useSchedule() {
  const { state, actions } = useAppState();
  return {
    schedules: state.schedules,
    setSchedules: actions.setSchedules
  };
}

export function useWorkflows() {
  const { state, actions } = useAppState();
  return {
    workflows: state.workflows,
    setWorkflows: actions.setWorkflows
  };
}

export function useSync() {
  const { state, actions } = useAppState();
  return {
    syncStatus: state.syncStatus,
    setSyncStatus: actions.setSyncStatus
  };
}

export function useNotification() {
  const { state, actions } = useAppState();
  return {
    notification: state.notification,
    showNotification: actions.showNotification,
    hideNotification: actions.hideNotification
  };
}

export function useOffline() {
  const { state } = useAppState();
  return state.offline;
}