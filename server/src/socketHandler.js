const VerificationJob = require("../models/VerificationJob");

module.exports = function initSockets(io) {
  io.on("connection", (socket) => {
    socket.on("joinJob", async (jobId) => {
      try {
        socket.join(jobId);
        socket.emit("joined", { jobId });

        // If there's an existing job record, emit its current progress/result
        if (jobId) {
          try {
            const job = await VerificationJob.findById(jobId).lean();
            if (job) {
              // Emit progress/state so the client sees the current status immediately
              socket.emit("progress", {
                jobId: job._id.toString(),
                progress: job.progress || 0,
                step: job.stage || job.status || "queued",
              });

              // If job has a persisted result, send it as a complete payload
              if (job.result) {
                socket.emit("complete", {
                  jobId: job._id.toString(),
                  result: job.result,
                });
              }
            }
          } catch (err) {
            console.warn("Failed to load job on join:", err.message);
          }
        }
      } catch (err) {
        console.warn("joinJob handler error:", err.message);
      }
    });
  });
};
