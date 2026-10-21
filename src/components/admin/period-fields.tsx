type Defaults = {
  name: string;
  startsAt: string;
  endsAt: string;
  prizePoolSol: number;
  payoutSplit: number[];
};

/** Shared inputs for creating and editing a period. Times are Eastern. */
export function PeriodFields({ defaults, disabled = false }: { defaults: Defaults; disabled?: boolean }) {
  return (
    <fieldset disabled={disabled} className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label className="field-label" htmlFor="name">Name</label>
        <input id="name" name="name" className="input" defaultValue={defaults.name} required maxLength={80} />
      </div>
      <div>
        <label className="field-label" htmlFor="startsAt">Starts (Eastern Time)</label>
        <input id="startsAt" name="startsAt" type="datetime-local" className="input" defaultValue={defaults.startsAt} required />
      </div>
      <div>
        <label className="field-label" htmlFor="endsAt">Ends (Eastern Time)</label>
        <input id="endsAt" name="endsAt" type="datetime-local" className="input" defaultValue={defaults.endsAt} required />
      </div>
      <div>
        <label className="field-label" htmlFor="prizePoolSol">Prize pool (SOL)</label>
        <input id="prizePoolSol" name="prizePoolSol" type="number" min="0" step="any" className="input" defaultValue={defaults.prizePoolSol} required />
      </div>
      <div>
        <label className="field-label" htmlFor="payoutSplit">Payout split (% for 1st, 2nd, ...)</label>
        <input
          id="payoutSplit"
          name="payoutSplit"
          className="input"
          defaultValue={defaults.payoutSplit.join(", ")}
          required
          aria-describedby="split-help"
        />
        <p id="split-help" className="mt-1 text-xs text-muted">Comma separated, must add up to 100.</p>
      </div>
    </fieldset>
  );
}
