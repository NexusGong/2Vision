/*
 * 弹窗管理Context
 * 用于统一管理登录、充值等弹窗的显示
 */
import React, { createContext, useContext, ReactNode } from "react";

interface ModalContextType {
  openAuthModal: () => void;
  openPaymentModal: () => void;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const useModal = () => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error("useModal must be used within ModalProvider");
  }
  return context;
};

interface ModalProviderProps {
  children: ReactNode;
  openAuthModal: () => void;
  openPaymentModal: () => void;
}

export const ModalProvider: React.FC<ModalProviderProps> = ({
  children,
  openAuthModal,
  openPaymentModal,
}) => {
  return (
    <ModalContext.Provider
      value={{
        openAuthModal,
        openPaymentModal,
      }}
    >
      {children}
    </ModalContext.Provider>
  );
};
