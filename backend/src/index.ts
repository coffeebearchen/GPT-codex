import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config();

const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

const port = Number(process.env.PORT || 4000);

type ErrorDetails = Record<string, unknown>;

function sendError(res: express.Response, status: number, error: string, details?: ErrorDetails) {
  return res.status(status).json(details ? { error, details } : { error });
}

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.post("/sources", async (req, res) => {
  const { title, source_type, content } = req.body;
  if (typeof title !== "string" || !title.trim()) {
    return sendError(res, 400, "Invalid title", { field: "title" });
  }
  if (typeof source_type !== "string" || !source_type.trim()) {
    return sendError(res, 400, "Invalid source_type", { field: "source_type" });
  }
  if (typeof content !== "string" || !content.trim()) {
    return sendError(res, 400, "Invalid content", { field: "content" });
  }

  const source = await prisma.source.create({
    data: {
      title: title.trim(),
      source_type: source_type.trim(),
      content: content.trim()
    }
  });

  return res.status(201).json(source);
});

app.get("/sources", async (_req, res) => {
  const sources = await prisma.source.findMany({ orderBy: { created_at: "desc" } });
  return res.json(sources);
});

app.post("/documents", async (req, res) => {
  const { title, source_id } = req.body;
  if (typeof title !== "string" || !title.trim()) {
    return sendError(res, 400, "Invalid title", { field: "title" });
  }

  if (source_id !== undefined && source_id !== null) {
    if (typeof source_id !== "string" || !source_id.trim()) {
      return sendError(res, 400, "Invalid source_id", { field: "source_id" });
    }
    const source = await prisma.source.findUnique({ where: { id: source_id } });
    if (!source) {
      return sendError(res, 400, "source_id not found", { field: "source_id" });
    }
  }

  const document = await prisma.document.create({
    data: {
      title: title.trim(),
      source_id: source_id ?? null,
      status: "draft",
      body: ""
    }
  });

  return res.status(201).json(document);
});

app.get("/documents", async (_req, res) => {
  const documents = await prisma.document.findMany({ orderBy: { created_at: "desc" } });
  return res.json(documents);
});

app.get("/documents/:id", async (req, res) => {
  const { id } = req.params;
  const document = await prisma.document.findUnique({ where: { id } });
  if (!document) {
    return sendError(res, 404, "document not found");
  }
  return res.json(document);
});

app.post("/documents/:id/generate", async (req, res) => {
  const { id } = req.params;
  const document = await prisma.document.findUnique({ where: { id } });
  if (!document) {
    return sendError(res, 404, "document not found");
  }

  let body = document.body || "";
  if (document.source_id) {
    const source = await prisma.source.findUnique({ where: { id: document.source_id } });
    if (source) {
      body = `${source.content}`;
    }
  }

  const updatedDocument = await prisma.document.update({
    where: { id },
    data: {
      body,
      status: "generated"
    }
  });

  const run = await prisma.run.create({
    data: {
      run_type: "generate",
      status: "success",
      document_id: id,
      message: "Generated content from source"
    }
  });

  return res.json({ document: updatedDocument, run });
});

app.post("/documents/:id/publish", async (req, res) => {
  const { id } = req.params;
  const document = await prisma.document.findUnique({ where: { id } });
  if (!document) {
    return sendError(res, 404, "document not found");
  }

  const updatedDocument = await prisma.document.update({
    where: { id },
    data: {
      status: "published"
    }
  });

  const run = await prisma.run.create({
    data: {
      run_type: "publish",
      status: "success",
      document_id: id,
      message: "Published (simulated)"
    }
  });

  return res.json({ document: updatedDocument, run });
});

app.get("/dashboard", async (_req, res) => {
  const total_documents = await prisma.document.count();
  const published_documents = await prisma.document.count({ where: { status: "published" } });

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const today_runs = await prisma.run.count({
    where: {
      created_at: {
        gte: startOfDay
      }
    }
  });

  return res.json({ total_documents, published_documents, today_runs });
});

app.get("/dashboard/runs", async (_req, res) => {
  const runs = await prisma.run.findMany({
    orderBy: { created_at: "desc" },
    include: { document: true }
  });
  return res.json(runs);
});

app.post("/jobs", async (req, res) => {
  const { job_type, payload_json } = req.body;
  if (!job_type || !payload_json) {
    return sendError(res, 400, "job_type and payload_json are required");
  }

  const job = await prisma.job.create({
    data: {
      job_type,
      payload_json,
      status: "queued"
    }
  });

  return res.status(201).json(job);
});

async function runGenerateJob(documentId: string) {
  const document = await prisma.document.findUnique({ where: { id: documentId } });
  if (!document) {
    throw new Error("document not found");
  }

  let body = document.body || "";
  if (document.source_id) {
    const source = await prisma.source.findUnique({ where: { id: document.source_id } });
    if (source) {
      body = `${source.content}`;
    }
  }

  await prisma.document.update({
    where: { id: documentId },
    data: {
      body,
      status: "generated"
    }
  });

  await prisma.run.create({
    data: {
      run_type: "generate",
      status: "success",
      document_id: documentId,
      message: "Generated content from source"
    }
  });
}

async function runPublishJob(documentId: string) {
  const document = await prisma.document.findUnique({ where: { id: documentId } });
  if (!document) {
    throw new Error("document not found");
  }

  await prisma.document.update({
    where: { id: documentId },
    data: {
      status: "published"
    }
  });

  await prisma.run.create({
    data: {
      run_type: "publish",
      status: "success",
      document_id: documentId,
      message: "Published (simulated)"
    }
  });
}

app.post("/jobs/:id/run", async (req, res) => {
  const { id } = req.params;
  const job = await prisma.job.findUnique({ where: { id } });
  if (!job) {
    return sendError(res, 404, "job not found");
  }

  try {
    await prisma.job.update({
      where: { id },
      data: { status: "running" }
    });

    const payload = job.payload_json as { document_id?: string };
    if (!payload.document_id) {
      throw new Error("payload_json.document_id is required");
    }

    if (job.job_type === "generate") {
      await runGenerateJob(payload.document_id);
    } else if (job.job_type === "publish") {
      await runPublishJob(payload.document_id);
    } else {
      throw new Error("unsupported job_type");
    }

    const updatedJob = await prisma.job.update({
      where: { id },
      data: { status: "done" }
    });

    return res.json(updatedJob);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    const updatedJob = await prisma.job.update({
      where: { id },
      data: { status: "failed" }
    });
    return sendError(res, 400, message, { job: updatedJob });
  }
});

app.listen(port, () => {
  console.log(`API listening on ${port}`);
});
