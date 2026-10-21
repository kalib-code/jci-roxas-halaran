const TONES = {
  pending: "wait", requested: "wait", draft: "wait",
  confirmed: "ok", approved: "ok", published: "ok", verified: "ok", attended: "ok",
  rejected: "bad", declined: "bad", cancelled: "bad",
};

export const badgeTone = (status) => TONES[status] ?? "neutral";
