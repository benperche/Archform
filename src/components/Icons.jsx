// Shared icon components

export function TrashIcon({ size = 12 }) {
  return (
    <svg
      width={size} height={size + 1}
      viewBox="0 0 12 13"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Handle */}
      <path d="M4.5 2.5V1.5h3v1" />
      {/* Lid */}
      <line x1="1" y1="2.5" x2="11" y2="2.5" />
      {/* Body */}
      <path d="M2.2 2.5L2.9 11h6.2L9.8 2.5" />
      {/* Inner lines */}
      <line x1="4.5" y1="4.5" x2="4.5" y2="9.5" />
      <line x1="7.5" y1="4.5" x2="7.5" y2="9.5" />
    </svg>
  );
}
