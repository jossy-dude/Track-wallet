export interface HelpCategoryCard {
  icon: string;
  title: string;
  detail: string;
  tone: string;
  sections: readonly HelpGuideSection[];
}

export interface HelpArticleFaq {
  id: string;
  question: string;
  answer: string;
}

export interface HelpGuideSection {
  title: string;
  body: string;
  bullets?: readonly string[];
}

export const helpCategoryCards: readonly HelpCategoryCard[] = [
  {
    icon: "rocket_launch",
    title: "Getting Started",
    detail:
      "Understand SMS capture, Inbox review, and how approved entries become dashboard balances.",
    tone: "bg-primary-container text-on-primary-container",
    sections: [
      {
        title: "1. Capture the first message",
        body:
          "Track Wallet starts with incoming SMS. If a message matches an existing parser template, it becomes a draft in Inbox instead of going straight into your ledger.",
        bullets: [
          "Matched SMS becomes an Inbox draft",
          "Unmatched SMS stays visible for manual review",
          "Nothing changes your balances before approval",
        ],
      },
      {
        title: "2. Review inside Inbox",
        body:
          "Inbox is the trust gate. Edit title, amount, category, account, or note before approving anything that will affect tracked balances.",
      },
      {
        title: "3. Approve to update the app",
        body:
          "Ledger, dashboard totals, budgets, and account summaries only update after approval. That keeps parser mistakes from silently rewriting your finance history.",
      },
    ],
  },
  {
    icon: "code_blocks",
    title: "Parsing Rules",
    detail:
      "Learn how templates, regex previews, and unmatched review work when bank messages change.",
    tone: "bg-tertiary-container text-on-tertiary-container",
    sections: [
      {
        title: "How matching works",
        body:
          "The parser compares sender labels and message patterns against known templates. If the wording shifts, Track Wallet keeps the message in review instead of forcing a bad guess.",
      },
      {
        title: "When to edit parsing logic",
        body:
          "Open the parser workspace when the same bank keeps landing in unmatched review or when titles and categories drift after a wording change.",
        bullets: [
          "Confirm the raw SMS first",
          "Preview the parsed result in the sandbox",
          "Queue the test result back into Inbox before trusting the change",
        ],
      },
      {
        title: "Safe parser workflow",
        body:
          "Treat parser editing as a controlled tool. Save the rule locally, test it on real examples, then approve the resulting Inbox draft like any other finance entry.",
      },
    ],
  },
  {
    icon: "send_to_mobile",
    title: "SMS Forwarding",
    detail:
      "Set up trusted desktop routing and fallback recipients without sending data to the cloud by default.",
    tone: "bg-secondary-container text-on-secondary-container",
    sections: [
      {
        title: "Trusted desktop handoff",
        body:
          "Use Sync and Connect Device first, then configure forwarding recipients after a trusted route exists. The desktop authority should be the primary path whenever possible.",
      },
      {
        title: "Fallback recipients",
        body:
          "Peer recipients are useful when you need a second phone or person in the loop. Add only people who should legitimately see raw financial notifications.",
      },
      {
        title: "Privacy note",
        body:
          "This mobile build is still local-first. Treat forwarding controls as intent configuration until backend transport and audit logging are fully wired.",
      },
    ],
  },
  {
    icon: "security",
    title: "Security & Devices",
    detail:
      "Review biometric access, trusted device pairing, and what the current mobile build can verify locally.",
    tone: "bg-error-container text-on-error-container",
    sections: [
      {
        title: "Biometric access",
        body:
          "Biometrics should protect Inbox review, profile export, and forwarding changes. In the current mobile build, this page saves security intent locally while deeper OS checks are still being wired.",
      },
      {
        title: "Trusted device pairing",
        body:
          "Use the 6-digit pairing code or nearby discovery to move a device into the trusted route list. Once trusted, it can become your primary sync target.",
        bullets: [
          "Nearby discovery is the fastest path",
          "Manual code entry is the fallback",
          "Remove trust immediately if a device should no longer receive data",
        ],
      },
      {
        title: "Current build limits",
        body:
          "This UI can already store trust state, primary device choice, and local sync activity. Production-grade auth confirmation still belongs to the backend/native pass.",
      },
    ],
  },
] as const;

export const helpFeaturedFaqs: readonly HelpArticleFaq[] = [
  {
    id: "unmatched-sms",
    question: "Why are some SMS messages still unmatched?",
    answer:
      "When a bank changes wording, the message stays in Inbox review instead of being forced into the ledger. That protects your balances from silent parser mistakes and gives you a safe place to inspect the raw message first.",
  },
  {
    id: "approved-balances",
    question: "Why does my dashboard change only after approval?",
    answer:
      "Track Wallet treats Inbox as a staging lane. Balances, budgets, and ledger totals update only after approval so a parser guess does not rewrite your financial history.",
  },
  {
    id: "pair-desktop",
    question: "How do I connect my desktop authority safely?",
    answer:
      "Open Sync & Devices, start local discovery, then pair using the 6-digit code or nearby device action. The current mobile build stores trusted-device state locally and shows which route is primary.",
  },
  {
    id: "forwarding-private",
    question: "Does SMS forwarding send everything to the cloud?",
    answer:
      "No. The current design is local-first. Forwarding surfaces are meant for trusted desktop or fallback recipients, and they should only be treated as fully live when backend transport is wired in.",
  },
] as const;
