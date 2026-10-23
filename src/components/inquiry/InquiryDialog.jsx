import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { InquiryForm } from "./InquiryForm.jsx";

export function InquiryDialog({ title, vehicleTitle, lang, vehicle, onClose }) {
  const dialogRef = useRef(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    const trigger = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    dialog.querySelector("input")?.focus();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      trigger?.focus();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="inquiry-dialog inquiry-native-dialog"
      aria-labelledby={titleId}
      onCancel={onClose}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = [
          ...event.currentTarget.querySelectorAll(
            'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]',
          ),
        ].filter(
          (element) => element.tabIndex >= 0 && element.getClientRects().length,
        );
        const first = controls[0];
        const last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const box = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < box.left ||
          event.clientX > box.right ||
          event.clientY < box.top ||
          event.clientY > box.bottom
        )
          onClose();
      }}
    >
      <button
        className="inquiry-close"
        type="button"
        aria-label={
          lang === "zh" ? "关闭" : lang === "en" ? "Close" : "Закрыть"
        }
        onClick={onClose}
      >
        <X size={20} />
      </button>
      <h2 id={titleId}>{title}</h2>
      <p>{vehicleTitle}</p>
      <InquiryForm lang={lang} vehicle={vehicle} />
    </dialog>
  );
}
