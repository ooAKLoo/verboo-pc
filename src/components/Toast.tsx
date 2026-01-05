import { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, Camera } from 'lucide-react';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'screenshot';
  duration?: number;
  position?: 'top' | 'bottom';
  onClose: () => void;
}

export function Toast({ message, type = 'success', duration = 2000, position = 'bottom', onClose }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    // Trigger enter animation
    requestAnimationFrame(() => setIsVisible(true));

    const timer = setTimeout(() => {
      setIsLeaving(true);
      setTimeout(onClose, 200);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const icons = {
    success: <CheckCircle2 size={16} strokeWidth={2} />,
    error: <AlertCircle size={16} strokeWidth={2} />,
    screenshot: <Camera size={16} strokeWidth={2} />
  };

  const styles = {
    success: 'bg-[#18181b] text-white',
    error: 'bg-[#dc2626] text-white',
    screenshot: 'bg-[#18181b] text-white'
  };

  const positionClasses = position === 'top'
    ? 'fixed top-[10px] left-1/2 -translate-x-1/2 z-[100] pointer-events-none'
    : 'fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] pointer-events-none';

  const animationClasses = isVisible && !isLeaving
    ? 'opacity-100 translate-y-0'
    : position === 'top'
      ? 'opacity-0 -translate-y-2'
      : 'opacity-0 translate-y-2';

  return (
    <div className={positionClasses}>
      <div
        className={`
          flex items-center gap-2.5 px-4 py-2.5 rounded-full shadow-lg
          ${styles[type]}
          transition-all duration-200 ease-out
          ${animationClasses}
        `}
      >
        <span className="flex-shrink-0 opacity-80">{icons[type]}</span>
        <span className="text-[13px] font-medium whitespace-nowrap">{message}</span>
      </div>
    </div>
  );
}

// Toast Container for managing multiple toasts
interface ToastItem {
  id: string;
  message: string;
  type: 'success' | 'error' | 'screenshot';
}

interface ToastContainerProps {
  toasts: ToastItem[];
  onRemove: (id: string) => void;
}

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  return (
    <>
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => onRemove(toast.id)}
        />
      ))}
    </>
  );
}
