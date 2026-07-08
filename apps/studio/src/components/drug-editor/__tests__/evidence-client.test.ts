import { describe, expect, it, vi } from "vitest";
import {
  attachEvidenceToDrug,
  detachEvidenceFromDrug,
  fetchDrugEvidence,
} from "../evidence-client";

const DRUG_ID = "2c31ee65-5805-5693-bdeb-01bb4829b1b9";
const EVIDENCE_ID = "a1000000-0000-4000-8000-000000000001";

function attachmentPayload() {
  return {
    evidence_id: EVIDENCE_ID,
    evidence: {
      id: EVIDENCE_ID,
      title: "Evidence stub",
      evidence_type: "review_article",
      quality_score: 0.75,
    },
    attached_at: "2026-07-08T10:00:00+00:00",
  };
}

function mockClient() {
  return {
    request: vi.fn().mockResolvedValue({ data: [attachmentPayload()], meta: {} }),
  };
}

describe("evidence client route selection", () => {
  it("uses curator slug routes before UUID routes when slug is present", async () => {
    const client = mockClient();

    await fetchDrugEvidence(client as never, {
      drugId: "ramipril",
      entityId: DRUG_ID,
      slug: "ramipril",
    });

    expect(client.request).toHaveBeenCalledWith("/curator/drugs/ramipril/evidence");
    expect(client.request).not.toHaveBeenCalledWith("/drugs/ramipril/evidence");
  });

  it("uses UUID drug routes when slug is absent", async () => {
    const client = mockClient();

    await fetchDrugEvidence(client as never, {
      drugId: "ramipril",
      entityId: DRUG_ID,
      slug: null,
    });

    expect(client.request).toHaveBeenCalledWith(`/drugs/${DRUG_ID}/evidence`);
  });

  it("falls back from entityId to drugId only when drugId is a UUID", async () => {
    const client = mockClient();

    await fetchDrugEvidence(client as never, {
      drugId: DRUG_ID,
      entityId: "draft-only",
      slug: null,
    });

    expect(client.request).toHaveBeenCalledWith(`/drugs/${DRUG_ID}/evidence`);
  });

  it("does not silently fetch the unscoped evidence catalog when drug evidence fails", async () => {
    const client = {
      request: vi.fn().mockRejectedValue(new Error("route failed")),
    };

    await expect(
      fetchDrugEvidence(client as never, {
        drugId: DRUG_ID,
        entityId: DRUG_ID,
        slug: null,
      }),
    ).rejects.toThrow("route failed");

    expect(client.request).toHaveBeenCalledTimes(1);
    expect(client.request).not.toHaveBeenCalledWith(
      "/evidence",
      expect.objectContaining({ params: expect.objectContaining({ drug_id: DRUG_ID }) }),
    );
  });

  it("raises a clear error when neither slug nor UUID can be resolved", async () => {
    const client = mockClient();

    await expect(
      fetchDrugEvidence(client as never, {
        drugId: "ramipril",
        entityId: "draft-only",
        slug: null,
      }),
    ).rejects.toThrow("Cannot resolve drug identity for evidence");

    expect(client.request).not.toHaveBeenCalled();
  });

  it("uses the selected route for attach and detach mutations", async () => {
    const client = {
      request: vi
        .fn()
        .mockResolvedValueOnce({ data: attachmentPayload(), meta: {} })
        .mockResolvedValueOnce({ data: { detached: true }, meta: {} }),
    };
    const context = { drugId: "ramipril", entityId: DRUG_ID, slug: "ramipril" };

    await attachEvidenceToDrug(client as never, context, `evidence:${EVIDENCE_ID}`);
    await detachEvidenceFromDrug(client as never, context, EVIDENCE_ID);

    expect(client.request).toHaveBeenNthCalledWith(1, "/curator/drugs/ramipril/evidence", {
      method: "POST",
      body: { evidence_id: EVIDENCE_ID },
    });
    expect(client.request).toHaveBeenNthCalledWith(
      2,
      `/curator/drugs/ramipril/evidence/${EVIDENCE_ID}`,
      { method: "DELETE" },
    );
  });

  it("hydrates attach responses that only return link metadata", async () => {
    const client = {
      request: vi
        .fn()
        .mockResolvedValueOnce({
          data: { evidence_id: EVIDENCE_ID, drug_id: DRUG_ID, attached: true },
          meta: {},
        })
        .mockResolvedValueOnce({ data: attachmentPayload().evidence, meta: {} }),
    };

    const attachment = await attachEvidenceToDrug(
      client as never,
      { drugId: "ramipril", entityId: DRUG_ID, slug: "ramipril" },
      EVIDENCE_ID,
    );

    expect(attachment.evidence.title).toBe("Evidence stub");
    expect(client.request).toHaveBeenNthCalledWith(2, `/evidence/${EVIDENCE_ID}`);
  });
});
