import { useEffect, useRef, useState } from "react";

export const useTimer = (expiresAt, onExpire) => {
  const [seconds, setSeconds] = useState(0);
  const expired = useRef(false);
  const onExpireRef = useRef(onExpire);

  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    if (!expiresAt) return undefined;
    expired.current = false;
    const update = () => {
      const value = Math.max(
        0,
        Math.ceil((new Date(expiresAt) - new Date()) / 1000),
      );
      setSeconds(value);
      if (!value && !expired.current) {
        expired.current = true;
        onExpireRef.current();
      }
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
};
