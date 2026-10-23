"use client";

import { reviewDeductionAction } from "@/server/actions";

export function DeductionDecision({ deductionId }: { deductionId: string }) {
  return (
    <div className="decision-buttons">
      <form action={reviewDeductionAction} onSubmit={(event) => {
        if (!window.confirm("هل تريد اعتماد هذا الخصم؟ سيؤثر على المستحق الشهري.")) event.preventDefault();
      }}>
        <input name="deductionId" type="hidden" value={deductionId} />
        <button className="button button-primary button-small" name="decision" value="approved" type="submit">اعتماد</button>
      </form>
      <form action={reviewDeductionAction} onSubmit={(event) => {
        if (!window.confirm("هل تريد رفض هذا الخصم؟")) event.preventDefault();
      }}>
        <input name="deductionId" type="hidden" value={deductionId} />
        <input aria-label="سبب الرفض" minLength={3} name="reason" placeholder="سبب الرفض" required />
        <button className="button button-danger button-small" name="decision" value="rejected" type="submit">رفض</button>
      </form>
    </div>
  );
}
