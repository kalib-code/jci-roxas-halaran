const link = (href, label) => ({ href, label, badge: null });

export function memberNav() {
  return [
    { label: null, links: [link("/members", "Home"), link("/members/card", "My card"), link("/members/profile", "Profile")] },
    { label: "Growth", links: [link("/members/passport", "Passport"), link("/members/events", "My events")] },
    { label: "Chapter", links: [link("/members/directory", "Directory"), link("/members/library", "Library")] },
  ];
}
