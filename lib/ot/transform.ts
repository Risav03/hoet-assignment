import type { OTOperation, OTInsert, OTDelete } from "./types";

/**
 * Transform opA so that it can be applied after opB has already been applied.
 *
 * Returns a new operation (opA is not mutated). Position tie-breaking for
 * concurrent inserts at the same position uses clientId lexicographic order —
 * the client with the "smaller" id goes first, so the other shifts right.
 */
export function transform(opA: OTOperation, opB: OTOperation): OTOperation {
  if (opA.type === "insert" && opB.type === "insert") {
    return transformInsertInsert(opA, opB);
  }
  if (opA.type === "insert" && opB.type === "delete") {
    return transformInsertDelete(opA, opB);
  }
  if (opA.type === "delete" && opB.type === "insert") {
    return transformDeleteInsert(opA, opB);
  }
  if (opA.type === "delete" && opB.type === "delete") {
    return transformDeleteDelete(opA, opB);
  }
  return opA;
}

function transformInsertInsert(opA: OTInsert, opB: OTInsert): OTInsert {
  if (opA.position > opB.position) {
    return { ...opA, position: opA.position + opB.text.length };
  }
  // Same position: tie-break by clientId so both clients converge to same order
  if (opA.position === opB.position && opA.clientId > opB.clientId) {
    return { ...opA, position: opA.position + opB.text.length };
  }
  return opA;
}

function transformInsertDelete(opA: OTInsert, opB: OTDelete): OTInsert {
  if (opA.position > opB.position) {
    const shift = Math.min(opA.position - opB.position, opB.length);
    return { ...opA, position: opA.position - shift };
  }
  return opA;
}

function transformDeleteInsert(opA: OTDelete, opB: OTInsert): OTDelete {
  if (opA.position >= opB.position) {
    return { ...opA, position: opA.position + opB.text.length };
  }
  return opA;
}

function transformDeleteDelete(opA: OTDelete, opB: OTDelete): OTDelete {
  if (opA.position > opB.position) {
    const overlap = Math.max(
      0,
      Math.min(opA.position + opA.length, opB.position + opB.length) -
        Math.max(opA.position, opB.position)
    );
    return {
      ...opA,
      position: Math.max(opB.position, opA.position - opB.length),
      length: Math.max(0, opA.length - overlap),
    };
  }
  if (opA.position === opB.position) {
    // opB deleted from here — shrink or collapse opA
    const remaining = Math.max(0, opA.length - opB.length);
    return { ...opA, length: remaining };
  }
  // opA.position < opB.position — opA starts before opB
  if (opA.position + opA.length > opB.position) {
    // opB overlaps the tail of opA — trim opA's length
    const overlap = Math.min(
      opA.position + opA.length - opB.position,
      opB.length
    );
    return { ...opA, length: opA.length - overlap };
  }
  return opA;
}
