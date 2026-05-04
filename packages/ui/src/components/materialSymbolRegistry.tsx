import type { ReactNode } from "react";

import type { MaterialSymbolName } from "../types";

type IconRenderer = (filled: boolean) => ReactNode;

interface MaterialSymbolAsset {
  content: ReactNode;
  isFallback: boolean;
}

const strokeProps = {
  stroke: "currentColor",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function strokeWidth(filled: boolean) {
  return filled ? 2.15 : 1.8;
}

function iconFrame(label: string) {
  return label
    .split("_")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2) || "?";
}

const iconAliases: Record<string, string> = {
  account_balance_wallet: "payments",
  auto_delete: "delete",
  code_blocks: "code",
  devices: "computer",
  dns: "database",
  edit_note: "edit",
  insights: "bar_chart",
  labs: "science",
  lock_person: "shield_lock",
  manage_search: "search",
  monitoring: "bar_chart",
  open_in_new: "north_east",
  phone_iphone: "smartphone",
  phonelink_lock: "smartphone",
  security: "shield_lock",
  settings_suggest: "settings",
  task_alt: "check_circle",
  terminal: "code",
  verified_user: "shield_lock",
  view_list: "grid_view",
  webhook: "hub",
};

const iconRenderers: Record<string, IconRenderer> = {
  account_balance: (filled) => (
    <>
      <path
        d={filled ? "M4 8h16v10.5H4zM3 7h18L12 3 3 7Z" : "M4 9h16M6.5 9v7M10 9v7M14 9v7M17.5 9v7M3 7h18L12 3 3 7Zm2 9h14M4 19h16"}
        fill={filled ? "currentColor" : "none"}
        {...(!filled ? { ...strokeProps, strokeWidth: strokeWidth(filled) } : {})}
      />
    </>
  ),
  add: (filled) => (
    <path
      d="M12 5v14M5 12h14"
      {...strokeProps}
      strokeWidth={strokeWidth(filled)}
    />
  ),
  arrow_back: (filled) => (
    <path
      d="M20 12H7m0 0 5-5m-5 5 5 5"
      {...strokeProps}
      strokeWidth={strokeWidth(filled)}
    />
  ),
  arrow_forward: (filled) => (
    <path
      d="M4 12h13m0 0-5-5m5 5-5 5"
      {...strokeProps}
      strokeWidth={strokeWidth(filled)}
    />
  ),
  article: (filled) => (
    <>
      <path
        d={filled ? "M6 4h9l3 3v13H6z" : "M7 4.5h8.5L18 7v12.5H7z"}
        fill={filled ? "currentColor" : "none"}
        {...(!filled ? { ...strokeProps, strokeWidth: strokeWidth(filled) } : {})}
      />
      <path d="M9 10h6M9 13h6M9 16h4.5" {...strokeProps} strokeWidth={1.7} />
    </>
  ),
  bar_chart: (filled) => (
    filled ? (
      <>
        <rect x="5" y="11" width="3" height="8" rx="1" fill="currentColor" />
        <rect x="10.5" y="7" width="3" height="12" rx="1" fill="currentColor" />
        <rect x="16" y="4" width="3" height="15" rx="1" fill="currentColor" />
      </>
    ) : (
      <>
        <path d="M5 19V11M12 19V7M19 19V4" {...strokeProps} strokeWidth={strokeWidth(filled)} />
        <path d="M4 19h16" {...strokeProps} strokeWidth={1.6} />
      </>
    )
  ),
  calendar_month: (filled) => (
    <>
      <rect
        x="4.5"
        y="6"
        width="15"
        height="13.5"
        rx="2.5"
        fill={filled ? "currentColor" : "none"}
        {...(!filled ? { ...strokeProps, strokeWidth: strokeWidth(filled) } : {})}
      />
      <path d="M8 4.5v3M16 4.5v3M4.5 9.5h15" {...strokeProps} strokeWidth={1.7} />
      <path d="M8.25 12.5h.01M12 12.5h.01M15.75 12.5h.01M8.25 15.75h.01M12 15.75h.01M15.75 15.75h.01" {...strokeProps} strokeWidth={1.9} />
    </>
  ),
  category: (filled) => (
    filled ? (
      <>
        <rect x="4.5" y="4.5" width="6.5" height="6.5" rx="1.5" fill="currentColor" />
        <rect x="13" y="4.5" width="6.5" height="6.5" rx="1.5" fill="currentColor" opacity="0.88" />
        <rect x="4.5" y="13" width="6.5" height="6.5" rx="1.5" fill="currentColor" opacity="0.88" />
        <rect x="13" y="13" width="6.5" height="6.5" rx="1.5" fill="currentColor" />
      </>
    ) : (
      <>
        <rect x="4.5" y="4.5" width="6.5" height="6.5" rx="1.5" {...strokeProps} strokeWidth={1.7} />
        <rect x="13" y="4.5" width="6.5" height="6.5" rx="1.5" {...strokeProps} strokeWidth={1.7} />
        <rect x="4.5" y="13" width="6.5" height="6.5" rx="1.5" {...strokeProps} strokeWidth={1.7} />
        <rect x="13" y="13" width="6.5" height="6.5" rx="1.5" {...strokeProps} strokeWidth={1.7} />
      </>
    )
  ),
  check: (filled) => (
    <path
      d="m5 12.5 4 4L19 7.5"
      {...strokeProps}
      strokeWidth={strokeWidth(filled)}
    />
  ),
  check_circle: (filled) => (
    filled ? (
      <>
        <circle cx="12" cy="12" r="9" fill="currentColor" />
        <path d="m7.6 12.3 2.7 2.8 5.9-6" fill="none" stroke="#faf6f0" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" />
      </>
    ) : (
      <>
        <circle cx="12" cy="12" r="8.5" {...strokeProps} strokeWidth={1.7} />
        <path d="m7.8 12.2 2.4 2.6 5.8-5.9" {...strokeProps} strokeWidth={1.9} />
      </>
    )
  ),
  chevron_right: (filled) => (
    <path
      d="m9 6 6 6-6 6"
      {...strokeProps}
      strokeWidth={strokeWidth(filled)}
    />
  ),
  close: (filled) => (
    <path
      d="M6 6l12 12M18 6 6 18"
      {...strokeProps}
      strokeWidth={strokeWidth(filled)}
    />
  ),
  code: (filled) => (
    <>
      <path d="m8.5 8.5-4 3.5 4 3.5M15.5 8.5l4 3.5-4 3.5M13 6l-2 12" {...strokeProps} strokeWidth={strokeWidth(filled)} />
    </>
  ),
  computer: (filled) => (
    <>
      <rect
        x="4.5"
        y="5.5"
        width="15"
        height="10.5"
        rx="2"
        fill={filled ? "currentColor" : "none"}
        {...(!filled ? { ...strokeProps, strokeWidth: 1.7 } : {})}
      />
      <path d="M9 19h6M12 16v3" {...strokeProps} strokeWidth={1.7} />
      {filled ? <rect x="7.5" y="8.2" width="9" height="4.6" rx="1.1" fill="#faf6f0" opacity="0.22" /> : null}
    </>
  ),
  content_copy: (filled) => (
    <>
      <rect x="7.5" y="7.5" width="10" height="11" rx="2" fill={filled ? "currentColor" : "none"} {...(!filled ? { ...strokeProps, strokeWidth: 1.7 } : {})} />
      <path d="M6.5 15.5H6A2 2 0 0 1 4 13.5V6.2a2 2 0 0 1 2-2h7.3" {...strokeProps} strokeWidth={1.7} />
    </>
  ),
  database: (filled) => (
    filled ? (
      <>
        <ellipse cx="12" cy="6.5" rx="6.5" ry="2.8" fill="currentColor" />
        <path d="M5.5 6.5v8.8c0 1.55 2.9 2.8 6.5 2.8s6.5-1.25 6.5-2.8V6.5" fill="currentColor" />
        <ellipse cx="12" cy="15.3" rx="6.5" ry="2.8" fill="#faf6f0" opacity="0.2" />
      </>
    ) : (
      <>
        <ellipse cx="12" cy="6.5" rx="6.5" ry="2.8" {...strokeProps} strokeWidth={1.7} />
        <path d="M5.5 6.5v8.8c0 1.55 2.9 2.8 6.5 2.8s6.5-1.25 6.5-2.8V6.5" {...strokeProps} strokeWidth={1.7} />
        <path d="M5.5 10.8c0 1.55 2.9 2.8 6.5 2.8s6.5-1.25 6.5-2.8M5.5 15.2c0 1.55 2.9 2.8 6.5 2.8s6.5-1.25 6.5-2.8" {...strokeProps} strokeWidth={1.5} />
      </>
    )
  ),
  delete: (filled) => (
    <>
      <path d="M8 6h8M10 6V4.5h4V6M6.5 6h11l-1 12h-9z" fill={filled ? "currentColor" : "none"} {...(!filled ? { ...strokeProps, strokeWidth: 1.7 } : {})} />
      <path d="M10 9.5v5M14 9.5v5" {...strokeProps} strokeWidth={1.6} />
    </>
  ),
  edit: (filled) => (
    <>
      <path d="m6 16.5 1.2-4.1L15.6 4a1.7 1.7 0 0 1 2.4 0l2 2a1.7 1.7 0 0 1 0 2.4l-8.4 8.4L7 18z" fill={filled ? "currentColor" : "none"} {...(!filled ? { ...strokeProps, strokeWidth: 1.7 } : {})} />
      <path d="m13.8 5.8 4.4 4.4M6 18h4.2" {...strokeProps} strokeWidth={1.6} />
    </>
  ),
  extension: (filled) => (
    <>
      <path d="M9.5 4.5h5a2 2 0 0 1 2 2v2.1a2.1 2.1 0 1 1 0 4.2v2.2a2 2 0 0 1-2 2h-2.1a2.1 2.1 0 1 1-4.2 0H6.5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h2.1a2.1 2.1 0 1 1 4.2 0H14.5a2 2 0 0 0 0-4h-5z" fill={filled ? "currentColor" : "none"} {...(!filled ? { ...strokeProps, strokeWidth: 1.6 } : {})} />
    </>
  ),
  fiber_manual_record: () => <circle cx="12" cy="12" r="5" fill="currentColor" />,
  filter_alt: (filled) => (
    filled ? (
      <path d="M5 6h14l-5.5 6v5.5l-3-1.6V12z" fill="currentColor" />
    ) : (
      <path d="M5 6h14l-5.5 6v5.5l-3-1.6V12z" {...strokeProps} strokeWidth={1.7} />
    )
  ),
  fingerprint: (filled) => (
    <>
      <path d="M12 6.2a4.3 4.3 0 0 0-4.3 4.3v1.8M12 4a6.5 6.5 0 0 0-6.5 6.5v2.7M12 8.5a2.2 2.2 0 0 1 2.2 2.2v2.8M16.5 10.7v2.8A8 8 0 0 1 12 21M9.2 14.2v1.6A5 5 0 0 0 12 20M6.3 13.7v1a6.7 6.7 0 0 0 2.1 4.8" {...strokeProps} strokeWidth={filled ? 2 : 1.7} />
    </>
  ),
  grid_view: (filled) => (
    filled ? (
      <>
        <rect x="5" y="5" width="6" height="6" rx="1.4" fill="currentColor" />
        <rect x="13" y="5" width="6" height="6" rx="1.4" fill="currentColor" opacity="0.88" />
        <rect x="5" y="13" width="6" height="6" rx="1.4" fill="currentColor" opacity="0.88" />
        <rect x="13" y="13" width="6" height="6" rx="1.4" fill="currentColor" />
      </>
    ) : (
      <>
        <rect x="5" y="5" width="6" height="6" rx="1.4" {...strokeProps} strokeWidth={1.7} />
        <rect x="13" y="5" width="6" height="6" rx="1.4" {...strokeProps} strokeWidth={1.7} />
        <rect x="5" y="13" width="6" height="6" rx="1.4" {...strokeProps} strokeWidth={1.7} />
        <rect x="13" y="13" width="6" height="6" rx="1.4" {...strokeProps} strokeWidth={1.7} />
      </>
    )
  ),
  hub: (filled) => (
    <>
      <circle cx="12" cy="12" r={filled ? "2.8" : "2.2"} fill="currentColor" />
      <circle cx="6" cy="7" r="1.8" fill="currentColor" opacity="0.9" />
      <circle cx="18" cy="7" r="1.8" fill="currentColor" opacity="0.9" />
      <circle cx="6" cy="17" r="1.8" fill="currentColor" opacity="0.9" />
      <circle cx="18" cy="17" r="1.8" fill="currentColor" opacity="0.9" />
      <path d="M7.5 8.2 10 10M16.5 8.2 14 10M7.5 15.8 10 14M16.5 15.8 14 14" {...strokeProps} strokeWidth={1.6} />
    </>
  ),
  inbox: (filled) => (
    filled ? (
      <path d="M5 6h14l2 10H15l-2 3h-2l-2-3H3L5 6Z" fill="currentColor" />
    ) : (
      <path d="M5 6h14l2 10H15l-2 3h-2l-2-3H3L5 6Z" {...strokeProps} strokeWidth={1.7} />
    )
  ),
  info: (filled) => (
    <>
      {filled ? <circle cx="12" cy="12" r="9" fill="currentColor" /> : <circle cx="12" cy="12" r="8.5" {...strokeProps} strokeWidth={1.7} />}
      <path d="M12 10v5" {...(filled ? { stroke: "#faf6f0" } : strokeProps)} strokeLinecap="round" strokeWidth={1.8} />
      <circle cx="12" cy="7.2" r="1.1" fill={filled ? "#faf6f0" : "currentColor"} />
    </>
  ),
  key: (filled) => (
    <>
      <circle cx="9" cy="12" r="3.2" fill={filled ? "currentColor" : "none"} {...(!filled ? { ...strokeProps, strokeWidth: 1.7 } : {})} />
      <path d="M12 12h7M16 12v2M18.5 12v2" {...strokeProps} strokeWidth={1.8} />
    </>
  ),
  keyboard_arrow_down: (filled) => (
    <path d="m7 10 5 5 5-5" {...strokeProps} strokeWidth={strokeWidth(filled)} />
  ),
  keyboard_arrow_up: (filled) => (
    <path d="m7 14 5-5 5 5" {...strokeProps} strokeWidth={strokeWidth(filled)} />
  ),
  language: (filled) => (
    <>
      <circle cx="12" cy="12" r="8.5" fill={filled ? "currentColor" : "none"} {...(!filled ? { ...strokeProps, strokeWidth: 1.7 } : {})} />
      <path d="M3.8 12h16.4M12 3.8a13.8 13.8 0 0 1 0 16.4M12 3.8a13.8 13.8 0 0 0 0 16.4" {...strokeProps} strokeWidth={1.5} />
    </>
  ),
  lock: (filled) => (
    <>
      <rect x="6" y="10.2" width="12" height="9.3" rx="2.2" fill={filled ? "currentColor" : "none"} {...(!filled ? { ...strokeProps, strokeWidth: 1.7 } : {})} />
      <path d="M8.4 10.2V8.4A3.6 3.6 0 0 1 12 4.8a3.6 3.6 0 0 1 3.6 3.6v1.8" {...strokeProps} strokeWidth={1.7} />
      <circle cx="12" cy="14.6" r="1.2" fill={filled ? "#faf6f0" : "currentColor"} />
    </>
  ),
  menu_book: (filled) => (
    <>
      <path d="M5 5.5h6.5A2.5 2.5 0 0 1 14 8v10.5H7.5A2.5 2.5 0 0 0 5 21zM19 5.5h-6.5A2.5 2.5 0 0 0 10 8v10.5h6.5A2.5 2.5 0 0 1 19 21z" fill={filled ? "currentColor" : "none"} {...(!filled ? { ...strokeProps, strokeWidth: 1.5 } : {})} />
      <path d="M10 8.4c.8-.7 1.7-1 2.5-1H19M5 7.4h6.5c.8 0 1.7.3 2.5 1" {...strokeProps} strokeWidth={1.4} />
    </>
  ),
  north_east: (filled) => (
    <>
      <path d="M8 16 16 8M10 8h6v6" {...strokeProps} strokeWidth={strokeWidth(filled)} />
    </>
  ),
  palette: (filled) => (
    <>
      <path d="M12 4.5c-4.7 0-8.5 3.4-8.5 7.6 0 3.3 2.3 5.9 5.2 5.9H11a1.7 1.7 0 0 0 0-3.4h-1.3c-1 0-1.8-.7-1.8-1.6 0-.7.4-1.2 1.1-1.5l1.7-.7c.8-.3 1.3-1 1.3-1.8 0-1-.8-1.8-1.8-1.8Z" fill={filled ? "currentColor" : "none"} {...(!filled ? { ...strokeProps, strokeWidth: 1.6 } : {})} />
      <circle cx="8.2" cy="9" r="1" fill="currentColor" />
      <circle cx="11" cy="7.2" r="1" fill="currentColor" />
      <circle cx="14" cy="7.6" r="1" fill="currentColor" />
      <circle cx="15.8" cy="10.2" r="1" fill="currentColor" />
    </>
  ),
  payments: (filled) => (
    <>
      <rect x="4.5" y="7" width="15" height="10" rx="2.4" fill={filled ? "currentColor" : "none"} {...(!filled ? { ...strokeProps, strokeWidth: 1.7 } : {})} />
      <path d="M4.5 10h15M8 14h3" {...strokeProps} strokeWidth={1.6} />
    </>
  ),
  person: (filled) => (
    <>
      <circle cx="12" cy="8.2" r="3" fill={filled ? "currentColor" : "none"} {...(!filled ? { ...strokeProps, strokeWidth: 1.7 } : {})} />
      <path d="M6 19c1.1-2.4 3.3-3.8 6-3.8s4.9 1.4 6 3.8" {...strokeProps} strokeWidth={1.8} />
    </>
  ),
  person_add: (filled) => (
    <>
      <circle cx="10" cy="8.2" r="2.8" fill={filled ? "currentColor" : "none"} {...(!filled ? { ...strokeProps, strokeWidth: 1.7 } : {})} />
      <path d="M4.8 19c1-2.2 3.1-3.5 5.4-3.5 1 0 2 .2 2.8.7M17.5 8.5v5M15 11h5" {...strokeProps} strokeWidth={1.7} />
    </>
  ),
  photo_camera: (filled) => (
    <>
      <path d="M6.5 8.5h3l1.4-2h2.2l1.4 2h3A2.5 2.5 0 0 1 20 11v6.5a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5V11a2.5 2.5 0 0 1 2.5-2.5Z" fill={filled ? "currentColor" : "none"} {...(!filled ? { ...strokeProps, strokeWidth: 1.7 } : {})} />
      <circle cx="12" cy="13.3" r="3.1" fill={filled ? "#faf6f0" : "none"} {...(!filled ? { ...strokeProps, strokeWidth: 1.7 } : {})} />
    </>
  ),
  receipt_long: (filled) => (
    <>
      <path d="M7 4.5h10v15l-1.7-1-1.5 1-1.8-1-1.8 1-1.5-1-1.7 1z" fill={filled ? "currentColor" : "none"} {...(!filled ? { ...strokeProps, strokeWidth: 1.6 } : {})} />
      <path d="M9 9h6M9 12h6M9 15h4.5" {...strokeProps} strokeWidth={1.6} />
    </>
  ),
  remove_circle: (filled) => (
    filled ? (
      <>
        <circle cx="12" cy="12" r="9" fill="currentColor" />
        <path d="M8 12h8" stroke="#faf6f0" strokeLinecap="round" strokeWidth="2" />
      </>
    ) : (
      <>
        <circle cx="12" cy="12" r="8.5" {...strokeProps} strokeWidth={1.7} />
        <path d="M8 12h8" {...strokeProps} strokeWidth={1.9} />
      </>
    )
  ),
  rule: (filled) => (
    <>
      <path d="M6.5 5.5H18v13H6.5z" fill={filled ? "currentColor" : "none"} {...(!filled ? { ...strokeProps, strokeWidth: 1.6 } : {})} />
      <path d="m8.5 10 1.4 1.4 2.6-2.8M8.5 14h7" {...strokeProps} strokeWidth={1.6} />
    </>
  ),
  schedule: (filled) => (
    <>
      <circle cx="12" cy="12" r="8.5" fill={filled ? "currentColor" : "none"} {...(!filled ? { ...strokeProps, strokeWidth: 1.7 } : {})} />
      <path d="M12 8v4.2l2.8 1.8" {...(filled ? { stroke: "#faf6f0" } : strokeProps)} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </>
  ),
  science: (filled) => (
    <>
      <path d="M9 4.5h6M11 4.5v4.4l-4.6 7.2a2.2 2.2 0 0 0 1.9 3.4h7.4a2.2 2.2 0 0 0 1.9-3.4L13 8.9V4.5" fill={filled ? "currentColor" : "none"} {...(!filled ? { ...strokeProps, strokeWidth: 1.6 } : {})} />
      <path d="M9.2 13.2h5.6M8.3 15.6h7.4" {...strokeProps} strokeWidth={1.5} />
    </>
  ),
  search: (filled) => (
    <>
      <circle cx="10.5" cy="10.5" r={filled ? "4.5" : "4"} fill={filled ? "currentColor" : "none"} {...(!filled ? { ...strokeProps, strokeWidth: 1.7 } : {})} />
      <path d="m14 14 5 5" {...strokeProps} strokeWidth={1.9} />
    </>
  ),
  settings: (filled) => (
    <>
      <circle cx="12" cy="12" r={filled ? "3.4" : "2.7"} fill={filled ? "currentColor" : "none"} {...(!filled ? { ...strokeProps, strokeWidth: 1.7 } : {})} />
      <path d="M12 4.5v2.4M12 17.1v2.4M4.5 12h2.4M17.1 12h2.4M6.8 6.8l1.7 1.7M15.5 15.5l1.7 1.7M17.2 6.8l-1.7 1.7M8.5 15.5l-1.7 1.7" {...strokeProps} strokeWidth={1.7} />
      <circle cx="12" cy="12" r="7" {...strokeProps} strokeWidth={1.4} />
    </>
  ),
  shield_lock: (filled) => (
    <>
      <path d="M12 4.5 18 7v4.6c0 3.5-2.2 6.6-6 7.9-3.8-1.3-6-4.4-6-7.9V7z" fill={filled ? "currentColor" : "none"} {...(!filled ? { ...strokeProps, strokeWidth: 1.6 } : {})} />
      <rect x="9.1" y="10.4" width="5.8" height="4.6" rx="1.1" fill={filled ? "#faf6f0" : "none"} {...(!filled ? { ...strokeProps, strokeWidth: 1.4 } : {})} />
      <path d="M10.3 10.4V9.5A1.7 1.7 0 0 1 12 7.8a1.7 1.7 0 0 1 1.7 1.7v.9" {...(filled ? { stroke: "#faf6f0" } : strokeProps)} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.4" />
    </>
  ),
  smartphone: (filled) => (
    <>
      <rect x="7.2" y="3.8" width="9.6" height="16.4" rx="2.2" fill={filled ? "currentColor" : "none"} {...(!filled ? { ...strokeProps, strokeWidth: 1.7 } : {})} />
      <path d="M10 6h4M11.1 17.5h1.8" {...strokeProps} strokeWidth={1.4} />
    </>
  ),
  sms: (filled) => (
    <>
      <path d="M5.2 6h13.6A2.2 2.2 0 0 1 21 8.2v7.1a2.2 2.2 0 0 1-2.2 2.2H10l-4.8 3v-3.1H5.2A2.2 2.2 0 0 1 3 15.3V8.2A2.2 2.2 0 0 1 5.2 6Z" fill={filled ? "currentColor" : "none"} {...(!filled ? { ...strokeProps, strokeWidth: 1.6 } : {})} />
      <path d="m7 9.5 5 4 5-4" {...strokeProps} strokeWidth={1.5} />
    </>
  ),
  sms_failed: (filled) => (
    <>
      <path d="M5.2 6h13.6A2.2 2.2 0 0 1 21 8.2v7.1a2.2 2.2 0 0 1-2.2 2.2H10l-4.8 3v-3.1H5.2A2.2 2.2 0 0 1 3 15.3V8.2A2.2 2.2 0 0 1 5.2 6Z" fill={filled ? "currentColor" : "none"} {...(!filled ? { ...strokeProps, strokeWidth: 1.6 } : {})} />
      <path d="M12 9v3.2M12 14.8h.01" {...strokeProps} strokeWidth={1.9} />
    </>
  ),
  sync: (filled) => (
    <>
      <path d="M7.2 8.5H4.5V5.8M16.8 15.5h2.7v2.7" {...strokeProps} strokeWidth={1.8} />
      <path d="M5 10a7 7 0 0 1 12.1-2.5L19 9.3M19 14a7 7 0 0 1-12.1 2.5L5 14.7" {...strokeProps} strokeWidth={strokeWidth(filled)} />
    </>
  ),
  tag: (filled) => (
    <>
      <path d="M5 10.2V5h5.2L19 13.8 13.8 19z" fill={filled ? "currentColor" : "none"} {...(!filled ? { ...strokeProps, strokeWidth: 1.6 } : {})} />
      <circle cx="8.2" cy="8.2" r="1.1" fill={filled ? "#faf6f0" : "currentColor"} />
    </>
  ),
  toggle_on: (filled) => (
    <>
      <rect x="3.5" y="7.5" width="17" height="9" rx="4.5" fill={filled ? "currentColor" : "none"} {...(!filled ? { ...strokeProps, strokeWidth: 1.6 } : {})} />
      <circle cx={filled ? "15.5" : "8.5"} cy="12" r="3.2" fill={filled ? "#faf6f0" : "currentColor"} />
    </>
  ),
  tune: (filled) => (
    <>
      <path d="M5 7h8M15.5 7H19M5 12h4M11.5 12H19M5 17h9M16.5 17H19" {...strokeProps} strokeWidth={1.7} />
      <circle cx="14.2" cy="7" r={filled ? "1.9" : "1.6"} fill="currentColor" />
      <circle cx="9.2" cy="12" r={filled ? "1.9" : "1.6"} fill="currentColor" />
      <circle cx="15.2" cy="17" r={filled ? "1.9" : "1.6"} fill="currentColor" />
    </>
  ),
  upload_file: (filled) => (
    <>
      <path d="M7 4.5h9l3 3v12H7z" fill={filled ? "currentColor" : "none"} {...(!filled ? { ...strokeProps, strokeWidth: 1.6 } : {})} />
      <path d="M12 17V10.2M9.5 12.8 12 10.2l2.5 2.6" {...(filled ? { stroke: "#faf6f0" } : strokeProps)} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </>
  ),
  warning: (filled) => (
    filled ? (
      <>
        <path d="M12 4.2 21 19H3z" fill="currentColor" />
        <path d="M12 9.2v4.5M12 16.6h.01" stroke="#faf6f0" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      </>
    ) : (
      <>
        <path d="M12 4.2 21 19H3z" {...strokeProps} strokeWidth={1.7} />
        <path d="M12 9.2v4.5M12 16.6h.01" {...strokeProps} strokeWidth={1.9} />
      </>
    )
  ),
  wifi: (filled) => (
    <>
      <path d="M4.5 9.8a11 11 0 0 1 15 0M7.6 13a6.7 6.7 0 0 1 8.8 0M10.7 16.2a2.5 2.5 0 0 1 2.6 0" {...strokeProps} strokeWidth={strokeWidth(filled)} />
      <circle cx="12" cy="18.5" r="1.2" fill="currentColor" />
    </>
  ),
};

function renderFallbackIcon(name: MaterialSymbolName) {
  return (
    <>
      <rect
        x="4.25"
        y="4.25"
        width="15.5"
        height="15.5"
        rx="4.2"
        {...strokeProps}
        strokeWidth={1.6}
      />
      <text
        x="12"
        y="12.45"
        fill="currentColor"
        fontFamily="system-ui, sans-serif"
        fontSize="6.4"
        fontWeight="700"
        textAnchor="middle"
        dominantBaseline="middle"
      >
        {iconFrame(name)}
      </text>
    </>
  );
}

export function getMaterialSymbolAsset(
  name: MaterialSymbolName,
  filled: boolean,
): MaterialSymbolAsset {
  const resolvedName = iconAliases[name] ?? name;
  const render = iconRenderers[resolvedName];

  if (!render) {
    return {
      content: renderFallbackIcon(name),
      isFallback: true,
    };
  }

  return {
    content: render(filled),
    isFallback: false,
  };
}
