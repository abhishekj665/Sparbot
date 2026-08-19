import { useEffect, useState } from "react";

export const useTimer = (expiresAt, onExpire) => {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!expiresAt) return undefined;
    const update = () => {
      const value = Math.max(
        0,
        Math.ceil((new Date(expiresAt) - new Date()) / 1000),
      );
      setSeconds(value);
      if (!value) onExpire();
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, onExpire]);
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
};
