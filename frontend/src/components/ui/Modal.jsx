import { useEffect, useRef } from "react";
import { X } from "lucide-react";

// El diálogo nativo controla el foco y permite cerrar con Escape sin perder etiquetas accesibles.
export function Modal({ title, children, onClose, busy = false }) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="institution-dialog resource-dialog"
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div className="dialog-heading">
        <h2>{title}</h2>
        <button
          type="button"
          className="icon-button"
          aria-label="Cerrar"
          disabled={busy}
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
