import React, { createContext, useContext, useState, ReactNode } from "react";

interface PinContextType {
  pin: string | null;
  setPin: (pin: string) => void;
  lock: () => void;
  isLocked: boolean;
  hasPinSetup: boolean;
}

const PinContext = createContext<PinContextType | null>(null);

export function PinProvider({ children }: { children: ReactNode }) {
  const [pin, setPinState] = useState<string | null>(null);
  
  const lock = () => {
    setPinState(null);
  };

  const setPin = (newPin: string) => {
    setPinState(newPin);
  };

  return (
    <PinContext.Provider value={{ pin, setPin, lock, isLocked: false, hasPinSetup: true }}>
      {children}
    </PinContext.Provider>
  );
}

export function usePin() {
  const context = useContext(PinContext);
  if (!context) throw new Error("usePin must be used within a PinProvider");
  return context;
}
