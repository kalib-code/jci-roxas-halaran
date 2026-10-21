"use client";

import { useState } from "react";
import PledgeForm from "./PledgeForm.jsx";
import PaymentCard from "./PaymentCard.jsx";

export default function PledgePanel({ campaigns, lang = "en" }) {
  const [campaignId, setCampaignId] = useState(campaigns[0] ? String(campaigns[0].id) : "");
  const campaign = campaigns.find((c) => String(c.id) === campaignId) ?? null;
  return (
    <div className="pledge-grid">
      <PaymentCard campaign={campaign} lang={lang} />
      <PledgeForm
        lang={lang}
        campaigns={campaigns.map((c) => ({ id: c.id, title: c.title }))}
        defaultCampaignId={campaigns[0] ? String(campaigns[0].id) : ""}
        onCampaignChange={setCampaignId}
      />
    </div>
  );
}
