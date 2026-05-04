export interface HelpCategoryCard {
  icon: string;
  title: string;
  detail: string;
  tone: string;
  statusLabel: string;
  sections: readonly HelpGuideSection[];
}

export interface HelpArticleFaq {
  id: string;
  question: string;
  summary: string;
  answer: string;
  tag: string;
}

export interface HelpGuideSection {
  title: string;
  body: string;
  bullets?: readonly string[];
  availability?: "available" | "coming-soon";
  previewNote?: string;
}

export const helpCategoryCards: readonly HelpCategoryCard[] = [
  {
    icon: "inbox",
    title: "Capture & Inbox",
    detail:
      "How SMS becomes a draft and why approval comes first.",
    tone: "bg-primary-container text-on-primary-container",
    statusLabel: "Live now",
    sections: [
      {
        title: "How capture actually works",
        body:
          "Track Wallet treats an incoming bank message as evidence, not an automatic balance change. The parser suggests a draft, then Inbox waits for your review.",
        bullets: [
          "Raw SMS stays attached",
          "Unmatched messages stay visible",
          "Balances wait for approval",
        ],
      },
      {
        title: "What to check before approval",
        body:
          "Confirm amount, direction, account, purpose, and category. This is the last clean checkpoint before Home, Ledger, and Accounts update.",
        bullets: [
          "Debit or credit",
          "Correct account source",
          "Add context if needed",
        ],
      },
      {
        title: "If something looks wrong",
        body:
          "Do not approve just to clear the queue. Compare the raw SMS first, then edit the draft or parser rule.",
      },
    ],
  },
  {
    icon: "grid_view",
    title: "Home & Accounts",
    detail:
      "How totals, account drill-in, and approval timing fit together.",
    tone: "bg-secondary-container text-on-secondary-container",
    statusLabel: "Live now",
    sections: [
      {
        title: "Why the Home total can look delayed",
        body:
          "Home stays conservative. A new SMS does not change totals until its Inbox draft is approved.",
      },
      {
        title: "Detailed total balance behavior",
        body:
          "When detailed balance is enabled, one tap expands the card and a double tap opens Accounts. In this build, the preference saves locally on the phone.",
        bullets: [
          "Single tap expands detail",
          "Double tap opens Accounts",
          "Preference is local-only for now",
        ],
      },
      {
        title: "Reading account differences",
        body:
          "If Home and Accounts do not align, check for Inbox drafts or entries tied to the wrong account reference.",
      },
    ],
  },
  {
    icon: "code_blocks",
    title: "Parsing Rules",
    detail:
      "When to trust a template, pause it, or update it.",
    tone: "bg-tertiary-container text-on-tertiary-container",
    statusLabel: "Live now",
    sections: [
      {
        title: "When a parser rule needs attention",
        body:
          "Repeated unmatched SMS, wrong categories, or weak titles usually mean the bank changed wording or the template is too broad.",
      },
      {
        title: "Safe editing workflow",
        body:
          "Test the pattern, preview the result, then queue it back to Inbox. Parser edits still move through the same human approval lane.",
        bullets: [
          "Confirm the sender label first",
          "Preview the extracted amount and direction",
          "Queue it back into Inbox",
        ],
      },
      {
        title: "What this mobile build does not fake",
        body:
          "The mobile UI can explain parsing and stage review actions, but deeper rule governance still belongs to the authority/backend side.",
      },
    ],
  },
  {
    icon: "devices",
    title: "Security & Devices",
    detail:
      "Biometrics, trusted pairing, and what is still deferred.",
    tone: "bg-[#eadfce] text-[#6d5d3f]",
    statusLabel: "Mixed readiness",
    sections: [
      {
        title: "Biometric access",
        body:
          "Biometrics in this build represent local intent for protecting Inbox review and sensitive settings on the phone.",
      },
      {
        title: "Trusted device pairing",
        body:
          "Use the 6-digit pairing code or nearby discovery to move a device into the trusted route list.",
        bullets: [
          "Nearby discovery is the fastest path",
          "Manual code entry is the fallback",
          "Remove trust if the device should no longer receive data",
        ],
      },
      {
        title: "Remote revocation timeline",
        body:
          "A full remote revocation history and authority-backed incident log are not ready in this mobile pass yet.",
        availability: "coming-soon",
        previewNote:
          "Coming soon: authority-backed revoke history, challenge failures, and the last confirmed route change.",
      },
    ],
  },
  {
    icon: "manage_search",
    title: "Exports, backups, and recovery",
    detail:
      "What is local-only now and what recovery work is still staged.",
    tone: "bg-surface-container-high text-on-surface",
    statusLabel: "Partially staged",
    sections: [
      {
        title: "Local-first expectation",
        body:
          "Several settings and profile actions in this mobile pass save intent locally on the phone. That is useful, but it is not the same as export or recovery wiring.",
      },
      {
        title: "What you can rely on today",
        body:
          "Treat local save feedback as confirmation that this device stored the preference. Do not assume cloud backup or cross-device propagation unless the app says the route is live.",
      },
      {
        title: "Recovery playbook",
        body:
          "Backup packages, restore drills, and recovery receipts are still being defined outside this mobile UI slice.",
        availability: "coming-soon",
        previewNote:
          "Coming soon: backup checks, restore prerequisites, and a plain-language recovery checklist.",
      },
    ],
  },
] as const;

export const helpFeaturedFaqs: readonly HelpArticleFaq[] = [
  {
    id: "home-total-approval",
    question: "Why didn't my home total change after I received an SMS?",
    summary:
      "Home totals follow approved history.",
    answer:
      "Incoming messages become Inbox drafts first, so Home totals stay unchanged until you review and approve the entry. That prevents a parser guess or malformed SMS from silently rewriting your confirmed balance story.",
    tag: "Home totals",
  },
  {
    id: "review-before-approve",
    question: "What should I check before I approve an Inbox draft?",
    summary:
      "Use Inbox as the trust gate.",
    answer:
      "Confirm the amount, transaction direction, account reference, title, and category against the raw SMS. If any of those look off, fix the draft or leave it in review instead of pushing a bad entry into Ledger and Accounts.",
    tag: "Inbox review",
  },
  {
    id: "desktop-trust",
    question: "When should I trust a desktop for sync?",
    summary:
      "Only trust devices that should legitimately receive your finance activity.",
    answer:
      "Pair the desktop through nearby discovery or the 6-digit code, then verify it is the machine you expect before making it the primary route. If the device is shared, unfamiliar, or no longer under your control, do not keep it trusted.",
    tag: "Trusted devices",
  },
  {
    id: "local-only-settings",
    question: "Which settings in this build are still local-only?",
    summary:
      "Some controls are polished but not yet authority-backed.",
    answer:
      "Profile edits, appearance preferences, and some security intent screens currently save on this phone to keep the interface honest and usable. They should not be treated as globally synced behavior until the app explicitly says the authority layer is involved.",
    tag: "Local-only",
  },
] as const;
