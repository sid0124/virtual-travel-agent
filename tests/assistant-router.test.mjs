import test from "node:test"
import assert from "node:assert/strict"
import {
  ASSISTANT_MODES,
  INTENTS,
  detectAssistantIntent,
  getQaClarifier,
  getMissingPlanField,
  applyPlanEntityUpdate,
} from "../lib/assistant-router.js"

test("visa question -> travel_qa and asks nationality/country only", () => {
  const result = detectAssistantIntent("What are visa rules for Japan?")
  assert.equal(result.intent, INTENTS.TRAVEL_QA)
  const clarifier = getQaClarifier(result, {})
  assert.equal(clarifier, "Which nationality/passport do you hold?")
})

test("planning flow interrupted by police number question keeps plan fields", () => {
  const base = {
    origin: "Mumbai",
    destinations: ["London"],
    startDate: "2026-03-10",
    endDate: "2026-03-17",
    travelersCount: 2,
    selectedPlaces: [],
  }
  const missingBefore = getMissingPlanField(base, false)
  assert.equal(missingBefore, null)

  const result = detectAssistantIntent("What is the police helpline in London?", {
    currentMode: ASSISTANT_MODES.PLAN_TRIP,
  })
  assert.equal(result.intent, INTENTS.TRAVEL_QA)

  const unchanged = applyPlanEntityUpdate(base, result.entities)
  assert.equal(unchanged.origin, "Mumbai")
  assert.deepEqual(unchanged.destinations, ["London"])
})

test("mixed query -> mixed intent", () => {
  const result = detectAssistantIntent("Plan my trip to Dubai and tell me visa rules")
  assert.equal(result.intent, INTENTS.MIXED)
})
