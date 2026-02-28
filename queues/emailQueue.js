const Queue = require("bull");
const nodemailer = require("nodemailer");

const emailQueue = new Queue("emailQueue", {
  redis: {
    host: "127.0.0.1",
    port: 6379
  }
});

emailQueue.process(async (job) => {
  const { to, subject, html } = job.data;

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.APP_EMAIL,
      pass: process.env.APP_PASSWORD
    }
  });

  await transporter.sendMail({
    from: process.env.APP_EMAIL,
    to,
    subject,
    html
  });
});

module.exports = emailQueue;