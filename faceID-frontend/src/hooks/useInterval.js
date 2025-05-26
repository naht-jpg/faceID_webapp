import { useEffect, useRef } from 'react';

export function useInterval(callback, delay) {
  const savedCallback = useRef();

  // Nhớ lại callback mới mỗi khi nó thay đổi
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Thiết lập interval
  useEffect(() => {
    function tick() {
      savedCallback.current();
    }
    
    if (delay !== null) {
      const id = setInterval(tick, delay);
      return () => clearInterval(id);
    }
  }, [delay]);
}