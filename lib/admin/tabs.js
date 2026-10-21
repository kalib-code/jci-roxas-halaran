export const pickTab = (value, keys) => (keys.includes(value) ? value : keys[0]);

// One tab per status in `defs` ([key, label] pairs), with its rows, count and optional peso total.
export function statusTabs(rows, defs, { amount = false } = {}) {
  return defs.map(([key, label]) => {
    const list = rows.filter((r) => r.status === key);
    return { key, label, count: list.length, total: amount ? list.reduce((s, r) => s + r.amountCentavos, 0) : null, rows: list };
  });
}
