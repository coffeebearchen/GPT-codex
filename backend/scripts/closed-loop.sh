#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:4000}"

echo "Running closed-loop test against ${BASE_URL}"

SOURCE_RESPONSE=$(curl -sS -X POST "${BASE_URL}/sources" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test Source","source_type":"manual","content":"Hello from source"}')

SOURCE_ID=$(node -e 'const data=JSON.parse(process.argv[1]); if (data.error) { console.error(data); process.exit(1); } if (!data.id) { process.exit(1); } console.log(data.id);' "${SOURCE_RESPONSE}")

DOCUMENT_RESPONSE=$(curl -sS -X POST "${BASE_URL}/documents" \
  -H "Content-Type: application/json" \
  -d "{\"title\":\"Test Document\",\"source_id\":\"${SOURCE_ID}\"}")

DOCUMENT_ID=$(node -e 'const data=JSON.parse(process.argv[1]); if (data.error) { console.error(data); process.exit(1); } if (!data.id) { process.exit(1); } console.log(data.id);' "${DOCUMENT_RESPONSE}")

GENERATE_RESPONSE=$(curl -sS -X POST "${BASE_URL}/documents/${DOCUMENT_ID}/generate")
node -e 'const data=JSON.parse(process.argv[1]); if (data.error) { console.error(data); process.exit(1); } if (data.document?.status !== "generated") { console.error(data); process.exit(1); } if (data.run?.run_type !== "generate") { console.error(data); process.exit(1); }' "${GENERATE_RESPONSE}"

PUBLISH_RESPONSE=$(curl -sS -X POST "${BASE_URL}/documents/${DOCUMENT_ID}/publish")
node -e 'const data=JSON.parse(process.argv[1]); if (data.error) { console.error(data); process.exit(1); } if (data.document?.status !== "published") { console.error(data); process.exit(1); } if (data.run?.run_type !== "publish") { console.error(data); process.exit(1); }' "${PUBLISH_RESPONSE}"

RUNS_RESPONSE=$(curl -sS -X GET "${BASE_URL}/dashboard/runs")
node -e 'const runs=JSON.parse(process.argv[1]); const documentId=process.argv[2]; const types=runs.filter(run=>run.document_id===documentId).map(run=>run.run_type); if(!types.includes("generate") || !types.includes("publish")) { console.error(runs); process.exit(1); }' "${RUNS_RESPONSE}" "${DOCUMENT_ID}"

echo "Closed-loop test passed. Document ID: ${DOCUMENT_ID}"
